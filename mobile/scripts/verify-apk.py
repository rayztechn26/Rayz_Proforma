"""Verify this project's APK archive, binary manifest and v2 signature/content digest.

Requires Python 3 and cryptography. This is an artifact check, not device execution
or a replacement for Android's installer/apksigner policy checks.
Signing format: https://source.android.com/docs/security/features/apksigning/v2
"""
import hashlib
import json
import struct
import sys
import zipfile
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, ec


def u32(b, p=0):
    return struct.unpack_from('<I', b, p)[0]


def lp(b, p=0):
    n = u32(b, p)
    assert p + 4 + n <= len(b), 'Invalid length prefix'
    return b[p + 4:p + 4 + n], p + 4 + n


def records(b):
    p = 0
    while p < len(b):
        item, p = lp(b, p)
        yield item


def manifest_root(b):
    strings = []
    p = 8
    while p < len(b):
        typ, header, size = struct.unpack_from('<HHI', b, p)
        assert size >= header > 0
        if typ == 1:
            count, _, flags, start, _ = struct.unpack_from('<IIIII', b, p + 8)
            def length8(q):
                n = b[q]
                return (((n & 127) << 8) | b[q + 1], q + 2) if n & 128 else (n, q + 1)
            for i in range(count):
                q = p + start + u32(b, p + header + i * 4)
                if flags & 256:
                    _, q = length8(q)
                    n, q = length8(q)
                    strings.append(b[q:q + n].decode('utf8'))
                else:
                    n = struct.unpack_from('<H', b, q)[0]
                    q += 2
                    if n & 32768:
                        n = ((n & 32767) << 16) | struct.unpack_from('<H', b, q)[0]
                        q += 2
                    strings.append(b[q:q + n * 2].decode('utf-16le'))
        if typ == 0x102 and strings[u32(b, p + 20)] == 'manifest':
            start, width, count = struct.unpack_from('<HHH', b, p + 24)
            result = {}
            for i in range(count):
                q = p + 16 + start + i * width
                name, raw = u32(b, q + 4), u32(b, q + 8)
                result[strings[name]] = strings[raw] if raw != 0xffffffff else u32(b, q + 16)
            return result, strings
        p += size
    raise AssertionError('Manifest root missing')


def verify(path, expected_version=None):
    data = Path(path).read_bytes()
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        assert len(names) == len(set(names)), 'Duplicate ZIP entries'
        assert z.testzip() is None, 'ZIP CRC failure'
        assert 'classes.dex' in names and 'assets/index.android.bundle' in names
        root, strings = manifest_root(z.read('AndroidManifest.xml'))
        assert root['package'] == 'com.proformastudio.app'
        assert int(root['versionCode']) >= 1
        if expected_version is not None:
            assert int(root['versionCode']) == expected_version
        assert 'android.intent.action.MAIN' in strings
    end = data.rfind(b'PK\x05\x06', max(0, len(data) - 65557))
    assert end >= 0
    assert end + 22 + struct.unpack_from('<H', data, end + 20)[0] == len(data)
    cd = u32(data, end + 16)
    assert cd + u32(data, end + 12) == end
    assert data[cd - 16:cd] == b'APK Sig Block 42'
    size = struct.unpack_from('<Q', data, cd - 24)[0]
    start = cd - size - 8
    assert start >= 0 and struct.unpack_from('<Q', data, start)[0] == size
    p = start + 8
    blocks = {}
    while p < cd - 24:
        n = struct.unpack_from('<Q', data, p)[0]
        assert n >= 4 and p + 8 + n <= cd - 24
        blocks[u32(data, p + 8)] = data[p + 12:p + 8 + n]
        p += 8 + n
    assert 0x7109871a in blocks, 'No v2 signature block'
    signers, last = lp(blocks[0x7109871a])
    assert last == len(blocks[0x7109871a])
    certificates = []
    for signer in records(signers):
        signed, p = lp(signer)
        signatures, p = lp(signer, p)
        keybytes, p = lp(signer, p)
        assert p == len(signer)
        digests, p = lp(signed)
        certs, p = lp(signed, p)
        cert = x509.load_der_x509_certificate(next(records(certs)))
        key = serialization.load_der_public_key(keybytes)
        assert cert.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo) == keybytes
        sigs = [(u32(x), lp(x, 4)[0]) for x in records(signatures)]
        digs = [(u32(x), lp(x, 4)[0]) for x in records(digests)]
        assert [x[0] for x in sigs] == [x[0] for x in digs]
        supported = [x for x in sigs if x[0] in (0x101, 0x102, 0x103, 0x104, 0x201, 0x202)]
        assert supported
        alg, signature = max(supported, key=lambda x: x[0] in (0x102, 0x104, 0x202))
        h = hashes.SHA512() if alg in (0x102, 0x104, 0x202) else hashes.SHA256()
        if alg in (0x101, 0x102):
            key.verify(signature, signed, padding.PSS(mgf=padding.MGF1(h), salt_length=h.digest_size), h)
        elif alg in (0x103, 0x104):
            key.verify(signature, signed, padding.PKCS1v15(), h)
        else:
            key.verify(signature, signed, ec.ECDSA(h))
        tail = bytearray(data[end:])
        struct.pack_into('<I', tail, 16, start)
        chunks = []
        for section in (data[:start], data[cd:end], bytes(tail)):
            for q in range(0, len(section), 1 << 20):
                chunk = section[q:q + (1 << 20)]
                chunks.append(hashlib.new(h.name, b'\xa5' + struct.pack('<I', len(chunk)) + chunk).digest())
        digest = hashlib.new(h.name, b'\x5a' + struct.pack('<I', len(chunks)) + b''.join(chunks)).digest()
        assert digest == dict(digs)[alg], 'APK content digest mismatch'
        certificates.append(cert.fingerprint(hashes.SHA256()).hex())
    assert certificates
    return {'package':root['package'], 'versionName':root.get('versionName'), 'versionCode':root['versionCode'], 'zipEntries':len(names), 'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest(), 'v2SignatureAndContentDigestVerified':True, 'certificateSha256':certificates}


if __name__ == '__main__':
    print(json.dumps(verify(sys.argv[1], int(sys.argv[2]) if len(sys.argv)>2 else None), indent=2))

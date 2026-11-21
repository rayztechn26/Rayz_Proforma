"""Resolve the installed application label from an APK's binary manifest/resources."""
import json
import struct
import sys
import zipfile


def chunks(blob, start, stop):
    while start < stop:
        kind, header, size = struct.unpack_from('<HHI', blob, start)
        assert size >= header >= 8 and start + size <= stop
        yield start, kind, header, size
        start += size


def pool(blob, offset):
    kind, header, size = struct.unpack_from('<HHI', blob, offset)
    assert kind == 1
    count, _, flags, start, _ = struct.unpack_from('<IIIII', blob, offset + 8)
    result = []
    for i in range(count):
        p = offset + start + struct.unpack_from('<I', blob, offset + header + 4*i)[0]
        def length8(p):
            n = blob[p]
            return (((n & 127) << 8) | blob[p+1], p+2) if n & 128 else (n, p+1)
        if flags & 256:
            _, p = length8(p)
            n, p = length8(p)
            result.append(blob[p:p+n].decode('utf-8'))
        else:
            n = struct.unpack_from('<H', blob, p)[0]; p += 2
            if n & 32768:
                n = ((n & 32767) << 16) | struct.unpack_from('<H', blob, p)[0]; p += 2
            result.append(blob[p:p+n*2].decode('utf-16le'))
    return result


def application_label(manifest):
    strings = None
    for p, kind, header, size in chunks(manifest, 8, len(manifest)):
        if kind == 1:
            strings = pool(manifest, p)
        if kind == 0x102 and strings[struct.unpack_from('<I', manifest, p+20)[0]] == 'application':
            start, width, count = struct.unpack_from('<HHH', manifest, p+24)
            for i in range(count):
                q = p + 16 + start + i*width
                name, raw = struct.unpack_from('<II', manifest, q+4)
                if strings[name] == 'label':
                    return (3, strings[raw]) if raw != 0xffffffff else (manifest[q+15], struct.unpack_from('<I', manifest, q+16)[0])
    raise AssertionError('Application label not found')


def resource_strings(blob, resource):
    global_strings = None
    found = []
    for p, kind, header, size in chunks(blob, struct.unpack_from('<H', blob, 2)[0], len(blob)):
        if kind == 1:
            global_strings = pool(blob, p)
        if kind != 0x200 or struct.unpack_from('<I', blob, p+8)[0] != resource >> 24:
            continue
        type_offset = struct.unpack_from('<I', blob, p+284)[0] if header >= 288 else 0
        for t, typ, th, ts in chunks(blob, p+header, p+size):
            if typ != 0x201 or blob[t+8] + type_offset != (resource >> 16) & 255:
                continue
            flags = blob[t+9]
            count, entries_start = struct.unpack_from('<II', blob, t+12)
            target = resource & 65535
            entry_offset = None
            if flags & 1:
                for i in range(count):
                    index, offset = struct.unpack_from('<HH', blob, t+th+i*4)
                    if index == target:
                        entry_offset = offset*4; break
            elif target < count:
                if flags & 2:
                    offset = struct.unpack_from('<H', blob, t+th+target*2)[0]
                    if offset != 65535: entry_offset = offset*4
                else:
                    offset = struct.unpack_from('<I', blob, t+th+target*4)[0]
                    if offset != 0xffffffff: entry_offset = offset
            if entry_offset is None:
                continue
            e = t+entries_start+entry_offset
            entry_size, entry_flags = struct.unpack_from('<HH', blob, e)
            assert not entry_flags & 1, 'Complex label resource'
            value = e+entry_size
            value_type = blob[value+3]
            data = struct.unpack_from('<I', blob, value+4)[0]
            if value_type == 3:
                found.append(global_strings[data])
            elif value_type == 1 and data != resource:
                found.extend(resource_strings(blob, data))
    return found


with zipfile.ZipFile(sys.argv[1]) as apk:
    kind, value = application_label(apk.read('AndroidManifest.xml'))
    labels = [value] if kind == 3 else resource_strings(apk.read('resources.arsc'), value)
    assert labels, 'Unable to resolve application label'
    if len(sys.argv) > 2:
        assert all(label == sys.argv[2] for label in labels), labels
    print(json.dumps({'applicationLabels': sorted(set(labels)), 'compiledManifestLabelVerified': True}, indent=2))

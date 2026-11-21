from pathlib import Path
import hashlib,json,zipfile

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/launch-pack';WEB=OUT/'website';QA=ROOT/'tmp/launch-qa'
checks=json.loads((QA/'browser-checks.json').read_text())
pdfs=json.loads((QA/'pdf-checks.json').read_text())
assert len(checks['website'])==12 and not checks['errors']
assert sum(p['pages'] for p in pdfs)==20
assert len(list((WEB/'assets/screenshots').glob('*.png')))==24
texts=[p for p in OUT.rglob('*') if p.is_file() and p.suffix in ['.html','.md','.txt','.json','.js','.css']]
for p in texts:
    s=p.read_text(encoding='utf-8')
    assert not any(marker in s for marker in ['APP_KEY=','DB_PASSWORD=','-----BEGIN PRIVATE KEY-----','-----BEGIN RSA PRIVATE KEY-----']),p
(OUT/'VERIFICATION.md').write_text('''# Launch pack verification

- Five PDFs, 20 pages total: two eight-page user guides, a two-page brochure and two one-page sample proformas.
- All PDF pages rendered and checked for page bounds and replacement glyphs. English and Amharic text and monetary sample totals checked.
- Twenty-four screenshots captured from actual interface components with isolated fictional fixtures. No production API or accounts used.
- Website, privacy notice and screenshot walkthrough checked in EN and AM at 390 px and 1280 px: 12 browser cases. No page errors, missing images or horizontal document overflow. Language switching and previous/next walkthrough controls checked.
- All local website href/src paths verified. External social destinations are owner-supplied and require owner validation of access and ownership.
- APK 2.0.8/code 11 copied unchanged and checked against the previously verified release SHA-256. No new APK or backend release was built.
- Website package contains no SQL, environment files or private keys. Known credential assignment and PEM private-key markers checked in text files.
- This is document/site QA, not a new physical Android acceptance run, hosting deployment, security assessment or legal approval. Privacy content remains a draft.
''',encoding='utf-8')
lines=[]
for file in sorted(OUT.rglob('*')):
    if file.is_file() and file.name!='SHA256SUMS.txt':lines.append(hashlib.sha256(file.read_bytes()).hexdigest()+'  '+file.relative_to(OUT).as_posix())
(OUT/'SHA256SUMS.txt').write_text('\n'.join(lines)+'\n',encoding='utf-8')
for name,folder,prefix in [('Rayz-Proforma-Website-Upload.zip',WEB,''),('Rayz-Proforma-Launch-Pack-EN-AM.zip',OUT,'Rayz-Proforma-Launch-Pack/')]:
    file=ROOT/'artifacts'/name
    with zipfile.ZipFile(file,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in sorted(folder.rglob('*')):
            if p.is_file():z.write(p,prefix+p.relative_to(folder).as_posix())
    with zipfile.ZipFile(file) as z:assert z.testzip() is None
    print(name, file.stat().st_size, 'bytes', 'ZIP integrity passed')

"""Create a source-only release ZIP; excludes runtime data, credentials and caches."""
from pathlib import Path
import hashlib, json, zipfile
root=Path(__file__).resolve().parents[1]
out=root/'artifacts'
out.mkdir(exist_ok=True)
files=set()
files.add(root/'backend/Setup-Administrator.cmd')
def tree(path):
    for p in (root/path).rglob('*'):
        if p.is_file() and not any(x in {'node_modules','__pycache__','.expo'} for x in p.relative_to(root).parts):
            files.add(p)
for p in ['mobile/app','mobile/src','mobile/assets','mobile/modules','mobile/plugins','mobile/scripts','mobile/tests','backend/app','backend/config','backend/routes','backend/resources','backend/public','backend/lang','backend/database/migrations','backend/database/factories','backend/database/seeders','backend/tests','docs','scripts','deploy']:
    tree(p)
for p in ['README.md','.gitignore','mobile/package.json','mobile/package-lock.json','mobile/app.json','mobile/eas.json','mobile/tsconfig.json','mobile/jest.config.cjs','mobile/.gitignore','mobile/.env.example','backend/composer.json','backend/composer.lock','backend/artisan','backend/phpunit.xml','backend/.env.example','backend/.gitignore','backend/.htaccess','backend/bootstrap/app.php','backend/bootstrap/providers.php']:
    files.add(root/p)
for folder in ['backend/storage','backend/bootstrap/cache']:
    files.update((root/folder).rglob('.gitignore'))
records=[]
app=json.loads((root/'mobile/app.json').read_text(encoding='utf8'))['expo']
version=app['version']
target=out/f'Proforma-Studio-{version}-source.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted(files):
        rel=p.relative_to(root).as_posix()
        if p.name=='.env' or p.suffix in {'.pem','.key','.sqlite','.apk'}:raise RuntimeError('Private/runtime file selected')
        blob=p.read_bytes();z.writestr(rel,blob)
        records.append({'path':rel,'sha256':hashlib.sha256(blob).hexdigest(),'bytes':len(blob)})
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    for r in records:assert hashlib.sha256(z.read(r['path'])).hexdigest()==r['sha256']
manifest={'version':version,'androidVersionCode':app['android']['versionCode'],'package':'com.proformastudio.app','sourceSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'files':records,'privateKeysIncluded':False,'runtimeAccountsAndReceiptsIncluded':False}
(out/f'release-manifest-{version}.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(f'Verified {len(records)} source files: {target}')

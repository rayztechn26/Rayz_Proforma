"""Prepare a File Manager/phpMyAdmin release without credentials or runtime data."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,tempfile,zipfile,secrets
root=Path(__file__).resolve().parents[1]
artifacts=root/'artifacts';artifacts.mkdir(exist_ok=True)
stage=Path(tempfile.mkdtemp(prefix='directadmin-build-',dir=artifacts))
app=stage/'backend';app.mkdir()
php=Path('C:/wamp64/bin/php/php8.2.29/php.exe')
composer=Path('C:/ProgramData/ComposerSetup/bin/composer.phar')
env=os.environ.copy();env['OPENSSL_CONF']='C:/wamp64/bin/php/php8.2.29/extras/ssl/openssl.cnf'
for directory in ['app','config','routes','resources','lang','database/migrations']:
    shutil.copytree(root/'backend'/directory,app/directory)
for name in ['artisan','composer.json','composer.lock','.htaccess']:
    shutil.copy2(root/'backend'/name,app/name)
(app/'bootstrap/cache').mkdir(parents=True)
for name in ['app.php','providers.php']:shutil.copy2(root/'backend/bootstrap'/name,app/'bootstrap'/name)
for name in ['storage/app/private','storage/app/public','storage/framework/cache/data','storage/framework/sessions','storage/framework/views','storage/logs']:
    (app/name).mkdir(parents=True,exist_ok=True)
    (app/name/'.gitignore').write_text('*\n!.gitignore\n',encoding='utf8')
(app/'bootstrap/cache/.gitignore').write_text('*\n!.gitignore\n',encoding='utf8')
shutil.copytree(root/'backend/public',app/'public')
(app/'deployment').mkdir()
shutil.copy2(root/'mobile/src/license-keys.json',app/'deployment/mobile-public-keys.json')
shutil.copy2(root/'deploy/production.env.example',app/'.env.example')
subprocess.run([str(php),str(composer),'install','--no-dev','--prefer-dist','--optimize-autoloader','--no-interaction','--no-scripts'],cwd=app,env=env,check=True)
subprocess.run([str(php),str(composer),'check-platform-reqs','--no-dev'],cwd=app,env=env,check=True)
# No cached paths from this Windows workstation are included.
for p in (app/'bootstrap/cache').iterdir():
    if p.name!='.gitignore':raise RuntimeError('Unexpected generated bootstrap cache')
public=stage/'fixed-document-root-public';shutil.copytree(app/'public',public)
shutil.copy2(root/'deploy/directadmin/public-index.php',public/'index.php')
shutil.copy2(root/'deploy/directadmin/app-path.php.example',public/'app-path.php')
shutil.copy2(root/'docs/DIRECTADMIN.md',stage/'START-HERE.md')
shutil.copy2(root/'deploy/production.env.example',stage/'production.env.example')
shutil.copy2(root/'deploy/directadmin/Prepare-Production-Administrator.cmd',stage/'Prepare-Production-Administrator.cmd')
database_dir=stage/'database-import';database_dir.mkdir()
database_file=root/'artifacts/proforma-production-database.sql'
database_report=json.loads((root/'artifacts/directadmin-database-verification.json').read_text(encoding='utf8'))
assert hashlib.sha256(database_file.read_bytes()).hexdigest()==database_report['sha256']
shutil.copy2(database_file,database_dir/database_file.name)
shutil.copy2(root/'artifacts/directadmin-database-verification.json',database_dir/'verification.json')
private=Path('D:/Projects/ProformaApp-secrets/directadmin-production');private.mkdir(parents=True,exist_ok=True)
env_path=private/'.env'
if not env_path.exists():
    import base64
    content=(root/'deploy/production.env.example').read_text(encoding='utf8')
    content=content.replace('APP_KEY=\n','APP_KEY=base64:'+base64.b64encode(secrets.token_bytes(32)).decode()+'\n')
    content=content.replace('DB_DATABASE=proforma_activation','DB_DATABASE=DA_USERNAME_proforma').replace('DB_USERNAME=proforma_service','DB_USERNAME=DA_USERNAME_proforma').replace('DB_PASSWORD=\n','DB_PASSWORD="SET_IN_DIRECTADMIN"\n')
    content=content.replace('LICENSE_KEY_ID=\n','LICENSE_KEY_ID=rayz-2026-01\n').replace('LICENSE_PRIVATE_KEY_PATH=\n','LICENSE_PRIVATE_KEY_PATH=/home/DA_USERNAME/proforma-private/rayz-2026-01.pem\n').replace('LICENSE_PUBLIC_KEYS_PATH=\n','LICENSE_PUBLIC_KEYS_PATH=/home/DA_USERNAME/proforma-private/public-keys.json\n')
    env_path.write_text(content,encoding='utf8')
for name in ['rayz-2026-01.pem','public-keys.json']:
    source=Path('D:/Projects/ProformaApp-secrets')/name
    target=private/name
    if target.exists():
        if target.read_bytes()!=source.read_bytes():raise RuntimeError('Existing private deployment key differs; not overwritten')
    else:shutil.copy2(source,target)
shutil.copy2(root/'deploy/directadmin/Prepare-Production-Administrator.cmd',private/'Prepare-Production-Administrator.cmd')
records=[];target=artifacts/'Proforma-DirectAdmin-2.0.0.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted(stage.rglob('*')):
        if not p.is_file() or '.git' in p.relative_to(stage).parts:continue
        rel=p.relative_to(stage).as_posix()
        if p.name=='.env' or p.suffix in {'.pem','.sqlite','.log'} or (p.suffix=='.sql' and rel!='database-import/proforma-production-database.sql'):raise RuntimeError('Private/runtime file in public release: '+rel)
        if any(x in {'tests','receipts','node_modules'} for x in p.relative_to(stage).parts):raise RuntimeError('Unexpected data in deployment package: '+rel)
        data=p.read_bytes();z.writestr(rel,data);records.append({'path':rel,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    for item in records:assert hashlib.sha256(z.read(item['path'])).hexdigest()==item['sha256']
(artifacts/'directadmin-manifest.json').write_text(json.dumps({'version':'2.0.0','archiveSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'files':records,'secretsIncluded':False,'localAccountsIncluded':False,'stage':str(stage)},indent=2),encoding='utf8')
print('Verified production backend archive: '+str(target))
print('Private files prepared separately; no secret values printed: '+str(private))

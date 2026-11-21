from pathlib import Path
from datetime import datetime
import shutil,zipfile
root=Path(__file__).resolve().parents[1]
target=Path('C:/wamp64/www/backend')
assert target.resolve()==Path('C:/wamp64/www/backend').resolve()
backup=Path('D:/Projects/ProformaApp-backups')/('wamp-backend-before-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True,exist_ok=False)
with zipfile.ZipFile(backup/'backend-private-backup.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in target.rglob('*'):
        if p.is_file() and not any(x in {'vendor','node_modules','.git'} for x in p.relative_to(target).parts):z.write(p,p.relative_to(target))
for folder in ['app','bootstrap','config','database/migrations','database/factories','database/seeders','public','resources','routes','tests']:
    for p in (root/'backend'/folder).rglob('*'):
        if p.is_file() and 'cache' not in p.relative_to(root/'backend').parts:
            dest=target/p.relative_to(root/'backend');dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
for name in ['artisan','composer.json','composer.lock','phpunit.xml','.env.example','.gitignore','.htaccess','Setup-Administrator.cmd']:
    shutil.copy2(root/'backend'/name,target/name)
print('Source synchronized without deleting runtime records or replacing .env.')
print('Private pre-change backup: '+str(backup))

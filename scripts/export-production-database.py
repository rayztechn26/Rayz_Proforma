"""Export and re-import a fresh production schema, never the local working DB."""
from pathlib import Path
import json,os,secrets,subprocess,hashlib
root=Path(__file__).resolve().parents[1]
mysql='C:/wamp64/bin/mysql/mysql8.4.7/bin/mysql.exe'
dump='C:/wamp64/bin/mysql/mysql8.4.7/bin/mysqldump.exe'
php='C:/wamp64/bin/php/php8.2.29/php.exe'
args=['--no-defaults','--host=127.0.0.1','--port=3306','--user=root','--default-character-set=utf8mb4']
def query(sql):return subprocess.run([mysql,*args,'--batch','--skip-column-names'],input=sql,text=True,capture_output=True,check=True).stdout.strip()
name='proforma_release_'+secrets.token_hex(5);restored='proforma_restore_'+secrets.token_hex(5)
created=[]
try:
    for db in [name,restored]:
        query(f'CREATE DATABASE `{db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');created.append(db)
    env=os.environ.copy();env.update({'APP_ENV':'testing','DB_CONNECTION':'mysql','DB_HOST':'127.0.0.1','DB_PORT':'3306','DB_USERNAME':'root','DB_PASSWORD':'','DB_DATABASE':name,'CACHE_STORE':'array','SESSION_DRIVER':'array','OPENSSL_CONF':'C:/wamp64/bin/php/php8.2.29/extras/ssl/openssl.cnf'})
    subprocess.run([php,'artisan','migrate','--force'],cwd=root/'backend',env=env,check=True)
    tables=query(f"SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA='{name}' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;").splitlines()
    assert len(tables)==22
    for table in tables:
        if table!='migrations':assert query(f'SELECT COUNT(*) FROM `{name}`.`{table}`;')=='0'
    common=[dump,*args,'--set-gtid-purged=OFF','--no-tablespaces','--column-statistics=0','--skip-comments','--skip-add-drop-table','--skip-add-locks','--skip-lock-tables']
    schema=subprocess.run([*common,'--no-data',name],capture_output=True,check=True).stdout
    metadata=subprocess.run([*common,'--no-create-info','--complete-insert',name,'migrations'],capture_output=True,check=True).stdout
    sql=b'-- Fresh Proforma Studio schema. Import only into a NEW EMPTY database.\n-- No accounts, test settings, credentials or payment records.\n'+schema+b'\n'+metadata
    text=sql.decode('utf8');upper=text.upper()
    for forbidden in ['DROP DATABASE','DROP TABLE','CREATE USER','CREATE DATABASE','USE `','INSERT INTO `USERS`','INSERT INTO `PAYMENTS`']:
        assert forbidden not in upper,forbidden
    output=root/'artifacts/proforma-production-database.sql';output.write_bytes(sql)
    subprocess.run([mysql,*args,restored],input=sql,capture_output=True,check=True)
    engines=query(f"SELECT COUNT(*) FROM information_schema.tables WHERE TABLE_SCHEMA='{restored}' AND ENGINE='InnoDB';")
    migration_count=query(f'SELECT COUNT(*) FROM `{restored}`.`migrations`;')
    assert engines=='22' and migration_count=='5'
    for table in tables:
        if table!='migrations':assert query(f'SELECT COUNT(*) FROM `{restored}`.`{table}`;')=='0'
    report={'sha256':hashlib.sha256(sql).hexdigest(),'tableCount':22,'engine':'InnoDB','migrationRows':5,'userRows':0,'paymentRows':0,'roundTripImport':'passed','serverVersion':query('SELECT VERSION();')}
    (root/'artifacts/directadmin-database-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print('PASS: fresh production SQL re-imported: 22 InnoDB tables, 5 migrations, no runtime records.')
    print(output)
finally:
    # Only databases with random names created above are removed; never local/user DBs.
    for db in created:
        assert db.startswith(('proforma_release_','proforma_restore_')) and len(db)<40
        query(f'DROP DATABASE `{db}`;')

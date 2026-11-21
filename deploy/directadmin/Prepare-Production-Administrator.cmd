@echo off
set "OPENSSL_CONF=C:\wamp64\bin\php\php8.2.29\extras\ssl\openssl.cnf"
cd /d "D:\Projects\ProformaApp\backend"
"C:\wamp64\bin\php\php8.2.29\php.exe" artisan admin:export-production "D:\Projects\ProformaApp-secrets\directadmin-production\.env" "D:\Projects\ProformaApp-secrets\directadmin-production\production-admin.sql" --phone=+251947833314
pause

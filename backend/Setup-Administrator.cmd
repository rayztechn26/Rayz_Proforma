@echo off
cd /d "%~dp0"
set "OPENSSL_CONF=C:\wamp64\bin\php\php8.2.29\extras\ssl\openssl.cnf"
"C:\wamp64\bin\php\php8.2.29\php.exe" artisan admin:provision +251947833314
pause

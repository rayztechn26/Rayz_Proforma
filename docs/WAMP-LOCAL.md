# Local WAMP installation before deployment

Source workspace: `D:\Projects\ProformaApp\backend`.

Local WAMP copy: `C:\wamp64\www\backend`.

Local admin URL after restarting WAMP: **http://127.0.0.1:8087/admin**.

At the user's request, this workstation's `.env` now enables `ADMIN_LOCAL_TEST_WITHOUT_TOTP=true`. Phone/password login without an authenticator is allowed only when APP_ENV is `local` and the request comes from loopback. Production ignores this flag, and local-test sessions do not satisfy production two-factor authentication. A test administrator was provisioned locally; do not migrate test accounts to hosting. Production environment examples keep the flag false.

The Apache configuration is installed at `C:\wamp64\alias\proforma-local.conf` (source: `deploy/wamp-proforma-local.conf`). It serves only `backend/public`, restricts access to this computer, and selects PHP 8.4.15 through FastCGI for this site. Other WAMP sites retain their existing PHP version. Restart All Services from the WAMP tray after configuration changes; a normal non-elevated terminal cannot restart the administrator-owned Windows service.

Use this URL rather than `/backend/public` under the default WAMP site. Raw `/backend/...` source-folder requests are deliberately blocked. The Laravel admin uses paths from the virtual-host root.

The local `.env` uses MySQL 8.4.7 on port 3306, database `proforma_local`, and a separate service account restricted to this project's local and test databases. Its random password is stored only in local `.env`; it is not printed or included in source packages. Laravel explicitly requests InnoDB, even when the WAMP MySQL server defaults to MyISAM. Transactional tables are necessary for safe payment approvals.

`proforma_local_test` is disposable and is the only database used by the WAMP test suite. Do not point tests at `proforma_local` or any deployed database. The original WAMP folder was backed up privately before synchronization; existing `.env`, APP_KEY, runtime records and signing-key configuration were preserved.

Provision your actual administrator through the local CLI, using your own phone number:

```powershell
Set-Location C:\wamp64\www\backend
$php='C:\wamp64\bin\php\php8.4.15\php.exe'
& $php artisan admin:provision +251YOUR_ADMIN_NUMBER
```

The command privately requests your password. Authenticator enrollment is required when the local-test exception is disabled, and always in production. Set the real payment instructions only after confirming the recipient and fee. The local database starts with payment requests disabled.

Future production URL: **https://proforma.rayztechnology.com**; mobile API URL: **https://proforma.rayztechnology.com/api**. No files have been published to that domain. For production use PHP 8.2+, MySQL/InnoDB, a document root pointing to Laravel `public`, HTTPS, a dedicated database user, secure cookies, private signing/receipt storage and queue workers. Use the production environment example as a template; never copy local database credentials or test accounts to hosting.

# Deploy Proforma Studio with DirectAdmin File Manager and phpMyAdmin

Target: **https://proforma.rayztechnology.com**. This guide does not require SSH or Composer on the hosting server. The ZIP includes production Composer dependencies. Nothing has been uploaded automatically.

## Files prepared on your computer

* `Proforma-DirectAdmin-2.0.0.zip`: production backend and a separate public-folder option. No passwords, APP_KEY, private signing keys, local accounts or receipts.
* `proforma-production-database.sql`: also included under `database-import/` in the ZIP. Fresh schema plus migration metadata. No administrators, customers, payments, licences or test settings. Import into a **new empty database only**. It deliberately contains no DROP DATABASE, DROP TABLE, CREATE USER or database-name selection statements.
* `D:\Projects\ProformaApp-secrets\directadmin-production`: private files, excluded from the ZIP. Contains a new production `.env`/APP_KEY and the matching licence signing files. Keep an encrypted backup of this directory. Do not put it in `public_html`.

Do not upload the local WAMP `.env` or copy `proforma_local`. Its test login is intentionally unsuitable for production. Production requires an enrolled authenticator and a new strong administrator password.

## 1. Prepare the hosting account

In DirectAdmin, select/create the `proforma` subdomain of `rayztechnology.com`. Verify its DNS points to this hosting account. Select **PHP 8.2** for this subdomain. Enable OpenSSL, PDO MySQL, mbstring, fileinfo, GD, cURL, XML and Sodium where available. Configure upload/post body limits to at least 20 MB for base64 company logos; receipt uploads are limited by the app to 5 MB.

Request a Let's Encrypt certificate covering `proforma.rayztechnology.com` through the SSL Certificates screen. Both the panel and API require working HTTPS; do not disable certificate checks or switch production to a local environment to work around an SSL error. Enable HTTP-to-HTTPS redirection in DirectAdmin after the certificate works.

In MySQL Management, create a **new** database and dedicated user, granting access only to that database. DirectAdmin normally prefixes names with the hosting username; copy the exact names shown by the panel. Record the database host/port provided by the host. Do not grant a remote access host for the Android app: the phone calls HTTPS, not MySQL.

## 2. Upload the application without exposing its source

Unzip the deployment archive on your computer first. In File Manager enable viewing hidden files so `.htaccess` and `.env` are visible. Replace every `DA_USERNAME` below with your actual hosting username.

Create `/home/DA_USERNAME/proforma-app` outside every web document root. Upload/extract the **contents of the ZIP's `backend/` folder** there. It contains `artisan`, `app`, `vendor`, `bootstrap`, `public` and other Laravel directories. The ZIP's top-level `START-HERE.md` and other deployment files do not belong in the document root.

Use one of these layouts:

**A — document-root override available (preferred).** In Subdomain Management → Document Root Override, set the HTTP and HTTPS document roots to `/home/DA_USERNAME/proforma-app/public`. The exact allowed path format depends on your host; ask them to set this root if the UI restricts it. Use the normal `backend/public/index.php`. No alternate public files are needed.

**B — document root fixed by the host.** Keep the Laravel core at `/home/DA_USERNAME/proforma-app`. Find the existing document root for the subdomain in DirectAdmin; it may be under `domains/rayztechnology.com/public_html/proforma`, but confirm the actual path in your account. Upload only the **contents** of `fixed-document-root-public/` into that subdomain's document root. Edit its `app-path.php` to return your real absolute `/home/DA_USERNAME/proforma-app` path. This alternate `index.php` loads the private Laravel core and uses the actual public folder for assets. Do not also copy the whole backend into the web root.

If PHP reports `open_basedir` restrictions for the private app folder, ask the host to allow your account's private app directory. Do not move `.env`, vendor or private keys into the public folder to bypass this restriction.

Remove/rename only the subdomain's default welcome `index.html` if it masks the application. Back up existing site files before replacing anything. Do not modify other domains' `public_html` folders. Ensure HTTP and HTTPS use the same application; avoid maintaining a second stale `private_html` copy.

## 3. Import the clean database

Open phpMyAdmin through DirectAdmin. Select the newly created empty database, choose **Import**, and upload `proforma-production-database.sql` from your computer. Do not upload the SQL file into the public website. Verify the import creates **22 InnoDB tables**, with **5 rows in `migrations`** and **0 rows in `users`**.

The SQL uses portable `utf8mb4_unicode_ci` and InnoDB. It was exported and re-imported on MySQL 8.4.7. MySQL 8+ or a maintained MariaDB version with JSON/InnoDB support is needed; the remote hosting engine has not been tested yet. Do not use a MyISAM fallback.

On future upgrades use an incremental migration plan, not this fresh-install SQL. Never reimport a clean schema over business accounts/payment records.

## 4. Upload private configuration and keys

Create `/home/DA_USERNAME/proforma-private` outside all document roots. Upload `rayz-2026-01.pem` and `public-keys.json` from the private local deployment directory into it. The signing key matches the Android app's embedded public key. Never place the `.pem` in `public_html`, the APK or an ordinary shareable ZIP.

Copy the prepared private `.env` from your local private directory into `/home/DA_USERNAME/proforma-app/.env` (the Laravel root). Edit only these deployment values in File Manager:

```dotenv
DB_HOST=YOUR_HOST_DATABASE_HOST
DB_PORT=3306
DB_DATABASE=YOUR_EXACT_DIRECTADMIN_DATABASE_NAME
DB_USERNAME=YOUR_EXACT_DIRECTADMIN_DATABASE_USER
DB_PASSWORD='YOUR_DATABASE_PASSWORD'
LICENSE_PRIVATE_KEY_PATH=/home/DA_USERNAME/proforma-private/rayz-2026-01.pem
LICENSE_PUBLIC_KEYS_PATH=/home/DA_USERNAME/proforma-private/public-keys.json
```

Keep the generated **APP_KEY unchanged**. The production administrator SQL below is encrypted for that exact key. Keep `APP_ENV=production`, `APP_DEBUG=false`, `ADMIN_LOCAL_TEST_WITHOUT_TOTP=false`, `SESSION_SECURE_COOKIE=true` and `SESSION_ENCRYPT=true`. APP_URL is already the correct HTTPS domain. Do not run `key:generate` later or replace this `.env` with the local WAMP one.

Use File Manager permissions so `.env` and the signing `.pem` are readable only by the hosting account/PHP worker (normally 600); private directories normally 700. Public files normally 644 and folders 755. Give the PHP worker write access to `storage` and `bootstrap/cache` using your host's recommended owner/group permissions. Never use 777. Ensure `storage/app/private`, `storage/framework/cache/data`, `storage/framework/sessions`, `storage/framework/views`, `storage/logs` and `bootstrap/cache` exist after ZIP extraction. The package includes marker files to preserve these directories.

No configuration cache from Windows is included, so the uploaded `.env` is read directly. A new installation does not need `artisan migrate` or `key:generate`: the SQL and prepared APP_KEY replace those first-install steps. Do not upload cached files from `bootstrap/cache` or compiled views from WAMP.

## 5. Prepare and import the production administrator

On your computer, run `Prepare-Production-Administrator.cmd` from the private deployment directory. It uses the project's PHP 8.2 runtime and pre-fills your administrator phone. It asks you to choose/confirm a **new strong production password**, enroll a time-based authenticator key and enter a valid six-digit code. No password or raw authenticator key is written to the SQL. The command does not modify any database.

It creates `production-admin.sql` in the same private local directory, with a password hash and an authenticator secret encrypted for the prepared production APP_KEY. In phpMyAdmin select the production database and import that file **once**, after the schema import. Do not put it in the web root or include it in public backups. This creates one administrator and a provisioning audit record, without a public signup/installer route. The local password-only test account is not copied.

Visit `https://proforma.rayztechnology.com/admin/login` and sign in using the complete phone, new password and current authenticator code. Do not use a fixed code. If login fails after importing the administrator, confirm the server uses the matching production APP_KEY and correct database; do not reset the key.

## 6. Configure fees and optional queues

After signing in, open Payment settings and enter the actual ETB fee, merchant/recipient, instructions, support contact and expected waiting period. Payment requests stay disabled until all fields are configured. No real merchant details or price are invented in this package.

Database notification lists and in-panel polling do not require a background worker. Optional background web push requires VAPID keys, permission, HTTPS, a queue and a real device delivery test. It is unconfigured by default.

If the host offers Cron Jobs but no SSH, ask them for the PHP 8.2 CLI path. For example, if it is `/usr/local/php82/bin/php`, create a once-per-minute cron command:

```sh
cd /home/DA_USERNAME/proforma-app && /usr/local/php82/bin/php artisan queue:work --stop-when-empty --max-time=50 --timeout=45 --tries=4 >> /home/DA_USERNAME/proforma-private/queue.log 2>&1
```

Confirm the host allows one-minute cron and a process runtime below a minute. Use one worker; Laravel's database queue reserves jobs transactionally. The PHP path is an example, not a verified path on your account. If the host blocks CLI/cron, leave optional push disabled and use the persistent notification centre. Queue delivery is not claimed until tested.

The `deployment:check` command can also be run once through DirectAdmin Cron Jobs, with output redirected to `/home/DA_USERNAME/proforma-private/deployment-check.log`; then remove that cron job. It checks configuration, database engines/schema, an enrolled admin, fee settings, writable storage and that the licence signing key matches Android. Do not expose it as a public web diagnostic route.

## 7. Verify before sharing the paid APK

* `/admin/login` loads over HTTPS and asks for the authenticator. Wrong credentials show a message on the form.
* `/.env`, `/vendor/autoload.php`, `/storage/logs/laravel.log` and `/proforma-production-database.sql` are inaccessible (403/404). Receipts must only be accessible through authenticated administrator routes.
* Account registration/login, payment submission, persistent admin notice, independent manual approval, one company registration and licence download all work. Use a designated test account/payment investigation workflow; do not fabricate real paid approvals.
* Test the actual Android development/release build, restart in airplane mode and export a proforma. Installing/restoring on another phone must not activate it. JVM/backend tests do not replace physical Keystore checks.
* If using a TLS reverse proxy/CDN and Laravel reports HTTPS required, have the host configure only the correct trusted proxy addresses. Do not disable production HTTPS enforcement or trust arbitrary forwarded headers.

The mobile production API URL is already prepared as `https://proforma.rayztechnology.com/api`; a release APK must be built with this URL after hosting passes checks. Existing unconfigured test APKs do not dynamically change servers.

Keep encrypted backups of the production database, private receipts, `.env`/APP_KEY and signing key. Customer/invoice business ZIPs remain separate from server account backups. Never overwrite production keys during future uploads. Permanent offline licences cannot reliably be revoked on phones that remain offline.

## Official hosting references

DirectAdmin documents [subdomain PHP selection](https://docs.directadmin.com/webservices/php/multiple-php.html), [document-root overrides](https://docs.directadmin.com/webservices/apache/customizing.html), [MySQL management](https://docs.directadmin.com/other-hosting-services/mariadb-mysql/) and [ACME/Let's Encrypt](https://docs.directadmin.com/webservices/ssl/ssl-and-letsencrypt-for-domains.html). Menu names and available permissions depend on the host and skin.


For the 2.0.2 activation repair on an existing deployment, follow `ACTIVATION-REPAIR-2.0.2.md` and use the four-file backend patch. Do not reimport the fresh-install SQL over existing payments, accounts or entitlements. Imunify360 API blocking requires a hosting-side exception separately.

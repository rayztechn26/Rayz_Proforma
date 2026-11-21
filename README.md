# Proforma Studio — manual Telebirr activation

The Android app is in **mobile/**. The Laravel API and responsive administrator panel are in **backend/**. Run their commands from the appropriate directory. Invoice/customer/catalogue data stays in SQLite on the phone; it is not synchronized to Laravel.

For DirectAdmin hosting with File Manager/phpMyAdmin and no SSH, use [the prepared deployment guide](docs/DIRECTADMIN.md), `artifacts/Proforma-DirectAdmin-2.0.0.zip` and the clean production SQL import. Private deployment configuration and keys are stored separately outside this project.

The local WAMP copy is now configured in `C:\wamp64\www\backend`; see [the local WAMP guide](docs/WAMP-LOCAL.md). Its site is `http://127.0.0.1:8087/admin` after WAMP reloads. The planned production domain is `https://proforma.rayztechnology.com`; no deployment has been performed.

The previous free release is preserved at `D:\Projects\ProformaApp-backups\free-v1.0.1-2026-10-19` with its signed APK, source ZIP, hashes and restore guide. Phone business data is separate: export its backup ZIP before installing this paid update. The paid update preserves the original package and SQLite filename, so an upgrade retains records. Existing companies must be linked after an approved payment or an audited administrator grant. There is no automatic free production entitlement.

Version 2.0.8 (Android version code 11) uses the live HTTPS API at `https://proforma.rayztechnology.com/api` in local development and all EAS profiles. Common unit selection, grouped two-decimal amounts and grand totals in English or Amharic words are included in the app and PDF. PDFs follow the EN/አማ selection, embed Ethiopic/Latin fonts, use the revised header and aligned totals, and include Terms & Conditions. An optional PNG organization stamp appears in the closing area and is preserved in issued snapshots and format-3 backups. Earlier format-1 and format-2 backups remain readable. See [the stamp guide](docs/ORGANIZATION-STAMP-2.0.5.md) and [the PDF guide](docs/PDF-LANGUAGE-2.0.4.md). The backend administrator panel is deployed; physical-device acceptance still needs testing. Export a business backup before upgrading; keep the existing app installed to preserve its data and device key.

## Customer and administrator workflow

1. Customer registers with a `+` country-code phone and a numeric password of at least six digits. Existing longer passwords remain valid for sign-in. No OTP verification is implemented or claimed.
2. Customer reads the configured one-time ETB fee and Telebirr instructions, then pays externally. No Telebirr API calls exist.
3. Customer submits a separate payer phone, reference/FT number, optional genuine JPG/PNG receipt (5 MB maximum) and optional note. Repeated retries reuse an idempotency ID. Pending requests retain their fee/instruction snapshot.
4. Administrators see a persistent notification, unread count and request details. Polling runs while the panel is visible. An administrator independently checks their own Telebirr records, records the received amount and verified reference, confirms approval, or rejects with a visible reason. A screenshot is not proof. Underpayments cannot be approved.
5. Approval creates one unused entitlement. Only its authenticated owner can register one company. Company details are not requested before approval. A second company requires another entitlement.
6. Android proves possession of its non-exportable Keystore private key through a five-minute single-use server challenge. Laravel issues an RS256 JWS licence bound to the company, legal identity and key fingerprint.
7. Android verifies the signed licence and fresh local key possession on launch and before protected writes/PDF operations. Activated invoices work permanently offline. Licence failure preserves records and opens recovery.

Rejected corrections create new requests linked to the original review. Pending reference disputes have a separate audited administrator action to release an incorrect claim. Approved verified references remain database-unique. A complimentary/manual grant is a separate audited action with a reason and no fabricated payment.

## Windows backend setup: WAMP or XAMPP

Use **PHP 8.2+** with OpenSSL, PDO MySQL, mbstring, fileinfo, GD, cURL, XML, ZIP and Sodium, Composer 2, and MySQL 8/InnoDB. The checked lockfile was installed with WAMP PHP 8.2.29 and Laravel 12.70.0. Existing XAMPP PHP 8.1 cannot run it. WAMP already has a compatible runtime here:

```powershell
$php = 'C:\wamp64\bin\php\php8.2.29\php.exe'
$composer = 'C:\ProgramData\ComposerSetup\bin\composer.phar'
$env:OPENSSL_CONF = 'C:\wamp64\bin\php\php8.2.29\extras\ssl\openssl.cnf'
Set-Location D:\Projects\ProformaApp\backend
& $php $composer install
Copy-Item .env.example .env
& $php artisan key:generate
```

Do not overwrite an already configured `.env` or regenerate an existing production APP_KEY. APP_KEY protects encrypted TOTP secrets, subscriptions and sessions. Store it securely with server backups.

Create a dedicated database and database user through your local MySQL administration tool. Example schema (choose your own password; never reuse the literal placeholder):

```sql
CREATE DATABASE proforma_activation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'proforma_service'@'localhost' IDENTIFIED BY 'REPLACE_WITH_A_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON proforma_activation.* TO 'proforma_service'@'localhost';
```

Set `.env` DB host, port, database and credentials. For local-only HTTP development set `APP_ENV=local`, `APP_DEBUG=false`, `APP_URL=http://YOUR_PC_LAN_IP:8000`, `SESSION_SECURE_COOKIE=false`. Production must use HTTPS, `APP_ENV=production`, `APP_DEBUG=false`, and secure cookies. Never expose the PHP development server to the public internet.

```powershell
& $php artisan migrate --force
& $php artisan admin:provision +251YOUR_ADMIN_NUMBER
```

Provisioning prompts privately for a strong password, shows a local authenticator enrollment URI once, and requires a valid code before creating the administrator. Enroll it locally in an authenticator; do not upload the enrollment URI to an online QR generator or save terminal output. There is no public administrator registration. Production web login requires password plus TOTP; codes cannot be reused. The documented loopback-only local test option can omit TOTP when explicitly enabled.

Configure WAMP/XAMPP Apache to serve **backend/public** as the document root, with `mod_rewrite` enabled and the selected PHP 8.2 runtime. Keep `.env`, vendor, storage, receipts and signing keys outside the web root. For development you can instead run:

```powershell
& $php artisan serve --host=0.0.0.0 --port=8000
& $php artisan queue:work --tries=4 --backoff=30
```

Open `/admin`, sign in and set the fee, merchant name, recipient number/ID, payment instructions, support contact and expected review time. No real fee or merchant details are seeded. Until every field is configured new payment submissions are disabled.

## Signing keys and rotation

The current local signing key is outside the project in `D:\Projects\ProformaApp-secrets`; only its public key is embedded in the app. Its directory ACL is restricted to the current Windows user and SYSTEM. Do not include private keys in source archives, APKs, mobile environment variables or public hosting.

For a new installation, generate a key outside source and outside the web root:

```powershell
& $php artisan license:keys D:\SecureProformaKeys rayz-2026-02
```

Set the reported `LICENSE_KEY_ID`, `LICENSE_PRIVATE_KEY_PATH` and `LICENSE_PUBLIC_KEYS_PATH` in backend `.env`. Restrict the private file ACL to the backend service account and keep an encrypted offline backup. Copy **only** `public-keys.json` into `mobile/src/license-keys.json` before building. On Windows, `OPENSSL_CONF` must point to a real `openssl.cnf` if RSA generation fails.

Rotation order: generate a new key with a new ID; merge old and new public verification keys; distribute an app containing both; only then change the server's active signing ID/private path. Keep old public keys indefinitely for permanent offline licences. Never overwrite an existing key. Removing an old verification key would lock that key's offline users after they update. Back up keys and APP_KEY separately from business ZIPs.

## Android development and APK builds

Expo Go is unsupported for licensing. The local Expo module in `mobile/modules/device-license` uses Android Keystore and the Nimbus JOSE library; it fails closed when unavailable. It does not substitute a device ID, stored paid flag or exportable private key. Android uses hardware protection when available; hardware attestation is not implemented.

```powershell
Set-Location D:\Projects\ProformaApp\mobile
npm ci
Copy-Item .env.example .env
# Edit EXPO_PUBLIC_API_URL before building.
npm run verify
npx eas-cli build --platform android --profile development
npx expo start --dev-client
```

For local builds install Java/Android Studio/SDK and use `npx expo run:android`. For a LAN development phone set `EXPO_PUBLIC_API_URL=http://YOUR_PC_LAN_IP:8000/api`. **Do not use localhost**: on the phone it refers to the phone. Use the same Wi-Fi, allow the selected development port on the private-network firewall, and open the API from the phone to diagnose connectivity. Production APKs accept HTTPS URLs only; plain HTTP is limited to debug builds. Use a trusted HTTPS certificate for release acceptance testing, not disabled certificate checks.

```powershell
# Internal signed release APK. Also executes the exact native verifier unit tests.
npx eas-cli build --platform android --profile preview
```

Keep the existing EAS project and signing credentials (`com.proformastudio.app`) so updates retain data. Increment Android versionCode for releases. No signing private key is included here. Hosting changes require setting the public URL and rebuilding; it is intentionally not an end-user editable server setting that could receive credentials at an untrusted endpoint.

The `preview` Gradle command runs `:device-license:testReleaseUnitTest :app:assembleRelease`. Nimbus tests cover valid permanent licences, signature tampering, wrong company/device, unknown signing key, missing key and invalid possession proof. These JVM tests do not prove Android hardware behavior. For the native module alone after prebuild: `android\gradlew.bat :device-license:testReleaseUnitTest`.

## Production HTTPS and queues

Deploy the Laravel directory to a maintained PHP 8.2 server and MySQL database. Serve only `public/` with HTTPS. Set all environment values, `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, `SESSION_ENCRYPT=true`, `QUEUE_CONNECTION=database`, then run:

```sh
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan view:cache
php artisan queue:work --tries=4 --timeout=120
```

Run queue workers under a service manager and restart them after deployment. Allow the receipt/company-logo upload sizes in PHP `upload_max_filesize`/`post_max_size` and the reverse proxy (company logos are base64; allow at least 20 MB request bodies). Receipts are stored on the private local disk and served only through authenticated, second-factor administrator routes, never `/storage` URLs. Back up server MySQL, private receipt storage, APP_KEY and signing keys with access controls. Do not enable request-body logging, API-token logging or debug dumps. Avoid public database accounts and restrict database access to the service.

If terminating TLS at a reverse proxy, configure Laravel trusted proxies for **only your proxy's addresses** so `isSecure()` recognizes forwarded HTTPS. Do not globally trust arbitrary forwarded headers. The production middleware rejects HTTP and sends HSTS; session cookies are HTTP-only and secure. Web forms use CSRF protection. Static assets should receive equivalent security headers from the web server.

## Administrator notifications

The database notice list is the reliable fallback. It persists before optional push dispatch; queue/provider failures cannot roll back a payment. The panel polls every 20 seconds while visible, shows unread counts and marks notices read when opened. Notifications contain generic text and authenticated links, not phones, references or receipts.

Optional background push requires HTTPS, a supported browser, explicit permission, VAPID keys/subject, a running queue and a real delivery test. Generate VAPID keys locally with the installed Minishlink library (store its private key in server `.env` only), set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:YOUR_SUPPORT_EMAIL`, and clear/cache configuration. The panel's button requests browser permission, registers `/admin-sw.js`, and saves an encrypted administrator subscription. Jobs retry with backoff; expired subscriptions are removed, exhausted delivery writes a generic warning. Test delivery with the browser closed on each intended phone/browser; iOS may require adding the site to the home screen. Permission denial does not affect submissions. Background delivery has **not** been configured or physically tested here.

## Recovery, company corrections and transfers

* Password recovery is administrator-assisted. Independently check original ownership/payment and identity evidence, not just control of the account or a screenshot. The admin recovery form records the checks/reason, resets a strong password and revokes all tokens/sessions. Deliver the temporary password through an agreed private channel. Never store identity document copies, passwords or tokens in notes/logs.
* Routine profile contacts/logo can be updated online. Legal name/TIN changes require a reviewed correction request in Activation & recovery. The signed licence also binds legal identity so editing a backup cannot repurpose it. After an approved correction, recover the licence/profile to download the revised signature; historical invoice snapshots remain intact.
* On reinstall/new phone, log in, generate the new key and request device transfer with an ownership explanation. The administrator verifies identity and approves that request. The new phone completes recovery with fresh proof from the approved key. The backend records the previous registration as revoked and issues a new licence. Account login alone cannot activate another key. No new payment is required for a verified existing company.
* Licences and business records are separate. Restore invoices from a user-exported backup; account recovery does not download invoices. Restoring a business ZIP preserves company IDs and historical snapshots but never imports tokens, private keys or activation authority. Copies stay locked without a valid signature for that company and the current device key.
* An old free-version company can be linked after an approved entitlement or an audited complimentary grant. The app retains the local ID; it never replaces invoices with server records. If the identity cannot be linked automatically, leave the records intact and resolve it with the administrator.

Permanent offline access has no recurring payment or periodic connection requirement. A permanently offline licence cannot reliably be revoked while the phone stays offline. A transfer revokes old **server** access; it cannot guarantee the old phone stops working offline. Modified/rooted apps can bypass client protections. No perfect piracy protection or guaranteed single-device enforcement is claimed.

## Verification and release acceptance

```powershell
# mobile/
npm run verify
# backend/ (PHP 8.2; OPENSSL_CONF as above on this Windows machine)
php artisan test
```

The backend suite uses isolated SQLite by default. It has also been run against a disposable MySQL 8.4 database. For MySQL, set `DB_CONNECTION=mysql`, host/port, and `DB_DATABASE=..._test` in the test process environment. **Never run tests against production.** `RefreshDatabase` migrates test tables. For the separate true-concurrency integration test, set `APP_ENV=testing` and a disposable MySQL database ending `_test`, then run `php tests/concurrency.php`. It runs independent PHP processes and tests same-request idempotency plus verified-reference uniqueness. It rejects other environment/database names.

Read `docs/VERIFICATION.md` for actual outcomes and remaining checks. Before accepting payments, run this on two physical Android devices:

1. Deploy HTTPS API, configure a real fee/recipient and provision an administrator with TOTP.
2. Register → submit → see admin notice → independently verify merchant receipt → approve → enter company/logo → download licence.
3. Restart in airplane mode; create/edit/issue, preview, print/share/export a proforma; restart again and verify persistence.
4. Install the same APK on phone B and restore phone A's business ZIP. It must remain locked. Complete an approved device transfer; verify old server proof is rejected.
5. Reject a request and correct it; test wrong/duplicate references, underpayment and private receipt access. Test identity correction and both data/licence recovery separately.

This phase is for direct APK distribution. Google Play payment/distribution policy review is a separate release task; compliance is not claimed. Existing decimal-safe VAT/no-discount calculations, numbering, immutable issued snapshots, fixed-aspect logos and multipage PDF behavior are retained. Exported PDF headings remain English. No invoice cloud synchronization or automatic Telebirr success is implemented.


Activation repair: see `docs/ACTIVATION-REPAIR-2.0.2.md` for observed Imunify360 HTTP 403 JSON blocks, separate unverified Laravel registration errors, safe retries, persistent company drafts, offline access checks and the four-file backend patch. Existing deployments must not reimport the clean production SQL to apply this patch.

Version 2.0.8 adds user-authored optional Terms & Conditions, corrected PDF closing pagination and 100% Android print text zoom, self-service Account → Change password, reliable secure-field masking fonts and a compact portal dashboard link. See [the update guide](docs/FEEDBACK-FIXES-2.0.8.md).

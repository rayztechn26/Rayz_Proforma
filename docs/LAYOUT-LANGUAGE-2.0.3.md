# Proforma Studio 2.0.3 — layout and language update

Android version code: 6. Same package and signing identity as earlier releases. The Expo build finished and the downloaded APK signature, version code, font hashes and compiled UI text were verified.

## What changed

- Corrected the heading to **All in One Proformas**. Language controls now read **EN / አማ** throughout the app and administrator portal.
- Replaced device-dependent interface typography with bundled Inter and Noto Sans Ethiopic fonts, licensed under SIL OFL. Adjusted headings, fields, spacing and buttons. Mobile controls retain a minimum 44-pixel logical touch target; secondary and backup actions are visually quieter.
- Added password visibility controls, clearer account and backup sections, translated unit names, and collapsible API diagnostic details. Removed outdated free-edition wording and the stale Settings version number.
- Added session-based administrator language selection, translated portal views, responsive headers/footer/forms, status badges, readable pagination, empty states, Clear filters and date-range validation. Notifications show refresh failures and a Refresh control instead of failing silently.
- Invalid administrator fee formats return to the form and retain entered instructions. Payment review still requires independent verification and explicit confirmation.
- Preserved the 2.0.2 activation repair, draft/logo retention, retry-safe registration, licence validation and offline access. No database schema changes.

## Update the installed Android app

Install `Proforma-Studio-2.0.3.apk` over the existing app. Export a business-data backup first. Do not uninstall or clear app storage: doing so removes the local device key and can require licence recovery. This is a native build; Expo Go cannot run its device-bound licence component.

## Update an existing DirectAdmin installation

Use `Proforma-Backend-UI-Update-2.0.3.zip`. It contains two separate upload roots:

1. Back up the existing `proforma-app`, public files and database using File Manager/phpMyAdmin.
2. Merge the **contents** of `proforma-app/` into `/domains/proforma.rayztechnology.com/proforma-app/`, replacing matching application files.
3. Merge the **contents** of `public_html/` into `/domains/proforma.rayztechnology.com/public_html/`, replacing matching assets. Files must be directly inside public_html, not inside another extracted folder.
4. Preserve the live `.env`, `vendor`, `storage`, database, signing keys, `public_html/index.php`, `app-path.php` and `.htaccess`. This update deliberately contains none of these configuration/runtime files. Do not import the original database SQL again.
5. If Laravel configuration/routes/views are cached, use File Manager to remove generated `bootstrap/cache/config.php`, `routes-*.php`, and compiled `.php` files in `storage/framework/views/`. Keep directories, `.gitignore`, session files and application data. Do not remove vendor files. With Terminal, the equivalent is `php artisan optimize:clear`.
6. Hard-refresh the browser, switch EN/አማ on login and dashboard, open Notifications and Payment settings. Verify the footer reads 2.0.3. No Composer installation or migration is required for an already working 2.0.2 deployment.

Local WAMP sources/assets were updated with a file backup at `D:/Projects/ProformaApp-backups/local-before-layout-2.0.3`. Local environment, database and runtime data were preserved. Remote hosting was not modified.

## Verification and limits

TypeScript, 34 core tests, 28 mobile UI/integration tests, and 37 PHP 8.2 backend tests / 239 assertions, and three portal JavaScript tests pass. Tests cover locale persistence, redirect confinement, continued administrator authentication/TOTP requirements, empty states, invalid fees retaining input, and diagnostic disclosure. Local browser inspection covered English/Amharic activation, company form, portal login/dashboard/settings and notification controls. Mobile visual previews render actual React components with isolated test fixtures, not production payment/registration requests. A physical Android acceptance check remains required, especially system font scaling, keyboard, print/share and selected logos.

The PDF document and amount-in-words output remain English. User-entered business records and server-authored payment instructions are preserved verbatim, not automatically translated. SMS OTP is not implemented; selecting a provider is separate work. Background push still requires VAPID/server delivery configuration; in-panel notifications work without it.

This visual update does not remove an Imunify360 block. Hosting support must allow legitimate mobile requests to the API without an interactive browser challenge while retaining normal authentication and rate limits. No new hosting exemption is required by the layout changes themselves. A separate production Laravel 500 still requires a fresh correlated server log; the historical missing-APP_KEY error is not evidence of its present cause.

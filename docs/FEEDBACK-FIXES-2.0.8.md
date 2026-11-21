# Proforma Studio 2.0.8 — PDF, terms, account and portal fixes

Android version 2.0.8 / version code 11. Install over the existing app after exporting a business-data backup. Do not uninstall first; keep the database and device licence key intact.

## What changed

- PDF closing content is no longer kept in one indivisible block. Totals, amount words and optional sections can flow naturally. Android PDF rendering explicitly uses 100% text zoom, avoiding inheritance of the phone's text-zoom preference. Monetary totals remain right aligned and the currency stays on the grand-total baseline. All four PDF actions use the same corrected generator.
- Terms & Conditions is entirely user supplied. Company profile has an optional default for new drafts; each proforma has its own editable optional field. Leave the draft field blank to omit both the heading and content. No canned service/agreement paragraph is inserted. New issued records freeze their custom terms. Existing records without this field do not acquire invented terms.
- Open **Account → Change password**. Enter the current password and confirm a new numeric password of at least six digits. Leading zeros and longer numeric entries are retained (maximum 72 digits). Existing longer letter/number passwords remain valid for current-password verification and sign-in. A successful change keeps the current API token, revokes other account tokens/sessions, and creates an audit event without password values. Wrong current passwords or mismatched confirmation do not change the password. Failed service requests preserve the form entries; success/cancel clears them. Password changes require a server connection; offline invoicing remains available on already activated devices.
- Android secure password fields use the platform sans-serif font so masking dots do not depend on the custom Latin/Ethiopic font. Sign-in, registration and password-change fields share Show/Hide controls. Password visibility toggling preserves the controlled value. This is native masking, not a displayed hash or a custom replacement of the real password.
- Payment settings has a compact one-line **Back to dashboard** control. The stylesheet cache version and portal footer identify the 2.0.8 update.

Company custom terms and stamps are local document data; they are excluded from activation-profile API requests and retained across canonical registration/recovery responses. They do not grant licence authority. No authentication, payment approval, entitlement or device-signature checks are removed.

## Backups and historical records

New backups use **format 3** to include optional custom terms. The app still reads old formats 1 and 2, including format-2 stamps. Restore new format-3 backups with app 2.0.8 or later. No SQL/SQLite schema migration is needed: optional fields live in existing JSON records. Old issued invoices remain read-only; changing a company default does not rewrite them. Their previous hardcoded system paragraph is no longer printed when no user terms were stored.

## DirectAdmin deployment — before installing the new APK

Back up your existing files, then replace the matching files from this archive under `/domains/proforma.rayztechnology.com/`:

- proforma-app/app/Services/UserPassword.php
- proforma-app/app/Http/Controllers/AccountController.php
- proforma-app/app/Http/Controllers/AdminController.php
- proforma-app/routes/api.php
- proforma-app/resources/views/admin/dashboard.blade.php
- proforma-app/resources/views/admin/settings.blade.php
- proforma-app/resources/views/admin/layout.blade.php
- proforma-app/lang/am.json
- proforma-app/public/admin.css
- public_html/admin.css

Keep proforma-app beside public_html. This adds authenticated **POST /api/password**, with current-password verification and a separate six-per-minute password-change limit. No database import, account reset, migration, .env replacement, key rotation or vendor replacement is required. Saved payment settings and existing payment snapshots are not changed by this update.

If cached routes prevent the new endpoint loading, remove only `proforma-app/bootstrap/cache/routes-v7.php` if present. For stale portal views, remove only compiled `.php` view files under `proforma-app/storage/framework/views/`, keeping `.gitignore`. Reload the browser; the stylesheet URL now uses `?v=2.0.8`. If PHP continues executing old source, ask the host to reset this site's PHP OPcache. Keep APP_KEY, licence keys, database contents and other configuration intact.

## Verification and limits

TypeScript and 89 mobile tests pass: 41 core and 48 UI/integration. All 44 backend tests / 315 assertions pass, including current-password authentication, confirmation, unrelated-account isolation, retained current token, other-token/session revocation, audit privacy, customer-only access and rate limiting. Existing payment, entitlement, signed licence and offline tests remain passing.

The actual HTML generator was rendered with embedded fonts in Chromium, then all nine pages across five cases were inspected: one-row A4 and Letter each remain one page; a stamped Amharic one-row invoice remains one page; long custom terms flow over three pages; a forty-item Amharic invoice spans three pages with repeated item headers. PDF checks cover searchable totals, matching amount words, aligned right edges, currency baseline, no forced default terms, all custom-condition markers, stamp/text separation, bounds and page counters. Three sample PDFs are in output/pdf. The sample stamp says DEMO COMPANY / SAMPLE / NOT VALID and is only a test fixture.

EN/Amharic isolated browser previews of the actual account UI verify masked fields, Show/Hide, retained values and the successful password-change flow. Local portal previews were checked at desktop and mobile widths. Android-preset component tests verify the secure system-font style and print textZoom option. Desktop renderers and mocked native components cannot establish behavior on every Android font/WebView/print-service combination; physically verify the supplied APK on an affected phone, including A4/Letter selection and system large-text settings.

The matching WAMP source files have been synchronized with a pre-change backup outside the project and compiled views cleared. No production account, payment, setting, or password was changed and no remote hosting deployment was performed.

Expo build `2ebbf906-a52b-450d-b797-99e0543ea6de` finished successfully. The downloaded APK version 2.0.8/code 11 passes ZIP integrity, v2 signature/content-digest, same-prior-certificate and bundled-font checks. Compiled password-change controls, optional custom-terms property, secure system-font choice, textZoom option, flowing PDF closing CSS, live API URL and minimum-six-digit guidance are verified. The old hardcoded service/agreement paragraph and obsolete password hints are absent. APK size: 92,931,363 bytes; SHA-256: `ebf27846d5c58a2a6899184a847e397d675210de19309e40091b762a1866bb7e`. Evidence: `artifacts/eas-build-2.0.8.json` and `artifacts/apk-verification-2.0.8.json`.

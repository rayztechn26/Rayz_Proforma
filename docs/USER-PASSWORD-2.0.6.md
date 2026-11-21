# Six-digit customer passwords — Proforma Studio 2.0.6

Android version 2.0.6 / version code 9. New customer passwords and administrator-assisted customer password resets require exactly six ASCII digits. Leading zeros are retained. The app uses a numeric keyboard and six-character limit only while creating an account; sign-in accepts existing longer passwords without truncating them. Guidance and validation errors are available in English and Amharic.

Existing passwords are not converted or reset automatically. A registered customer may continue to sign in with their existing password. To change it to six digits, an administrator uses **Assisted account recovery** after verifying ownership. Recovery still requires confirmation and identity checks, revokes that customer's tokens and sessions, and records an audit event. It cannot reset an administrator account.

Administrator provisioning/export still requires 12+ characters with mixed-case letters and numbers. Administrator TOTP, hashing, API authentication, six-per-minute account sign-in/registration throttling, payment approval, entitlements, device-bound licence verification and offline access are unchanged.

## DirectAdmin deployment (before distributing APK 2.0.6)

Back up the existing files, then upload the six matching files from this ZIP into the existing `/domains/proforma.rayztechnology.com/proforma-app/` folder:

- app/Services/UserPassword.php (new file; required)
- app/Http/Controllers/AccountController.php
- app/Http/Controllers/AdminController.php
- resources/views/admin/dashboard.blade.php
- resources/views/admin/settings.blade.php
- lang/am.json

The `proforma-app` directory belongs beside `public_html`, not inside it. No public_html changes, Composer reinstall, SQL import, schema migration, account reset or signing-key replacement is required. The existing optimized Composer autoloader supports the new PSR-4 class without rebuilding vendor files.

After upload, refresh the portal. If the old recovery form is still shown, remove only the compiled `.php` files in `proforma-app/storage/framework/views/` (keep `.gitignore`). If PHP continues serving old source, ask hosting support to reset this site's PHP OPcache.

This package also includes the payment-label/description changes from 22 October. Those files do not overwrite saved payment settings. The supplied payment instructions must still be pasted and saved through Payment settings if that has not already been done. Keep the existing approval-time value and other settings as requested.

Install the signed 2.0.6 APK over the existing app after exporting a business-data backup. Do not uninstall first: keeping the installed app preserves its database and device licence key. The downloaded APK retains the package identity and its signing certificate is verified to match 2.0.5. APK signature and content digest verification pass.

## Local changes and checks

The matching backend files were synchronized to `C:/wamp64/www/backend` with a pre-change file backup outside the project. Its compiled views were cleared. No live hosting deployment or customer/password database change was performed.

TypeScript, 40 core mobile tests and 46 mobile UI/integration tests pass. Registration UI tests cover the numeric keyboard, six-character limit, invalid input, leading zeros and legacy-password sign-in. 41 backend tests / 274 assertions pass. Backend checks cover six-digit registration/login, hashing, invalid lengths/letters/types, existing longer-password login, the unchanged strong administrator policy, assisted recovery, token/session revocation, audit records and rejection of administrator-account resets. Existing payment/licensing tests remain passing. Physical-phone keyboard, upgrade and complete account/payment journeys still need device acceptance.

Expo build `fe21ade2-d9ac-4bf5-a674-507649f4e9f4` finished successfully. The downloaded 2.0.6/code 9 APK passes ZIP integrity, v2 signature/content-digest, same-prior-certificate, bundled-font and compiled-six-digit-guidance checks. The old 12-character registration guidance is absent from the compiled app. APK size: 92,926,791 bytes; SHA-256: `08381d2e7c1ac72463f9e19ae8c3fe682d431f3502613cede9a2d250e74d14e1`. Evidence: `artifacts/eas-build-2.0.6.json` and `artifacts/apk-verification-2.0.6.json`. English and Amharic browser previews of the actual registration component also pass numeric-input, six-character-limit and leading-zero checks.

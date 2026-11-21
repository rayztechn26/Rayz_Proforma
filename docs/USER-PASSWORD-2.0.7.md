# Minimum-six-digit customer passwords — Proforma Studio 2.0.7

Android version 2.0.7 / version code 10. Customer registration and administrator-assisted customer password resets now accept **six or more numeric digits**, up to the existing 72-byte password-hashing limit. Leading zeros are retained. Six-digit passwords remain valid; longer numeric passwords are no longer truncated or rejected just because they exceed six digits.

The registration hint reads **Use at least 6 digits for your password.** in English and Amharic. The old 12-character/mixed-case hint and the exactly-six-digit hint are removed from current mobile sources. The numeric registration input allows longer values. Sign-in continues to accept existing longer passwords, including letters, without truncation. Existing passwords are not reset automatically.

Administrator provisioning/export still uses the original 12+ character strong-password policy. TOTP, request throttling, password hashing, authenticated payment approval, registration entitlements, device-bound licence validation and offline activation behaviour are unchanged. Assisted recovery still requires verified ownership and confirmation, revokes that customer's tokens/sessions, records an audit event and cannot reset administrators.

## DirectAdmin: deploy before using the new APK

Back up the existing files, then replace these six matching files inside your existing `/domains/proforma.rayztechnology.com/proforma-app/` folder:

- app/Services/UserPassword.php
- app/Http/Controllers/AccountController.php
- app/Http/Controllers/AdminController.php
- resources/views/admin/dashboard.blade.php
- resources/views/admin/settings.blade.php
- lang/am.json

Keep `proforma-app` beside `public_html`. No public_html changes, Composer reinstall, SQL import, account reset, database migration, signing-key change or saved-payment-setting change is required.

Refresh the portal after upload. If its recovery field still limits input to six digits, clear only compiled `.php` views in `proforma-app/storage/framework/views/` (keep `.gitignore`). If PHP still executes old source, ask hosting support to reset this site's PHP OPcache.

The patch includes the payment-settings labels and description requested earlier. It does not change the saved Instructions field, approval-time value or other payment settings. If you still need to update the saved payment instructions, paste PAYMENT-INSTRUCTIONS.txt through Payment settings and save.

## Android installation and the old hint

Export a business-data backup, then install `Proforma-Studio-2.0.7.apk` over the existing app. Do not uninstall first, so the local database and device key remain intact. Android Settings → Apps → Proforma Studio → App info should show **2.0.7** after installation. Reopen Create account and confirm the hint says **Use at least 6 digits for your password.** The version check helps distinguish older APKs saved in Downloads. The phone's installed version has not been read by this workstation.

A deliberately invalid-phone request to the live API passed the six-digit password validation without creating an account, so the reported 12-character hint was not reproduced from that server validation response. The downloaded APK has been checked and excludes both obsolete hint strings. No live customer account or payment was created or modified during this check.

## Verification and local status

TypeScript and 86 mobile tests pass (40 core, 46 UI/integration). The UI tests cover numeric registration, longer entries with leading zeros, invalid values and full legacy-password sign-in. All 41 backend tests / 283 assertions pass, including six-digit and nine-digit account registration/login, longer assisted-recovery passwords, 72/73-digit boundaries, wrong lengths/types/characters, unchanged administrator policy, token/session revocation and auditing.

English and Amharic browser previews of the actual registration component preserve a nine-digit input and use the new minimum-six-digit hint. Physical-phone installation/keyboard acceptance remains to be checked.

The six matching backend files were backed up and synchronized to `C:/wamp64/www/backend`; its compiled views were cleared. A local invalid-phone registration probe with nine password digits returns the phone-format error instead of a password-length error, with no account created. Saved payment settings and account records remain unchanged. The hosting files have not been remotely deployed by this workstation.

Expo build `059bcc9d-8d20-42ef-abeb-83c21b9864cc` finished successfully. Downloaded APK version 2.0.7/code 10, ZIP integrity, v2 signature/content digest, the same prior signing certificate, bundled font hashes and compiled English/Amharic minimum-six-digit guidance are verified. Both obsolete English hints (12-character mixed-case and exactly six digits) are absent from the compiled bundle in UTF-8 and UTF-16 representations. APK size: 92,926,783 bytes; SHA-256: `5f5a0602954accdeb37527021d6334549ad6afd336f3a98c19314eac87bc89bc`. Evidence: `artifacts/eas-build-2.0.7.json` and `artifacts/apk-verification-2.0.7.json`. Physical-phone installation/keyboard acceptance remains to be checked.

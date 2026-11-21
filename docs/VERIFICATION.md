# Verification record

This file records executed checks separately from deployment/device acceptance.

## Executed

DirectAdmin PHP 8.2 preparation: 29 backend tests pass (166 assertions) on PHP 8.2.29. Composer resolves against PHP 8.2.0; production dependencies pass actual PHP 8.2 platform checks, and Composer audit reports no advisories. The assembled backend boots without development dependencies. The deployment archive contains 6,948 verified file hashes. Its clean SQL was exported and re-imported with 22 InnoDB tables, 5 migration rows, and no users/payments/runtime records. Secrets and private signing keys are excluded. No remote upload, hosting configuration or live-domain acceptance test has been performed.

Local testing update: 24 Laravel tests pass (130 assertions), including loopback-only password login, production enforcement, remote-request enforcement, role checks and rejection of local-test sessions after switching to production. Real WAMP browser login without an authenticator field successfully reaches the dashboard and signs out. This exception is explicitly enabled only in the local WAMP `.env`.

Results: 28 core mobile tests, 14 Android-preset UI/licence integration tests, 19 Laravel tests (109 assertions), and 20/20 Expo Doctor checks pass. The Laravel suite also passes from `C:\wamp64\www\backend` using WAMP MySQL 8.4.7 on port 3306 and the isolated `proforma_local_test` database. All 22 primary local database tables use InnoDB.

* Existing TypeScript checks and financial/SQLite/backup/PDF/localization regression suite.
* Android-preset UI tests of existing workspace forms with an explicit activated test fixture, and separate real activation-gate tests for blocked company entry, rejected requests, approved entitlements, offline access and copied-record locking.
* Mobile licence integration tests verify that protected operations invoke native verification, invalid results are not stored, missing licences fail closed and legal-identity changes cannot reuse activation. The native bridge is mocked in these tests; they do not test cryptography. Exact crypto checks are separate JVM tests.
* Laravel API/web tests with real RSA challenge signatures and signed RS256 licences: register/login/logout, phone normalization, absent configuration, approval ordering, immutable expected fee, retry idempotency, pending notices, rejection corrections, duplicate references, underpayment, repeated approval, ownership, private receipts, mandatory TOTP/replay rejection, one entitlement/company, transfer and legal correction.
* Laravel suite against both isolated SQLite and MySQL 8.4.7. Separate independent-process MySQL concurrency checks passed: same request converges to one entitlement; different requests cannot both use the same verified reference.
* Real HTTP/browser protocol check on the development server with a disposable MySQL database: synthetic registration, submission, administrator notification, password/TOTP browser review, approval, company registration and RS256 signature verification. Test merchant settings and software RSA test keys were used; no money or Android hardware was involved. Desktop and phone-browser layouts were checked and captured.
* Existing WAMP default-site requests for `/backend/.env`, `/backend/composer.json` and `/backend/storage/logs/laravel.log` return 403. The dedicated WAMP site on port 8087 passes Apache configuration validation, but its HTTP check is pending an administrator restart of the WAMP service.

## Build and remaining checks

The release APK build includes exact Kotlin/Nimbus verifier tests before assembly. The final delivery records the build result and APK signature verification separately.

Previous APK build `a9bc5379-7906-4d03-bc03-a08feea68d7d` finished successfully on Expo. Version 2.0.1 / code 4 build `e140385e-ba67-46b8-941d-279b2ca66885` finished successfully on Expo. The downloaded APK passes ZIP CRC, package/version, APK v2 signing and content-digest verification. Its certificate matches the free release. The compiled bundle contains the live API address and new unit/amount features. Evidence is saved in artifacts/eas-build-2.0.1.json and artifacts/apk-verification-2.0.1.json. An earlier packaging failure was corrected and the build archive was inspected to confirm it includes native sources and tests.

Hosting, real merchant configuration and physical phones are unavailable. The full on-phone payment-to-airplane-mode PDF journey, actual Android Keystore hardware/non-exportability, reinstall behavior, native print/share, second-phone copy test and background web push delivery must be tested on devices before release. JVM crypto tests cannot establish those hardware/OS properties. No payment has been taken and no production account has been provisioned.

Optional push VAPID keys and provider delivery are unconfigured. Persistent in-panel notices are implemented and tested; background delivery is not claimed.

The existing npm dependency audit reports transitive vulnerabilities in the Expo ecosystem (including build/test dependencies); no forced incompatible SDK downgrade was applied. Backend Composer audit is clean at installation. Review dependency advisories and update the supported Expo stack before public distribution.


## Version 2.0.1

Live API: https://proforma.rayztechnology.com/api. Unauthenticated account GET returns JSON HTTP 401, confirming API routing without creating accounts or payments. All EAS profiles and local mobile .env use this URL. The app keeps its package identity and existing signing credentials.

31 core tests and 17 Android UI tests pass, including grouped decimal amounts, matching figures/words, PDF content, searchable carton selection and preservation of historical units. TypeScript and the Android Metro/Hermes export pass. The exported bundle contains the live API URL. A nine-page PDF fixture was generated; its final page was visually checked for readable totals, amount in words and unclipped terms. Grand totals in words are currently English in both interface languages, matching the existing English PDF. Existing invoice records, VAT arithmetic and backup format are unchanged. Physical phone acceptance is still pending.

The 2.0.1 APK is 92,119,239 bytes; SHA-256: ead38dc742c4cd87db1935e6ffa9b7ad08fd2290a32caef951d8f5817676832d.


## Version 2.0.2 activation repair

60 mobile tests (34 core and 26 UI/integration), TypeScript, 33 backend tests / 209 assertions, four targeted MySQL rollback/retry tests / 50 assertions, and independent-process MySQL registration concurrency pass. Android Metro/Hermes export passes. Local WAMP returns JSON 401 plus X-Request-ID for unauthenticated account access. Current workstation probes of GET /api/account, POST /api/challenges and POST /api/companies return HTTP 403 application/json generated by Imunify360; no live data was changed. Fresh production registration-error logs remain unavailable; the old MissingAppKeyException is not treated as evidence of the new failure. Full findings/install instructions: docs/ACTIVATION-REPAIR-2.0.2.md. EAS build: 6e12ead9-ec6c-4026-9171-1370572dd7d5.

Version 2.0.2 EAS build finished. APK version code 5, signature/content digest, same prior certificate and compiled repair features verified; see artifacts/apk-verification-2.0.2.json. Backend patch is local, not remotely deployed.


## Version 2.0.3 layout and language

34 core tests, 28 mobile UI/integration tests, TypeScript, and 37 backend tests / 239 assertions pass on PHP 8.2. Three portal JavaScript tests pass, covering guest password controls, retained notifications during outages and rejection of hosting HTML responses. Browser visual inspection covers EN/አማ activation and company forms using actual components with isolated fixtures, and local WAMP administrator login, dashboard, settings and notification controls. Details, deployment instructions and remaining limitations: docs/LAYOUT-LANGUAGE-2.0.3.md. EAS build 8c94a6f0-20ed-4d7a-a94e-bd273dfbc0f1.

The 2.0.3 Expo APK build finished successfully. Downloaded APK version code 6, v2 signature/content digest, prior signing certificate, bundled Inter/Ethiopic font hashes, corrected heading and compiled API address verified. APK bytes: 92,608,831; SHA-256: 6817bc7db5306d50638b13e3aee4e3e7f29518b00d34f98bc1a024b1750c0897. Evidence: artifacts/apk-verification-2.0.3.json and artifacts/eas-build-2.0.3.json. Backend package has not been remotely deployed.


## Version 2.0.4 bilingual PDF

36 core tests, 38 mobile UI/integration tests and TypeScript pass. Actual HTML exports include embedded Noto Sans Ethiopic fonts, EN/Amharic labels and amount words, right-aligned totals and Terms & Conditions. All seven pages across three sample PDFs were rendered and inspected. Rendered PDF checks verify embedded fonts, copyable numeric text, labels, financial totals, aligned right edges and pagination. The native export pipeline remains licence guarded. The four PDF actions follow the live interface language without modifying issued records. See docs/PDF-LANGUAGE-2.0.4.md and artifacts/pdf-verification-2.0.4.json. No backend/database changes. Physical Android print/share acceptance remains pending.

Version 2.0.4 final Expo build `12e4f6c3-5098-405c-b5ef-21f8426652eb` finished successfully. The downloaded APK version name 2.0.4/code 7, ZIP integrity, v2 signature/content digest, same prior certificate, bundled font hashes, Amharic PDF strings and bilingual PDF export features are verified. APK bytes: 92,919,311; SHA-256: 1dc68aacaeb30934c6c13d3412f91d6e9e4a4a8e0c7ca1ddc44e2b88af02b6c0. Evidence: artifacts/eas-build-2.0.4.json and artifacts/apk-verification-2.0.4.json.


## Version 2.0.5 organization stamp

40 core tests, 44 mobile UI/integration tests and TypeScript pass. Optional PNG stamps are selected in the company profile, preserved as local assets across activation responses, frozen in issued snapshots, embedded into the closing PDF area and included in format-2 backups. Format-1 backups remain readable. All seven pages across three stamped PDF fixtures were rendered and inspected. Rendered-PDF checks verify image transparency, placement on the final page without text overlap, aligned totals, fonts, searchable amounts and pagination. No backend/database changes. See docs/ORGANIZATION-STAMP-2.0.5.md and artifacts/pdf-verification-2.0.5.json. Physical-phone acceptance remains pending.

The final 2.0.5/code 8 Expo build `a1ceec49-2f36-4de4-9d82-c902bfd9a004` finished successfully. The downloaded APK includes the larger stamp area and removal of the printed caption. ZIP integrity, APK v2 signature/content digest, the same prior signing certificate, package/version, bundled font hashes and compiled stamp layout are verified. APK bytes: 92,926,663; SHA-256: `eb457f9aee89895ac90fd26fdb240995083cde1e9cf6ad742929efeda84001ad`. Evidence: `artifacts/eas-build-2.0.5.json` and `artifacts/apk-verification-2.0.5.json`. This artifact verification does not replace physical-phone acceptance.


## Version 2.0.6 six-digit customer passwords

40 core mobile tests, 46 UI/integration tests and TypeScript pass. Customer registration and assisted recovery use an exactly-six-ASCII-digit password rule; leading zeros survive hashing and login. Existing longer passwords remain accepted at sign-in. Administrator provisioning/export password rules and TOTP remain unchanged. All 41 backend tests / 274 assertions pass; four dedicated backend tests cover invalid input, login compatibility, strong administrator policy, recovery, token/session revocation, audit records and inability to reset administrator accounts. Existing payment/activation tests remain passing. The DirectAdmin patch includes the latest payment-settings wording, but no runtime settings, accounts or database updates. See docs/USER-PASSWORD-2.0.6.md. Expo build: fe21ade2-d9ac-4bf5-a674-507649f4e9f4.

The 2.0.6 Expo build `fe21ade2-d9ac-4bf5-a674-507649f4e9f4` finished successfully. Downloaded APK version 2.0.6/code 9, ZIP integrity, v2 signature/content digest, matching prior certificate, bundled fonts and compiled six-digit password guidance are verified. The old 12-character guidance is absent. APK size: 92,926,791 bytes; SHA-256: `08381d2e7c1ac72463f9e19ae8c3fe682d431f3502613cede9a2d250e74d14e1`. See artifacts/apk-verification-2.0.6.json and artifacts/eas-build-2.0.6.json. English and Amharic browser previews of the actual registration component pass numeric-input, six-character-limit and leading-zero checks. The local WAMP API returns JSON 422 with the six-digit validation message and X-Request-ID for invalid registration, without creating an account.


## Version 2.0.7 minimum-six-digit customer passwords

TypeScript and 86 mobile tests (40 core and 46 UI/integration), and all 41 backend tests / 283 assertions pass. Registration and assisted recovery now accept six or more numeric digits (up to 72), with leading zeros retained. Six-digit and nine-digit registration/login and longer recovery, 72/73-digit boundaries, old-password sign-in and unchanged administrator policy are tested. Actual-component EN/Amharic browser previews preserve a nine-digit input and show the new hint. Local WAMP files are synchronized and return the expected JSON phone validation error after a nine-digit password passes validation. No live account/payment/settings data was changed. See docs/USER-PASSWORD-2.0.7.md.

Expo build `059bcc9d-8d20-42ef-abeb-83c21b9864cc` finished successfully. Downloaded APK version 2.0.7/code 10, ZIP integrity, v2 signature/content digest, the same prior signing certificate, bundled font hashes and compiled English/Amharic minimum-six-digit guidance are verified. Both obsolete English hints (12-character mixed-case and exactly six digits) are absent from the compiled bundle in UTF-8 and UTF-16 representations. APK size: 92,926,783 bytes; SHA-256: `5f5a0602954accdeb37527021d6334549ad6afd336f3a98c19314eac87bc89bc`. Evidence: `artifacts/eas-build-2.0.7.json` and `artifacts/apk-verification-2.0.7.json`. Physical-phone installation/keyboard acceptance remains to be checked.


## Version 2.0.8 PDF, optional terms and self-service passwords

TypeScript, 89 mobile tests (41 core/48 UI) and all 44 backend tests / 315 assertions pass. Android PDF textZoom is pinned to 100; the unbreakable closing wrapper is removed. User-authored optional terms, format-3 backup compatibility with formats 1/2, local-only profile fields, native secure-field font masking, password-change confirmation/current-password checks, retained current token, revocation of other sessions, rate limiting and audit privacy are covered. All nine PDF pages across five A4/Letter/stamp/long-terms/many-item cases were rendered and checked. EN/AM account and portal previews pass. Physical Android acceptance remains pending. Expo build `2ebbf906-a52b-450d-b797-99e0543ea6de` finished successfully. The downloaded APK version 2.0.8/code 11 passes ZIP integrity, v2 signature/content-digest, same-prior-certificate and bundled-font checks. Compiled password-change controls, optional custom-terms property, secure system-font choice, textZoom option, flowing PDF closing CSS, live API URL and minimum-six-digit guidance are verified. The old hardcoded service/agreement paragraph and obsolete password hints are absent. APK size: 92,931,363 bytes; SHA-256: `ebf27846d5c58a2a6899184a847e397d675210de19309e40091b762a1866bb7e`. Evidence: `artifacts/eas-build-2.0.8.json` and `artifacts/apk-verification-2.0.8.json`. See docs/FEEDBACK-FIXES-2.0.8.md and artifacts/pdf-verification-2.0.8.json.

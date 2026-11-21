# Proforma Studio 2.0.5 — optional organization stamp

Android version code 8. This update is mobile-only: no DirectAdmin, database, signing-key or payment changes are required.

## Add your stamp

1. Install `Proforma-Studio-2.0.5.apk` over the existing app. Export a business-data backup first. Keep the app installed so its database and device licence key remain intact.
2. Open **Company profile**, then **Organization stamp (optional)**.
3. Tap **Choose PNG stamp**, select your organization's PNG image and save the company. A transparent background is recommended. The app preserves the original PNG bytes and aspect ratio. JPEG/SVG files are not accepted; maximum size is 10 MB and 4096 × 4096 pixels.
4. Preview/export a new proforma. The stamp appears at the lower right of the closing details, above Terms & Conditions, in a separate area clear of the totals and text. The stamp is printed without a visible caption in either language; its larger image area is approximately 48 × 46 mm with the aspect ratio preserved.
5. To replace the stamp, choose another PNG and save. To stop using it on new invoices, select **Remove stamp** and save.

The stamp is optional. Companies and invoices without a stamp keep their previous behaviour. Cancelling the picker or a failed save retains the existing selection.

## Historical records and backups

- Draft PDFs use the current company stamp. On issue, the PNG bytes are embedded in the invoice's company snapshot. Changing/removing the company stamp later does not change issued/void invoices, and old issued invoices do not acquire a stamp retroactively.
- A selected stamp that is missing, unreadable or invalid stops issue/export with an error rather than silently producing a document without it. A failed issue does not consume an invoice number.
- Stamps are local document assets. They are excluded from the activation profile sent to Laravel and are preserved when the server returns a canonical company profile or recovers a local licence. This feature does not grant or change licence authority.
- Business-data backups include both current and historical stamps. Identical stamp assets are stored once, PNG data is validated, and archive paths/checksums remain checked. Restore converts the company stamp to a permanent local image; issued snapshots remain self-contained.
- New backups use **format 2** and need app 2.0.5 or later. Existing format-1 backups from earlier app versions remain readable. A stamp on a replacement phone is recovered through the business-data backup, not through the activation server alone.

No source images are deleted when replacing/removing a stamp, which protects references still used by drafts and historical records. File cleanup can be considered separately once references are audited.

## Verification

TypeScript and 84 mobile tests pass: 40 core tests plus 44 UI/integration tests. These cover PNG signature/chunks/CRC, invalid formats, cancellation, byte-preserving copy, EN/Amharic selection controls, failed submission, canonical registration responses, issue rollback, historical replacement/removal, archive deduplication, corrupt/missing assets and old-format restore. Existing authentication, payment, offline/licence and PDF tests remain passing.

Three QA PDFs were created using the actual HTML generator, bundled fonts and a transparent **DEMO COMPANY / SAMPLE / NOT VALID** stamp: English, Amharic and a five-page Amharic invoice. All seven pages were rendered and inspected after enlarging the stamp and removing the caption. Automated PDF checks verify embedded transparency, one stamp on the final page, no overlap with extracted text, embedded fonts, copyable amounts, matching totals, alignment and page counters. The demo stamp exists only as a test fixture; it is not attached to real companies by the application.

Reproduction: from `mobile`, run `npx tsx scripts/stamp-pdf-fixtures.ts`, then `node scripts/render-stamp-pdfs.cjs` with the local Playwright/Chrome paths configured as in the bilingual PDF guide. From the workspace root, run `python scripts/verify-stamp-pdfs.py`. Evidence: `artifacts/pdf-verification-2.0.5.json`.

Actual Android gallery/provider selection, viewing the transparent image and save/share/print sheets still require physical-phone acceptance. Desktop PDF QA uses a separate headless Chromium renderer with the same HTML, not an Android device.

The final 2.0.5/code 8 Expo build `a1ceec49-2f36-4de4-9d82-c902bfd9a004` finished successfully. The downloaded APK includes the larger stamp area and removal of the printed caption. ZIP integrity, APK v2 signature/content digest, the same prior signing certificate, package/version, bundled font hashes and compiled stamp layout are verified. APK bytes: 92,926,663; SHA-256: `eb457f9aee89895ac90fd26fdb240995083cde1e9cf6ad742929efeda84001ad`. Evidence: `artifacts/eas-build-2.0.5.json` and `artifacts/apk-verification-2.0.5.json`. This artifact verification does not replace physical-phone acceptance.

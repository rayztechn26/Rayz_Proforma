# Admin payment wording update — 22 October 2026

This small update changes only the payment-settings labels, explanatory text and Instructions textarea height. The matching Amharic labels are included. It does not change payment approval, authentication, licensing, fees, recipient details, support numbers or the existing approval-time value. Continue using Android APK 2.0.5; no rebuild is required.

## DirectAdmin

1. Back up these existing server files before replacing them:
   - proforma-app/resources/views/admin/settings.blade.php
   - proforma-app/lang/am.json
2. Upload the matching files from this archive to those exact locations inside `/domains/proforma.rayztechnology.com/`. The `proforma-app` folder belongs beside `public_html`. Do not put it inside `public_html`.
3. Open your live admin portal → Payment settings. Replace only the **Instructions** field with the full contents of `PAYMENT-INSTRUCTIONS.txt`, then click **Save settings**. Keep all other values, including the approval time, as they are.
4. Refresh the page and confirm the three new labels and the new paragraph under Payment instructions. If the old wording persists, remove only compiled `.php` view files in `proforma-app/storage/framework/views/`, keeping `.gitignore`, then refresh.

The instructions are stored in the database. Uploading the two portal files updates the labels/layout, but does not automatically replace the saved Instructions field. Pasting and saving is therefore required on the live portal. No SQL import or database migration is required.

Existing payment requests retain their original payment snapshot. The update contains no `.env`, accounts, private keys, receipts, database exports or public entry-point configuration.

## Local status and verification

The two portal files have been synchronized to `C:/wamp64/www/backend`, and its compiled views cleared. There was no saved payment-settings row in that local database, so no settings row was created and no payment records were modified. The prior local files were backed up outside the project.

Five existing backend tests pass (40 assertions), including retained form input and immutable expected fees for pending requests. English and Amharic settings templates were rendered with the supplied payment copy and checked at desktop/mobile widths. Browser checks confirm the approval-time fixture remains `2 min` and no horizontal overflow occurs. The supplied Instructions text is ready to paste; this archive has not been uploaded to the live server.

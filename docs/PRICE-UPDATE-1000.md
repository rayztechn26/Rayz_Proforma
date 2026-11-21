# Activation price update to ETB 1,000

The current English and Amharic launch materials and prepared website sections show a one-time ETB 1,000 activation fee per company. This supersedes the earlier ETB 3,000 proposal. Fictional invoice line prices in sample proformas are not activation fees and have not been changed.

## Apply the actual live fee

The production server has not been changed. In its administrator portal, open Payment settings:

1. Enter `1000.00` in One-time activation fee (ETB), without a thousands separator.
2. Change the Instructions opening sentence to: Activate Rayz Proforma with a one-time payment of ETB 1,000 per company.
3. Save, keeping the intended merchant, recipient, support contacts and other settings.
4. Refresh payment settings in Android and confirm the NEW-request fee is ETB 1,000 before payment. Updated website packages must also be deployed before their public pages change.

No new APK is required just for this fee change; the app fetches its fee from the server. Existing submissions retain their original fee and instruction snapshots. Do not reprice historical requests, remove approvals, consume another entitlement or recharge already activated companies as part of this price change. Contact support about an existing pending request if the new price should apply; do not submit another payment blindly.

No local or production database was modified in this revision. The prepared Rayz Services update remains a source integration package that must go through the main website's normal build and deployment process. The download destination remains https://proforma.rayztechnology.com/download/ until the main-domain configuration is arranged later.

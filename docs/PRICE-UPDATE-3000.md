# Activation price update to ETB 3,000

The current marketing copy, English and Amharic guides, promotional images, download website and Rayz Services product section now show a one-time ETB 3,000 activation fee per company. The sample invoice line item priced at ETB 500 is fictional demonstration data, not the activation fee.

## Production setting required

The live server has not been modified by this task. In its administrator portal, open Payment settings:

1. Set One-time activation fee (ETB) to `3000.00`. Use an ungrouped number in the input field.
2. Change the Instructions opening line to: Activate Proforma Studio with a one-time payment of ETB 3,000 per company.
3. Keep the verified recipient, Telebirr number and other settings as intended, then save.
4. Refresh account/payment settings on Android and verify ETB 3,000 is displayed for a NEW request before paying.

The app fetches the fee from the server, so a new APK is not required just for this price change. Changing marketing materials alone does not change the live fee.

Existing payment submissions keep their original fee/instruction snapshots. Existing approved payments, registration entitlements and activated licences should not be repriced, deleted or recharged. Do not import a clean database or edit historical payments to implement this price change.

No configured payment-settings row was found in the local WAMP database inspected during this change, so that database was left unchanged. Website and document packages need to be redeployed through their normal process; the Rayz source integration ZIP requires a normal website rebuild before deployment.

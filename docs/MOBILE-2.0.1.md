# Android 2.0.1 update

This update keeps the package com.proformastudio.app, Android signing identity, existing layout, English/Amharic language choice, local records, VAT calculation, backup/restore and company licensing flow. Android version code is 4.

- Select common units instead of typing: pcs, c/n, m, m², m³, g, kg, L, ct, veh and other packaging/service units. Both invoice lines and catalogue items use the selector. Existing custom unit values remain readable and preserved.
- Prices and calculated amounts display comma separators and two decimal places. A price field shows raw decimals while focused and formatted money when focus leaves. Calculations retain the existing decimal precision and rounding rules.
- Grand totals appear in figures and English words in the compose screen, preview and exported PDF. Both representations use the final VAT-inclusive rounded amount.
- Local development and all Expo build profiles use https://proforma.rayztechnology.com/api. No server credentials or private signing keys are included.

Export a business backup from the installed app before upgrading. Install the signed APK as an update over the existing app, without uninstalling it. Expo Go cannot load the Android device licensing module; use the signed APK or a development build.

Expo build: https://expo.dev/accounts/abatethomas1/projects/proforma-studio/builds/e140385e-ba67-46b8-941d-279b2ca66885

No backend/database upgrade or SQL reimport is required for these mobile changes. Deployment success and local tests do not replace testing real payment approval, activation, backup/restore and offline invoice/PDF use on a physical phone.

Verified APK: artifacts/Proforma-Studio-2.0.1.apk. Expo build finished successfully; package, version code, signing certificate and content digest are verified. Certificate matches the existing free release.

# Proforma Studio 2.0.4: bilingual PDF export

Android version code 7. The Expo build finished successfully; the downloaded APK signature, version, bundled font hashes and compiled bilingual PDF features were verified. This is a mobile-only update; the backend, database, payment approval, device licensing and existing records do not need changing.

## Using the update

Install `Proforma-Studio-2.0.4.apk` over the existing application. Export a business-data backup beforehand; do not uninstall or clear application storage, because the device licence key must remain on the phone.

Choose **EN** or **አማ** before using PDF preview, export, share or print. PDF labels, grand-total words, default Terms & Conditions and the proforma notice follow the current selection. The on-screen amount in words follows it too. Currency codes and standard measurement abbreviations remain unchanged. Page footers use language-neutral `1 / N` numbering.

Company/customer names, descriptions, notes, bank details and entered payment/delivery terms remain exactly as saved. They are not automatically translated. Issued invoice records and their prices/totals are not edited when switching language or generating a PDF. Already exported PDFs stay unchanged; export again to get the new language/layout.

## Layout

- Logo at the upper left, company information aligned to the right.
- Centred invoice title between divider lines, customer information on the left, and an invoice-details table on the right.
- Right-aligned numeric columns and separate right-aligned subtotal, VAT and grand-total amounts, with a highlighted grand-total row.
- Amount in words below the totals. A closing section keeps short totals/words/terms together on multipage invoices; long content continues naturally to following pages.
- Terms & Conditions at the end: “All services provided are subject to the terms and conditions outlined in the agreement or engagement letter.” The Amharic export includes its translated equivalent. Existing payment and delivery terms are also printed.

Both PDF languages embed Noto Sans Ethiopic regular/semibold fonts, including Latin support. This covers mixed-language business details and avoids dependence on fonts installed in a recipient's PDF viewer. A copied-numeral issue found with Inter/OpenType numeric alternates during QA was resolved by using the PDF font family that preserves Unicode extraction. The app interface keeps its existing Inter/Ethiopic typography.

Number spelling uses exact decimal strings and the same half-up rounded cents as the displayed total. ETB, USD, EUR and GBP have named major/minor units in both languages. Other currencies retain their supplied code and use hundredths. Very large Amharic values recurse in trillion groups, preserving the exact integer without JavaScript floating-point conversion. General Ethiopic numeral terminology was cross-checked against [Unicode CLDR Amharic spellout data](https://github.com/unicode-org/cldr/blob/main/common/rbnf/am.xml); the conventional tens wording is implemented locally.

## Verification

- TypeScript, 36 core tests and 38 mobile UI/integration tests pass.
- Tests cover Amharic words, fractions, rounding carry, large values, English singular units, HTML escaping, unchanged records, all four PDF actions following a live language switch, retryable font failure and licence rejection before PDF generation.
- Three standalone QA PDFs were created from the actual HTML generator using embedded bundled fonts: English (one page), Amharic (one page) and Amharic with 48 lines/long descriptions (five pages). All seven pages were rendered and visually inspected.
- Rendered PDF checks verify embedded fonts, searchable/copyable digits, translated labels, expected financial totals, matching page counters, content within page bounds, aligned totals and the final closing section. Evidence: `artifacts/pdf-verification-2.0.4.json`.
- Samples use fictional data and the app logo as a sample company logo. Real exports use the selected company's logo.

Reproduce with `npx tsx scripts/localized-pdf-fixtures.ts` and `node scripts/render-localized-pdfs.cjs` from `mobile`, then `python scripts/verify-localized-pdfs.py` from the workspace root. Set `PLAYWRIGHT_MODULE`/`CHROME_PATH` to the local renderer installation if needed. The render script starts a separate headless process and does not access user browser sessions.

The standalone render uses desktop Chromium with the same generated HTML, not an Android device. Physical-phone acceptance of Android WebView printing, font loading in airplane mode and native save/share/print sheets remains necessary. Hosting security exceptions remain the hosting provider's responsibility and are independent of PDF layout.

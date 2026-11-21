from pathlib import Path
import shutil,json,hashlib,zipfile

ROOT=Path(__file__).resolve().parents[1]
SITE=Path('D:/xampp/htdocs/rayztech')
OUT=ROOT/'output/rayz-services-integration'
CHANGED=['src/pages/ServicesPage.tsx','src/components/site/ProformaStudioProduct.tsx','src/components/site/proforma-studio.css','src/lib/i18n.tsx','src/lib/proformaAnalytics.ts']
OUT.mkdir(parents=True,exist_ok=True)
for name in CHANGED:
    dst=OUT/'source'/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(SITE/name,dst)
shutil.copytree(SITE/'public/proforma-studio',OUT/'source/public/proforma-studio',dirs_exist_ok=True)
(OUT/'deployment').mkdir(exist_ok=True)
(OUT/'deployment/services-spa-routes.htaccess.txt').write_text('''# MERGE into the MAIN rayztechnology.com document-root .htaccess after review.
# Do not replace existing HTTPS, PHP, authentication, access-control or API rules.
# Scoped to Services SPA routes; real files/directories retain normal handling.
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_METHOD} ^(?:GET|HEAD)$
  RewriteCond %{REQUEST_URI} ^/services(?:/[^/.]+)?/?$
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>
''',encoding='utf-8')
(OUT/'README.md').write_text('''# Rayz Technology Services page Rayz Proforma integration

Prepared 27 October 2026. This is a SOURCE integration package and public product assets, not a replacement of the whole live website. The local matching website at D:\\xampp\\htdocs\\rayztech has already received these source edits. No hosting files, social accounts, lead records or production API settings were modified.

## What was added

A dedicated ready-to-use Rayz Proforma product section on /services, after the introductory hero and before the eleven existing service categories. It follows the website's existing navy/cyan theme and uses its existing Eng/Am language switch. There is no second independent language switch.

- English and Amharic description and feature list.
- ETB 1,000 one-time activation per company; device-bound activation and online activation/offline work explained.
- Download and activation button to https://proforma.rayztechnology.com/download/?lang=en or lang=am, retained at the owner's request. No APK has been moved to the main website.
- Product brochure, EN/AM user guides and fictional sample PDFs hosted under /proforma-studio/documents/ on the main website after deployment.
- Real component screenshots with fictional sample data, scoped Ethiopic fonts, support telephone links and the exact product-channel links supplied by the owner.
- Expandable activation instructions showing Telebirr 0911099246, recipient Thomas Abate, review/approval steps and a warning against paying twice after a connection error.
- No claim of iPhone support, automatic cloud synchronization, tax-invoice certification or guaranteed two-minute approval.

## Source files

1. src/components/site/ProformaStudioProduct.tsx: new product component and bilingual copy. Change downloadPage here when the main-domain download destination is configured later.
2. src/components/site/proforma-studio.css: font rules scoped to this product section, so the rest of the website keeps its styling.
3. src/pages/ServicesPage.tsx: imports and mounts the new section. Compare before replacing if this file changes in another task.
4. src/lib/i18n.tsx: a one-line type correction from an English-only literal type to the union of EN/AM message objects. Translation strings and runtime behavior are unchanged by this correction. Merge this one line instead of replacing the entire file if translations change later.
5. public/proforma-studio/: icon, EN/AM screenshots, fonts with their licence and five previously prepared PDFs.

## Build and deploy when ready

1. Review the product copy, price, recipient details and Amharic translation. Confirm the Proforma subdomain /download/ and /download/demo.html are actually uploaded and accessible before publishing their links. The earlier launch pack contains that website and APK.
2. Back up the main website source and deployed document root. Keep a copy of the current index.html and its matching hashed assets for rollback.
3. The local source is already updated. On another checkout, merge the source/ tree into the actual Rayz website source. Do NOT upload TSX files directly into public_html and expect the live React site to change.
4. Run the normal trusted production build in that website repository using its intended production configuration. Upload the new dist/index.html, new matching dist/assets/ files and dist/proforma-studio/ directory together through the existing deployment process. Preserve PHP /api files, server configuration, lead storage and existing .htaccess rules. Retain old hashed assets during the rollout so existing browser sessions still load.
5. The verification build in D:\\Projects\\ProformaApp\\tmp\\rayz-services-preview deliberately used an empty env directory and is ONLY a local preview. It is not included as a production deployment and must not replace the site's configured production build. Existing admin/contact configuration needs the normal production deployment process.
6. The live /services URL returned a LiteSpeed 404 on direct navigation, but worked after clicking Services from the homepage. This is consistent with a missing server fallback for client-side routes. deployment/services-spa-routes.htaccess.txt is a SCOPED merge candidate for GET/HEAD /services routes on Apache/LiteSpeed. Review and merge it with existing rules; do not overwrite the whole .htaccess. Its effect has not been verified on the hosting server. Other routes are outside this scoped candidate.
7. Test a direct visit and reload of https://rayztechnology.com/services, then the EN/AM switch, images, price, guide PDFs, sample PDFs, activation details, telephone links and channel links. Verify that API requests and real static files are handled normally, and existing site navigation/contact behavior still works.
8. Keep this update unpublished until the final preview and hosting setup are approved. No payment or activation authority is changed by this website section.

## Verification performed

- TypeScript app check passes after the existing translation-context type correction.
- Vite production compilation passes with an isolated empty env directory; no .env credentials were read into the preview build.
- ESLint on changed TSX files: no errors; one pre-existing Fast Refresh warning in the translation context file.
- Browser review of the actual Services page in English and Amharic; language-specific download/guide/sample links and screenshot switch verified. Activation disclosure opens and renders the four steps.
- Both product images load and the section stays within the tested desktop document width. Mobile stacking is implemented in responsive classes; a physical-phone website acceptance check remains recommended.
- /services and ten product static resources returned HTTP 200 locally, with expected image/font/PDF content types. See http-checks.json.
- Earlier PDFs were copied unchanged from the launch pack, where all 20 pages were rendered and checked.
- No live deployment, external purchase, contact-form submission or API mutation was performed.

## Local review

http://127.0.0.1:8099/services#proforma-studio while the local preview server is running. Scroll below the existing introductory hero to see the product section. preview-en.png and preview-am.png show browser captures of the integrated design.
''',encoding='utf-8')
files=[p for p in OUT.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt']
for p in files:
    assert p.name not in ['.env','.env.local','contact.php','leads.json'] and p.suffix not in ['.pem','.sql'],p
(OUT/'SHA256SUMS.txt').write_text('\n'.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(OUT).as_posix() for p in sorted(files))+'\n',encoding='utf-8')
archive=ROOT/'artifacts/Rayz-Services-Proforma-Integration-EN-AM.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted(OUT.rglob('*')):
        if p.is_file():z.write(p,'Rayz-Services-Proforma-Integration/'+p.relative_to(OUT).as_posix())
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
print('Prepared',archive.name,archive.stat().st_size,'bytes; ZIP integrity passed.')

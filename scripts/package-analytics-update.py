from pathlib import Path
import sys,runpy,shutil,zipfile,hashlib,json
root=Path('D:/Projects/ProformaApp');sys.path.insert(0,str(root/'scripts'))
g=runpy.run_path(str(root/'scripts/build-launch-pack.py'));g['website']();g['privacy']();g['demo']()
for name in ['index.html','privacy.html','analytics.js','demo.html','demo.js','style.css','site.js']:
 shutil.copy2(root/'output/launch-pack/website'/name,Path('C:/wamp64/www/backend/public/download')/name)
out=root/'output/analytics-update';out.mkdir(exist_ok=True)
backendfiles=['routes/api.php','routes/web.php','app/Services/WebsiteAnalytics.php','app/Http/Controllers/WebsiteAnalyticsController.php','database/migrations/2026_10_27_000001_website_analytics.php','resources/views/admin/dashboard.blade.php','resources/views/admin/website-analytics.blade.php','public/website-analytics-admin.js','lang/am.json']
server=out/'proforma-server'
for name in backendfiles:
 p=server/'proforma-app'/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/'backend'/name,p)
p=server/'public_html/website-analytics-admin.js';p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/'backend/public/website-analytics-admin.js',p)
for name in ['index.html','privacy.html','analytics.js','demo.html','demo.js','style.css','site.js']:
 p=server/'public_html/download'/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/'output/launch-pack/website'/name,p)
for name in ['Inter_400Regular.ttf','Inter_600SemiBold.ttf','Inter-OFL.txt']:
 for base in [Path('C:/wamp64/www/backend/public/download'),server/'public_html/download']:
  target=base/'assets'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/'output/launch-pack/website/assets'/name,target)
notes='''RAYZ PROFORMA - WEBSITE COUNTERS UPDATE
Prepared 27 October 2026. Local WAMP implementation tested; NOT deployed live.

WHAT IT SHOWS
Public download page: all-time page views, estimated browsers today, official APK download requests, browsers active in the last 2 minutes.
Private /admin dashboard: those metrics plus daily views/downloads, separately for the main website Proforma section and download page. Refresh every 15 seconds while visible. Today uses Ethiopian time (UTC+3).
A browser is estimated using a random daily local-storage ID. It is not a verified person. Different browsers/devices, cleared storage, blocking and bots affect counts. Shared IPs do not identify people. The main website counts exposure of the Proforma Services section, not every visit anywhere on rayztechnology.com. Viewing it several times in one page load counts once; a reload is another view.
APK counts are accepted requests to the official download endpoint, not completed transfers, installations or licences. HEAD/range-resume requests do not increment. Existing direct static APK links bypass the counter. No earlier traffic can be recovered from this feature; hosting access logs may contain historical traffic.

PACKAGE 1: Rayz-Proforma-Analytics-Server-Update.zip
This ZIP contains proforma-app/ and public_html/. These two folders map to siblings under /domains/proforma.rayztechnology.com/. DO NOT extract this ZIP inside public_html alone, because it also has private Laravel files.
1. Back up the corresponding live files and database.
2. In DirectAdmin open /domains/proforma.rayztechnology.com/. Upload/extract the ZIP there, mapping proforma-app/ to the existing PRIVATE Laravel directory and public_html/ to its public document root. Alternatively upload the files individually using the matching paths.
3. routes/api.php, routes/web.php, dashboard.blade.php and lang/am.json are existing files. Compare/merge if your live files contain newer changes. Keep existing authentication, payments, approvals and licences. This change adds analytics routes and one dashboard include only.
4. Before opening the updated download page to customers, run this from the PRIVATE Laravel application directory:
php artisan migrate --path=database/migrations/2026_10_27_000001_website_analytics.php --force
php artisan route:clear
php artisan view:clear
This adds three analytics-only tables. It does not reset or modify accounts, payments, companies or entitlements. Do not run migrate:fresh or migrate:refresh. If DirectAdmin has no terminal, ask hosting support to run the exact commands.
5. Keep .env, APP_KEY, database credentials, licence keys and public_html/index.php/.htaccess unchanged. The APK and PDF files are unchanged and are not in this small patch. Existing download/downloads/Proforma-Studio-2.0.8.apk must remain available. When releasing a new APK, update the fixed file path in WebsiteAnalyticsController.php as well as the landing page/release manifest.
6. Open https://proforma.rayztechnology.com/download?lang=en and ?lang=am. View the counters, refresh the page and check the count increases without adding an extra estimated browser. Sign in normally at /admin and check the analytics table. Test the official APK link and the existing payment/activation workflow.
7. Remove the uploaded ZIP after extracting. Keep the backup privately. To roll back, restore the backed-up routes, dashboard and download index. Leave the new analytics tables in place; no destructive rollback is required.

PACKAGE 2: Rayz-Technology-Analytics-Website-Update.zip
Optional for measuring the MAIN website's Proforma section. This is a consistent compiled frontend build from D:\\xampp\\htdocs\\rayztech, also copied to its local dist/ for testing.
Upload/extract CONTENTS into rayztechnology.com's existing document root, after backing it up. assets/, proforma-studio/ and index.html belong directly in that root. Preserve existing PHP API files, lead storage, .htaccess, and old hashed assets. If copying individually, assets first and index.html last. This package does not belong to the Proforma subdomain.
The main website sends anonymous events to https://proforma.rayztechnology.com/api/analytics/events only when the Proforma section enters view. Localhost previews send to WAMP at http://127.0.0.1:8087 instead. No credentials or cross-site cookies are transmitted by analytics.

HOSTING
Allow POST /api/analytics/events, GET /api/analytics/public, and GET/HEAD /api/analytics/apk through the hosting WAF as normal API/download traffic. Existing Imunify360 HTML challenges cannot be fixed by these app counters. Ask hosting support for a narrowly scoped rule if blocked; do not disable authentication or the entire WAF.
Do not cache analytics JSON or the APK response at a CDN/proxy; endpoints send Cache-Control: no-store. If a Content-Security-Policy is already set on rayztechnology.com, its connect-src must permit the Proforma analytics origin. Form-encoded cross-origin tracking does not require enabling credentialed CORS.

PRIVACY AND FAILURE BEHAVIOR
The download privacy notice now describes this feature in EN/AM. Review it before publication. Analytics records only keyed digests of random daily IDs, timestamps, page category and retry IDs; it stores no account/payment data or IP addresses. Older anonymous records are cleaned during tracking activity after 30 days; aggregate daily counts remain. Web-server access logs are separate.
During service/WAF errors the page keeps its last counts and shows unavailable/Retry, not a fabricated zero. Page content and business functionality remain independent. If analytics storage fails, the official APK response is still served.

LOCAL TEST
http://127.0.0.1:8087/download?lang=en
http://127.0.0.1:8087/admin (normal sign-in)
http://127.0.0.1:8101/services#proforma-studio
Local counters include local QA visits and one verified APK download. Production starts separately at zero when deployed. Local database rows are NOT in the upload packages.

VALIDATION
48 Laravel tests passed, 356 assertions (with the PHP CLI OpenSSL config set for the existing licence tests). Includes retries, admin second-factor protection, no inflation from HEAD/ranges, download continuation during analytics failure and all existing activation/security tests.
Website TypeScript check and production build passed. WAMP public JSON and browser EN/AM counters tested; real APK bytes matched the verified release checksum. No live analytics endpoint was mutated by these tests.
'''
(out/'UPLOAD-INSTRUCTIONS.txt').write_text(notes,encoding='utf-8')
for name,folder in [('Rayz-Proforma-Analytics-Server-Update.zip',server),('Rayz-Technology-Analytics-Website-Update.zip',root/'output/website-phase-1/upload/public_html')]:
 archive=root/'artifacts'/name
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for f in sorted(folder.rglob('*')):
   if f.is_file():
    assert f.suffix not in ['.env','.pem','.sql']
    z.write(f,f.relative_to(folder).as_posix())
 with zipfile.ZipFile(archive) as z:assert z.testzip() is None
 print(name,archive.stat().st_size,'bytes; ZIP integrity passed')
(out/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256((root/'artifacts'/n).read_bytes()).hexdigest()+'  '+n+'\n' for n in ['Rayz-Proforma-Analytics-Server-Update.zip','Rayz-Technology-Analytics-Website-Update.zip']))

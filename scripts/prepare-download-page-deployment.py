from pathlib import Path
import shutil,hashlib,json,zipfile,datetime,urllib.request
root=Path('D:/Projects/ProformaApp')
src=root/'output/launch-pack/website'
dst=Path('C:/wamp64/www/backend/public/download')
out=root/'output/download-page-deployment'
out.mkdir(parents=True,exist_ok=True)
if dst.exists():
 backup=root/'tmp/download-page-backups'/datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
 shutil.copytree(dst,backup)
shutil.copytree(src,dst,dirs_exist_ok=True)
# The upload ZIP has one download/ directory, so extraction is into public_html.
archive=root/'artifacts/Rayz-Proforma-Download-Page-Upload.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(src.rglob('*')):
  if p.is_file():
   assert p.suffix not in ['.pem','.sql','.env','.php'],p.name
   assert hashlib.sha256(p.read_bytes()).digest()==hashlib.sha256((dst/p.relative_to(src)).read_bytes()).digest()
   z.write(p,'download/'+p.relative_to(src).as_posix())
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
checks=[]
for rel in ['', 'index.html','site.js','style.css','demo.html','privacy.html','release.json','assets/icon.png','documents/Proforma-Studio-User-Guide-EN.pdf','documents/Proforma-Studio-User-Guide-AM.pdf','documents/Proforma-Studio-Brochure-EN-AM.pdf']:
 url='http://127.0.0.1:8087/download'+('?' if rel=='' else '/'+rel+'?')+'lang=en'
 with urllib.request.urlopen(url) as r:
  body=r.read()
  assert r.status==200
  file=src/(rel or 'index.html')
  assert hashlib.sha256(body).digest()==hashlib.sha256(file.read_bytes()).digest(),rel
  checks.append({'path':rel or '/download?lang=en','status':r.status,'contentType':r.headers.get_content_type(),'finalUrl':r.url,'matchesPreparedFile':True})
# Check APK delivery type/size without repeatedly transferring the binary.
rel='downloads/Proforma-Studio-2.0.8.apk'
with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8087/download/'+rel,method='HEAD')) as r:
 assert r.status==200 and int(r.headers['Content-Length'])==(src/rel).stat().st_size
 checks.append({'path':rel,'status':200,'contentType':r.headers.get_content_type(),'bytes':int(r.headers['Content-Length'])})
(out/'LOCAL-VERIFICATION.json').write_text(json.dumps(checks,indent=2),encoding='utf-8')
(out/'UPLOAD-INSTRUCTIONS.txt').write_text('''RAYZ PROFORMA DOWNLOAD PAGE - LOCAL TEST AND DIRECTADMIN UPLOAD
Prepared 27 October 2026

LOCAL WAMP TEST
Files are installed at C:\\wamp64\\www\\backend\\public\\download
English: http://127.0.0.1:8087/download?lang=en
Amharic: http://127.0.0.1:8087/download?lang=am
This uses the existing WAMP Apache site. No app database, payment, licence, authentication or server configuration was changed.

ANALYTICS DEPENDENCY
If this page includes live counters, deploy Rayz-Proforma-Analytics-Server-Update.zip and its three-table migration first. See output/analytics-update/UPLOAD-INSTRUCTIONS.txt. The new official download link uses /api/analytics/apk. A static-page-only upload cannot create those backend routes.

WHAT IS IN THE ZIP
Rayz-Proforma-Download-Page-Upload.zip contains one folder named download.
Inside it: index.html, demo.html, privacy.html, style.css, site.js, release.json, assets/, documents/ and downloads/.
The included APK is the unchanged verified release 2.0.8, with the previous Proforma Studio name. The landing page explains this. No new APK has been built by this task. Screenshots show the renamed source.
Privacy content remains a draft requiring owner review before public launch.

DIRECTADMIN - AFTER LOCAL TESTING
1. Open File Manager for proforma.rayztechnology.com, not rayztechnology.com.
2. Go to /domains/proforma.rayztechnology.com/public_html/
3. If a download folder already exists, back it up first.
4. Upload Rayz-Proforma-Download-Page-Upload.zip directly into public_html and extract it THERE. This ZIP already contains the download folder. Do not extract inside another download folder.
5. Confirm this file exists: /domains/proforma.rayztechnology.com/public_html/download/index.html
6. Preserve public_html/index.php, .htaccess and all Laravel/private application files. The ZIP does not replace them.
7. Open https://proforma.rayztechnology.com/download?lang=en and ?lang=am. Apache may redirect to /download/?lang=en; that is normal. Check both language buttons, guides, samples, brochure, demonstration and APK download.
8. Confirm the downloaded APK has SHA-256:
ebf27846d5c58a2a6899184a847e397d675210de19309e40091b762a1866bb7e
9. After checking, remove the uploaded ZIP from public_html. Keep a private backup for rollback.

No hosting upload or live publication has been performed. Hosting MIME/download restrictions or Imunify360 challenges must still be resolved by the hosting provider if encountered; this static page cannot bypass them.
''',encoding='utf-8')
(out/'UPLOAD-ZIP-SHA256.txt').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print(json.dumps({'localFolder':str(dst),'zip':str(archive),'bytes':archive.stat().st_size,'httpChecks':len(checks),'zipIntegrity':'passed','allCopiedFilesMatch':True},indent=2))

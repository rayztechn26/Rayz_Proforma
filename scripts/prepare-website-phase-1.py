from pathlib import Path
import json,hashlib,zipfile,re,urllib.request,shutil
root=Path('D:/Projects/ProformaApp')
out=root/'output/website-phase-1';web=out/'upload/public_html'
(out/'deployment').mkdir(parents=True,exist_ok=True)
shutil.copy2(root/'output/rayz-services-integration/deployment/services-spa-routes.htaccess.txt',out/'deployment/services-route-merge.txt')
(out/'START-HERE.txt').write_text('''PHASE 1 - RAYZ TECHNOLOGY WEBSITE ONLY
Prepared: 27 October 2026

Website: https://rayztechnology.com
Local source: D:\\xampp\\htdocs\\rayztech
Upload folder: upload\\public_html
Upload archive: Rayz-Technology-Website-Phase-1-Upload.zip

This is the compiled website, ready for the existing website document root.
It contains the Rayz Proforma Services section, ETB 1,000 price, English/Amharic content, screenshots, brochure, user guides and sample PDFs. It also contains the rest of the matching website frontend so index.html and its hashed assets remain a consistent build.

1. You may switch from WAMP to XAMPP for website work. Building this package did not require stopping or starting either Apache/MySQL service. Avoid running both Apache services on the same port.
2. Back up the LIVE rayztechnology.com website document root and current .htaccess before uploading. Record its actual folder in your hosting panel; do not use the proforma subdomain folder.
3. Upload Rayz-Technology-Website-Phase-1-Upload.zip into the MAIN website document root and extract there. index.html and assets/ must be directly inside that root. There must not be an extra public_html/ or dist/ layer.
4. Add/overwrite the packaged frontend files. Do not delete the existing website first. Keep existing api/, PHP files, storage/, server configuration and old hashed asset files. Upload assets and proforma-studio first, and replace index.html last if transferring files individually.
5. This archive contains NO replacement .htaccess. Keep your current .htaccess. If direct /services navigation returns 404 while navigation from the homepage works, merge the separate deployment/services-route-merge.txt snippet with the existing root .htaccess. It is a scoped /services route fallback, not a complete server configuration.
6. Open https://rayztechnology.com/services and reload it. Check EN/AM, Rayz Proforma, the ETB 1,000 fee, image, brochure and both language guides/samples. Confirm the existing homepage, other services and contact form still work. Local checks do not confirm the live PHP/API configuration.
7. The product Download & activate button keeps https://proforma.rayztechnology.com/download/. This package does not configure or upload that destination, an APK or the activation backend. Prepare/check that destination in its own later phase before announcing paid downloads.
8. After verifying the live result, remove the uploaded ZIP from the web document root. Keep the backup and previous matching index/assets for rollback. To roll back, restore the previous index.html and its matching assets; do not restore or overwrite lead data.

NOT INCLUDED IN THIS PHASE
App/WAMP changes, Android or Expo builds, Laravel admin/API deployment, database changes, licence keys, social-account edits and live publication by the assistant.

The existing website contact API and frontend admin mechanism are unchanged. This package is a content/frontend deployment, not a security upgrade. No .env, PHP API, lead records, private keys, node_modules or source repository are included.

Local build preview: http://127.0.0.1:8100/services#proforma-studio
The Vite preview is independent of XAMPP Apache. If you want to view through Apache itself, configure the local document root and SPA fallback for these built files; the raw TSX source folder is not a built website.
''',encoding='utf-8')
checks=[]
for p in sorted(web.rglob('*')):
 if not p.is_file():continue
 assert p.suffix not in ['.pem','.sql','.env','.php','.tsx','.ts','.map'],p.name
 assert not any(x in p.parts for x in ['node_modules','storage','api'])
 rel=p.relative_to(web).as_posix()
 with urllib.request.urlopen('http://127.0.0.1:8100/'+urllib.parse.quote(rel)) as response:
  assert response.status==200
  assert hashlib.sha256(response.read()).hexdigest()==hashlib.sha256(p.read_bytes()).hexdigest(),rel
  checks.append({'path':rel,'status':200,'contentType':response.headers.get_content_type(),'matchesUploadFile':True})
assert 'Rayz Proforma' in ''.join(p.read_text(encoding='utf-8') for p in (web/'assets').glob('ServicesPage-*.js'))
(out/'VERIFICATION.json').write_text(json.dumps({'productionBuild':True,'source':'D:/xampp/htdocs/rayztech','typecheck':'passed','files':checks,'liveDeployment':False,'apiOrPaymentMutations':False},indent=2),encoding='utf-8')
(out/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(web).as_posix()+'\n' for p in sorted(web.rglob('*')) if p.is_file()),encoding='utf-8')
archive=root/'artifacts/Rayz-Technology-Website-Phase-1-Upload.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(web.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(web).as_posix())
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
print(f'Website upload archive: {archive.name}; {archive.stat().st_size} bytes; {len(checks)} local files verified; ZIP integrity passed.')

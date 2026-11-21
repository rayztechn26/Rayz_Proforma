from pathlib import Path
import json,hashlib,shutil,runpy,sys,zipfile,re,datetime
root=Path(__file__).resolve().parents[1];out=root/'output/android-2.0.9-release';out.mkdir(parents=True,exist_ok=True)
report=json.loads((root/'artifacts/Rayz-Proforma-2.0.9-verification.json').read_text())
assert report['versionName']=='2.0.9' and report['versionCode']==12 and report['applicationLabels']==['Rayz Proforma'] and report['sameSigningCertificateAs208']
apk=root/'artifacts/Rayz-Proforma-2.0.9.apk';assert hashlib.sha256(apk.read_bytes()).hexdigest()==report['sha256']
# Save source and local deployed metadata before changing the active download release.
backup=root/'tmp/release-209-before'/datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
for rel in ['scripts/build-launch-pack.py','scripts/launch-content.json']:
 target=backup/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/rel,target)
p=root/'scripts/launch-content.json';data=json.loads(p.read_text(encoding='utf-8'));old=data['version'];data['version']='2.0.9';data['date']='2026-10-27'
for lang in ['en','am']:data[lang]['footer']=data[lang]['footer'].replace(old,'2.0.9')
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=root/'scripts/build-launch-pack.py';s=p.read_text(encoding='utf-8').replace(old,'2.0.9')
s=re.sub(r"APK=ROOT/'artifacts/[^']+\.apk'", "APK=ROOT/'artifacts/Rayz-Proforma-2.0.9.apk'",s)
s=re.sub(r"assert HASH=='[a-f0-9]{64}'", "assert HASH=='"+report['sha256']+"'",s)
s=s.replace("'versionCode':11", "'versionCode':12").replace('version code 11','version code 12')
s=s.replace('Proforma-Studio-2.0.9.apk','Rayz-Proforma-2.0.9.apk')
s=s.replace('The current APK is version 2.0.9 and still shows the previous name, Proforma Studio. The renamed Android build is not included yet.', 'Rayz Proforma 2.0.9. Existing users: install this update over your current app; do not uninstall first.')
s=s.replace('ያለው APK ስሪት 2.0.9 ሲሆን የቀድሞውን ስም Proforma Studio ያሳያል። አዲሱ ስም ያለው የአንድሮይድ ስሪት ገና አልተካተተም።','Rayz Proforma 2.0.9። ነባር ተጠቃሚዎች፦ ባለው መተግበሪያ ላይ ያዘምኑ፤ መጀመሪያ አያራግፉት።')
s=s.replace('Proforma Studio 2.0.9 for Android (previous branding)','Rayz Proforma 2.0.9 for Android').replace('Proforma Studio 2.0.9 ለአንድሮይድ (previous branding)','Rayz Proforma 2.0.9 ለአንድሮይድ')
s=s.replace('The included 2.0.9 APK is the unchanged previous release and still displays Proforma Studio; a newly built APK is required for the Android rename.', 'The included 2.0.9 APK displays Rayz Proforma. Its compiled name and existing signing certificate were verified.')
s=s.replace('No new APK or backend release was built.', 'A new signed Rayz Proforma 2.0.9 APK was built and verified.')
p.write_text(s,encoding='utf-8')
sys.path.insert(0,str(root/'scripts'));g=runpy.run_path(str(p));g['website']();g['privacy']();g['demo']()
web=root/'output/launch-pack/website';metadata=json.loads((web/'release.json').read_text())
assert metadata['version']=='2.0.9' and metadata['versionCode']==12 and metadata['apk']=='downloads/'+apk.name
assert 'Rayz Proforma 2.0.9' in (web/'index.html').read_text(encoding='utf-8')
assert 'renamed Android build is not included' not in (web/'index.html').read_text(encoding='utf-8')
assert '/api/analytics/apk' in (web/'index.html').read_text(encoding='utf-8')
# Local staging only: keep existing older APK files and user data untouched.
local=Path('C:/wamp64/www/backend')
for rel in ['app/Http/Controllers/WebsiteAnalyticsController.php','public/download/index.html','public/download/release.json']:
 target=local/rel
 if target.is_file():
  dst=backup/'wamp'/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,dst)
shutil.copytree(web,local/'public/download',dirs_exist_ok=True)
shutil.copy2(root/'backend/app/Http/Controllers/WebsiteAnalyticsController.php',local/'app/Http/Controllers/WebsiteAnalyticsController.php')
stage=out/'server-update'
for f in sorted(web.rglob('*')):
 if not f.is_file() or (f.suffix=='.apk' and f.name!=apk.name):continue
 dst=stage/'public_html/download'/f.relative_to(web);dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dst)
for rel in ['app/Http/Controllers/WebsiteAnalyticsController.php','app/Http/Controllers/AccountController.php','app/Http/Middleware/ApiToken.php','app/Models/User.php','app/Services/UserPassword.php','routes/api.php']:
 dst=stage/'proforma-app'/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/'backend'/rel,dst)

archive=root/'artifacts/Rayz-Proforma-2.0.9-Server-Update.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in sorted(stage.rglob('*')):
  if f.is_file():z.write(f,f.relative_to(stage).as_posix())
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
notes=f'''RAYZ PROFORMA 2.0.9 - READY APK AND DOWNLOAD SITE UPDATE

APK: Rayz-Proforma-2.0.9.apk
App label: Rayz Proforma
Version: 2.0.9 / Android code 12
Package: com.proformastudio.app (unchanged intentionally)
SHA-256: {report['sha256']}
Signing certificate matches 2.0.8. APK v2 signature, content digest, version and compiled app label verified.
Expo build: https://expo.dev/accounts/abatethomas1/projects/proforma-studio/builds/4b0f5b12-70be-42b2-8b49-25edcb2c9e5e

INSTALL / TEST
Export your business-data backup first. Install this APK over the current app; do not uninstall it first. Confirm Android App info shows Rayz Proforma 2.0.9. Package/project IDs retain the old internal name for compatibility.
Open Account > Change password. Connect to the Internet, enter the current password, then the new numeric password (at least 6 digits) and matching confirmation. The current session stays signed in; other account sessions are revoked. Existing longer/legacy current passwords remain accepted. Secure input dots and Show/Hide behavior are included. Test this with your own test account, not an administrator account; admin TOTP is unchanged.
Password updates, company activation and payment approval still require the server. Already activated devices retain offline business access. A database reset does not remotely clear an existing offline licence; see the earlier reset instructions for your own test-phone cleanup.

HOSTING UPDATE - OPTIONAL AFTER DEVICE REVIEW
The new server ZIP has TWO sibling folders: proforma-app/ (the download controller plus the matching account-password backend files and API routes) and public_html/download/ (website, manifest and new APK).
1. Back up the existing download folder and WebsiteAnalyticsController.php.
2. Upload/extract Rayz-Proforma-2.0.9-Server-Update.zip under /domains/proforma.rayztechnology.com/, NOT inside public_html. Map its private proforma-app/ folder to the existing Laravel app and public_html/ to the public document root.
3. The controller now reads the operator-managed download/release.json, validates the APK filename and serves that release through /api/analytics/apk. This prevents the tracked download button from continuing to serve 2.0.8. Replace this controller as well as the website/APK. It is backward-compatible with the old release manifest. The included AccountController, UserPassword, ApiToken and User files ensure the matching password-change implementation is deployed. Compare/merge routes/api.php if you have newer live customizations; keep existing payment, licence and analytics routes. After uploading, run php artisan route:clear from the private Laravel app directory, or ask hosting support to do so.
4. If transferring individually: controller first; new APK and other public assets next; release.json and index.html last. Keep the old APK during rollback/transition. This update does not require a database migration, reset, password/key change or main rayztechnology.com deployment. The existing analytics tables/routes from the earlier update must already exist.
5. Open https://proforma.rayztechnology.com/download?lang=en (and ?lang=am). It must show v2.0.9. Download using the official button and confirm the filename is Rayz-Proforma-2.0.9.apk and the checksum above matches. A renamed old APK will not match this checksum.
6. Remove the uploaded ZIP afterwards. Keep .env, APP_KEY, private keys, payment records, accounts and licences unchanged.

LOCAL REVIEW
The new download site is installed locally at C:/wamp64/www/backend/public/download. Test http://127.0.0.1:8087/download?lang=en.

VALIDATION / LIMITS
89 mobile automated tests passed (48 Android UI tests and 41 core tests). Password/account backend checks passed; the live password endpoint required authentication (401 on an empty unauthenticated request), without changing any live account.
The new release-manifest download handler and traversal rejection are covered by backend tests. The build profile runs native licence-module unit tests before assembling the release APK.
This is not a physical Android-device acceptance run. No phone was installed or password changed by the assistant. Live hosting has NOT been updated by this task. Guides/PDF samples are the previously prepared workflow references; no new PDF document release was generated.
'''
(out/'INSTALL-AND-UPLOAD.txt').write_text(notes,encoding='utf-8')
(out/'SHA256SUMS.txt').write_text(report['sha256']+'  '+apk.name+'\n'+hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print(json.dumps({'apk':str(apk),'uploadZip':str(archive),'uploadZipBytes':archive.stat().st_size,'localDownloadVersion':metadata['version']},indent=2))

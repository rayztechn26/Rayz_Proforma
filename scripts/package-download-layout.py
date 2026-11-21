from pathlib import Path
import shutil,zipfile,hashlib,json
root=Path('D:/Projects/ProformaApp');out=root/'output/download-layout-update';web=root/'output/launch-pack/website'
files=['index.html','demo.html','demo.js','style.css','site.js','analytics.js','assets/Inter_400Regular.ttf','assets/Inter_600SemiBold.ttf','assets/Inter-OFL.txt']
zip_path=root/'artifacts/Rayz-Proforma-Download-Layout-Update.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
 for name in files:
  target=out/'public_html/download'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(web/name,target)
  z.write(web/name,'download/'+name)
with zipfile.ZipFile(zip_path) as z:assert z.testzip() is None
(out/'UPLOAD-INSTRUCTIONS.txt').write_text('''RAYZ PROFORMA DOWNLOAD PAGE - LAYOUT UPDATE

Local preview:
http://127.0.0.1:8087/download?lang=en
http://127.0.0.1:8087/download/demo.html?lang=en
Both pages also support ?lang=am.
The files have already been installed at C:\\wamp64\\www\\backend\\public\\download for local testing.

Changes:
- Activity panel immediately below the site header, before the main product introduction.
- Compact four-column desktop / two-column mobile metrics; explanations in a disclosure.
- Guided screenshot player with a screenshot and instructions, a progress bar and controls below the slide.
- Previous/Next stop at the boundaries; keyboard arrows work. Play/Pause is one visible control at a time, pauses in background tabs, and does not auto-start.
- Consistent English/Amharic typography, compact buttons with minimum 44px touch targets, clearer back navigation, footer and mobile spacing.

UPLOAD AFTER LOCAL REVIEW
1. Back up existing download/index.html, demo.html, style.css and scripts.
2. This ZIP has a download/ folder. Upload Rayz-Proforma-Download-Layout-Update.zip into /domains/proforma.rayztechnology.com/public_html/ and extract THERE, replacing the matching download/ files. Do not extract inside the download folder again.
3. Keep all existing APKs, PDFs, screenshots, index.php and .htaccess. New Inter fonts and their licence are included under download/assets/.
4. Reload the live EN and AM download page, then the walkthrough. Check that counters are above the introduction and navigation controls are below the slide. Check mobile width, keyboard Previous/Next, Play/Pause, first/last states and the existing APK/user-guide links.
5. Remove the uploaded ZIP after extraction. No APK or database changes are required for THIS LAYOUT adjustment.

ANALYTICS DEPENDENCY
The previous analytics backend update and its migration must already be deployed for the counters and tracked APK endpoint to work. If it has not been deployed, use the refreshed Rayz-Proforma-Analytics-Server-Update.zip and output/analytics-update/UPLOAD-INSTRUCTIONS.txt FIRST. That combined server package now includes this layout too, so the layout-only ZIP is unnecessary in that case.

Status: local only; no hosting upload performed. Existing APK remains 2.0.8. The main rayztechnology.com website does not need another upload for these download-page layout changes.
''',encoding='utf-8')
(out/'SHA256SUMS.txt').write_text(hashlib.sha256(zip_path.read_bytes()).hexdigest()+'  '+zip_path.name+'\n')
print(zip_path.name,zip_path.stat().st_size,'bytes; ZIP integrity passed')

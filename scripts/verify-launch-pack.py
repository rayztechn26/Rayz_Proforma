from pathlib import Path
import json,subprocess,re,zipfile,hashlib
import pdfplumber
from pypdf import PdfReader
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/launch-pack';QA=ROOT/'tmp/launch-qa';QA.mkdir(parents=True,exist_ok=True)
reports=[];images=[]
for file in sorted((OUT/'website/documents').glob('*.pdf')):
    with pdfplumber.open(file) as pdf:
        assert len(pdf.pages)==(8 if 'Guide' in file.name else 2 if 'Brochure' in file.name else 1),(file,len(pdf.pages))
        txt='\n'.join(p.extract_text() or '' for p in pdf.pages)
        assert '\ufffd' not in txt
        if 'Sample' in file.name:assert '12,075.00' in txt and 'SAMPLE' in txt
        for p in pdf.pages:
            for w in p.extract_words():
                assert -1<=w['x0']<w['x1']<=p.width+1 and -1<=w['top']<w['bottom']<=p.height+1,(file,w)
        reports.append({'file':file.name,'pages':len(pdf.pages),'pageBoundsChecked':True,'amharicText':bool(re.search('[\u1200-\u137f]',txt))})
    prefix=QA/file.stem
    subprocess.run(['pdftoppm','-r','100','-png',str(file),str(prefix)],check=True,capture_output=True)
    pngs=sorted(QA.glob(file.stem+'-*.png'));images.extend(pngs)
    if 'Brochure' in file.name:
        for lang,p in zip(['EN','AM'],pngs):
            im=Image.open(p).convert('RGB');im.resize((1080,1528)).save(OUT/f'promotional-images/Proforma-Studio-{lang}.png')
    if 'Sample' in file.name:
        im=Image.open(pngs[0]);im.save(OUT/f'website/assets/sample-{file.stem[-2:].lower()}.png')
    if 'Guide' in file.name:
        im=Image.open(pngs[0]).convert('RGB');im.thumbnail((720,1020));im.save(OUT/f'website/assets/guide-{file.stem[-2:].lower()}.jpg',quality=90)
# Verify every local href/src on the public website. External destinations require owner review.
for file in (OUT/'website').glob('*.html'):
    for url in re.findall(r'(?:href|src)="([^"]+)"',file.read_text(encoding='utf-8')):
        if re.match(r'^(https?:|tel:|#)',url) or url == '/api/analytics/apk':continue
        p=file.parent/url.split('?')[0].split('#')[0]
        assert p.is_file(),(file,url)
for f in (OUT/'website').rglob('*'):
    if f.is_file():assert f.suffix not in ['.pem','.sql','.env'],f
assert not any('node_modules' in str(p) for p in OUT.rglob('*'))
sheet=Image.new('RGB',(1200,470*((len(images)+3)//4)),'#d9e5e0');draw=ImageDraw.Draw(sheet)
for i,p in enumerate(images):
    im=Image.open(p).convert('RGB');im.thumbnail((280,420));x=10+(i%4)*300;y=30+(i//4)*470;sheet.paste(im,(x,y));draw.text((x,y-20),p.name.replace('Proforma-Studio-','')[:43],fill='black')
sheet.save(QA/'all-pdf-pages.png')
(QA/'pdf-checks.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
print(f'Checked and rendered {len(images)} pages in {len(reports)} PDFs; verified website local links.')

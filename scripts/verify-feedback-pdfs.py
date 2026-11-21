from pathlib import Path
import json, subprocess
import pdfplumber
from pypdf import PdfReader
from PIL import Image, ImageOps, ImageDraw

root=Path(__file__).resolve().parents[1]
reports=json.loads((root/'artifacts/pdf-render-2.0.8.json').read_text())
images=[]
for r in reports:
    path=Path(r['file'])
    reader=PdfReader(path)
    with pdfplumber.open(path) as pdf:
        texts=[p.extract_text() or '' for p in pdf.pages]
        text='\n'.join(texts)
        assert len(pdf.pages)==r['pages']
        for i,p in enumerate(pdf.pages):
            assert f'{i+1} / {len(pdf.pages)}' in texts[i]
            assert not any(0xe000<=ord(c)<=0xf8ff or c=='\ufffd' for c in texts[i])
            for w in p.extract_words():
                assert -1<=w['x0']<w['x1']<=p.width+1 and -1<=w['top']<w['bottom']<=p.height+1, (path.name,w)
        expected=['80,000.00','12,000.00','92,000.00'] if 'many-items' in path.name else ['15,000,000.00','2,250,000.00','17,250,000.00']
        for amount in expected: assert amount in text, (path.name,amount)
        assert 'All services provided are subject' not in text
        if 'one-row' in path.name:
            assert len(pdf.pages)==1
            assert 'Terms & Conditions' not in text
            assert 'Grand total' in texts[0]
        if 'long-terms' in path.name:
            assert len(pdf.pages)>1 and 'Grand total' in texts[0]
            for i in range(1,43): assert f'TERM-{i:02}' in text
        if 'stamp-am' in path.name or 'many-items-am' in path.name:
            assert 'ውሎች' in text and 'ፕሮፎርማ' in texts[0]
            assert 'የድርጅት ማህተም' not in text
            stamp=[im for im in pdf.pages[-1].images if im.get('srcsize')==(420,420)]
            assert len(stamp)==1
            for w in pdf.pages[-1].extract_words():
                im=stamp[0]
                assert not (w['x0']<im['x1'] and w['x1']>im['x0'] and w['top']<im['bottom'] and w['bottom']>im['top']), (path.name,w)
        # All three monetary values share their right edge, and currency remains on the grand-total baseline.
        value_page=next(p for p in pdf.pages if expected[0] in (p.extract_text() or ''))
        numbers=[[w for w in value_page.extract_words() if w['text']==v][-1] for v in expected]
        assert max(w['x1'] for w in numbers)-min(w['x1'] for w in numbers)<1
        currency=[w for w in value_page.extract_words() if w['text']=='ETB' and abs(w['top']-numbers[-1]['top'])<1]
        assert currency, (path.name,'Currency wrapped away from total')
    embedded=0
    for page in reader.pages:
        for ref in page['/Resources'].get('/Font',{}).values():
            f=ref.get_object()
            for face in f.get('/DescendantFonts',[f]):
                desc=face.get_object().get('/FontDescriptor')
                if desc and any(k in desc.get_object() for k in ['/FontFile','/FontFile2','/FontFile3']):embedded+=1
    assert embedded>=2
    prefix=root/'tmp/pdfs/2.0.8'/path.stem
    subprocess.run(['pdftoppm','-r','85','-png',str(path),str(prefix)],check=True,capture_output=True)
    images.extend(sorted(prefix.parent.glob(prefix.name+'-*.png')))
    r.update(searchableAmountsAndFontsVerified=True,optionalTermsVerified=True,totalsAligned=True,rendered=True)
(root/'artifacts/pdf-verification-2.0.8.json').write_text(json.dumps(reports,indent=2))
sheet=Image.new('RGB',(990,480*((len(images)+2)//3)),'#dce5e2')
for i,p in enumerate(images):
    im=Image.open(p).convert('RGB');im.thumbnail((310,440));x=10+(i%3)*330;y=28+(i//3)*480
    sheet.paste(im,(x,y));ImageDraw.Draw(sheet).text((x,y-18),p.name,fill='black')
sheet.save(root/'tmp/pdfs/2.0.8/all-pages.png')
print(f'Verified and rendered {len(images)} pages across {len(reports)} PDF cases.')

"""Check the rendered QA PDFs, not just their HTML source."""
from pathlib import Path
import json
import pdfplumber
from pypdf import PdfReader

root = Path(__file__).resolve().parents[1]
reports = []
for path in sorted((root / 'output/pdf').glob('*2.0.5.pdf')):
    reader = PdfReader(path)
    embedded_fonts = 0
    for page in reader.pages:
        for reference in page['/Resources'].get('/Font', {}).values():
            font = reference.get_object()
            for face in font.get('/DescendantFonts', [font]):
                descriptor = face.get_object().get('/FontDescriptor')
                if descriptor and any(key in descriptor.get_object() for key in ['/FontFile', '/FontFile2', '/FontFile3']):
                    embedded_fonts += 1
    assert embedded_fonts >= 2, (path.name, 'Fonts are not embedded')
    with pdfplumber.open(path) as pdf:
        text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
        assert not any(0xE000 <= ord(char) <= 0xF8FF or char == '\ufffd' for char in text), 'Bad copied text/numeric glyphs'
        multipage = 'multipage' in path.name
        expected = ['177,777.60', '26,666.64', '204,444.24'] if multipage else ['3,820,000.00', '573,000.00', '4,393,000.00']
        for amount in expected:
            assert amount in text, (path.name, amount)
        if 'stamp-am' in path.name:
            assert 'ፕሮፎርማ' in text and 'ውሎች' in text
            assert 'PROFORMA INVOICE' not in text
        else:
            assert 'PROFORMA INVOICE' in text and 'Terms & Conditions' in text
        if multipage:
            assert len(pdf.pages) > 1
            last = pdf.pages[-1].extract_text() or ''
            assert 'ጠቅላላ ድምር' in last and 'ውሎች' in last
        stamp_label = 'የድርጅት ማህተም' if 'stamp-am' in path.name else 'Organization stamp'
        assert stamp_label not in text
        stamp_images = [image for image in pdf.pages[-1].images if image.get('srcsize') == (420,420)]
        assert len(stamp_images) == 1, (path.name, 'Missing final stamp')
        stamp = stamp_images[0]
        assert stamp['x1'] - stamp['x0'] >= 125 and stamp['bottom'] - stamp['top'] >= 125, 'Stamp size was not enlarged'
        for word in pdf.pages[-1].extract_words():
            overlaps = word['x0'] < stamp['x1'] and word['x1'] > stamp['x0'] and word['top'] < stamp['bottom'] and word['bottom'] > stamp['top']
            assert not overlaps, (path.name, 'Stamp overlaps text', word['text'])
        xobjects = reader.pages[-1]['/Resources'].get('/XObject', {})
        assert any(obj.get_object().get('/Width') == 420 and '/SMask' in obj.get_object() for obj in xobjects.values()), 'Transparency not embedded'
        right_edges = []
        words = pdf.pages[-1].extract_words()
        for amount in expected:
            matches = [word for word in words if word['text'] == amount]
            assert matches, (path.name, amount)
            right_edges.append(matches[-1]['x1'])
        assert max(right_edges) - min(right_edges) < 0.6, (path.name, 'Totals are not aligned', right_edges)
        for index, page in enumerate(pdf.pages):
            assert f'{index + 1} / {len(pdf.pages)}' in (page.extract_text() or '')
            assert all(word['x0'] >= 0 and word['x1'] <= page.width + 0.5 and word['top'] >= 0 and word['bottom'] <= page.height for word in page.extract_words())
        reports.append({'file': str(path), 'pages': len(pdf.pages), 'embeddedFontInstances': embedded_fonts, 'searchableNumbersAndLocalizedLabelsVerified': True, 'totalsRightAligned': True, 'stampOnFinalPageWithoutOverlap': True, 'transparentStampEmbedded': True})
assert len(reports) == 3
(root / 'artifacts/pdf-verification-2.0.5.json').write_text(json.dumps(reports, indent=2), encoding='utf8')
print(json.dumps(reports, indent=2))

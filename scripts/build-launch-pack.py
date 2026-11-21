"""Build a local, reviewable launch pack. Does not publish or touch production."""
from pathlib import Path
import json, shutil, hashlib, html, textwrap
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont
from launch_analytics import enhance_download_page, privacy_analytics
from download_demo import build_demo

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/launch-pack'
WEB=OUT/'website'
PDF=WEB/'documents'
DATA=json.loads((ROOT/'scripts/launch-content.json').read_text(encoding='utf-8'))
for p in [PDF, WEB/'downloads', WEB/'assets', OUT/'channel-copy', OUT/'promotional-images']:
    p.mkdir(parents=True,exist_ok=True)
FONTS=ROOT/'mobile/assets/fonts'
for name,file in [('Body','NotoSansEthiopic_400Regular.ttf'),('Bold','NotoSansEthiopic_600SemiBold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(FONTS/file)))
TEAL='#117568'; INK='#193d43'; GREY='#5e7478'; LIGHT='#eff5f3'
APK=ROOT/'artifacts/Rayz-Proforma-2.0.9.apk'
assert APK.is_file()
HASH=hashlib.sha256(APK.read_bytes()).hexdigest()
assert HASH=='bfb9e1079003d71288eeffbc47ed46b9ca7efb2feb384124f0866a86c178a436'
shutil.copy2(APK,WEB/'downloads'/APK.name)
shutil.copy2(ROOT/'mobile/assets/icon.png',WEB/'assets/icon.png')
for file in ['NotoSansEthiopic_400Regular.ttf','NotoSansEthiopic_600SemiBold.ttf','NotoSansEthiopic-OFL.txt','Inter-OFL.txt','Inter_400Regular.ttf','Inter_600SemiBold.ttf']:
    shutil.copy2(FONTS/file,WEB/'assets'/file)

def wrap(text,width,size,font='Body'):
    lines=[]
    for paragraph in text.split('\n'):
        line=''
        for word in paragraph.split():
            trial=(line+' '+word).strip()
            if pdfmetrics.stringWidth(trial,font,size)<=width:
                line=trial;continue
            if line:lines.append(line);line=''
            # Long URLs and words must never overflow the page.
            while pdfmetrics.stringWidth(word,font,size)>width:
                n=1
                while n<len(word) and pdfmetrics.stringWidth(word[:n+1],font,size)<=width:n+=1
                lines.append(word[:n]);word=word[n:]
            line=word
        if line:lines.append(line)
    return lines

def para(c,text,x,y,width,size=10.2,leading=15,font='Body',color=INK):
    c.setFillColor(color);c.setFont(font,size)
    for line in wrap(text,width,size,font):
        c.drawString(x,y,line);y-=leading
    return y

def top(c,lang,label):
    c.setFillColor(TEAL);c.rect(0,826,595.28,16,fill=1,stroke=0)
    c.drawImage(str(WEB/'assets/icon.png'),38,776,36,36,mask='auto')
    para(c,'RAYZ PROFORMA',86,800,300,11,15,'Bold')
    para(c,label,86,782,450,8.2,12,color=GREY)

def footer(c,num,lang):
    c.setStrokeColor('#d9e5e0');c.line(38,47,557,47)
    para(c,'Rayz Technology plc  |  0911099246 / 0947833314',38,31,450,8,10,color=GREY)
    c.setFillColor(GREY);c.setFont('Body',8);c.drawRightString(557,31,str(num))

def guide(lang):
    d=DATA[lang];file=PDF/f'Proforma-Studio-User-Guide-{lang.upper()}.pdf'
    c=canvas.Canvas(str(file),pagesize=(595.28,841.89));c.setTitle(d['guideTitle']);c.setAuthor(DATA['company'])
    for i,p in enumerate(d['guidePages']):
        top(c,lang,d['guideTitle']+' · 2.0.9')
        y=para(c,f'{i+1:02d}  '+p['title'],38,745,519,21,30,'Bold')
        if i==0:y=para(c,d['guideIntro'],38,y-6,519,10,15)-8
        else:y-=16
        start=min(y,660 if i==0 else 680)
        img=WEB/f'assets/screenshots/{p["image"]}-{lang}.png'
        c.setFillColor(LIGHT);c.roundRect(347,start-437,210,445,10,fill=1,stroke=0)
        c.drawImage(str(img),352,start-428,width=200,height=418.61,mask='auto')
        cap='App screenshot · Sample data' if lang=='en' else 'የመተግበሪያ ማሳያ · የናሙና መረጃ'
        para(c,cap,347,start-450,210,7.5,11,color=GREY)
        yy=start
        for j,s in enumerate(p['steps']):
            yy=para(c,f'{j+1}. '+s,38,yy,282,10.2,15.5)-14
        assert yy>100,(lang,i,yy)
        # Bottom note belongs beneath both the steps and screenshot.
        note_y=min(yy-4,start-476)
        lines=wrap(p['note'],495,9)
        box_h=len(lines)*13+20
        assert note_y-box_h>58,(lang,i,note_y,box_h)
        c.setFillColor(LIGHT);c.roundRect(38,note_y-box_h,519,box_h,7,fill=1,stroke=0)
        para(c,p['note'],50,note_y-14,495,9,13)
        footer(c,i+1,lang);c.showPage()
    c.save()

def brochure():
    c=canvas.Canvas(str(PDF/'Proforma-Studio-Brochure-EN-AM.pdf'),pagesize=(595.28,841.89))
    c.setTitle('Rayz Proforma product brochure English and Amharic');c.setAuthor(DATA['company'])
    for lang in ['en','am']:
        d=DATA[lang];top(c,lang,'Android · English / አማርኛ')
        y=para(c,d['title'],38,740,519,25,36,'Bold')-10
        y=para(c,d['intro'],38,y,519,11,17)-24
        c.setFillColor(TEAL);c.roundRect(38,y-80,519,80,10,fill=1,stroke=0)
        para(c,d['price'],55,y-30,480,22,28,'Bold','#ffffff')
        para(c,'One-time company activation' if lang=='en' else 'የአንድ ጊዜ የድርጅት ማግበሪያ',55,y-56,480,10,15,'Body','#ffffff')
        y-=110
        feature_top=y
        for feature in d['features']:
            y=para(c,'• '+feature,38,y,310,10.5,16)-10
        image=WEB/f'assets/screenshots/home-{lang}.png'
        c.drawImage(str(image),430,feature_top-241,width=120,height=251.2,mask='auto')
        y=min(y-8,feature_top-265,205)
        y=para(c,'Telebirr 0911099246 · Thomas Abate',38,y,519,12,18,'Bold')-4
        y=para(c,'Confirm the recipient before paying. Internet is needed for activation; work offline afterwards.' if lang=='en' else 'ከመክፈልዎ በፊት ተቀባዩን ያረጋግጡ። ለማግበር ኢንተርኔት ያስፈልጋል፤ ከዚያ በኋላ ያለ ኢንተርኔት ይሥሩ።',38,y,519,10,15)-10
        label='Download and get help' if lang=='en' else 'ለማውረድ እና ለድጋፍ'
        y=para(c,label,38,y,519,10,15,'Bold')-3
        y=para(c,DATA['baseUrl'],38,y,519,10,15)
        c.linkURL(DATA['baseUrl'],(38,y,557,y+16),relative=0)
        para(c,'Android only · Sample records shown · Proformas are not tax invoices.' if lang=='en' else 'ለአንድሮይድ ብቻ · የናሙና መረጃ · ፕሮፎርማ የታክስ ደረሰኝ አይደለም።',38,65,519,8,11,color=GREY)
        footer(c,1 if lang=='en' else 2,lang);c.showPage()
    c.save()

CSS='''@font-face{font-family:App;src:url(assets/NotoSansEthiopic_400Regular.ttf);font-weight:400;font-display:swap}@font-face{font-family:App;src:url(assets/NotoSansEthiopic_600SemiBold.ttf);font-weight:600 900;font-display:swap}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f4f8f6;color:#193d43;font:16px/1.8 App,Arial,sans-serif}a{color:#09665c}button,a{touch-action:manipulation}a:focus-visible,button:focus-visible{outline:3px solid #df9f32;outline-offset:4px}.wrap{max-width:1120px;margin:auto;padding:0 24px}header{background:white;border-bottom:1px solid #d9e5e0}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:86px}.brand{display:flex;gap:12px;align-items:center;font-weight:600;text-decoration:none;color:#193d43}.brand img{width:44px;height:44px;border-radius:10px}.langs{display:flex;gap:4px;background:#e6f0ec;padding:4px;border-radius:10px}.langs button{border:0;border-radius:7px;padding:9px 14px;background:none;color:#193d43;cursor:pointer;font:inherit}.langs button[aria-pressed=true]{background:#117568;color:white}.hero{display:grid;grid-template-columns:1.25fr .75fr;gap:54px;align-items:center;padding-top:64px;padding-bottom:64px}.eyebrow{font-size:12px;letter-spacing:1px;font-weight:600;color:#117568}h1{font-size:clamp(30px,4vw,48px);line-height:1.35;letter-spacing:-.8px;margin:12px 0 20px}h2{font-size:27px;line-height:1.45;margin:0 0 18px}h3{font-size:18px;line-height:1.5}p{margin:0 0 18px}.muted,small{color:#5e7478}.actions{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}.btn{display:inline-block;padding:11px 18px;border-radius:8px;background:#117568;color:white;text-decoration:none;font-weight:600;line-height:1.5}.btn.secondary{background:white;border:1px solid #bfd4ca;color:#193d43}.card{background:white;border:1px solid #d9e5e0;border-radius:16px;padding:28px}.hero img{width:100%;max-width:300px;border-radius:20px;border:1px solid #ccdcd4;box-shadow:0 20px 45px #193d4315}.hero figure{margin:0;text-align:center}section{padding-top:38px;padding-bottom:38px}.features{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;list-style:none;padding:0}.features li{background:white;border:1px solid #d9e5e0;border-radius:10px;padding:14px 18px}.price{display:grid;grid-template-columns:1fr 1.2fr;gap:34px;background:#193d43;color:white;padding:34px;border-radius:16px}.price strong{font-size:32px;line-height:1.4;display:block}.price p{margin:0}.steps{counter-reset:steps;list-style:none;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:16px}.steps li{counter-increment:steps;background:white;border:1px solid #d9e5e0;border-radius:12px;padding:22px}.steps li:before{content:counter(steps,decimal-leading-zero);display:block;color:#117568;font-size:22px;font-weight:600;margin-bottom:8px}.notice{padding:20px;background:#e4efe9;border-radius:10px}.screens{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.screens figure{margin:0}.screens img{width:100%;border:1px solid #d9e5e0;border-radius:14px}.screens figcaption{font-weight:600;margin:10px 0}details{background:white;border:1px solid #d9e5e0;padding:18px;border-radius:10px;margin-bottom:10px}summary{cursor:pointer;font-weight:600}details p{margin:12px 0 0}.links{display:flex;flex-wrap:wrap;gap:10px}.links a{padding:10px 16px;border:1px solid #bfd4ca;background:white;border-radius:8px;text-decoration:none}footer{padding:30px 0;background:white;border-top:1px solid #d9e5e0;margin-top:30px;font-size:13px}.hash{font:11px/1.6 monospace;overflow-wrap:anywhere}.policy{max-width:840px;padding:40px 24px;margin:auto}[hidden]{display:none!important}.caption{font-size:12px;margin-top:9px}.skip{position:absolute;left:-10000px}.skip:focus{left:12px;top:12px;background:white;padding:8px;z-index:20}@media(max-width:700px){.wrap{padding:0 18px}.hero{grid-template-columns:1fr;gap:28px;padding-top:32px;padding-bottom:32px}.hero figure img{max-width:230px}.features,.steps,.price{grid-template-columns:1fr}.price{padding:24px;gap:18px}.screens{grid-template-columns:1fr;max-width:340px;margin:auto}.brand span{font-size:14px}.langs button{padding:8px 11px}.card{padding:20px}h2{font-size:24px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}'''
JS='''function setLanguage(lang){document.documentElement.lang=lang;document.querySelectorAll('[data-lang]').forEach(el=>el.hidden=el.dataset.lang!==lang);document.querySelectorAll('[data-set-lang]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.setLang===lang)));try{localStorage.setItem('proforma-site-language',lang)}catch(e){}}document.querySelectorAll('[data-set-lang]').forEach(el=>el.addEventListener('click',()=>setLanguage(el.dataset.setLang)));let lang=new URLSearchParams(location.search).get('lang');if(!['en','am'].includes(lang)){try{lang=localStorage.getItem('proforma-site-language')}catch(e){}}setLanguage(lang==='am'?'am':'en');'''
def esc(s):return html.escape(s,quote=True)
def document(title,body):
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title><meta name="description" content="Rayz Proforma for Android. English and Amharic proformas, PDF export and offline preparation after activation."><link rel="icon" href="assets/icon.png"><link rel="stylesheet" href="style.css?v=layout-2"><script src="site.js" defer></script></head><body><a class="skip" href="#main">Skip to content / ወደ ዋና ይሂዱ</a><header><div class="wrap"><a class="brand" href="index.html"><img src="assets/icon.png" alt=""><span>Rayz Proforma</span></a><nav class="langs" aria-label="Language / ቋንቋ"><button type="button" data-set-lang="en" aria-pressed="true">EN</button><button type="button" data-set-lang="am" aria-pressed="false">አማ</button></nav></div></header><main id="main">{body}</main><footer><div class="wrap">Rayz Technology plc · Rayz Proforma · <a href="privacy.html">Privacy / ግላዊነት</a> · <a href="index.html#support-en">0911099246 / 0947833314</a></div></footer></body></html>'''

def website():
    sections=[]
    for lang in ['en','am']:
        d=DATA[lang];hidden=' hidden' if lang=='am' else ''
        links=''.join(f'<a href="{esc(DATA[key])}" rel="noopener noreferrer">{esc(label)}</a>' for key,label in zip(['facebook','telegram','whatsapp'],d['channels']))
        features=''.join(f'<li>{esc(x)}</li>' for x in d['features'])
        steps=''.join(f'<li>{esc(x)}</li>' for x in d['steps'])
        screens=''.join(f'<figure><img loading="lazy" src="assets/screenshots/{name}-{lang}.png" alt="{esc(label)}"><figcaption>{esc(label)}</figcaption></figure>' for name,label in zip(['home','company','preview'],d['screenLabels']))
        faq=''.join(f'<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q,a in d['faq'])
        guide=f'documents/Proforma-Studio-User-Guide-{lang.upper()}.pdf'
        sample=f'documents/Proforma-Studio-Sample-{lang.upper()}.pdf'
        sections.append(f'''<div data-lang="{lang}" lang="{lang}"{hidden}><div class="wrap"><section class="hero"><div><div class="eyebrow">ANDROID · ENGLISH / አማርኛ</div><h1>{esc(d['title'])}</h1><p>{esc(d['intro'])}</p><div class="actions"><a class="btn" href="downloads/{APK.name}" download>{esc(d['download'])}</a><a class="btn secondary" href="{guide}">{esc(d['guide'])}</a></div><p class="caption">{esc('Rayz Proforma 2.0.9. Existing users: install this update over your current app; do not uninstall first.' if lang=='en' else 'Rayz Proforma 2.0.9። ነባር ተጠቃሚዎች፦ ባለው መተግበሪያ ላይ ያዘምኑ፤ መጀመሪያ አያራግፉት።')}</p><small>v2.0.9 · {APK.stat().st_size/1024/1024:.1f} MiB · Android APK</small><details style="margin-top:14px"><summary>SHA-256</summary><p class="hash">{HASH}</p></details></div><figure><img src="assets/screenshots/home-{lang}.png" alt="{esc(d['screenLabels'][0])}"><figcaption class="caption">{'Sample data' if lang=='en' else 'የናሙና መረጃ'}</figcaption></figure></section><section><h2>{esc(d['featuresTitle'])}</h2><ul class="features">{features}</ul></section><section><div class="price"><div><h2>{esc(d['priceTitle'])}</h2><strong>{esc(d['price'])}</strong></div><p>{esc(d['priceNote'])}</p></div></section><section><h2>{esc(d['stepsTitle'])}</h2><ol class="steps">{steps}</ol><p class="notice">{esc(d['safety'])}</p></section><section><h2>{esc(d['screensTitle'])}</h2><div class="screens">{screens}</div><p class="muted caption">{esc(d['demoNote'])}</p><div class="actions"><a class="btn secondary" href="{sample}">{esc(d['sample'])}</a><a class="btn secondary" href="documents/Proforma-Studio-Brochure-EN-AM.pdf">{'Product brochure · EN / አማ' if lang=='en' else 'የምርት መግለጫ · EN / አማ'}</a></div></section><section><h2>{esc(d['faqTitle'])}</h2>{faq}<p class="notice">{esc(d['backup'])}</p></section><section id="support-{lang}" class="card"><h2>{esc(d['supportTitle'])}</h2><p>{esc(d['support'])}</p><div class="actions"><a class="btn" href="tel:+251911099246">0911099246</a><a class="btn secondary" href="tel:+251947833314">0947833314</a></div><div class="links">{links}</div><p class="caption muted">{esc(d['channelNote'])}</p><a href="privacy.html?lang={lang}">{esc(d['privacy'])}</a></section></div></div>''')
    (WEB/'index.html').write_text(enhance_download_page(document('Rayz Proforma | Android · English and Amharic',''.join(sections)), DATA),encoding='utf-8')
    shutil.copy2(ROOT/'scripts/download-analytics.js',WEB/'analytics.js')
    (WEB/'style.css').write_text(CSS+(ROOT/'scripts/download-layout.css').read_text(encoding='utf-8'),encoding='utf-8');(WEB/'site.js').write_text(JS,encoding='utf-8')
    (WEB/'release.json').write_text(json.dumps({'version':'2.0.9','versionCode':12,'package':'com.proformastudio.app','apk':'downloads/'+APK.name,'bytes':APK.stat().st_size,'sha256':HASH,'releaseReadyForPublicLaunch':'Owner must complete acceptance checklist before publication'},indent=2),encoding='utf-8')

PRIVACY={
 'en':[
  ('Privacy notice','This notice describes the Rayz Proforma Android app and this download website, operated by Rayz Technology plc. Prepared on 26 October 2026. For privacy questions or requests, call 0911099246 or 0947833314.'),
  ('Account and activation information','The service receives your account phone number, a password which the server stores as a hash, payment submissions, payer phone, transaction reference, optional receipt or note, and payment review records. Activation also sends your company profile, including legal name, TIN, logo and any optional contact, bank or business fields you entered. Device public keys and fingerprints are used to issue and validate a device-bound licence. Your private device key is kept by Android Keystore.'),
  ('Business records on your phone','Customers, catalogue items and proforma documents are stored locally on the phone and are not automatically synchronized to the activation server. The optional organization stamp and optional Terms & Conditions remain local document data. PDF export, sharing and business-data backup send or save files only through the destinations and apps you choose. Those files may contain personal or confidential business information.'),
  ('How information is used','Account, company, device and payment information is used to authenticate access, verify payments, activate or recover licences, provide support, prevent misuse and maintain service security. Support personnel may review information you submit privately to resolve your request. Please do not submit passwords or private keys.'),
  ('Service providers and technical logs','The hosting provider processes server traffic and may keep technical logs such as IP addresses, request times and error details. Telebirr handles the payment you make in its own service under its own terms. A social channel, messaging app or storage provider you choose is governed by that provider\'s policies. This download website has no analytics or advertising scripts; it uses browser local storage only to remember the selected language.'),
  ('Retention and requests','Keep local records and backups only for as long as your business needs them. You can contact support to request access, correction or deletion of account information. Some payment, security or audit records may need to be retained for fraud prevention, dispute resolution or applicable legal obligations; support should explain any applicable retention when handling a request. Uninstalling the app does not delete server account records, and deleting an account is not implemented as an in-app self-service feature in version 2.0.9.'),
  ('Protecting your information','Use a screen lock, a unique account password and secure backup storage. Keep the app updated. Only send receipt details privately. Internet transmission uses HTTPS, but no system can guarantee absolute security. Contact support promptly if your phone is lost or you suspect unauthorized access.'),
  ('Changes','An updated notice may be published on this page when the service or its data practices change. Check the notice before submitting information. This draft must be checked by the operator against actual hosting, retention practices and applicable law before publication.')
 ],
 'am':[
  ('የግላዊነት ማሳወቂያ','ይህ ማሳወቂያ በRayz Technology plc የሚተዳደረውን Rayz Proforma የአንድሮይድ መተግበሪያ እና የማውረጃ ድረ ገጽ ይመለከታል። በ26 October 2026 ተዘጋጀ። ለግላዊነት ጥያቄዎች በ0911099246 ወይም 0947833314 ይደውሉ።'),
  ('የመለያ እና የማግበሪያ መረጃ','አገልግሎቱ የመለያ ስልክዎን፣ በአገልጋዩ ላይ በሃሽ የሚቀመጥ የይለፍ ቃል፣ የክፍያ ጥያቄዎች፣ የከፋይ ስልክ፣ የግብይት ማጣቀሻ፣ አማራጭ ደረሰኝ ወይም ማስታወሻ እና የግምገማ መዝገቦችን ይቀበላል። ማግበር የድርጅት ህጋዊ ስም፣ TIN፣ አርማ እና ያስገቡትን አማራጭ የእውቂያ፣ የባንክ ወይም የንግድ መረጃ ይልካል። የመሣሪያ ይፋዊ ቁልፍ እና መለያ ፈቃድ ለመስጠት ይጠቅማሉ። የግል ቁልፉ በAndroid Keystore ይጠበቃል።'),
  ('በስልክዎ ላይ ያሉ መዝገቦች','ደንበኞች፣ የዕቃ ካታሎግ እና ፕሮፎርማዎች በስልኩ ላይ ይቀመጣሉ፤ በራስ ሰር ከማግበሪያ አገልጋዩ ጋር አይመሳሰሉም። አማራጭ ማህተም እና ውሎች የአካባቢ የሰነድ መረጃ ናቸው። PDF፣ ማጋራት እና ምትኬ ፋይሎችን እርስዎ ወደመረጡት ቦታ ወይም መተግበሪያ ያስቀምጣሉ ወይም ይልካሉ። ፋይሎቹ የግል ወይም ሚስጥራዊ የንግድ መረጃ ሊይዙ ይችላሉ።'),
  ('መረጃው የሚጠቅምበት','የመለያ፣ የድርጅት፣ የመሣሪያ እና የክፍያ መረጃ መግባትን ለማረጋገጥ፣ ክፍያ ለማረጋገጥ፣ ፈቃድ ለማግበር ወይም ለመመለስ፣ ድጋፍ ለመስጠት፣ አላግባብ አጠቃቀምን ለመከላከል እና ደህንነትን ለመጠበቅ ይጠቅማል። ድጋፍ ሰጪዎች ጥያቄዎን ለመፍታት በግል የላኩትን መረጃ ሊያዩ ይችላሉ። የይለፍ ቃል ወይም የግል ቁልፍ አይላኩ።'),
  ('አገልግሎት ሰጪዎች እና መዝገቦች','የማስተናገጃ አገልግሎት ሰጪው የአገልጋይ ግንኙነትን ያስተናግዳል፤ እንደ IP አድራሻ፣ ጊዜ እና የስህተት መረጃ ያሉ ቴክኒካዊ መዝገቦችን ሊያስቀምጥ ይችላል። ቴሌብር ክፍያውን በራሱ አገልግሎት እና ውሎች ያከናውናል። የመረጡት ማህበራዊ ቻናል፣ የመልዕክት ወይም የማስቀመጫ አገልግሎት በራሱ ፖሊሲ ይመራል። ይህ የማውረጃ ገጽ የትንታኔ ወይም የማስታወቂያ ስክሪፕት የለውም፤ የቋንቋ ምርጫን ብቻ በአሳሹ ያስታውሳል።'),
  ('ማቆየት እና ጥያቄዎች','የአካባቢ መዝገቦችን እና ምትኬዎችን ንግድዎ እስከሚፈልግበት ጊዜ ያቆዩ። የመለያ መረጃዎን ለማየት፣ ለማስተካከል ወይም ለማጥፋት ድጋፍ ያግኙ። አንዳንድ የክፍያ፣ የደህንነት ወይም የኦዲት መዝገቦች ማጭበርበርን ለመከላከል፣ ክርክር ለመፍታት ወይም ለህግ ግዴታ ሊቆዩ ይችላሉ። ጥያቄዎ ሲታይ ድጋፍ ሰጪው የሚመለከተውን ማቆያ ሊያብራራ ይገባል። መተግበሪያውን ማራገፍ የአገልጋዩን መለያ አያጠፋም። በ2.0.9 ውስጥ ተጠቃሚው በራሱ መለያ የሚያጠፋበት ተግባር አልተጨመረም።'),
  ('መረጃዎን ይጠብቁ','የስልክ መቆለፊያ፣ የተለየ የመለያ የይለፍ ቃል እና ደህንነቱ የተጠበቀ ምትኬ ይጠቀሙ። መተግበሪያውን ያዘምኑ። የደረሰኝ መረጃ በግል ብቻ ይላኩ። ግንኙነቱ HTTPS ይጠቀማል፤ ምንም ስርዓት ፍጹም ደህንነት አያረጋግጥም። ስልክዎ ከጠፋ ወይም ያልተፈቀደ መግባት ከጠረጠሩ ድጋፍ ያግኙ።'),
  ('ለውጦች','አገልግሎቱ ወይም የመረጃ አጠቃቀሙ ሲቀየር ይህ ገጽ ሊዘመን ይችላል። መረጃ ከመላክዎ በፊት ያንብቡት። ይህ ረቂቅ ከመታተሙ በፊት ከእውነተኛው ማስተናገጃ፣ ማቆያ ልምድ እና ከሚመለከተው ህግ ጋር በአስተዳዳሪው መመርመር አለበት።')
 ]}

def privacy():
    body=''
    for lang,parts in PRIVACY.items():
        content=f'<h1>{esc(parts[0][0])}</h1><p>{esc(parts[0][1])}</p>'
        content+=''.join(f'<h2>{esc(t)}</h2><p>{esc(p)}</p>' for t,p in parts[1:])
        body+=f'<article class="policy" lang="{lang}" data-lang="{lang}"'+(' hidden' if lang=='am' else '')+'>'+content+'</article>'
    (WEB/'privacy.html').write_text(privacy_analytics(document('Rayz Proforma | Privacy notice / ግላዊነት',body)),encoding='utf-8')
    (OUT/'Privacy-notice-DRAFT-EN-AM.md').write_text('\n\n'.join(f'# {lang.upper()}\n\n'+'\n\n'.join(f'## {t}\n\n{p}' for t,p in parts) for lang,parts in PRIVACY.items()),encoding='utf-8')

def markdown_copy():
    download=DATA['baseUrl']
    bios={
     'en':'Android proforma invoices in English and Amharic. Work offline after activation. One-time ETB 1,000 per company. Help: 0911099246 / 0947833314.',
     'am':'በአማርኛ እና በእንግሊዝኛ የአንድሮይድ ፕሮፎርማ። ከማግበር በኋላ ያለ ኢንተርኔት ይሥሩ። ለእያንዳንዱ ድርጅት የአንድ ጊዜ 1,000 ብር። ድጋፍ፦ 0911099246 / 0947833314።'
    }
    for lang in ['en','am']:
        d=DATA[lang]
        launch=f"{DATA['brand']}\n\n{d['intro']}\n\n"+'\n'.join('• '+x for x in d['features'])+f"\n\n{d['price']}\n{d['priceNote']}\n\n{download}\n0911099246 / 0947833314"
        payment='\n'.join(f'{i+1}. {x}' for i,x in enumerate(d['steps']))+'\n\n'+d['safety']
        posts={
         'Bio and channel description':bios[lang],
         'Pinned welcome and launch post':launch,
         'Payment and activation tutorial':payment,
         'Sample PDF post':('See what your next proforma could look like. These English and Amharic samples use fictional company data, not customer records. Add your own logo, optional PNG stamp and optional terms. Proformas are not tax invoices.' if lang=='en' else 'ቀጣዩ ፕሮፎርማዎ እንዴት ሊታይ እንደሚችል ይመልከቱ። የእንግሊዝኛ እና የአማርኛ ናሙናዎቹ ልቦለድ መረጃ ይጠቀማሉ፤ የደንበኞች መዝገብ አይደሉም። የራስዎን አርማ፣ አማራጭ PNG ማህተም እና ውሎች ይጨምሩ። ፕሮፎርማ የታክስ ደረሰኝ አይደለም።')+'\n\n'+download+'documents/Proforma-Studio-Sample-'+lang.upper()+'.pdf',
         'Version 2.0.9 release announcement':('Rayz Proforma 2.0.9 for Android\n\nThis release includes flowing PDF layouts, optional user-written Terms & Conditions, self-service account password changes and improved password-field rendering. Export a business-data backup, then install the update over the existing app. Do not uninstall first. Try your usual workflow and contact support if you notice a problem.' if lang=='en' else 'Rayz Proforma 2.0.9 ለአንድሮይድ\n\nይህ ስሪት የPDF አቀማመጥ ማሻሻያ፣ ተጠቃሚው የሚጽፋቸው አማራጭ ውሎች፣ የመለያ የይለፍ ቃል መቀየሪያ እና የይለፍ ቃል መስክ ማሻሻያ ይዟል። የንግድ መረጃ ምትኬ ያውጡ፤ ከዚያ ባለው መተግበሪያ ላይ ያዘምኑ። መጀመሪያ አያራግፉት። የተለመደውን ሥራዎን ይሞክሩ፤ ችግር ካዩ ድጋፍ ያግኙ።')+'\n\n'+download,
         'Request genuine customer feedback':('Have you prepared a proforma with Rayz Proforma? Tell us what worked well and what we should improve. Which phone and app version did you use? Please hide customer details and payment references. We will ask permission before publishing your name, business or comments as a testimonial.' if lang=='en' else 'በRayz Proforma ፕሮፎርማ አዘጋጅተዋል? ጥሩ የሠራውን እና ማሻሻል የሚገባንን ይንገሩን። ምን ስልክ እና ስሪት ተጠቀሙ? የደንበኞችን መረጃ እና የክፍያ ማጣቀሻ ይደብቁ። ስምዎን፣ ድርጅትዎን ወይም አስተያየትዎን እንደ ምስክርነት ከማተማችን በፊት ፈቃድ እንጠይቃለን።'),
         'Backup reminder':d['backup']+'\n\n'+download+'documents/Proforma-Studio-User-Guide-'+lang.upper()+'.pdf',
         'WhatsApp Business greeting':('Welcome to Rayz Proforma support by Rayz Technology plc. How can we help: installation, payment, activation or PDF preparation? Please include your app version. Never send your password or authenticator code. Official download: '+download if lang=='en' else 'እንኳን ወደ Rayz Technology plc የRayz Proforma ድጋፍ በደህና መጡ። በምን እንርዳዎ፦ መጫን፣ ክፍያ፣ ማግበር ወይም PDF? የመተግበሪያውን ስሪት ይግለጹ። የይለፍ ቃል ወይም የአረጋጋጭ ኮድ አይላኩ። ይፋዊ ማውረጃ፦ '+download),
         'WhatsApp Business away reply':('Thank you for your message. We will respond when support is available. For now, see the user guide at '+download+'. Do not pay again because approval is pending. Never post payment information in a public channel.' if lang=='en' else 'ለመልዕክትዎ እናመሰግናለን። ድጋፍ ሲኖር እንመልሳለን። ለአሁኑ መመሪያውን በ'+download+' ይመልከቱ። ማጽደቅን እየጠበቁ ስለሆነ እንደገና አይክፈሉ። የክፍያ መረጃ በሕዝብ ቻናል አይለጥፉ።'),
         'Support reply when activation fails':('Please do not pay again. Keep the app installed and your entered company details. Connect and refresh your status, then retry registration. If it still fails, send your app version, Android version, time and the technical request reference privately. Hide passwords and unrelated receipt or customer information.' if lang=='en' else 'እባክዎ እንደገና አይክፈሉ። መተግበሪያውን እና ያስገቡትን የድርጅት መረጃ ያቆዩ። ይገናኙ፣ ሁኔታዎን ያድሱና ምዝገባውን ይሞክሩ። ከቀጠለ ስሪቱን፣ የአንድሮይድ ስሪት፣ ጊዜ እና የቴክኒክ ማጣቀሻ በግል ይላኩ። የይለፍ ቃል እና ያልተያያዘ የደንበኛ መረጃ ይደብቁ።')
        }
        body=f'# Rayz Proforma channel copy {lang.upper()}\n\nPrepared for owner review. Publish download links only after uploading and checking the website. No customer testimonials have been invented.\n\n'
        body+='\n\n'.join(f'## {k}\n\n{v}' for k,v in posts.items())
        (OUT/f'channel-copy/Ready-to-post-{lang.upper()}.md').write_text(body,encoding='utf-8')
        # Plain text is easy to paste into social applications without Markdown headings.
        (OUT/f'channel-copy/Ready-to-post-{lang.upper()}.txt').write_text('\n\n'+'\n\n'.join(f'{k}\n{"="*len(k)}\n{v}' for k,v in posts.items()),encoding='utf-8')
    (OUT/'channel-copy/Channel-setup-and-demo-plan.md').write_text(textwrap.dedent(f'''\
    # Rayz Proforma channel setup and demonstration plan

    These are prepared materials, not published posts or completed account settings.

    ## Official destinations supplied by the owner

    - Facebook: {DATA['facebook']}
    - Telegram: {DATA['telegram']}
    - WhatsApp channel: {DATA['whatsapp']}
    - Proposed download page: {download}
    - Support telephone: 0911099246 / 0947833314

    The WhatsApp destination is a broadcast channel, not a one-to-one WhatsApp Business chat. Confirm which phone is registered to WhatsApp Business before adding a private chat link. The Telegram destination is an invite link; ensure it is not expiring or revoked. Check all three destinations while logged out before publishing.

    ## Facebook page

    1. Keep the page name Rayz Proforma and identify Rayz Technology plc as the operator. Select a suitable software category if available.
    2. Use assets/icon.png as the profile image. Use the English or Amharic promotional image as a launch post, rather than cropping a portrait image into a cover.
    3. Paste the matching bio from Ready-to-post-EN.md or Ready-to-post-AM.md. Add the official download website and verified support contacts.
    4. Publish and pin the welcome post. Attach the brochure or promotional image. Post a sample PDF separately.
    5. Add a contact or website action where available. Keep customer receipt details out of comments; move sensitive enquiries to an authorized private support route.
    6. Request genuine feedback. Obtain explicit permission before publishing a customer's words, company name, logo or screenshot. Do not invent customer success stories.

    ## Telegram channel

    1. Set the channel name to Rayz Proforma and add the product icon and bilingual description.
    2. Pin a welcome post containing the official download URL, price, support numbers and a warning against fake payment instructions.
    3. Publish separate labelled EN and AM guides and sample PDFs. Prefer the website download link so users see the current version and checksum.
    4. Publish release notes with the version and backup instructions. Remove or clearly mark obsolete APK announcements.
    5. Restrict posting to trusted administrators. If comments are enabled, moderate spam and remove exposed personal information.

    ## WhatsApp Business and channel

    1. Keep the supplied channel for broadcast updates. Its invite does not provide customer-support chat.
    2. Separately configure the WhatsApp Business app on a business-controlled number and verify ownership. Add a truthful business name, description, website and support hours you actually cover.
    3. Paste the prepared greeting and away reply. Add quick replies for installation, price, payment, activation, backup and password help using the bilingual guide.
    4. Use labels such as New enquiry, Installation help, Payment review, Activation help and Resolved. A chat label must never replace payment approval in the administrator portal.
    5. Message only people who requested or consented to contact. Respect opt-outs. Check current Meta commerce rules before offering software in catalog, shop or checkout features.

    ## Demonstration recording storyboard

    Produce one English and one Amharic recording on a test Android phone with fictional data. The pack contains screenshot demonstrations, not a recorded physical-device video.

    | Time | Action | English narration | Amharic narration |
    |---|---|---|---|
    | 0–10 sec | Show workspace and language switch | Prepare clear proformas on your Android phone. | በአንድሮይድ ስልክዎ ግልጽ ፕሮፎርማ ያዘጋጁ። |
    | 10–25 sec | Show company logo and optional PNG stamp | Add your company details, logo and optional stamp. | የድርጅትዎን መረጃ፣ አርማ እና አማራጭ ማህተም ይጨምሩ። |
    | 25–45 sec | Add fictional customer and two line items | Choose units, enter quantities and review VAT and totals. | መለኪያ ይምረጡ፣ ብዛት ያስገቡ፣ ቫትን እና ድምርን ያረጋግጡ። |
    | 45–65 sec | Preview English or Amharic sample PDF | Export a PDF with totals in digits and words. | ድምሩ በቁጥር እና በፊደል ያለውን PDF ያውጡ። |
    | 65–80 sec | Show activation information and download page | One-time ETB 1,000 per company. Work offline after activation. | ለእያንዳንዱ ድርጅት የአንድ ጊዜ 1,000 ብር። ከማግበር በኋላ ያለ ኢንተርኔት ይሥሩ። |

    Do not record real passwords, receipts, notifications or customer data. Use the PNG files in website/assets/screenshots for a slide demonstration if a phone recording is not available. They are actual components rendered with isolated test services, not proof of physical-device acceptance.

    ## First week publishing plan

    - Day 1: Welcome, price and official download page.
    - Day 2: EN and AM sample PDFs.
    - Day 3: Installation and activation tutorial.
    - Day 4: Logo, optional stamp and optional terms demonstration.
    - Day 5: Backup reminder and password-change help.
    - Day 6: Invite honest feedback without rewards tied to positive comments.
    - Day 7: Answer common questions and summarize verified improvements.

    ## Feedback intake template

    Ask for app version, phone model, Android version, action attempted, expected result, actual result and a redacted screenshot. Ask separately: May we publish your exact comment? May we use your name or business name? Keep payment references and phone numbers private. A feedback request is not testimonial consent.

    ## Policy references

    - Android direct distribution: https://developer.android.com/distribute/marketing-tools/alternative-distribution
    - WhatsApp Business policy: https://business.whatsapp.com/policy
    - Android developer verification: https://developer.android.com/developer-verification

    Check current platform rules before purchasing advertisements or enabling commerce features. Do not promise two-minute approval, automatic cloud sync, iPhone support, tax-invoice compliance, unlimited devices or a refund policy that has not been approved.
    '''),encoding='utf-8')

def owner_notes():
    (OUT/'START-HERE.md').write_text(textwrap.dedent(f'''\
    # Rayz Proforma launch pack

    Prepared 26 October 2026 for Rayz Technology plc. Local drafts only; no social accounts, posts or hosting files were changed. English and Amharic content is editable in scripts/launch-content.json and scripts/build-launch-pack.py.

    ## Branding update

    The product is now Rayz Proforma. Screenshots show the renamed source. The included 2.0.9 APK displays Rayz Proforma. Its compiled name and existing signing certificate were verified. Package ID, device licences, database and backup formats remain compatible.

    ## Contents

    - website: self-contained bilingual website, verified release 2.0.9 APK, screenshot guides, brochure and sample PDFs.
    - channel-copy: ready-to-paste English and Amharic posts, greeting, away reply, support scripts, setup steps, demo storyboard and feedback intake template.
    - promotional-images: English and Amharic brochure pages exported as PNG images for sharing.
    - Privacy-notice-DRAFT-EN-AM.md: editable privacy notice. The same draft is included in website/privacy.html.

    ## Required owner review before publication

    1. Verify ownership, public accessibility and permanence of the supplied Facebook, Telegram and WhatsApp channel links. They have not been authenticated or modified by this task.
    2. Confirm the displayed ETB 1,000 fee matches live administrator settings. Confirm Telebirr 0911099246 resolves to Thomas Abate, support 0911099246 / 0947833314, company operator name and the proposed public URL {DATA['baseUrl']}.
    3. Review the English and Amharic copy, especially privacy, VAT wording and support/recovery wording. Have a fluent Amharic reviewer proofread public-facing text. Approve real refund and device-transfer terms before making sales commitments; this pack does not invent them.
    4. Review the privacy draft against actual hosting providers, information access and retention/deletion practices. Assign responsibility for handling privacy requests. Do not remove draft status until that review is complete.
    5. Run physical Android acceptance for release 2.0.9: account, payment, approval, company activation, offline PDF in both languages, stamp, backup/restore and password change. Resolve production licence/WAF issues before inviting paid customers.
    6. Address the previously exposed credentials and review dependency advisories in the security review. This pack does not rotate secrets or upgrade app dependencies.
    7. Confirm the phone used for WhatsApp Business private support; the provided WhatsApp channel is broadcast-only. The website intentionally provides telephone support and channel links, not an unverified private-chat URL.

    ## DirectAdmin upload without replacing your backend

    Proposed public destination: {DATA['baseUrl']}

    1. Download a backup of your existing public_html before making hosting changes.
    2. In /domains/proforma.rayztechnology.com/public_html create a new folder named download.
    3. Upload Rayz-Proforma-Website-Upload.zip into that folder and extract its CONTENTS there. index.html must be directly inside public_html/download, not inside an extra website folder.
    4. Do not replace public_html/index.php, public_html/.htaccess, proforma-app, .env, vendor, storage or any private keys. This package contains no backend patch or SQL migration.
    5. Confirm HTTPS works and the host serves .apk as application/vnd.android.package-archive or application/octet-stream, PDFs as application/pdf and fonts/images correctly. A file download should not return a hosting challenge page.
    6. Open the /download/ page in a private browser on a real phone. Test both language buttons, all channel links, phone links, APK download, both guides, samples and privacy page. Download the APK and compare its SHA-256 below.
    7. Leave your existing admin and API paths unchanged. A future security-header change should be scoped to this folder and checked against the live hosting setup.
    8. Only after these checks, publish the prepared social posts and replace any older public download links.

    APK: Rayz-Proforma-2.0.9.apk; package com.proformastudio.app; Android version code 12.
    Size: {APK.stat().st_size} bytes.
    SHA-256: {HASH}

    ## Screenshot and sample provenance

    Twenty-four EN/AM screenshots were captured from current React Native components rendered using react-native-web with isolated fictional fixtures. No production API was contacted for these screenshots. Mocked licence helpers exist only in scripts/launch-preview.cjs; no application licence checks were changed. Screenshots are labelled as preview/sample data. Android appearance and system installation/print dialogs must be demonstrated on a real device.

    Sample proformas are generated by the current app PDF renderer, use fictional identities and a clearly invalid sample stamp, and show a total of ETB 12,075.00. These are not tax invoices or real offers. No real customer endorsement is included.
    '''),encoding='utf-8')
    shutil.copy2(ROOT/'scripts/launch-content.json',OUT/'editable-content.json')

def demo():
    (WEB/'demo.html').write_text(build_demo(document, DATA, esc),encoding='utf-8')
    shutil.copy2(ROOT/'scripts/download-demo.js',WEB/'demo.js')
    # Insert the demonstration entry point beside the guide in each language.
    file=WEB/'index.html';s=file.read_text(encoding='utf-8')
    for lang,label in [('en','Watch the screenshot walkthrough'),('am','የማሳያ መመሪያውን ይመልከቱ')]:
        needle=f'<a class="btn secondary" href="documents/Proforma-Studio-User-Guide-{lang.upper()}.pdf">'
        s=s.replace(needle,f'<a class="btn secondary" href="demo.html?lang={lang}">{label}</a>'+needle)
    file.write_text(s,encoding='utf-8')

def social_images():
    font=lambda size,bold=False:ImageFont.truetype(str(FONTS/('NotoSansEthiopic_600SemiBold.ttf' if bold else 'NotoSansEthiopic_400Regular.ttf')),size)
    def lines(draw,text,x,y,width,size=36,bold=False,color=INK,gap=12):
        f=font(size,bold);line=''
        for word in text.split():
            trial=(line+' '+word).strip()
            if draw.textlength(trial,font=f)>width and line:
                draw.text((x,y),line,font=f,fill=color);y+=size+gap;line=word
            else:line=trial
        if line:draw.text((x,y),line,font=f,fill=color);y+=size+gap
        return y
    icon=Image.open(WEB/'assets/icon.png').convert('RGBA')
    for lang in ['en','am']:
        d=DATA[lang]
        # Wide cover: key text stays away from the corners and profile overlay.
        im=Image.new('RGB',(1640,624),'#193d43');draw=ImageDraw.Draw(im)
        im.paste(icon.resize((112,112)),(110,65),icon.resize((112,112)))
        draw.text((250,78),'RAYZ PROFORMA',font=font(49,True),fill='white')
        y=lines(draw,d['title'],110,230,1020,53,True,'white',18)
        lines(draw,'Android · English / አማርኛ',110,y+18,1050,32,False,'#bad8cd')
        lines(draw,d['price'],110,520,1100,35,True,'white')
        screen=Image.open(WEB/f'assets/screenshots/home-{lang}.png').convert('RGB');screen.thumbnail((265,500));im.paste(screen,(1290,62))
        im.save(OUT/f'promotional-images/Facebook-cover-{lang.upper()}.png')
        im=Image.new('RGB',(1080,1080),'#f0f5f3');draw=ImageDraw.Draw(im)
        draw.rectangle((0,0,1080,18),fill=TEAL);im.paste(icon.resize((86,86)),(65,65),icon.resize((86,86)))
        draw.text((180,76),'RAYZ PROFORMA',font=font(37,True),fill=INK)
        y=lines(draw,d['title'],65,210,950,48,True)
        y=lines(draw,d['intro'],65,y+25,950,29,False,gap=15)
        draw.rounded_rectangle((65,550,1015,700),radius=20,fill=TEAL)
        lines(draw,d['price'],95,581,890,43,True,'white')
        lines(draw,'One-time activation' if lang=='en' else 'የአንድ ጊዜ ማግበሪያ',95,650,890,23,False,'white')
        lines(draw,'Telebirr 0911099246 · Thomas Abate',65,755,950,29,True)
        lines(draw,'proforma.rayztechnology.com/download/',65,824,950,29)
        lines(draw,'0911099246 / 0947833314',65,890,950,32,True)
        lines(draw,'Work offline after activation · Android only' if lang=='en' else 'ከማግበር በኋላ ያለ ኢንተርኔት · ለአንድሮይድ ብቻ',65,990,950,22,color=GREY)
        im.save(OUT/f'promotional-images/Launch-post-{lang.upper()}.png')
    shutil.copy2(WEB/'assets/icon.png',OUT/'promotional-images/Profile-icon.png')

if __name__=='__main__':
    for lang in ['en','am']:guide(lang)
    brochure();website();privacy();markdown_copy();owner_notes();demo();social_images()
    print('Built two 8-page guides, a bilingual brochure, website and channel copy. Samples and visual verification follow.')

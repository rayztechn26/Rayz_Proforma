"""Accessible EN/AM guided screenshot player; controls follow the active slide."""
def build_demo(document, data, esc):
    content = ''
    arrow_left = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>'
    arrow_right = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>'
    for lang in ['en','am']:
        d = data[lang]; slides = ''
        for i, item in enumerate(d['guidePages']):
            step = f'Step {i+1} of 8' if lang == 'en' else f'ደረጃ {i+1} / 8'
            caption = 'Interface preview · Sample data' if lang == 'en' else 'የገጽታ ማሳያ · የናሙና መረጃ'
            slides += f'<figure class="demo-slide" data-slide="{i}"'+(' hidden' if i else '')+f'><div class="demo-screen"><img src="assets/screenshots/{item["image"]}-{lang}.png" alt="{esc(item["title"])}" width="430" height="900"></div><figcaption class="demo-copy"><p class="demo-step">{step}</p><h2>{esc(item["title"])}</h2><p>{esc(item["steps"][0])}</p><p>{esc(item["steps"][1])}</p><p class="demo-note">{caption}. {esc(item["note"])}</p></figcaption></figure>'
        title = 'See how Rayz Proforma works' if lang == 'en' else 'Rayz Proforma እንዴት እንደሚሠራ ይመልከቱ'
        back = 'Back to downloads' if lang == 'en' else 'ወደ ማውረጃ ገጽ ተመለስ'
        intro = 'A quick, eight-step guide from creating your account to preparing and sharing your first proforma.' if lang == 'en' else 'መለያ ከመፍጠር እስከ ፕሮፎርማ ማዘጋጀትና ማጋራት የሚወስድ የስምንት ደረጃ መመሪያ።'
        previous, next_label, play, pause = ['Previous','Next','Play slideshow','Pause slideshow'] if lang == 'en' else ['ቀዳሚ','ቀጣይ','ማሳያውን አጫውት','ማሳያውን አቁም']
        help_text = 'Use Previous and Next, or the arrow keys. Slideshow advances every 10 seconds.' if lang == 'en' else 'ቀዳሚ እና ቀጣይ ወይም የቀስት ቁልፎችን ይጠቀሙ። ማሳያው በየ10 ሰከንዱ ይቀጥላል።'
        sample = 'Screenshots use fictional records. Phone appearance may vary.' if lang == 'en' else 'ማሳያዎቹ የናሙና መረጃ ናቸው። በስልክ ላይ ገጽታው ሊለያይ ይችላል።'
        content += f'<section class="demo-page" data-demo data-lang="{lang}" lang="{lang}"'+(' hidden' if lang == 'am' else '')+f'><a class="demo-back" href="index.html?lang={lang}">{arrow_left}{back}</a><div class="demo-header"><div class="eyebrow">{"PRODUCT WALKTHROUGH" if lang == "en" else "የምርት መመሪያ"}</div><h1>{title}</h1><p>{intro}</p></div><div class="demo-player"><div data-slides>{slides}</div><div class="demo-progress" aria-hidden="true"><span data-progress></span></div><div class="demo-controls"><nav class="demo-nav" aria-label="{"Slideshow navigation" if lang == "en" else "የማሳያ መቆጣጠሪያ"}"><button type="button" class="btn secondary" data-prev disabled>{arrow_left}{previous}</button><p class="demo-counter" role="status" aria-live="polite" data-counter>1 / 8</p><button type="button" class="btn" data-next>{next_label}{arrow_right}</button></nav><div class="demo-tools"><button type="button" data-play>{play}</button><button type="button" data-pause hidden>{pause}</button></div></div></div><p class="demo-help">{help_text}</p><div class="demo-bottom"><p>{sample}</p><a class="btn secondary" href="documents/Proforma-Studio-User-Guide-{lang.upper()}.pdf">{esc(d["guide"])}</a></div></section>'
    return document('Rayz Proforma | Product walkthrough', content).replace('</head>', '<script src="demo.js?v=2" defer></script></head>')

"""Analytics additions to the static download-page generator (no PDF changes)."""
import html
import re

def enhance_download_page(page, data):
    for lang in ['en', 'am']:
        title = 'Download page activity' if lang == 'en' else 'የማውረጃ ገጹ እንቅስቃሴ'
        labels = ['Page views', 'Visitors today (estimate)', 'APK download requests', 'Active browsers'] if lang == 'en' else ['የገጽ እይታዎች', 'የዛሬ ጎብኚዎች (ግምት)', 'የAPK ማውረድ ጥያቄዎች', 'ንቁ አሳሾች']
        note = 'Updates every 15 seconds. Counts start when tracking is deployed. Visitors are anonymous browser estimates; downloads are requests, not installations. Today uses Ethiopian time (UTC+3); active means seen in the last 2 minutes.' if lang == 'en' else 'በየ15 ሰከንዱ ይታደሳል። ቆጠራው ክትትሉ ከተጫነ በኋላ ይጀምራል። ጎብኚዎች የአሳሽ ግምት ናቸው፤ ማውረድ ጥያቄ እንጂ መጫን አይደለም። ዛሬ በኢትዮጵያ ሰዓት ነው፤ ንቁ ማለት ባለፉት 2 ደቂቃዎች የታየ ነው።'
        updated = 'Updated:' if lang == 'en' else 'የታደሰው፦'
        unavailable = 'Counts are temporarily unavailable. Retrying…' if lang == 'en' else 'ቆጠራዎች ለጊዜው አይገኙም። እንደገና በመሞከር ላይ…'
        cards = ''.join(f'<div class="card"><strong data-public-count="{key}">—</strong><p>{label}</p></div>' for key, label in zip(['views','visitors_today','downloads','active'],labels))
        about = 'About these counts' if lang == 'en' else 'ስለ እነዚህ ቆጠራዎች'
        refresh = 'Refresh' if lang == 'en' else 'አድስ'
        loading = 'Loading counts…' if lang == 'en' else 'ቆጠራዎችን በማምጣት ላይ…'
        markup = f'<section class="activity-panel" aria-label="{title}"><div class="activity-heading"><h2>{title}</h2><button class="quiet-button" type="button" data-count-retry>{refresh}</button></div><div class="analytics-grid">{cards}</div><div class="activity-meta"><p class="caption" role="status" data-count-status data-updated="{updated}" data-unavailable="{unavailable}">{loading}</p><details><summary>{about}</summary><p>{note}</p></details></div></section>'
        needle = f'<div data-lang="{lang}" lang="{lang}"'+(' hidden' if lang == 'am' else '')+'><div class="wrap">'
        assert needle in page
        page = page.replace(needle, needle + markup, 1)
    page = re.sub(r'href="downloads/(?:Rayz-Proforma|Proforma-Studio)-[0-9]+\.[0-9]+\.[0-9]+\.apk" download', 'href="/api/analytics/apk" data-apk-download', page)
    return page.replace('</head>', '<script src="analytics.js?v=1" defer></script></head>')


def privacy_analytics(page):
    en = '<h2>Anonymous website statistics</h2><p>The Proforma Services section and download page use a random daily browser ID to estimate visitors and activity. This analytics feature does not collect names, account details, payment information or IP addresses. Only a server-keyed hash of the ID is stored, until cleanup after 30 days; cleanup runs during tracking activity and daily aggregate counts remain. Local browser storage is used; when unavailable, counts can be less accurate. Download requests do not prove installation. Server access logs are separate from these counters.</p>'
    am = '<h2>ስም የሌላቸው የድረ ገጽ ቆጠራዎች</h2><p>የፕሮፎርማ ክፍሉ እና የማውረጃ ገጹ የጎብኚዎችን ግምት ለማወቅ የዕለት የዘፈቀደ የአሳሽ መለያ ይጠቀማሉ። ይህ ክትትል ስም፣ የመለያ ዝርዝር፣ የክፍያ መረጃ ወይም IP አይሰበስብም። በአገልጋይ ቁልፍ የተሰወረው መለያ ከ30 ቀናት በኋላ በክትትል ጊዜ ይጸዳል፤ የዕለት ድምር ይቀራል። ማውረድ መጫንን አያረጋግጥም። የአገልጋይ መዝገቦች ከዚህ ቆጠራ የተለዩ ናቸው።</p>'
    page = page.replace('<section class="policy" data-lang="en"', '<section class="policy" data-lang="en"',1)
    # Insert within each language section, before the next section/footer.
    marker = '</article>'
    assert page.count(marker) == 2
    pos = page.find(marker)
    page = page[:pos] + en + page[pos:]
    pos = page.find(marker, pos + len(en) + len(marker))
    return page[:pos] + am + page[pos:] if pos >= 0 else page

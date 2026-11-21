const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/launch-pack');
const {chromium}=require('C:/Users/Pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const report={samples:[],website:[],errors:[]};
 for(const lang of (process.argv.includes('--website-only')?[]:['en','am'])){
  const page=await browser.newPage();await page.setContent(fs.readFileSync(path.join(root,`tmp/launch-preview/sample-${lang}.html`),'utf8'),{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
  await page.pdf({path:path.join(out,`website/documents/Proforma-Studio-Sample-${lang.toUpperCase()}.pdf`),format:'A4',printBackground:true,preferCSSPageSize:true});
  report.samples.push(lang);await page.close();
 }
 const qa=path.join(root,'tmp/launch-qa');fs.mkdirSync(qa,{recursive:true});
 for(const width of [390,1280])for(const lang of ['en','am'])for(const file of ['index.html','privacy.html','demo.html']){
  const page=await browser.newPage({viewport:{width,height:960}});const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.route('http://launch-pack.test/**',r=>{const pathname=decodeURIComponent(new URL(r.request().url()).pathname);if(pathname==='/api/analytics/events')return r.fulfill({status:204,body:''});if(pathname==='/api/analytics/public')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({updated_at:new Date().toISOString(),download:{views:0,visitors_today:0,downloads:0,active:0}})});const p=path.join(out,'website',pathname==='/'?'index.html':pathname);if(!fs.existsSync(p)||!fs.statSync(p).isFile()){errs.push('Missing resource '+pathname);return r.abort();}return r.fulfill({path:p});});
  await page.goto(`http://launch-pack.test/${file}?lang=${lang}`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow '+width+lang+file);
  if(await page.locator(`main [data-lang=${lang}]`).getAttribute('hidden')!==null)throw Error('Language hidden');
  const other=lang==='en'?'am':'en';await page.getByRole('button',{name:other==='am'?'አማ':'EN',exact:true}).click();
  if(await page.locator(`main [data-lang=${other}]`).getAttribute('hidden')!==null)throw Error('Language toggle failed');
  await page.getByRole('button',{name:lang==='am'?'አማ':'EN',exact:true}).click();
  if(file==='demo.html'){
   const area=page.locator(`main [data-lang=${lang}]`);if(await area.locator('[data-prev]').isEnabled())throw Error('Previous must start disabled');await area.locator('[data-next]').click();
   if(await area.locator('[data-counter]').innerText()!=='2 / 8')throw Error('Demo next failed');
   await area.locator('[data-prev]').click();if(await area.locator('[data-counter]').innerText()!=='1 / 8')throw Error('Demo previous failed');
   await area.locator('[data-play]').click();if(!await area.locator('[data-pause]').isVisible()||await area.locator('[data-play]').isVisible())throw Error('Play/pause toggle failed');await area.locator('[data-pause]').click();
   for(let n=0;n<7;n++)await area.locator('[data-next]').click();if(await area.locator('[data-next]').isEnabled())throw Error('Next must stop at final slide');await page.keyboard.press('ArrowLeft');if(await area.locator('[data-counter]').innerText()!=='7 / 8')throw Error('Keyboard navigation failed');for(let n=0;n<6;n++)await area.locator('[data-prev]').click();
   const slide=await area.locator('[data-slide="0"]').boundingBox(), controls=await area.locator('.demo-controls').boundingBox();if(controls.y<slide.y+slide.height-1)throw Error('Controls must follow slide');
  }
  if(file==='index.html'){const area=page.locator(`main [data-lang=${lang}]`);const activity=await area.locator('.activity-panel').boundingBox(),hero=await area.locator('.hero').boundingBox();if(activity.y>=hero.y)throw Error('Activity panel must be first');}
  await page.evaluate(async()=>{await Promise.all([...document.images].map(async i=>{i.loading='eager';await i.decode();}));});
  const missing=await page.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src));if(missing.length)throw Error('Broken images '+missing.join());
  await page.screenshot({path:path.join(qa,`${file.replace('.html','')}-${lang}-${width}.png`),fullPage:true});
  report.website.push({file,lang,width,errors:errs,overflow:false});report.errors.push(...errs);await page.close();
 }
 await browser.close();if(report.errors.length)throw Error(report.errors.join('\n'));
 fs.writeFileSync(path.join(qa,'browser-checks.json'),JSON.stringify(report,null,2));console.log('Website EN/AM checked at 390px and 1280px: 12 cases; slideshow navigation, play/pause, boundary states, keyboard and control order passed.');
})().catch(e=>{console.error(e);process.exit(1)});

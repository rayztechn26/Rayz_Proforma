// Standalone headless PDF renderer for QA; does not access user browser sessions.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path');
const {PDFDocument, StandardFonts, rgb} = require('pdf-lib');
const root = path.resolve(__dirname, '../..');
(async()=>{
 const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const out=path.join(root,'output/pdf');fs.mkdirSync(out,{recursive:true});
 try{
  for(const name of ['stamp-en','stamp-am','stamp-am-multipage']){
   const page=await browser.newPage();
   await page.setContent(fs.readFileSync(path.join(root,'tmp/pdfs/2.0.5',name+'.html'),'utf8'),{waitUntil:'load'});
   await page.evaluate(()=>document.fonts.ready);
   const pdf=await PDFDocument.load(await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true}));
   const font=await pdf.embedFont(StandardFonts.Helvetica),pages=pdf.getPages();
   pages.forEach((p,i)=>{const text=`${i+1} / ${pages.length}`;p.drawText(text,{x:p.getWidth()-font.widthOfTextAtSize(text,8)-37,y:20,size:8,font,color:rgb(.35,.43,.47)});});
   fs.writeFileSync(path.join(out,`Proforma-${name}-2.0.5.pdf`),await pdf.save());
   console.log(JSON.stringify({name,pages:pages.length}));await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

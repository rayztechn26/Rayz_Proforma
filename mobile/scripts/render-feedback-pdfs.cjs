const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {PDFDocument,StandardFonts,rgb}=require('pdf-lib');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const outputs=[];
 try{
  for(const name of ['one-row-en','stamp-am','long-terms-en','many-items-am']){
   const page=await browser.newPage();await page.setContent(fs.readFileSync(path.join(root,'tmp/pdfs/2.0.8',name+'.html'),'utf8'),{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
   for(const format of (name==='one-row-en'?['A4','Letter']:['A4'])){
    const pdf=await PDFDocument.load(await page.pdf({format,preferCSSPageSize:format==='A4',printBackground:true}));
    const font=await pdf.embedFont(StandardFonts.Helvetica),pages=pdf.getPages();pages.forEach((p,i)=>{const s=`${i+1} / ${pages.length}`;p.drawText(s,{x:p.getWidth()-font.widthOfTextAtSize(s,8)-37,y:20,size:8,font,color:rgb(.35,.43,.47)});});
    const intermediate=name==='many-items-am'||format==='Letter';
    const file=path.join(root,intermediate?'tmp/pdfs/2.0.8':'output/pdf',`Proforma-${name}${format==='Letter'?'-letter':''}-2.0.8.pdf`);fs.writeFileSync(file,await pdf.save());outputs.push({file,pages:pages.length});
   }await page.close();
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(root,'artifacts/pdf-render-2.0.8.json'),JSON.stringify(outputs,null,2));console.log(JSON.stringify(outputs,null,2));
})().catch(e=>{console.error(e);process.exit(1)});

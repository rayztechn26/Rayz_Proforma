import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {newCompany,newCustomer,newDocument} from '../src/domain';
import {pdfHtml} from '../src/pdf';
const root=resolve(__dirname,'../..'),out=resolve(root,'tmp/launch-preview');mkdirSync(out,{recursive:true});
const fonts={fontRegularBase64:readFileSync(resolve(root,'mobile/assets/fonts/NotoSansEthiopic_400Regular.ttf')).toString('base64'),fontBoldBase64:readFileSync(resolve(root,'mobile/assets/fonts/NotoSansEthiopic_600SemiBold.ttf')).toString('base64')};
for(const language of ['en','am'] as const){
 const company={...newCompany(),name:language==='en'?'Example Trading · SAMPLE':'የምሳሌ ንግድ · ናሙና',tin:'SAMPLE ONLY',address:'Addis Ababa',phone:'',logo:'data:image/png;base64,'+readFileSync(resolve(root,'mobile/assets/icon.png')).toString('base64'),stamp:'data:image/png;base64,'+readFileSync(resolve(root,'mobile/tests/fixtures/sample-stamp.png')).toString('base64')};
 const customer={...newCustomer(company.id),name:language==='en'?'Example Customer · SAMPLE':'የምሳሌ ደንበኛ · ናሙና'};
 const doc={...newDocument(company,customer),number:'DEMO-2026-0001',status:'issued' as const,issueDate:'2026-10-26',validUntil:'2026-11-10',preparedBy:language==='en'?'Sales team · SAMPLE':'የሽያጭ ክፍል · ናሙና',notes:language==='en'?'DEMONSTRATION ONLY. Not a real offer or tax invoice.':'ለማሳያ ብቻ። እውነተኛ የዋጋ ጥያቄ ወይም የታክስ ደረሰኝ አይደለም።',termsAndConditions:'',lines:[{id:'a',description:language==='en'?'Office chair':'የቢሮ ወንበር',unit:'pcs',quantity:'4',price:'2500'},{id:'b',description:language==='en'?'Delivery':'ማጓጓዣ',unit:'trip',quantity:'1',price:'500'}]};
 writeFileSync(resolve(out,`sample-${language}.html`),pdfHtml(doc,{...fonts,language}));
}

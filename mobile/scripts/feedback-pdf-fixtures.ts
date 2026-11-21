import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {newCompany,newCustomer,newDocument} from "../src/domain";
import {pdfHtml} from "../src/pdf";
const root=resolve(__dirname,"../.."),out=resolve(root,"tmp/pdfs/2.0.8");mkdirSync(out,{recursive:true});
const fonts={fontRegularBase64:readFileSync(resolve(root,"mobile/assets/fonts/NotoSansEthiopic_400Regular.ttf")).toString("base64"),fontBoldBase64:readFileSync(resolve(root,"mobile/assets/fonts/NotoSansEthiopic_600SemiBold.ttf")).toString("base64")};
const company={...newCompany(),name:"Example Trading - SAMPLE",tin:"EXAMPLE-123",address:"Addis Ababa",phone:"+251 900 000 000",email:"office@example.test",logo:"data:image/png;base64,"+readFileSync(resolve(root,"mobile/assets/icon.png")).toString("base64")};
const customer={...newCustomer(company.id),name:"Example Hotel"};
const one={...newDocument(company,customer),number:"PF-2026-0001",status:"issued" as const,issueDate:"2026-10-22",validUntil:"2026-11-06",paymentTerms:"Cash",lines:[{id:"one",description:"White marble 60x60",unit:"m²",quantity:"1500",price:"10000"}]};
writeFileSync(resolve(out,"one-row-en.html"),pdfHtml(one,{...fonts,language:"en"}));
const am={...one,company:{...company,name:"የምሳሌ ንግድ - ናሙና",stamp:"data:image/png;base64,"+readFileSync(resolve(root,"mobile/tests/fixtures/sample-stamp.png")).toString("base64")},termsAndConditions:"አቅርቦቱ በሁለቱ ወገኖች ስምምነት መሠረት ይፈጸማል።",preparedBy:"የሽያጭ ክፍል"};
writeFileSync(resolve(out,"stamp-am.html"),pdfHtml(am,{...fonts,language:"am"}));
const long={...one,termsAndConditions:Array.from({length:42},(_,i)=>`${i+1}. Buyer and seller agree this sample condition applies only when explicitly accepted. Delivery and inspection follow the agreed schedule. Reference TERM-${String(i+1).padStart(2,"0")}.`).join("\n\n")};
writeFileSync(resolve(out,"long-terms-en.html"),pdfHtml(long,{...fonts,language:"en"}));
// Intermediate stress case: many items must flow naturally with a repeated table heading.
writeFileSync(resolve(out,"many-items-am.html"),pdfHtml({...am,lines:Array.from({length:40},(_,i)=>({...one.lines[0]!,id:String(i),description:`${i+1}. የምሳሌ ዕቃ እና አገልግሎት`,quantity:"2",price:"1000"}))},{...fonts,language:"am"}));
console.log("Created single-row, stamped Amharic, long custom terms and many-item HTML fixtures.");

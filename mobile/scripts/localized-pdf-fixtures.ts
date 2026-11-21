import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { newCompany, newCustomer, newDocument, id } from "../src/domain";
import { pdfHtml } from "../src/pdf";
const root = resolve(__dirname, "../..");
const out = resolve(root, "tmp/pdfs/2.0.4");
mkdirSync(out, { recursive: true });
for (const language of ["en", "am"] as const) {
  const company = {...newCompany(), name: language === "am" ? "ምሳሌ አጠቃላይ ንግድ - ናሙና" : "Example General Trading - SAMPLE", tin: "EXAMPLE-123", address: language === "am" ? "አዲስ አበባ፣ ኢትዮጵያ" : "Addis Ababa, Ethiopia", phone: "+251 900 000 000", email: "office@example.test", logo: "data:image/png;base64," + readFileSync(resolve(root,"mobile/assets/icon.png")).toString("base64"), bankName: language === "am" ? "ምሳሌ ባንክ" : "Example Bank", accountName: language === "am" ? "ምሳሌ ንግድ" : "Example Trading", accountNumber: "EXAMPLE-0001"};
  const customer = {...newCustomer(company.id), name: language === "am" ? "የምሳሌ ሆቴል" : "Example Hotel", tin: "CUSTOMER-001", address: language === "am" ? "ካዛንቺስ፣ አዲስ አበባ" : "Kazanchis, Addis Ababa", contact: language === "am" ? "የግዢ ክፍል" : "Procurement team"};
  const doc = {...newDocument(company, customer), number:"PF-2026-0001", status:"issued" as const, issueDate:"2026-10-21", validUntil:"2026-11-20", paymentTerms: language === "am" ? "ክፍያው ከስምምነቱ በኋላ በ14 ቀናት ውስጥ ይፈጸማል።" : "Payment within 14 days of acceptance.", deliveryTerms: language === "am" ? "አቅርቦቱ በስምምነቱ መሠረት ይፈጸማል።" : "Delivery as agreed in the accepted quotation.", preparedBy: language === "am" ? "የሽያጭ ክፍል" : "Sales team", lines:[{id:id(),description:language === "am" ? "የግንባታ ዕቃዎች እና የአቅርቦት አገልግሎት" : "Building materials and supply service",unit:"c/n",quantity:"2",price:"1910000"}]};
  const options = {language, fontRegularBase64:readFileSync(resolve(root,`mobile/assets/fonts/NotoSansEthiopic_400Regular.ttf`)).toString("base64"),fontBoldBase64:readFileSync(resolve(root,`mobile/assets/fonts/NotoSansEthiopic_600SemiBold.ttf`)).toString("base64")};
  writeFileSync(resolve(out,`sample-${language}.html`),pdfHtml(doc, options));
  if (language === "am") {
    doc.lines = Array.from({length:48},(_,i)=>({id:id(),description:`${i+1}. የዕቃ አቅርቦት፣ ዝርዝር መግለጫ፣ የመጫን እና የማስረከብ አገልግሎት። ${i === 5 ? "ረጅም የአገልግሎት መግለጫ። ".repeat(15): ""}`,unit:"pcs",quantity:"3",price:"1234.567"}));
    writeFileSync(resolve(out,"sample-am-multipage.html"),pdfHtml(doc,options));
  }
}
console.log("Generated English, Amharic and multipage HTML fixtures with embedded fonts.");

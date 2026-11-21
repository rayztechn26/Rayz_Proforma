import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {Repository,DB} from "../src/repository";
import {newCompany,newCustomer,newDocument} from "../src/domain";
import {capture,encodeBackup,decodeBackup} from "../src/backup";
import {pdfHtml} from "../src/pdf";
test("optional custom terms are inherited, escaped, frozen on issue and backed up without system defaults",()=>{
 const sql=new DatabaseSync(":memory:");const db:DB={execSync:s=>sql.exec(s),runSync:(s,...p)=>sql.prepare(s).run(...p),getAllSync:<T>(s:string,...p:any[])=>sql.prepare(s).all(...p) as T[],getFirstSync:<T>(s:string,...p:any[])=>sql.prepare(s).get(...p) as T||null};
 const repo=new Repository(db,()=>{}),company={...newCompany(),name:"Example",tin:"123",termsAndConditions:"Agreed delivery <only>\nNo other conditions."},customer={...newCustomer(company.id),name:"Customer"};repo.saveCompany(company);repo.saveCustomer(customer);
 const d=newDocument(company,customer);d.lines=[{id:"one",description:"Example",unit:"pcs",quantity:"1",price:"1000"}];assert.equal(d.termsAndConditions,company.termsAndConditions);
 const empty=pdfHtml({...d,termsAndConditions:""});assert.ok(!empty.includes('<section class="conditions">'));assert.ok(!empty.includes('All services provided are subject'));
 assert.ok(pdfHtml(d).includes('Agreed delivery &lt;only&gt;'));
 repo.saveDraft({...d,termsAndConditions:"Invoice-specific condition."});repo.issue(company.id,d.id,"");repo.saveCompany({...company,termsAndConditions:"New default"});assert.equal(repo.document(company.id,d.id).termsAndConditions,"Invoice-specific condition.");
 const m=decodeBackup(encodeBackup(capture(repo)));assert.equal(m.version,3);assert.equal(m.documents[0]!.termsAndConditions,"Invoice-specific condition.");assert.equal(m.companies[0]!.termsAndConditions,"New default");
 for(const version of [1,2] as const){const old={...m,version,companies:m.companies.map(({termsAndConditions,...c})=>c),documents:m.documents.map(({termsAndConditions,company,...d})=>({...d,company:(({termsAndConditions,...c})=>c)(company)}))};assert.equal(decodeBackup(encodeBackup(old)).version,version);}
});

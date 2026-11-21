import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {zipSync,unzipSync,strToU8,strFromU8} from "fflate";
import {Repository,DB} from "../src/repository";
import {newCompany,newCustomer,newDocument} from "../src/domain";
import {capture,encodeBackup,decodeBackup,embedBackupLogos,restore} from "../src/backup";
import {pdfHtml} from "../src/pdf";
import {validStamp} from "../src/stamp";
const A="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGPkj5o2jYGBgYEJRIAwABfTAZlkof41AAAAAElFTkSuQmCC";
const B="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGNMEanYwsDAwMAEIkAYABj6AagReJkIAAAAAElFTkSuQmCC";
function fixture(){
 const sql=new DatabaseSync(":memory:");
 const db:DB={execSync:s=>sql.exec(s),runSync:(s,...p)=>sql.prepare(s).run(...p),getAllSync:<T>(s:string,...p:any[])=>sql.prepare(s).all(...p) as T[],getFirstSync:<T>(s:string,...p:any[])=>sql.prepare(s).get(...p) as T||null};
 const repo=new Repository(db,()=>{}),company={...newCompany(),name:"Example",tin:"123"},customer={...newCustomer(company.id),name:"Customer"};repo.saveCompany(company);repo.saveCustomer(customer);
 const draft=()=>{const d=newDocument(company,customer);d.lines=[{id:"line",description:"Example",unit:"pcs",quantity:"1",price:"1000"}];repo.saveDraft(d);return d;};
 return {repo,company,draft};
}
test("PNG stamps retain transparency data and reject JPEG, SVG, truncated and corrupt files",()=>{
 assert.ok(validStamp(A));assert.ok(validStamp(B));
 assert.equal(validStamp(A.replace("image/png","image/jpeg")),false);
 assert.equal(validStamp("data:image/svg+xml;base64,PHN2Zz4="),false);
 assert.equal(validStamp(A.slice(0,-12)),false);
 const bytes=Buffer.from(A.split(",")[1]!,"base64");bytes[50]=bytes[50]!^1;
 assert.equal(validStamp("data:image/png;base64,"+bytes.toString("base64")),false);
});
test("issued invoices freeze stamp bytes; replacement/removal affect only new invoices",()=>{
 const f=fixture(),old=f.draft();f.repo.issue(f.company.id,old.id,"");
 f.repo.saveCompany({...f.company,stamp:"file:///stamp.png"});
 const one=f.draft();assert.throws(()=>f.repo.issue(f.company.id,one.id,""),/valid PNG/);
 const issued=f.repo.issue(f.company.id,one.id,"",A);assert.equal(issued.number.slice(-4),"0002");
 f.repo.saveCompany({...f.company,stamp:B});const two=f.draft();f.repo.issue(f.company.id,two.id,"",B);
 f.repo.saveCompany({...f.company,stamp:""});const three=f.draft();f.repo.issue(f.company.id,three.id,"","");
 assert.equal(f.repo.document(f.company.id,one.id).company.stamp,A);
 assert.equal(f.repo.document(f.company.id,two.id).company.stamp,B);
 assert.equal(f.repo.document(f.company.id,three.id).company.stamp,"");
 assert.ok(!pdfHtml(f.repo.document(f.company.id,old.id)).includes('<div class="organization-stamp">'));
 const html=pdfHtml(issued,{language:"am"});assert.ok(html.includes(A));assert.ok(html.includes("የድርጅት ማህተም"));assert.ok(html.indexOf(A)>html.indexOf('class="words"'));
 assert.throws(()=>pdfHtml({...issued,company:{...issued.company,stamp:'data:image/svg+xml;base64,PHN2Zz4='}}),/valid embedded PNG/);
});
test("format-3 backup embeds and deduplicates current/historical stamps and restores them",async()=>{
 const f=fixture();f.repo.saveCompany({...f.company,stamp:A});const d=f.draft();f.repo.issue(f.company.id,d.id,"",A);
 f.repo.saveCompany({...f.company,stamp:B});const d2=f.draft();f.repo.issue(f.company.id,d2.id,"",B);
 f.repo.saveCompany({...f.company,stamp:"file:///saved-stamp.png"});
 const embedded=await embedBackupLogos(capture(f.repo),async x=>x,async uri=>uri.startsWith("file:")?B:uri);
 const bytes=encodeBackup(embedded),files=unzipSync(bytes);assert.equal(Object.keys(files).filter(x=>x.startsWith("assets/stamp-")).length,2);
 assert.ok(!strFromU8(files['manifest.json']!).includes('file:///'));
 const decoded=decodeBackup(bytes);assert.equal(decoded.version,3);assert.equal(decoded.companies[0]!.stamp,B);
 const target=fixture();restore(target.repo,decoded);assert.equal(target.repo.document(f.company.id,d.id).company.stamp,A);
 assert.equal(target.repo.company(f.company.id).stamp,B);
 const key=Object.keys(files).find(x=>x.startsWith('assets/stamp-'))!;delete files[key];assert.throws(()=>decodeBackup(zipSync(files)),/stamp/);
});
test("older format-1 backups without stamps remain readable",()=>{
 const f=fixture();const m=capture(f.repo);m.version=1;for(const c of m.companies)delete c.stamp;
 const restored=decodeBackup(encodeBackup(m));assert.equal(restored.version,1);assert.equal(restored.companies[0]!.stamp,undefined);
 const invalid={...m,companies:[{...m.companies[0]!,stamp:A}]};assert.throws(()=>encodeBackup(invalid),/format 2/);
 const raw={...capture(f.repo),companies:[{...f.company,stamp:'assets/stamp-1.png'}]};
 assert.throws(()=>decodeBackup(zipSync({'manifest.json':strToU8(JSON.stringify(raw)),'assets/stamp-1.png':new Uint8Array([1,2,3])})),/PNG stamp/);
});

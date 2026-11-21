import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repository, DB } from "../src/repository";
import {
  calculate,
  newCompany,
  newCustomer,
  newDocument,
  id,
  companySchema,
} from "../src/domain";
import {
  capture,
  encodeBackup,
  decodeBackup,
  restore,
  validateManifest,
  embedBackupLogos,
} from "../src/backup";
import { pdfHtml, escapeHtml, filename } from "../src/pdf";
import { zipSync, strToU8, unzipSync } from "fflate";
function database(path = ":memory:") {
  const sql = new DatabaseSync(path);
  const db: DB = {
    execSync: (s) => sql.exec(s),
    runSync: (s, ...p) => sql.prepare(s).run(...p),
    getFirstSync: <T>(s: string, ...p: any[]) =>
      (sql.prepare(s).get(...p) as T) || null,
    getAllSync: <T>(s: string, ...p: any[]) => sql.prepare(s).all(...p) as T[],
  };
  return { repo: new Repository(db, () => {}), close: () => sql.close() };
}
function fixture(path?: string) {
  const db = database(path);
  const c = { ...newCompany(), name: "Test <Business>", tin: "123" };
  db.repo.saveCompany(c);
  db.repo.setSetting("activeCompany", c.id);
  const u = { ...newCustomer(c.id), name: "Customer & Co" };
  db.repo.saveCustomer(u);
  const d = newDocument(c, u);
  d.issueDate = "2026-10-19";
  d.validUntil = "2026-11-18";
  d.lines = [
    {
      id: id(),
      description: "Consulting <service>",
      unit: "hour",
      quantity: "2",
      price: "1000",
    },
    {
      id: id(),
      description: "Delivery",
      unit: "service",
      quantity: "3",
      price: "500",
    },
  ];
  db.repo.saveDraft(d);
  return { ...db, c, u, d };
}
test("specified VAT-exclusive example uses shared totals", () => {
  const f = fixture();
  assert.deepEqual(calculate(f.d.lines, "15"), {
    amounts: ["2000.00", "1500.00"],
    subtotal: "3500.00",
    vat: "525.00",
    total: "4025.00",
  });
});
test("round lines first and round VAT half up", () => {
  const f = fixture();
  const lines = [
    { ...f.d.lines[0]!, quantity: "1.5", price: "0.03" },
    { ...f.d.lines[1]!, quantity: "1", price: "0.05" },
  ];
  assert.deepEqual(calculate(lines, "15"), {
    amounts: ["0.05", "0.05"],
    subtotal: "0.10",
    vat: "0.02",
    total: "0.12",
  });
});
test("decimal arithmetic avoids binary errors", () => {
  const f = fixture();
  assert.equal(
    calculate([{ ...f.d.lines[0]!, quantity: "0.1", price: "0.2" }], "15")
      .amounts[0],
    "0.02",
  );
});
test("large allowed financial values retain cents before rounding", () => {
  const f = fixture();
  const lines = [
    { ...f.d.lines[0]!, quantity: "999999999999.49", price: "999999999999.49" },
  ];
  assert.equal(calculate(lines, "15").subtotal, "999999999998980000000000.26");
});
test("VAT is mandatory, positive and finite", () => {
  const f = fixture();
  for (const v of ["0", "-1", "", "NaN", "Infinity", "1e9"])
    assert.throws(() => calculate(f.d.lines, v));
  assert.equal(companySchema.safeParse({ ...f.c, vat: "0" }).success, false);
  assert.equal(
    companySchema.safeParse({ ...f.c, vatConfirmed: false }).success,
    false,
  );
});
test("invalid quantities and negative prices cannot save", () => {
  const f = fixture();
  assert.throws(() => f.repo.saveDraft({ ...f.d, lines: [] }));
  assert.throws(() =>
    f.repo.saveDraft({ ...f.d, lines: [{ ...f.d.lines[0]!, quantity: "0" }] }),
  );
  assert.throws(() =>
    f.repo.saveDraft({ ...f.d, lines: [{ ...f.d.lines[0]!, price: "-2" }] }),
  );
});
test("number allocation is per company and year; voided numbers stay consumed", () => {
  const f = fixture();
  const first = f.repo.issue(f.c.id, f.d.id, "");
  assert.match(first.number, /-0001$/);
  f.repo.void(f.c.id, first.id);
  const second = f.repo.duplicate(f.c.id, first.id);
  assert.match(f.repo.issue(f.c.id, second.id, "").number, /-0002$/);
  const c2 = { ...f.c, id: id() };
  f.repo.saveCompany(c2);
  const d2 = newDocument(c2, { ...f.u, id: id(), companyId: c2.id });
  d2.lines = f.d.lines;
  f.repo.saveDraft(d2);
  assert.match(f.repo.issue(c2.id, d2.id, "").number, /-0001$/);
  const next = {
    ...f.d,
    id: id(),
    issueDate: "2027-01-01",
    validUntil: "2027-02-01",
  };
  f.repo.saveDraft(next);
  assert.equal(f.repo.issue(f.c.id, next.id, "").number, "PF-2027-0001");
});
test("simultaneous stale drafts receive distinct final numbers", () => {
  const f = fixture();
  const b = { ...f.d, id: id() };
  f.repo.saveDraft(b);
  const n1 = f.repo.issue(f.c.id, f.d.id, "").number;
  const n2 = f.repo.issue(f.c.id, b.id, "").number;
  assert.notEqual(n1, n2);
  assert.throws(() => f.repo.issue(f.c.id, b.id, ""));
});
test("failed issue transaction does not consume a sequence", () => {
  const f = fixture();
  f.repo.db.execSync(
    "CREATE TRIGGER fail_issue BEFORE UPDATE ON documents WHEN NEW.status='issued' BEGIN SELECT RAISE(ABORT,'forced failure'); END;",
  );
  assert.throws(() => f.repo.issue(f.c.id, f.d.id, ""));
  assert.equal(f.repo.document(f.c.id, f.d.id).status, "draft");
  assert.equal(f.repo.db.getAllSync("SELECT * FROM sequences").length, 0);
});
test("company queries and mutation boundaries isolate records", () => {
  const f = fixture();
  const c2 = { ...f.c, id: id() };
  f.repo.saveCompany(c2);
  assert.deepEqual(f.repo.customers(c2.id), []);
  assert.deepEqual(f.repo.documents(c2.id), []);
  assert.throws(() => f.repo.document(c2.id, f.d.id));
  assert.throws(() => f.repo.saveCustomer({ ...f.u, companyId: c2.id }));
  assert.throws(() =>
    f.repo.saveDraft({
      ...f.d,
      companyId: c2.id,
      company: c2,
      customer: { ...f.u, companyId: c2.id },
    }),
  );
});
test("issued snapshots remain immutable after profile/customer/catalogue changes", () => {
  const f = fixture();
  const issued = f.repo.issue(f.c.id, f.d.id, "data:image/png;base64,abc=");
  f.repo.saveCompany({ ...f.c, name: "Changed", bankName: "New Bank" });
  f.repo.saveCustomer({ ...f.u, name: "Changed customer" });
  assert.deepEqual(f.repo.document(f.c.id, f.d.id), issued);
  assert.throws(() => f.repo.saveDraft({ ...issued, status: "draft" }));
  assert.throws(() => f.repo.deleteDraft(f.c.id, issued.id));
  assert.equal(f.repo.duplicate(f.c.id, issued.id).status, "draft");
});
test("draft deletion cascades line records", () => {
  const f = fixture();
  f.repo.deleteDraft(f.c.id, f.d.id);
  assert.deepEqual(f.repo.db.getAllSync("SELECT * FROM lines"), []);
});
test("validated archive round-trip preserves records and numbering", () => {
  const f = fixture();
  f.repo.issue(f.c.id, f.d.id, "");
  const m = decodeBackup(encodeBackup(capture(f.repo)));
  const target = database();
  restore(target.repo, m);
  assert.deepEqual(capture(target.repo), capture(f.repo));
  const copy = target.repo.duplicate(f.c.id, f.d.id);
  assert.match(target.repo.issue(f.c.id, copy.id, "").number, /-0002$/);
});
test("archive embeds logos and rejects corrupt assets", () => {
  const f = fixture();
  const logo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=";
  f.repo.saveCompany({ ...f.c, logo });
  f.repo.issue(f.c.id, f.d.id, logo);
  const round = decodeBackup(encodeBackup(capture(f.repo)));
  assert.equal(round.companies[0]!.logo, logo);
  assert.equal(round.documents[0]!.company.logo, logo);
  assert.throws(() => decodeBackup(new Uint8Array([1, 2, 3])));
});
test("unsupported, orphaned or sequence-regressing backups do not replace data", () => {
  const f = fixture();
  f.repo.issue(f.c.id, f.d.id, "");
  const before = capture(f.repo);
  assert.throws(() => restore(f.repo, { ...before, version: 99 } as any));
  assert.throws(() => validateManifest({ ...before, companies: [] }));
  assert.throws(() => validateManifest({ ...before, sequences: [] }));
  assert.throws(() =>
    validateManifest({
      ...before,
      documents: [...before.documents, ...before.documents],
    }),
  );
  assert.deepEqual(capture(f.repo), before);
});
test("restore transaction rolls back every write on failure", () => {
  const f = fixture();
  const before = capture(f.repo);
  f.repo.db.execSync(
    "CREATE TRIGGER fail_restore BEFORE INSERT ON companies BEGIN SELECT RAISE(ABORT,'forced failure'); END;",
  );
  assert.throws(() => restore(f.repo, before));
  assert.deepEqual(capture(f.repo), before);
});
test("reopening persistent SQLite retains issued records", () => {
  const dir = mkdtempSync(join(tmpdir(), "proforma-"));
  const path = join(dir, "test.db");
  try {
    const f = fixture(path);
    const issued = f.repo.issue(f.c.id, f.d.id, "");
    f.close();
    const reopened = database(path);
    assert.deepEqual(reopened.repo.document(f.c.id, f.d.id), issued);
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("PDF escapes user content, uses shared totals and marks drafts", () => {
  const f = fixture();
  const html = pdfHtml(f.d);
  assert.ok(html.includes("Test &lt;Business&gt;"));
  assert.ok(html.includes("Customer &amp; Co"));
  assert.ok(html.includes("4,025.00"));
  assert.ok(html.includes("DRAFT"));
  assert.ok(html.includes("30mm"));
  assert.ok(html.includes("table-header-group"));
  assert.equal(escapeHtml('<script>"&'), "&lt;script&gt;&quot;&amp;");
  assert.ok(
    !filename({
      ...f.d,
      number: "PF/1",
      customer: { ...f.u, name: "A:B?" },
    }).includes("/"),
  );
});
test("repository protected writes fail closed and preserve business data", () => {
  const f=fixture();
  const locked=new Repository(f.repo.db);
  assert.throws(()=>locked.saveDraft(f.d),/licence required/);
  assert.throws(()=>locked.saveCustomer(f.u),/licence required/);
  assert.throws(()=>locked.issue(f.c.id,f.d.id,''),/licence required/);
  assert.throws(()=>locked.deleteDraft(f.c.id,f.d.id),/licence required/);
  assert.equal(locked.document(f.c.id,f.d.id).id,f.d.id);
  assert.equal(locked.companies().length,1);
});
test('backups contain business data only and cannot import activation authority',()=>{
  const f=fixture();
  f.repo.setSetting('paid','true');
  f.repo.setSetting('account.token','must-not-export');
  f.repo.setSetting('license.'+f.c.id,'must-not-export');
  const m=capture(f.repo);
  assert.equal(JSON.stringify(m).includes('must-not-export'),false);
  assert.throws(()=>validateManifest({...m,settings:{...m.settings,paid:true}}));
  const locked=new Repository(f.repo.db);
  restore(locked,m);
  assert.throws(()=>locked.saveDraft(f.d),/licence required/);
  assert.equal(locked.company(f.c.id).id,f.c.id);
});
test("normal sized embedded logos are valid in issued snapshots", () => {
  const f = fixture();
  const logo = "data:image/jpeg;base64," + "A".repeat(100000);
  assert.equal(f.repo.issue(f.c.id, f.d.id, logo).company.logo, logo);
});
test("archive checksum rejects modified content before restore", () => {
  const f = fixture();
  const original = zipSync(
    { "manifest.json": strToU8(JSON.stringify(capture(f.repo))) },
    { level: 0 },
  );
  const changed = original.slice();
  const text = Buffer.from(changed).indexOf(Buffer.from("Test <Business>"));
  assert.ok(text > 0);
  changed[text] = 88;
  assert.throws(() => decodeBackup(changed), /checksum/);
});
test("identical historical logos share one image asset", () => {
  const f = fixture();
  const logo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=";
  f.repo.saveCompany({ ...f.c, logo });
  f.repo.issue(f.c.id, f.d.id, logo);
  const files = unzipSync(encodeBackup(capture(f.repo)));
  assert.equal(
    Object.keys(files).filter((x) => x.startsWith("assets/")).length,
    1,
  );
});
test("backup resolves permanent logo paths in draft snapshots too", async () => {
  const f = fixture();
  const logo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=";
  f.repo.saveCompany({ ...f.c, logo: "file:///logos/company.png" });
  f.repo.saveDraft({
    ...f.d,
    company: { ...f.c, logo: "file:///logos/company.png" },
  });
  const embedded = await embedBackupLogos(capture(f.repo), async (uri) =>
    uri ? logo : "",
  );
  const restored = decodeBackup(encodeBackup(embedded));
  assert.equal(restored.documents[0]!.company.logo, logo);
});
test("backup round-trip preserves the selected interface language", () => {
  const f = fixture();
  f.repo.setSetting("language", "am");
  const target = database();
  restore(target.repo, decodeBackup(encodeBackup(capture(f.repo))));
  assert.equal(target.repo.setting("language"), "am");
  assert.throws(() =>
    validateManifest({ ...capture(f.repo), settings: { language: "unknown" } }),
  );
});

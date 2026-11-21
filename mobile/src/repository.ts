import {
  Company,
  Customer,
  Catalogue,
  Proforma,
  companySchema,
  customerSchema,
  catalogueSchema,
  documentSchema,
  id,
} from "./domain";
import { validStamp } from "./stamp";
export interface DB {
  execSync(sql: string): void;
  runSync(sql: string, ...params: any[]): unknown;
  getAllSync<T>(sql: string, ...params: any[]): T[];
  getFirstSync<T>(sql: string, ...params: any[]): T | null;
}
export const schema = `
CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,companyId TEXT NOT NULL REFERENCES companies(id),payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS catalogue(id TEXT PRIMARY KEY,companyId TEXT NOT NULL REFERENCES companies(id),payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,companyId TEXT NOT NULL REFERENCES companies(id),status TEXT NOT NULL,number TEXT,payload TEXT NOT NULL,UNIQUE(companyId,number));
CREATE TABLE IF NOT EXISTS lines(id TEXT PRIMARY KEY,documentId TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sequences(companyId TEXT NOT NULL REFERENCES companies(id),year TEXT NOT NULL,value INTEGER NOT NULL,PRIMARY KEY(companyId,year));
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
PRAGMA user_version=1;`;
export class Repository {
  constructor(
    public db: DB,
    private authorize: (companyId: string) => void = () => {
      throw Error("Device licence required");
    },
  ) {
    db.execSync("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
    const v =
      db.getFirstSync<{ user_version: number }>("PRAGMA user_version")
        ?.user_version || 0;
    if (v > 1) throw Error("Database is newer than this app");
    if (v === 0) this.transaction(() => db.execSync(schema));
  }
  transaction<T>(fn: () => T): T {
    this.db.execSync("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.execSync("COMMIT");
      return result;
    } catch (e) {
      this.db.execSync("ROLLBACK");
      throw e;
    }
  }
  companies(): Company[] {
    return this.db
      .getAllSync<{
        payload: string;
      }>("SELECT payload FROM companies ORDER BY rowid")
      .map((r) => JSON.parse(r.payload));
  }
  company(cid: string): Company {
    const c = this.companies().find((c) => c.id === cid);
    if (!c) throw Error("Company not found");
    return c;
  }
  saveCompany(c: Company) {
    companySchema.parse(c);
    this.db.runSync(
      "INSERT INTO companies(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      c.id,
      JSON.stringify(c),
    );
  }
  customers(cid: string): Customer[] {
    return this.read("customers", cid);
  }
  catalogue(cid: string): Catalogue[] {
    return this.read("catalogue", cid);
  }
  private read<T>(
    table: "customers" | "catalogue" | "documents",
    cid: string,
  ): T[] {
    return this.db
      .getAllSync<{
        payload: string;
      }>(
        `SELECT payload FROM ${table} WHERE companyId=? ORDER BY rowid DESC`,
        cid,
      )
      .map((r) => JSON.parse(r.payload));
  }
  saveCustomer(c: Customer) {
    this.authorize(c.companyId);
    customerSchema.parse(c);
    this.saveScoped("customers", c);
  }
  saveCatalogue(c: Catalogue) {
    this.authorize(c.companyId);
    catalogueSchema.parse(c);
    this.saveScoped("catalogue", c);
  }
  private saveScoped(
    table: "customers" | "catalogue",
    c: Customer | Catalogue,
  ) {
    const old = this.db.getFirstSync<{ companyId: string }>(
      `SELECT companyId FROM ${table} WHERE id=?`,
      c.id,
    );
    if (old && old.companyId !== c.companyId) throw Error("Company mismatch");
    this.db.runSync(
      `INSERT INTO ${table}(id,companyId,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload`,
      c.id,
      c.companyId,
      JSON.stringify(c),
    );
  }
  documents(cid: string): Proforma[] {
    return this.read("documents", cid);
  }
  document(cid: string, did: string): Proforma {
    const d = this.documents(cid).find((d) => d.id === did);
    if (!d) throw Error("Document not found");
    return d;
  }
  suggested(cid: string, date: string) {
    const n =
      this.db.getFirstSync<{ value: number }>(
        "SELECT value FROM sequences WHERE companyId=? AND year=?",
        cid,
        date.slice(0, 4),
      )?.value || 0;
    return this.number(this.company(cid), date, n + 1);
  }
  private number(c: Company, date: string, n: number) {
    return `${c.prefix}-${date.slice(0, 4)}-${String(n).padStart(4, "0")}`;
  }
  saveDraft(input: Proforma, saveCustomer = false) {
    this.authorize(input.companyId);
    const d = documentSchema.parse(input);
    if (d.status !== "draft") throw Error("Issued records are read-only");
    return this.transaction(() => {
      const old = this.db.getFirstSync<{ companyId: string; status: string }>(
        "SELECT companyId,status FROM documents WHERE id=?",
        d.id,
      );
      if (old && (old.companyId !== d.companyId || old.status !== "draft"))
        throw Error("Record is read-only");
      if (saveCustomer) this.saveCustomer(d.customer);
      d.number = "";
      this.write(d);
      return d;
    });
  }
  private write(d: Proforma) {
    this.db.runSync(
      "INSERT INTO documents(id,companyId,status,number,payload) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,number=excluded.number,payload=excluded.payload",
      d.id,
      d.companyId,
      d.status,
      d.number || null,
      JSON.stringify(d),
    );
    this.db.runSync("DELETE FROM lines WHERE documentId=?", d.id);
    for (const l of d.lines)
      this.db.runSync(
        "INSERT INTO lines(id,documentId,payload) VALUES(?,?,?)",
        `${d.id}:${l.id}`,
        d.id,
        JSON.stringify(l),
      );
  }
  issue(cid: string, did: string, logoData: string, stampData?: string) {
    this.authorize(cid);
    return this.transaction(() => {
      const d = this.document(cid, did);
      if (d.status !== "draft") throw Error("Only drafts can be issued");
      const company = this.company(cid);
      const stamp = stampData ?? company.stamp ?? "";
      if (stamp && !validStamp(stamp)) throw Error("Choose a valid PNG organization stamp before issuing.");
      d.company = { ...company, logo: logoData, ...(company.stamp !== undefined || stampData !== undefined ? {stamp} : {}) };
      documentSchema.parse(d);
      const year = d.issueDate.slice(0, 4);
      let n =
        this.db.getFirstSync<{ value: number }>(
          "SELECT value FROM sequences WHERE companyId=? AND year=?",
          cid,
          year,
        )?.value || 0;
      do {
        d.number = this.number(d.company, d.issueDate, ++n);
      } while (
        this.db.getFirstSync(
          "SELECT id FROM documents WHERE companyId=? AND number=?",
          cid,
          d.number,
        )
      );
      this.db.runSync(
        "INSERT INTO sequences(companyId,year,value) VALUES(?,?,?) ON CONFLICT(companyId,year) DO UPDATE SET value=excluded.value",
        cid,
        year,
        n,
      );
      d.status = "issued";
      this.write(d);
      return d;
    });
  }
  duplicate(cid: string, did: string) {
    this.authorize(cid);
    const d = this.document(cid, did);
    const copy = {
      ...d,
      id: id(),
      number: "",
      status: "draft" as const,
      company: this.company(cid),
      lines: d.lines.map((l) => ({ ...l, id: id() })),
    };
    return this.saveDraft(copy);
  }
  void(cid: string, did: string) {
    this.authorize(cid);
    this.transaction(() => {
      const d = this.document(cid, did);
      if (d.status !== "issued")
        throw Error("Only issued documents can be voided");
      d.status = "void";
      this.write(d);
    });
  }
  deleteDraft(cid: string, did: string) {
    this.authorize(cid);
    this.transaction(() => {
      if (this.document(cid, did).status !== "draft")
        throw Error("Only drafts can be deleted");
      this.db.runSync(
        "DELETE FROM documents WHERE companyId=? AND id=?",
        cid,
        did,
      );
    });
  }
  setting(key: string) {
    return this.db.getFirstSync<{ value: string }>(
      "SELECT value FROM settings WHERE key=?",
      key,
    )?.value;
  }
  setSetting(key: string, value: string) {
    this.db.runSync(
      "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      value,
    );
  }
}

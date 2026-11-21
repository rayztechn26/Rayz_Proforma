import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { fromByteArray, toByteArray } from "base64-js";
import { z } from "zod";
import {
  companySchema,
  customerSchema,
  catalogueSchema,
  documentSchema,
} from "./domain";
import { Repository } from "./repository";
import { validStamp } from "./stamp";
const sequence = z
  .object({
    companyId: z.string(),
    year: z.string().regex(/^\d{4}$/),
    value: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
const manifestSchema = z
  .object({
    format: z.literal("proforma-studio"),
    version: z.union([z.literal(1),z.literal(2),z.literal(3)]),
    companies: z.array(companySchema),
    customers: z.array(customerSchema),
    catalogue: z.array(catalogueSchema),
    documents: z.array(documentSchema),
    sequences: z.array(sequence),
    settings: z
      .object({
        activeCompany: z.string().optional(),
        language: z.enum(["en", "am"]).optional(),
      })
      .strict(),
  })
  .strict();
export type Manifest = z.infer<typeof manifestSchema>;
export function validateManifest(input: unknown): Manifest {
  const m = manifestSchema.parse(input);
  if (m.version === 1 && [...m.companies,...m.documents.map(d => d.company)].some(c => c.stamp)) throw Error("Organization stamps require backup format 2");
  if (m.version < 3 && [...m.companies,...m.documents.map(d => d.company),...m.documents].some(c => c.termsAndConditions)) throw Error("Custom terms require backup format 3");
  const companies = new Set(m.companies.map((c) => c.id));
  const unique = (values: string[]) => {
    if (new Set(values).size !== values.length)
      throw Error("Duplicate backup IDs or numbers");
  };
  unique(m.companies.map((c) => c.id));
  unique(m.customers.map((c) => c.id));
  unique(m.catalogue.map((c) => c.id));
  unique(m.documents.map((d) => d.id));
  unique(m.sequences.map((s) => `${s.companyId}:${s.year}`));
  for (const r of [
    ...m.customers,
    ...m.catalogue,
    ...m.documents,
    ...m.sequences,
  ])
    if (!companies.has(r.companyId)) throw Error("Orphan company reference");
  if (m.settings.activeCompany && !companies.has(m.settings.activeCompany))
    throw Error("Invalid active company");
  unique(
    m.documents
      .filter((d) => d.status !== "draft")
      .map((d) => `${d.companyId}:${d.number}`),
  );
  for (const d of m.documents) {
    unique(d.lines.map((l) => l.id));
    if (d.status === "draft" && d.number) throw Error("Draft has final number");
    if (d.status !== "draft") {
      if (!d.number) throw Error("Missing final number");
      const suffix = /-(\d{4})-(\d+)$/.exec(d.number);
      if (!suffix || suffix[1] !== d.issueDate.slice(0, 4))
        throw Error("Invalid issued number");
      const seq = m.sequences.find(
        (s) => s.companyId === d.companyId && s.year === suffix[1],
      );
      if (!seq || seq.value < Number(suffix[2]))
        throw Error("Sequence would reuse numbers");
    }
  }
  return m;
}
export function capture(repo: Repository): Manifest {
  const companies = repo.companies();
  return validateManifest({
    format: "proforma-studio",
    version: 3,
    companies,
    customers: companies.flatMap((c) => repo.customers(c.id)),
    catalogue: companies.flatMap((c) => repo.catalogue(c.id)),
    documents: companies.flatMap((c) => repo.documents(c.id)),
    sequences: repo.db.getAllSync("SELECT companyId,year,value FROM sequences"),
    settings: {
      activeCompany: repo.setting("activeCompany"),
      language: repo.setting("language"),
    },
  });
}
export async function embedBackupLogos(
  input: Manifest,
  readLogo: (uri: string) => Promise<string>,
  readStamp: (uri: string) => Promise<string> = readLogo,
): Promise<Manifest> {
  const m = validateManifest(input);
  const logos = new Map<string,Promise<string>>(), stamps = new Map<string,Promise<string>>();
  const read = (uri:string, cache:Map<string,Promise<string>>, reader:(uri:string)=>Promise<string>) => {
    if (!cache.has(uri)) cache.set(uri,reader(uri));
    return cache.get(uri)!;
  };
  for (const company of [...m.companies, ...m.documents.map((d) => d.company)]) {
    company.logo = await read(company.logo,logos,readLogo);
    if (company.stamp) company.stamp = await read(company.stamp,stamps,readStamp);
  }
  return m;
}
export function encodeBackup(input: Manifest): Uint8Array {
  const m: Manifest = JSON.parse(JSON.stringify(validateManifest(input)));
  const files: Record<string, Uint8Array> = {};
  const existing = new Map<string, string>();
  let count = 0;
  for (const c of [...m.companies, ...m.documents.map((d) => d.company)]) {
    if (c.stamp) {
      const key = "stamp:" + c.stamp;
      const same = existing.get(key);
      if (same) c.stamp = same;
      else {
        if (!validStamp(c.stamp)) throw Error("Stamp must be a valid embedded PNG before backup");
        const path = `assets/stamp-${++count}.png`;
        files[path] = toByteArray(c.stamp.split(",")[1]!);
        existing.set(key,path);
        c.stamp = path;
      }
    }
    if (!c.logo) continue;
    const same = existing.get(c.logo);
    if (same) {
      c.logo = same;
      continue;
    }
    const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(
      c.logo,
    );
    if (!match) throw Error("Logo must be embedded before backup");
    const path = `assets/logo-${++count}.${match[1] === "png" ? "png" : "jpg"}`;
    files[path] = toByteArray(match[2]!);
    existing.set(c.logo, path);
    c.logo = path;
  }
  files["manifest.json"] = strToU8(JSON.stringify(m));
  const bytes = zipSync(files, { level: 6 });
  decodeBackup(bytes); // Never export an archive this version cannot restore.
  return bytes;
}
export function decodeBackup(bytes: Uint8Array): Manifest {
  if (bytes.length > 50 * 1024 * 1024) throw Error("Backup exceeds 50 MB");
  let size = 0;
  const files = unzipSync(bytes, {
    filter: (f) => {
      size += f.originalSize;
      if (size > 100 * 1024 * 1024)
        throw Error("Expanded backup exceeds 100 MB");
      if (
        f.name !== "manifest.json" &&
        !/^assets\/(?:logo-\d+\.(?:png|jpg)|stamp-\d+\.png)$/.test(f.name)
      )
        throw Error("Unexpected archive path");
      return true;
    },
  });
  verifyZipCrc(bytes, files);
  if (!files["manifest.json"]) throw Error("Missing manifest");
  const raw = manifestSchema.parse(
    JSON.parse(strFromU8(files["manifest.json"])),
  );
  const stampImages = new Map<string,string>();
  for (const c of [...raw.companies, ...raw.documents.map((d) => d.company)]) {
    if (c.stamp) {
      if (![2,3].includes(raw.version) || !/^assets\/stamp-\d+\.png$/.test(c.stamp)) throw Error("Invalid stamp path");
      if (!stampImages.has(c.stamp)) {
        const image = files[c.stamp];
        if (!image || image.length > 10 * 1024 * 1024) throw Error("Missing or oversized stamp");
        const data = `data:image/png;base64,${fromByteArray(image)}`;
        if (!validStamp(data)) throw Error("Invalid PNG stamp");
        stampImages.set(c.stamp,data);
      }
      c.stamp = stampImages.get(c.stamp)!;
    }
    if (!c.logo) continue;
    if (!/^assets\/logo-\d+\.(png|jpg)$/.test(c.logo))
      throw Error("Invalid logo path");
    const asset = files[c.logo];
    if (!asset || asset.length > 10 * 1024 * 1024)
      throw Error("Missing or oversized logo");
    const png =
      asset[0] === 137 && asset[1] === 80 && asset[2] === 78 && asset[3] === 71;
    const jpg = asset[0] === 255 && asset[1] === 216 && asset[2] === 255;
    if (!png && !jpg) throw Error("Invalid image");
    c.logo = `data:image/${png ? "png" : "jpeg"};base64,${fromByteArray(asset)}`;
  }
  return validateManifest(raw);
}
// ZIP readers often omit CRC validation. Verify the central directory before trusting content.
function verifyZipCrc(bytes: Uint8Array, files: Record<string, Uint8Array>) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--)
    if (v.getUint32(p, true) === 0x06054b50) {
      end = p;
      break;
    }
  if (end < 0) throw Error("Invalid ZIP directory");
  const count = v.getUint16(end + 10, true);
  let offset = v.getUint32(end + 16, true);
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || v.getUint32(offset, true) !== 0x02014b50)
      throw Error("Invalid ZIP entry");
    const nameLen = v.getUint16(offset + 28, true),
      extra = v.getUint16(offset + 30, true),
      comment = v.getUint16(offset + 32, true);
    const name = strFromU8(bytes.slice(offset + 46, offset + 46 + nameLen));
    if (seen.has(name)) throw Error("Duplicate ZIP entry");
    seen.add(name);
    const data = files[name];
    if (!data) throw Error("Missing ZIP entry");
    let crc = 0xffffffff;
    for (const b of data) {
      crc ^= b;
      for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    if ((crc ^ 0xffffffff) >>> 0 !== v.getUint32(offset + 16, true))
      throw Error("Corrupt backup checksum");
    offset += 46 + nameLen + extra + comment;
  }
  if (seen.size !== Object.keys(files).length)
    throw Error("Unexpected ZIP entries");
}
export function restore(repo: Repository, input: Manifest) {
  const m = validateManifest(input);
  repo.transaction(() => {
    for (const table of [
      "lines",
      "documents",
      "sequences",
      "customers",
      "catalogue",
      "settings",
      "companies",
    ])
      repo.db.execSync(`DELETE FROM ${table}`);
    for (const c of m.companies) repo.saveCompany(c);
    // Restoring validated business records is available during recovery. It
    // imports no licence authority; protected operations still verify the key.
    for (const [table,records] of [['customers',m.customers],['catalogue',m.catalogue]] as const)
      for(const c of records) repo.db.runSync(`INSERT INTO ${table}(id,companyId,payload) VALUES(?,?,?)`,c.id,c.companyId,JSON.stringify(c));
    for (const d of m.documents) {
      repo.db.runSync(
        "INSERT INTO documents(id,companyId,status,number,payload) VALUES(?,?,?,?,?)",
        d.id,
        d.companyId,
        d.status,
        d.number || null,
        JSON.stringify(d),
      );
      for (const l of d.lines)
        repo.db.runSync(
          "INSERT INTO lines(id,documentId,payload) VALUES(?,?,?)",
          `${d.id}:${l.id}`,
          d.id,
          JSON.stringify(l),
        );
    }
    for (const s of m.sequences)
      repo.db.runSync(
        "INSERT INTO sequences(companyId,year,value) VALUES(?,?,?)",
        s.companyId,
        s.year,
        s.value,
      );
    if (m.settings.activeCompany)
      repo.setSetting("activeCompany", m.settings.activeCompany);
    if (m.settings.language) repo.setSetting("language", m.settings.language);
  });
}

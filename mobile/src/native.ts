import * as SQLite from "expo-sqlite";
import * as FS from "expo-file-system/legacy";
import * as Picker from "expo-image-picker";
import * as Documents from "expo-document-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fromByteArray, toByteArray } from "base64-js";
import { Repository } from "./repository";
import {
  capture,
  decodeBackup,
  encodeBackup,
  restore,
  Manifest,
  validateManifest,
  embedBackupLogos,
} from "./backup";
import { Proforma, id } from "./domain";
import { pdfHtml, filename } from "./pdf";
import { assertLicense } from './licensing';
import { validStamp } from "./stamp";
let repository: Repository;
export const getRepo = () =>
  (repository ||= new Repository(
    SQLite.openDatabaseSync("proforma-studio.db"),
    (cid) => assertLicense(cid,repository.company(cid)),
  ));
const assets = () => `${FS.documentDirectory}logos/`;
export async function logoData(uri: string): Promise<string> {
  if (!uri) return "";
  try {
    if (uri.startsWith("data:image/")) return validLogo(uri) ? uri : "";
    const info = await FS.getInfoAsync(uri);
    if (!info.exists || info.size > 10 * 1024 * 1024) return "";
    const b = await FS.readAsStringAsync(uri, {
      encoding: FS.EncodingType.Base64,
    });
    const data = `data:image/${uri.endsWith(".png") ? "png" : "jpeg"};base64,${b}`;
    return validLogo(data) ? data : "";
  } catch {
    return "";
  }
}
function validLogo(data: string) {
  const encoded = data.split(",")[1];
  if (!encoded) return false;
  const b = toByteArray(encoded);
  return (
    b.length > 8 &&
    ((b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71) ||
      (b[0] === 255 && b[1] === 216 && b[2] === 255))
  );
}
export async function chooseLogo(): Promise<string | null> {
  const result = await Picker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw Error("No image selected");
  const mime = asset.mimeType;
  if (mime !== "image/png" && mime !== "image/jpeg")
    throw Error("Choose a JPG or PNG logo");
  if ((asset.fileSize || 0) > 10 * 1024 * 1024)
    throw Error("Logo must be smaller than 10 MB");
  await FS.makeDirectoryAsync(assets(), { intermediates: true });
  const path = `${assets()}${id()}.${mime === "image/png" ? "png" : "jpg"}`;
  await FS.copyAsync({ from: asset.uri, to: path });
  return path;
}
export async function stampData(uri: string | undefined): Promise<string> {
  if (!uri) return "";
  let data = uri;
  if (!uri.startsWith("data:")) {
    const info = await FS.getInfoAsync(uri);
    if (!info.exists || info.size > 10 * 1024 * 1024) throw Error("The organization stamp is missing or too large. Select its PNG file again.");
    data = "data:image/png;base64," + await FS.readAsStringAsync(uri, {encoding: FS.EncodingType.Base64});
  }
  if (!validStamp(data)) throw Error("Choose a valid PNG stamp, up to 10 MB and 4096 × 4096 pixels.");
  return data;
}
export async function chooseStamp(): Promise<string | null> {
  const result = await Picker.launchImageLibraryAsync({mediaTypes:["images"], allowsEditing:false});
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw Error("No image selected");
  if (asset.mimeType && asset.mimeType !== "image/png") throw Error("Choose a PNG organization stamp. JPG files are not supported.");
  await stampData(asset.uri);
  await FS.makeDirectoryAsync(assets(), {intermediates:true});
  const path = `${assets()}stamp-${id()}.png`;
  await FS.copyAsync({from:asset.uri,to:path});
  return path;
}
export async function exportBackup() {
  const m = await embedBackupLogos(capture(getRepo()), logoData, stampData);
  const bytes = encodeBackup(m);
  const uri = `${FS.documentDirectory}Proforma-backup-${Date.now()}.zip`;
  await FS.writeAsStringAsync(uri, fromByteArray(bytes), {
    encoding: FS.EncodingType.Base64,
  });
  await share(uri, "application/zip");
  return uri;
}
export async function pickBackup(): Promise<Manifest | null> {
  const r = await Documents.getDocumentAsync({
    type: [
      "application/zip",
      "application/octet-stream",
      "application/x-zip-compressed",
    ],
    copyToCacheDirectory: true,
  });
  if (r.canceled) return null;
  const file = r.assets[0]!;
  if ((file.size || 0) > 50 * 1024 * 1024) throw Error("Backup exceeds 50 MB");
  return decodeBackup(
    toByteArray(
      await FS.readAsStringAsync(file.uri, {
        encoding: FS.EncodingType.Base64,
      }),
    ),
  );
}
export async function restoreBackup(input: Manifest) {
  const m = validateManifest(JSON.parse(JSON.stringify(input)));
  await FS.makeDirectoryAsync(assets(), { intermediates: true });
  const paths: string[] = [];
  try {
    for (const c of m.companies) {
      if (c.stamp) {
        const path = `${assets()}stamp-${id()}.png`;
        await FS.writeAsStringAsync(path,c.stamp.split(",")[1]!,{encoding:FS.EncodingType.Base64});
        paths.push(path);
        c.stamp = path;
      }
      if (!c.logo) continue;
      const path = `${assets()}${id()}.${c.logo.startsWith("data:image/png") ? "png" : "jpg"}`;
      await FS.writeAsStringAsync(path, c.logo.split(",")[1]!, {
        encoding: FS.EncodingType.Base64,
      });
      paths.push(path);
      c.logo = path;
    } // Only validated data enters the transaction; validate before converting local asset paths.
    const parsed = { ...m, companies: m.companies.map((c) => ({ ...c })) };
    restore(getRepo(), parsed);
  } catch (e) {
    for (const p of paths) await FS.deleteAsync(p, { idempotent: true });
    throw e;
  }
}
let pdfFontCache: Promise<[string, string]> | undefined;
async function pdfFonts(): Promise<[string, string]> {
  // One embedded family covers Latin and Ethiopic, including mixed business
  // names, and preserves searchable/copyable numeric glyphs in printed PDFs.
  return pdfFontCache ||= (async () => {
    const modules = [require("../assets/fonts/NotoSansEthiopic_400Regular.ttf"), require("../assets/fonts/NotoSansEthiopic_600SemiBold.ttf")];
    return await Promise.all(modules.map(async module => {
      const asset = Asset.fromModule(module);
      await asset.downloadAsync();
      if (!asset.localUri) throw Error("The PDF font could not be loaded. Please retry.");
      return FS.readAsStringAsync(asset.localUri, { encoding: FS.EncodingType.Base64 });
    })) as [string, string];
  })().catch(error => { pdfFontCache = undefined; throw error; });
}
export async function generatePdf(d: Proforma, language: "en" | "am" = "en") {
  assertLicense(d.companyId,getRepo().company(d.companyId));
  const embedded = {
    ...d,
    company: { ...d.company, logo: await logoData(d.company.logo), ...(d.company.stamp ? {stamp:await stampData(d.company.stamp)} : {}) },
  };
  const [fontRegularBase64, fontBoldBase64] = await pdfFonts();
  const result = await Print.printToFileAsync({
    html: pdfHtml(embedded, { language, fontRegularBase64, fontBoldBase64 }),
    width: 595.28,
    height: 841.89,
    textZoom: 100,
  });
  const pdf = await PDFDocument.load(
    await FS.readAsStringAsync(result.uri, {
      encoding: FS.EncodingType.Base64,
    }),
  );
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    // Neutral numerals work in both languages without a WinAnsi-only footer.
    const label = `${i + 1} / ${pages.length}`;
    p.drawText(label, {
      x: p.getWidth() - font.widthOfTextAtSize(label, 8) - 37,
      y: 20,
      size: 8,
      font,
      color: rgb(0.35, 0.43, 0.47),
    });
  });
  const uri = `${FS.documentDirectory}${filename(d)}`;
  await FS.writeAsStringAsync(uri, fromByteArray(await pdf.save()), {
    encoding: FS.EncodingType.Base64,
  });
  await FS.deleteAsync(result.uri, { idempotent: true });
  return uri;
}
export async function share(uri: string, mimeType: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw Error("Native sharing is unavailable on this device");
  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: "Share or save file",
  });
}
export async function pdfAction(
  d: Proforma,
  action: "preview" | "export" | "share" | "print",
  language: "en" | "am" = "en",
) {
  const uri = await generatePdf(d, language);
  if (action === "print" || action === "preview")
    await Print.printAsync({ uri });
  else await share(uri, "application/pdf");
  return uri;
}

import { generatePdf, pdfAction, chooseStamp, stampData } from "../src/native";
import * as Picker from "expo-image-picker";
import { newCompany, newCustomer, newDocument } from "../src/domain";
import * as Print from "expo-print";
import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { assertLicense } from "../src/licensing";
import { Asset } from "expo-asset";

jest.mock("expo-sqlite", () => ({openDatabaseSync: jest.fn(() => ({}))}));
jest.mock("../src/repository", () => ({Repository: jest.fn().mockImplementation(() => ({company: () => ({name: "Example", tin: "123"})}))}));
jest.mock("../src/licensing", () => ({assertLicense: jest.fn()}));
jest.mock("expo-asset", () => ({Asset: {fromModule: jest.fn(() => ({downloadAsync: async () => {}, localUri: "file:///font.ttf"}))}}));
jest.mock("expo-file-system/legacy", () => ({documentDirectory: "file:///documents/", EncodingType: {Base64: "base64"}, readAsStringAsync: jest.fn(async () => "dGVzdA=="), writeAsStringAsync: jest.fn(), deleteAsync: jest.fn(),getInfoAsync:jest.fn(async()=>({exists:true,size:100})),makeDirectoryAsync:jest.fn(),copyAsync:jest.fn()}));
jest.mock("expo-image-picker",()=>({launchImageLibraryAsync:jest.fn()}));
jest.mock("expo-print", () => ({printToFileAsync: jest.fn(async () => ({uri: "file:///printed.pdf"})), printAsync: jest.fn()}));
jest.mock("expo-sharing", () => ({isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn()}));
jest.mock("pdf-lib", () => ({StandardFonts: {Helvetica: "Helvetica"}, rgb: () => ({}), PDFDocument: {load: jest.fn(async () => ({embedFont: async () => ({widthOfTextAtSize: () => 20}), getPages: () => [{getWidth: () => 595, drawText: jest.fn()}], save: async () => new Uint8Array([1,2,3])}))}}));
beforeEach(() => {jest.clearAllMocks();(assertLicense as jest.Mock).mockImplementation(() => {});});
const company = {...newCompany(), name:"Example", tin:"123"};
const doc = {...newDocument(company,newCustomer(company.id)), lines:[{id:"line",description:"Example",unit:"pcs",quantity:"1",price:"1000"}]};

test("font loading failure is retryable and never exports an unreadable PDF", async () => {
  (Asset.fromModule as jest.Mock).mockReturnValueOnce({downloadAsync: async () => {}, localUri:null});
  await expect(generatePdf(doc,"en")).rejects.toThrow("PDF font");
  expect(Print.printToFileAsync).not.toHaveBeenCalled();
  await generatePdf(doc,"en");
  expect(Print.printToFileAsync).toHaveBeenCalledTimes(1);
});
test.each(["preview","export","share","print"] as const)("%s exports Amharic text and embedded fonts with licence checks intact", async action => {
  await pdfAction(doc,action,"am");
  expect(assertLicense).toHaveBeenCalledWith(doc.companyId,expect.any(Object));
  expect(Print.printToFileAsync).toHaveBeenCalledWith(expect.objectContaining({html:expect.stringContaining('lang="am"'),textZoom:100}));
  const html=(Print.printToFileAsync as jest.Mock).mock.calls[0][0].html;
  expect(html).toContain("ፕሮፎርማ ደረሰኝ");expect(html).toContain("data:font/ttf;base64,");expect(html).toContain("አንድ ሺህ አንድ መቶ ሃምሳ ብር");
  expect(FS.writeAsStringAsync).toHaveBeenCalled();
  if(action === "print" || action === "preview") expect(Print.printAsync).toHaveBeenCalled();
  else expect(Sharing.shareAsync).toHaveBeenCalled();
});
test("invalid device licence prevents PDF generation before loading fonts or printing", async () => {
  (assertLicense as jest.Mock).mockImplementation(() => {throw Error("Invalid licence");});
  await expect(generatePdf(doc,"am")).rejects.toThrow("Invalid licence");
  expect(Print.printToFileAsync).not.toHaveBeenCalled();expect(Asset.fromModule).not.toHaveBeenCalled();
});
const png="iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGPkj5o2jYGBgYEJRIAwABfTAZlkof41AAAAAElFTkSuQmCC";
test("stamp picker cancels safely, rejects JPG, and copies PNG bytes without conversion",async()=>{
  (Picker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({canceled:true});expect(await chooseStamp()).toBeNull();
  (Picker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({canceled:false,assets:[{uri:"file:///stamp.jpg",mimeType:"image/jpeg"}]});
  await expect(chooseStamp()).rejects.toThrow("PNG organization stamp");expect(FS.copyAsync).not.toHaveBeenCalled();
  (Picker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({canceled:false,assets:[{uri:"file:///stamp.png",mimeType:"image/png"}]});
  (FS.readAsStringAsync as jest.Mock).mockResolvedValueOnce(png);
  const uri=await chooseStamp();expect(uri).toMatch(/stamp-.+\.png$/);
  expect(FS.copyAsync).toHaveBeenCalledWith({from:"file:///stamp.png",to:uri});
});
test("export embeds the issued PNG stamp and a missing selected asset stops printing",async()=>{
  const stamped={...doc,company:{...doc.company,stamp:"data:image/png;base64,"+png}};
  await generatePdf(stamped,"am");expect((Print.printToFileAsync as jest.Mock).mock.calls[0][0].html).toContain('src="data:image/png;base64,'+png+'"');
  (Print.printToFileAsync as jest.Mock).mockClear();
  (FS.getInfoAsync as jest.Mock).mockResolvedValueOnce({exists:false});
  await expect(generatePdf({...doc,company:{...doc.company,stamp:"file:///missing.png"}})).rejects.toThrow("missing or too large");
  expect(Print.printToFileAsync).not.toHaveBeenCalled();
  await expect(stampData("data:image/jpeg;base64,"+png)).rejects.toThrow("valid PNG");
});

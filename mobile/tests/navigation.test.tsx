import React from "react";
import {
  renderRouter,
  screen,
  fireEvent,
  waitFor,
} from "expo-router/testing-library";
import App from "../app/index";
import Layout from "../app/_layout";
import type { Company } from "../src/domain";
import { newCompany, newCustomer, newDocument, Proforma } from "../src/domain";
import { pdfAction, chooseStamp } from "../src/native";
import { translate } from "../src/i18n";

let mockCompanies: Company[] = [];
let mockSettings: Record<string, string> = {};
let mockCompanySaveError = "";
let mockDocuments: Proforma[] = [];
const mockRepo = {
  companies: () => mockCompanies,
  setting: (key: string) => mockSettings[key],
  setSetting: (key: string, value: string) => {
    mockSettings[key] = value;
  },
  saveCompany: jest.fn((company: Company) => {
    mockCompanies.push(company);
  }),
  customers: () => [],
  catalogue: () => [],
  documents: () => mockDocuments,
  document: (_companyId: string, id: string) => mockDocuments.find(d => d.id === id),
};
jest.mock("../src/native", () => ({ getRepo: () => mockRepo, chooseLogo: jest.fn(async () => "file:///saved-logo.jpg"), chooseStamp: jest.fn(), pdfAction: jest.fn(async () => "file:///example.pdf") }));
// This suite exercises existing workspace forms after activation. Real gate tests
// live in activation.test.tsx, with no gate mock.
jest.mock("../src/ActivationGate", () => ({
  ActivationGate: ({ children }: any) => children,
  useActivation: () => ({
    saveCompany: async (c: Company) => { if (mockCompanySaveError) throw Error(mockCompanySaveError); return mockRepo.saveCompany(c); },
  }),
}));
jest.mock("../src/licensing", () => ({ assertLicense: jest.fn() }));
const routes = { index: App, "[page]": App, _layout: Layout };
jest.setTimeout(20000);
beforeEach(() => {
  mockCompanies = [];
  mockSettings = {};
  mockCompanySaveError = "";
  mockDocuments = [];
  jest.clearAllMocks();
});

test.each(["en","am"] as const)("%s stamp picker retains selection after cancellation/failure and allows removal", async language => {
  mockSettings.language=language;mockCompanySaveError="Service unavailable";
  (chooseStamp as jest.Mock).mockResolvedValueOnce("file:///organization-stamp.png").mockResolvedValueOnce(null);
  renderRouter(routes,{initialUrl:"/company"});
  const t=(text:string)=>translate(text,language);
  fireEvent.changeText(screen.getByLabelText(t("Business / legal name *")),"Example");
  fireEvent.changeText(screen.getByLabelText(t("TIN *")),"123");
  fireEvent.press(screen.getByText(t("Choose PNG stamp")));
  await waitFor(()=>expect(screen.getByLabelText(t("Organization stamp preview"))).toBeOnTheScreen());
  fireEvent.press(screen.getByText(t("Choose PNG stamp")));
  await waitFor(()=>expect(chooseStamp).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText(t("Organization stamp preview")).props.source.uri).toBe("file:///organization-stamp.png");
  fireEvent.press(screen.getByText(t("Confirm this VAT rate")));fireEvent.press(screen.getByText(t("Save company")));
  await waitFor(()=>expect(screen.getByText(mockCompanySaveError)).toBeOnTheScreen());
  expect(screen.getByLabelText(t("Organization stamp preview"))).toBeOnTheScreen();
  fireEvent.press(screen.getByText(t("Remove stamp")));expect(screen.queryByLabelText(t("Organization stamp preview"))).toBeNull();
});

test.each(["preview", "export", "share", "print"] as const)("%s PDF follows the live language switch without modifying issued records", async action => {
  const company = {...newCompany(), name:"Example", tin:"123"};
  const doc = {...newDocument(company,newCustomer(company.id)), status:"issued" as const, number:"PF-2026-1", lines:[{id:"line",description:"Example",unit:"pcs",quantity:"1",price:"1000"}]};
  mockCompanies = [company];mockDocuments = [doc];mockSettings.activeCompany = company.id;
  const before = JSON.stringify(doc);
  renderRouter(routes,{initialUrl:`/preview?id=${doc.id}`});
  fireEvent.press(screen.getByLabelText("አማርኛ"));
  const label=action === "preview" ? "PDF preview" : action[0]!.toUpperCase()+action.slice(1)+" PDF";
  fireEvent.press(screen.getByText(translate(label,"am")));
  await waitFor(()=>expect(pdfAction).toHaveBeenCalledWith(doc,action,"am"));
  expect(JSON.stringify(doc)).toBe(before);
});

test("company form retains legal name, TIN, VAT confirmation and selected logo after submission failure", async () => {
  mockCompanySaveError = "Activation service unavailable. Retry.";
  renderRouter(routes, { initialUrl: "/company" });
  fireEvent.changeText(screen.getByLabelText("Business / legal name *"), "Preserved Company");
  fireEvent.changeText(screen.getByLabelText("TIN *"), "987654321");
  fireEvent.press(screen.getByText("Choose JPG / PNG logo"));
  await waitFor(() => expect(screen.getByText("Remove logo")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Confirm this VAT rate"));
  fireEvent.press(screen.getByText("Save company"));
  await waitFor(() => expect(screen.getByText(mockCompanySaveError)).toBeOnTheScreen());
  expect(screen.getByLabelText("Business / legal name *")).toHaveDisplayValue("Preserved Company");
  expect(screen.getByLabelText("TIN *")).toHaveDisplayValue("987654321");
  expect(screen.getByText("Remove logo")).toBeOnTheScreen();
  expect(mockRepo.saveCompany).not.toHaveBeenCalled();
});

test("catalogue price displays grouped amounts while editing raw decimals and selecting units", async () => {
  const company = { ...newCompany(), name: "Existing business", tin: "123" };
  mockCompanies = [company];
  mockSettings.activeCompany = company.id;
  renderRouter(routes, { initialUrl: "/item" });
  const price = () => screen.getByLabelText("Default unit price *");
  await waitFor(() => expect(price()).toHaveDisplayValue("0.00"));
  fireEvent(price(), "focus");
  fireEvent.changeText(price(), "11,000,000.25");
  expect(price()).toHaveDisplayValue("11000000.25");
  fireEvent(price(), "blur");
  expect(price()).toHaveDisplayValue("11,000,000.25");
  fireEvent.press(screen.getByLabelText("Choose unit"));
  fireEvent.changeText(screen.getByLabelText("Search units"), "meter");
  fireEvent.press(screen.getByText("m — Meter"));
  expect(screen.getByText("m ▾")).toBeOnTheScreen();
});

test("first-run setup button opens the company form and saves the first company", async () => {
  renderRouter(routes, { initialUrl: "/" });
  expect(screen.getByText("All in One Proformas")).toBeOnTheScreen();
  fireEvent.press(screen.getByText("Set up company"));
  await waitFor(() =>
    expect(screen.getByLabelText("Business / legal name *")).toBeOnTheScreen(),
  );
  fireEvent.changeText(
    screen.getByLabelText("Business / legal name *"),
    "Sample business",
  );
  fireEvent.changeText(screen.getByLabelText("TIN *"), "123456");
  fireEvent.press(screen.getByText("Confirm this VAT rate"));
  fireEvent.press(screen.getByText("Save company"));
  await waitFor(() =>
    expect(mockRepo.saveCompany).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Sample business",
        tin: "123456",
        vat: "15",
        vatConfirmed: true,
      }),
    ),
  );
  await waitFor(() =>
    expect(screen.getByText("Issued proforma values")).toBeOnTheScreen(),
  );
});

test("first-run restore button opens backup settings", async () => {
  renderRouter(routes, { initialUrl: "/" });
  fireEvent.press(screen.getByText("Restore an existing backup"));
  await waitFor(() =>
    expect(screen.getByText("Restore from backup ZIP")).toBeOnTheScreen(),
  );
});

test("workspace sections and company editing retain their route parameters", async () => {
  const company = { ...newCompany(), name: "Existing business", tin: "123" };
  mockCompanies = [company];
  mockSettings.activeCompany = company.id;
  renderRouter(routes, { initialUrl: "/" });
  for (const [tab, expected] of [
    ["People", "＋ Add customer"],
    ["Items", "＋ Add item or service"],
    ["Quotes", "Proformas"],
    ["Backup", "Restore from backup ZIP"],
    ["Business", "Companies"],
  ]) {
    fireEvent.press(screen.getByText(tab!));
    await waitFor(() => expect(screen.getByText(expected!)).toBeOnTheScreen());
  }
  fireEvent.press(screen.getByText("Edit profile"));
  await waitFor(() =>
    expect(screen.getByLabelText("Business / legal name *")).toHaveDisplayValue(
      "Existing business",
    ),
  );
});

test("AM/EN switching persists and preserves company edits and the developer footer", async () => {
  renderRouter(routes, { initialUrl: "/" });
  expect(
    screen.getByText("Developed by Rayz Technology plc"),
  ).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText("አማርኛ"));
  expect(mockSettings.language).toBe("am");
  expect(screen.getByText("ሁሉንም በአንድ ፕሮፎርማ")).toBeOnTheScreen();
  fireEvent.press(screen.getByText("ድርጅት ያዋቅሩ"));
  await waitFor(() =>
    expect(screen.getByLabelText("የድርጅት / ሕጋዊ ስም *")).toBeOnTheScreen(),
  );
  fireEvent.changeText(screen.getByLabelText("የድርጅት / ሕጋዊ ስም *"), "ሙከራ ድርጅት");
  fireEvent.press(screen.getByLabelText("English"));
  expect(screen.getByLabelText("Business / legal name *")).toHaveDisplayValue(
    "ሙከራ ድርጅት",
  );
  expect(
    screen.getByText("Developed by Rayz Technology plc"),
  ).toBeOnTheScreen();
  fireEvent.changeText(screen.getByLabelText("TIN *"), "123456");
  fireEvent.press(screen.getByText("Confirm this VAT rate"));
  fireEvent.press(screen.getByLabelText("አማርኛ"));
  fireEvent.press(screen.getByText("ድርጅት አስቀምጥ"));
  await waitFor(() =>
    expect(screen.getByText("የወጡ ፕሮፎርማዎች ዋጋ")).toBeOnTheScreen(),
  );
  expect(mockCompanies[0]?.name).toBe("ሙከራ ድርጅት");
  expect(mockSettings.language).toBe("am");
});

test("a fresh launch reads the saved AM preference and can switch back to EN", () => {
  mockSettings.language = "am";
  renderRouter(routes, { initialUrl: "/" });
  expect(screen.getByText("ሁሉንም በአንድ ፕሮፎርማ")).toBeOnTheScreen();
  expect(screen.getByLabelText("አማርኛ").props.accessibilityState.selected).toBe(
    true,
  );
  fireEvent.press(screen.getByLabelText("English"));
  expect(screen.getByText("All in One Proformas")).toBeOnTheScreen();
  expect(mockSettings.language).toBe("en");
});

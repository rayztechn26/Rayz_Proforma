import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAmount, amountInWords } from "../src/amounts";
import { calculate, newCompany, newCustomer, newDocument } from "../src/domain";
import { pdfHtml } from "../src/pdf";

test("amount display groups thousands, preserves cents and rounds half up", () => {
  assert.equal(formatAmount("11000000"), "11,000,000.00");
  assert.equal(formatAmount("1000"), "1,000.00");
  assert.equal(formatAmount("0"), "0.00");
  assert.equal(formatAmount("999.995"), "1,000.00");
  assert.equal(formatAmount("1000000000000000000000000.01"), "1,000,000,000,000,000,000,000,000.01");
});
test("words use the same rounded cents as the displayed amount", () => {
  assert.equal(amountInWords("11000000", "ETB"), "Eleven million Ethiopian birr and zero cents only.");
  assert.equal(amountInWords("1000.25", "ETB"), "One thousand Ethiopian birr and twenty-five cents only.");
  assert.equal(amountInWords("999.995", "USD"), "One thousand US dollars and zero cents only.");
  assert.equal(amountInWords("0", "ETB"), "Zero Ethiopian birr and zero cents only.");
  assert.equal(amountInWords("1000000000000000000000000.01", "ETB"), "One septillion Ethiopian birr and one cent only.");
  assert.equal(amountInWords("1.01", "USD"), "One US dollar and one cent only.");
});
test("PDF shows formatted prices, VAT-inclusive grand total and matching words", () => {
  const company = newCompany();
  const doc = newDocument(company, newCustomer(company.id));
  doc.lines = [{ id: "one", unit: "c/n", description: "Goods", quantity: "2", price: "1000" }];
  doc.vat = "15";
  doc.termsAndConditions = "User supplied conditions only.";
  const before = JSON.stringify(doc);
  const html = pdfHtml(doc);
  assert.ok(html.includes("1,000.00"));
  assert.ok(html.includes("Grand total</th><td>ETB 2,300.00"));
  assert.ok(html.includes("Two thousand three hundred Ethiopian birr and zero cents only."));
  assert.ok(html.includes("c/n"));
  assert.equal(calculate(doc.lines, doc.vat).total, "2300.00");
  assert.equal(JSON.stringify(doc), before);
});

test("Amharic money words preserve rounded cents and large exact integer values", () => {
  assert.equal(amountInWords("0", "ETB", "am"), "ዜሮ ብር እና ዜሮ ሳንቲም ብቻ።");
  assert.equal(amountInWords("11.25", "ETB", "am"), "አስራ አንድ ብር እና ሃያ አምስት ሳንቲም ብቻ።");
  assert.equal(amountInWords("11000000", "ETB", "am"), "አስራ አንድ ሚሊዮን ብር እና ዜሮ ሳንቲም ብቻ።");
  assert.equal(amountInWords("999.995", "USD", "am"), "አንድ ሺህ የአሜሪካ ዶላር እና ዜሮ ሴንት ብቻ።");
  assert.equal(amountInWords("1000000000000000000000000.01", "ETB", "am"), "አንድ ትሪሊዮን ትሪሊዮን ብር እና አንድ ሳንቲም ብቻ።");
  for (const value of ["-1", "NaN", "Infinity"]) assert.throws(() => amountInWords(value, "ETB", "am"));
});

test("localized PDFs preserve entered records and localize labels, totals and conditions", () => {
  const company = {...newCompany(), name: "Sample <Company>", paymentTerms: "Original payment terms"};
  const doc = newDocument(company, newCustomer(company.id));
  doc.lines = [{id: "line", description: "Original <description>", unit: "c/n", quantity: "2", price: "1000"}];
  doc.vat = "15";
  doc.termsAndConditions = "User supplied conditions only.";
  const before = JSON.stringify(doc);
  const html = pdfHtml(doc, {language: "am", fontRegularBase64: "dGVzdA==", fontBoldBase64: "dGVzdA=="});
  assert.ok(html.includes('<html lang="am">'));
  assert.ok(html.includes("ፕሮፎርማ ደረሰኝ"));
  assert.ok(html.includes("ጠቅላላ ድምር</th><td>ETB 2,300.00"));
  assert.ok(html.includes("ሁለት ሺህ ሦስት መቶ ብር እና ዜሮ ሳንቲም ብቻ።"));
  assert.ok(html.includes("ውሎች እና ሁኔታዎች"));
  assert.ok(html.includes("Original &lt;description&gt;"));
  assert.ok(html.includes("Original payment terms"));
  assert.ok(html.includes("data:font/ttf;base64,dGVzdA=="));
  assert.ok(!html.includes("PROFORMA INVOICE"));
  assert.equal(JSON.stringify(doc), before);
  const english = pdfHtml(doc);
  assert.ok(!english.includes("All services provided are subject to the terms and conditions outlined in the agreement or engagement letter."));
  const large = {...doc, lines:[{...doc.lines[0]!, quantity:"1000000000000", price:"1000000000000"}], vat:"1000000000000"};
  assert.ok(pdfHtml(large,{language:"am"}).includes('class="totals wide"'));
});

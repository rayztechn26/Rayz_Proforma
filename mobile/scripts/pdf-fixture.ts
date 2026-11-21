import { writeFileSync, mkdirSync } from "node:fs";
import {
  newCompany,
  newCustomer,
  newDocument,
  id,
  calculate,
} from "../src/domain";
import { pdfHtml } from "../src/pdf";
const c = {
  ...newCompany(),
  name: "Northfield Products & Professional Services Company",
  tin: "EXAMPLE-123",
  address: "Industrial district, Building 12\nAddis Ababa",
  phone: "+251 900 000 000",
  email: "office@example.test",
  bankName: "Example Bank",
  accountName: "Northfield Products",
  accountNumber: "0000123456789",
};
const u = {
  ...newCustomer(c.id),
  name: "Customer with a long business name & regional procurement office",
  address: "Main Street, Branch 4",
  contact: "Procurement team",
};
const d = newDocument(c, u);
d.number = "PF-2026-0001";
d.status = "issued";
d.paymentTerms = "Payment within 14 days of acceptance.";
d.deliveryTerms = "Delivery within 21 days, subject to confirmation.";
d.notes =
  "This fixture exercises long descriptions and multi-page tables. Values are illustrative.";
d.preparedBy = "Sample preparer";
d.lines = Array.from({ length: 65 }, (_, i) => ({
  id: id(),
  description: `Item ${i + 1}: ${i === 5 ? "A particularly long service scope. ".repeat(42) : "Professional service and supply package with detailed technical requirements, testing, installation and handover documentation."}`,
  unit: i % 2 ? "piece" : "hour",
  quantity: i % 3 ? "3" : "1.5",
  price: "1234.567",
}));
mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/multipage.html", pdfHtml(d));
writeFileSync(
  "artifacts/fixture.json",
  JSON.stringify({ document: d, totals: calculate(d.lines, d.vat) }, null, 2),
);

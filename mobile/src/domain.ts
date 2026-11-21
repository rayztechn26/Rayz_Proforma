import Decimal from "decimal.js";
import { z } from "zod";

// Bound numeric input length and retain enough precision for all allowed products,
// summed rounded lines, and VAT before the explicit two-place rounding steps.
Decimal.set({ precision: 100, rounding: Decimal.ROUND_HALF_UP });

export const positive = z
  .string()
  .max(40)
  .refine(
    (v) =>
      /^\d+(\.\d+)?$/.test(v) &&
      new Decimal(v).gt(0) &&
      new Decimal(v).lte("1000000000000"),
    "Enter a positive number",
  );
export const nonnegative = z
  .string()
  .max(40)
  .refine(
    (v) =>
      /^\d+(\.\d+)?$/.test(v) &&
      new Decimal(v).gte(0) &&
      new Decimal(v).lte("1000000000000"),
    "Enter zero or a positive number",
  );
const text = z.string().max(20000);
const required = text.refine((v) => v.trim().length > 0, "Required");
export const companySchema = z
  .object({
    id: required,
    name: required,
    tin: required,
    vatNumber: text,
    address: text,
    phone: text,
    email: text,
    website: text,
    bankName: text,
    accountName: text,
    accountNumber: text,
    currency: required,
    vat: positive,
    paymentTerms: text,
    deliveryTerms: text,
    termsAndConditions: text.optional(),
    validity: z.number().int().min(1).max(3650),
    prefix: required,
    logo: z.string().max(14 * 1024 * 1024),
    stamp: z.string().max(14 * 1024 * 1024).optional(),
    vatConfirmed: z.literal(true),
  })
  .strict();
export const customerSchema = z
  .object({
    id: required,
    companyId: required,
    name: required,
    tin: text,
    address: text,
    phone: text,
    email: text,
    contact: text,
  })
  .strict();
export const catalogueSchema = z
  .object({
    id: required,
    companyId: required,
    name: required,
    description: text,
    unit: text,
    price: nonnegative,
  })
  .strict();
export const lineSchema = z
  .object({
    id: required,
    description: required,
    unit: text,
    quantity: positive,
    price: nonnegative,
  })
  .strict();
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Use a real date: YYYY-MM-DD",
  );
export const documentSchema = z
  .object({
    id: required,
    companyId: required,
    number: text,
    status: z.enum(["draft", "issued", "void"]),
    issueDate: dateSchema,
    validUntil: dateSchema,
    customer: customerSchema,
    company: companySchema,
    currency: required,
    vat: positive,
    paymentTerms: text,
    deliveryTerms: text,
    termsAndConditions: text.optional(),
    notes: text,
    preparedBy: text,
    lines: z.array(lineSchema).min(1).max(1000),
  })
  .strict()
  .refine(
    (d) => d.validUntil >= d.issueDate,
    "Validity must be on or after issue date",
  )
  .refine(
    (d) => d.companyId === d.company.id && d.companyId === d.customer.companyId,
    "Company mismatch",
  );
export type Company = z.infer<typeof companySchema>;
export type Customer = z.infer<typeof customerSchema>;
export type Catalogue = z.infer<typeof catalogueSchema>;
export type Line = z.infer<typeof lineSchema>;
export type Proforma = z.infer<typeof documentSchema>;
export const id = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function calculate(lines: Line[], vat: string) {
  positive.parse(vat);
  lines.forEach((l) => lineSchema.parse(l));
  const amounts = lines.map((l) =>
    new Decimal(l.quantity)
      .mul(l.price)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  );
  const subtotal = amounts.reduce((a, b) => a.plus(b), new Decimal(0));
  const tax = subtotal
    .mul(vat)
    .div(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return {
    amounts: amounts.map((a) => a.toFixed(2)),
    subtotal: subtotal.toFixed(2),
    vat: tax.toFixed(2),
    total: subtotal.plus(tax).toFixed(2),
  };
}
export function newCompany(): Company {
  return {
    id: id(),
    name: "",
    tin: "",
    vatNumber: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    bankName: "",
    accountName: "",
    accountNumber: "",
    currency: "ETB",
    vat: "15",
    paymentTerms: "",
    deliveryTerms: "",
    termsAndConditions: "",
    validity: 30,
    prefix: "PF",
    logo: "",
    stamp: "",
    vatConfirmed: true,
  };
}
export function newCustomer(companyId: string): Customer {
  return {
    id: id(),
    companyId,
    name: "",
    tin: "",
    address: "",
    phone: "",
    email: "",
    contact: "",
  };
}
export function newDocument(company: Company, customer: Customer): Proforma {
  const until = new Date();
  until.setDate(until.getDate() + company.validity);
  return {
    id: id(),
    companyId: company.id,
    company: { ...company },
    customer: { ...customer },
    number: "",
    status: "draft",
    issueDate: today(),
    validUntil: `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, "0")}-${String(until.getDate()).padStart(2, "0")}`,
    currency: company.currency,
    vat: company.vat,
    paymentTerms: company.paymentTerms,
    deliveryTerms: company.deliveryTerms,
    termsAndConditions: company.termsAndConditions || "",
    notes: "",
    preparedBy: "",
    lines: [
      { id: id(), description: "", unit: "pcs", quantity: "1", price: "0" },
    ],
  };
}

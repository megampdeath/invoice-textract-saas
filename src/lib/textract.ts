import { AnalyzeExpenseCommand, ExpenseDocument, type TextractClient } from "@aws-sdk/client-textract";
import { getTextractClient } from "./aws";

export const INVOICE_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export interface ExtractedLineItem {
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
}

export interface ExtractedInvoice {
  pageCount: number;
  vendorName: string | null;
  vendorAddress: string | null;
  vendorTaxId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  paymentTerms: string | null;
  confidence: number;
  lineItems: ExtractedLineItem[];
  raw: unknown; // normalized ExpenseDocuments for storage/audit
}

const ACCEPTED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
]);

export function isSupportedInvoiceMime(mime: string): boolean {
  return ACCEPTED.has(mime.toLowerCase());
}

function toNumber(text: string | undefined | null): number | null {
  if (!text) return null;
  // Strip everything except digits, '.', '-' and ',' then treat ',' carefully.
  const trimmed = text.trim();
  if (!trimmed) return null;

  const hasCommaDecimal = /,\d{1,2}\b/.test(trimmed) && !/\.\d{3}/.test(trimmed);
  let cleaned = trimmed.replace(/[^0-9.,-]/g, "");
  if (hasCommaDecimal) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function summaryValue(doc: ExpenseDocument, typeText: string): string | null {
  const field = doc.SummaryFields?.find(
    (f) => f.Type?.Text?.toUpperCase() === typeText.toUpperCase()
  );
  return field?.ValueDetection?.Text ?? null;
}

function summaryConfidence(doc: ExpenseDocument, typeText: string): number | null {
  const field = doc.SummaryFields?.find(
    (f) => f.Type?.Text?.toUpperCase() === typeText.toUpperCase()
  );
  const c = field?.ValueDetection?.Confidence;
  return typeof c === "number" ? c / 100 : null;
}

function avg(values: (number | null)[]): number {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function normalize(doc: ExpenseDocument): ExtractedInvoice {
  const vendorName = summaryValue(doc, "VENDOR_NAME");
  const invoiceNumber = summaryValue(doc, "INVOICE_RECEIPT_ID");
  const invoiceDate = summaryValue(doc, "INVOICE_RECEIPT_DATE");
  const dueDate = summaryValue(doc, "DUE_DATE");
  let currency = summaryValue(doc, "CURRENCY");
  if (!currency) {
    const totalText = summaryValue(doc, "TOTAL") ?? summaryValue(doc, "SUBTOTAL");
    if (totalText?.includes("$")) currency = "USD";
    else if (totalText?.includes("€")) currency = "EUR";
    else if (totalText?.includes("£")) currency = "GBP";
  }
  const subtotal = toNumber(summaryValue(doc, "SUBTOTAL"));
  const tax = toNumber(summaryValue(doc, "TAX"));
  const total = toNumber(summaryValue(doc, "TOTAL"));
  const paymentTerms = summaryValue(doc, "PAYMENT_TERMS");
  const vendorAddress =
    summaryValue(doc, "VENDOR_ADDRESS") ??
    summaryValue(doc, "VENDOR_ADDRESS_BLOCK");
  const vendorTaxId =
    summaryValue(doc, "VENDOR_TAX_ID") ??
    summaryValue(doc, "VENDOR_GST_REGISTRATION_NUMBER") ??
    summaryValue(doc, "VENDOR_PAN") ??
    summaryValue(doc, "VENDOR_VAT_ID") ??
    summaryValue(doc, "VENDOR_TAX_REGISTRATION_NUMBER");

  const lineItems: ExtractedLineItem[] = [];
  for (const group of doc.LineItemGroups ?? []) {
    for (const item of group.LineItems ?? []) {
      const get = (t: string) => {
        const f = item.LineItemExpenseFields?.find(
          (x) => x.Type?.Text?.toUpperCase() === t.toUpperCase()
        );
        return f?.ValueDetection?.Text ?? null;
      };
      lineItems.push({
        description:
          get("ITEM") ?? get("PRODUCT_CODE") ?? get("DESCRIPTION") ?? null,
        quantity: toNumber(get("QUANTITY")),
        // Textract uses UNIT_PRICE for unit price and PRICE for the line amount.
        unitPrice: toNumber(get("UNIT_PRICE") ?? get("UNIT PRICE")),
        amount: toNumber(get("PRICE") ?? get("AMOUNT")),
      });
    }
  }

  const confidence = avg([
    summaryConfidence(doc, "VENDOR_NAME"),
    summaryConfidence(doc, "INVOICE_RECEIPT_ID"),
    summaryConfidence(doc, "TOTAL"),
    summaryConfidence(doc, "INVOICE_RECEIPT_DATE"),
  ]);

  return {
    pageCount: 0, // set by caller from DocumentMetadata
    vendorName,
    vendorAddress,
    vendorTaxId,
    invoiceNumber,
    invoiceDate,
    dueDate,
    currency,
    subtotal,
    tax,
    total,
    paymentTerms,
    confidence,
    lineItems,
    raw: null, // set by caller (full ExpenseDocuments[] for annotations)
  };
}

/**
 * Run AWS Textract AnalyzeExpense on a document buffer.
 * Buffer must be PDF/PNG/JPEG/TIFF.
 */
export async function analyzeInvoiceDocument(
  bytes: Uint8Array,
  client: TextractClient = getTextractClient()
): Promise<ExtractedInvoice> {
  const command = new AnalyzeExpenseCommand({
    Document: { Bytes: bytes as unknown as Buffer },
  });

  const res = await client.send(command);
  const pageCount = res.DocumentMetadata?.Pages ?? 1;
  const docs = res.ExpenseDocuments ?? [];

  if (docs.length === 0) {
    throw new Error("Textract returned no expense documents. Not an invoice/receipt?");
  }

  // Use the first expense document as the primary invoice (covers the common case).
  const primary = normalize(docs[0]);
  primary.pageCount = pageCount;
  // Keep ALL expense documents so the viewer can draw highlights on every page.
  primary.raw = docs;

  return primary;
}

// ---------- Annotation extraction (for the highlighted PDF viewer) ----------

export type AnnotationGroup = "vendor" | "id" | "dates" | "money" | "line";

export interface Annotation {
  field: string;
  label: string;
  group: AnnotationGroup;
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
}

interface RawBox {
  Left: number;
  Top: number;
  Width: number;
  Height: number;
}
interface RawField {
  Type?: { Text?: string };
  ValueDetection?: { Text?: string; Geometry?: { BoundingBox?: RawBox } };
  PageNumber?: number;
}
interface RawExpenseDoc {
  SummaryFields?: RawField[];
  LineItemGroups?: { LineItems?: { LineItemExpenseFields?: RawField[] }[] }[];
}

const SUMMARY_MAP: { type: string; label: string; group: AnnotationGroup }[] = [
  { type: "VENDOR_NAME", label: "Vendor", group: "vendor" },
  { type: "VENDOR_ADDRESS", label: "Vendor address", group: "vendor" },
  { type: "TAX_PAYER_ID", label: "Vendor tax ID", group: "vendor" },
  { type: "INVOICE_RECEIPT_ID", label: "Invoice #", group: "id" },
  { type: "INVOICE_RECEIPT_DATE", label: "Invoice date", group: "dates" },
  { type: "DUE_DATE", label: "Due date", group: "dates" },
  { type: "PAYMENT_TERMS", label: "Payment terms", group: "dates" },
  { type: "SUBTOTAL", label: "Subtotal", group: "money" },
  { type: "TAX", label: "Tax", group: "money" },
  { type: "TOTAL", label: "Total", group: "money" },
];

const LINE_MAP: { type: string; label: string; group: AnnotationGroup }[] = [
  { type: "ITEM", label: "Item", group: "line" },
  { type: "QUANTITY", label: "Qty", group: "line" },
  { type: "UNIT_PRICE", label: "Unit price", group: "line" },
  { type: "PRICE", label: "Amount", group: "line" },
];

/**
 * Build a list of highlight annotations (normalized 0..1 boxes + page) from the
 * stored raw Textract ExpenseDocuments. Accepts an array or a single doc.
 */
export function buildAnnotations(raw: unknown): Annotation[] {
  const docs: RawExpenseDoc[] = Array.isArray(raw)
    ? (raw as RawExpenseDoc[])
    : raw
    ? [raw as RawExpenseDoc]
    : [];

  const out: Annotation[] = [];
  const push = (f: RawField, m: { label: string; group: AnnotationGroup }) => {
    const bb = f.ValueDetection?.Geometry?.BoundingBox;
    if (!bb) return;
    out.push({
      field: f.Type?.Text ?? "",
      label: m.label,
      group: m.group,
      page: f.PageNumber ?? 1,
      left: bb.Left,
      top: bb.Top,
      width: bb.Width,
      height: bb.Height,
      text: f.ValueDetection?.Text ?? "",
    });
  };

  for (const doc of docs) {
    for (const f of doc.SummaryFields ?? []) {
      const t = f.Type?.Text?.toUpperCase();
      const m = SUMMARY_MAP.find((s) => s.type === t);
      if (m) push(f, m);
    }
    for (const g of doc.LineItemGroups ?? []) {
      for (const item of g.LineItems ?? []) {
        for (const f of item.LineItemExpenseFields ?? []) {
          const t = f.Type?.Text?.toUpperCase();
          const m = LINE_MAP.find((s) => s.type === t);
          if (m) push(f, m);
        }
      }
    }
  }
  return out;
}

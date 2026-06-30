import ExcelJS from "exceljs";

interface LineItem {
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  amount?: number | null;
}

export interface InvoiceExport {
  id: string;
  fileName: string;
  status: string;
  vendorName?: string | null;
  vendorAddress?: string | null;
  vendorTaxId?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  paymentTerms?: string | null;
  duplicate: boolean;
  createdAt: Date;
  lineItems: LineItem[];
}

const money = "#,##0.00";

/** Build a per-invoice workbook (Summary + Line items sheets). */
export async function buildInvoiceXlsx(inv: InvoiceExport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "InvoiceIQ";
  wb.created = new Date();

  const s = wb.addWorksheet("Summary");
  s.columns = [{ width: 18 }, { width: 38 }];
  const rows: Array<[string, string | number | null | undefined]> = [
    ["Vendor", inv.vendorName],
    ["Vendor address", inv.vendorAddress],
    ["Vendor tax ID", inv.vendorTaxId],
    ["Invoice #", inv.invoiceNumber],
    ["Invoice date", inv.invoiceDate],
    ["Due date", inv.dueDate],
    ["Currency", inv.currency],
    ["Subtotal", inv.subtotal],
    ["Tax", inv.tax],
    ["Total", inv.total],
    ["Payment terms", inv.paymentTerms],
    ["Status", inv.status],
    ["Duplicate", inv.duplicate ? "YES" : "no"],
    ["File", inv.fileName],
  ];
  for (const [k, v] of rows) s.addRow([k, v ?? ""]);
  // number format for money rows
  [8, 9, 10].forEach((r) => (s.getRow(r).getCell(2).numFmt = money));

  const li = wb.addWorksheet("Line items");
  li.addRow(["Description", "Quantity", "Unit price", "Amount"]);
  for (const l of inv.lineItems) {
    li.addRow([l.description ?? "", l.quantity ?? "", l.unitPrice ?? "", l.amount ?? ""]);
  }
  li.columns = [
    { width: 42 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
  ];
  for (let r = 2; r <= li.rowCount; r++) {
    li.getRow(r).getCell(3).numFmt = money;
    li.getRow(r).getCell(4).numFmt = money;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Build an org-wide workbook (all invoices + all line items). */
export async function buildOrgInvoicesXlsx(invoices: InvoiceExport[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "InvoiceIQ";
  wb.created = new Date();

  const s = wb.addWorksheet("Invoices");
  s.addRow([
    "Vendor", "Invoice #", "Invoice date", "Due date", "Currency",
    "Subtotal", "Tax", "Total", "Status", "Duplicate", "File", "Uploaded",
  ]);
  for (const inv of invoices) {
    s.addRow([
      inv.vendorName ?? "",
      inv.invoiceNumber ?? "",
      inv.invoiceDate ?? "",
      inv.dueDate ?? "",
      inv.currency ?? "",
      inv.subtotal ?? "",
      inv.tax ?? "",
      inv.total ?? "",
      inv.status,
      inv.duplicate ? "YES" : "",
      inv.fileName,
      inv.createdAt.toISOString(),
    ]);
  }
  s.columns = [{ width: 24 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 8 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 30 }, { width: 22 }];
  for (let r = 2; r <= s.rowCount; r++) {
    [6, 7, 8].forEach((c) => (s.getRow(r).getCell(c).numFmt = money));
  }

  const li = wb.addWorksheet("Line items");
  li.addRow(["Vendor", "Invoice #", "Description", "Quantity", "Unit price", "Amount"]);
  for (const inv of invoices) {
    for (const l of inv.lineItems) {
      li.addRow([
        inv.vendorName ?? "",
        inv.invoiceNumber ?? "",
        l.description ?? "",
        l.quantity ?? "",
        l.unitPrice ?? "",
        l.amount ?? "",
      ]);
    }
  }
  li.columns = [{ width: 24 }, { width: 16 }, { width: 42 }, { width: 12 }, { width: 14 }, { width: 14 }];
  for (let r = 2; r <= li.rowCount; r++) {
    [5, 6].forEach((c) => (li.getRow(r).getCell(c).numFmt = money));
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

import PDFDocument from "pdfkit";
import { analyzeInvoiceDocument } from "../src/lib/textract";

function buildInvoicePdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(26).text("INVOICE", 50, 50, { align: "center" });
    doc.moveDown();

    doc.fontSize(12);
    doc.text("Acme Supplies Inc.", 50, 130);
    doc.text("123 Commerce Street");
    doc.text("New York, NY 10001");
    doc.text("Tax ID: 99-7654321");

    doc.text("Invoice #: INV-10042", 350, 130);
    doc.text("Invoice Date: 2024-06-30", 350, 150);
    doc.text("Due Date: 2024-07-30", 350, 170);
    doc.text("Currency: USD", 350, 190);

    doc.text("Bill To:", 50, 220);
    doc.text("Demo Customer Co.", 50, 240);
    doc.text("456 Client Ave", 50, 255);

    doc.text("Description", 50, 300);
    doc.text("Qty", 280, 300);
    doc.text("Unit Price", 360, 300);
    doc.text("Amount", 460, 300);

    const rows = [
      ["Widget A", "2", "$15.00", "$30.00"],
      ["Widget B", "5", "$8.00", "$40.00"],
      ["Gadget C", "1", "$22.50", "$22.50"],
    ];
    let y = 320;
    for (const [d, q, u, a] of rows) {
      doc.text(d, 50, y);
      doc.text(q, 280, y);
      doc.text(u, 360, y);
      doc.text(a, 460, y);
      y += 20;
    }

    doc.text("Subtotal: $92.50", 360, y + 20);
    doc.text("Tax (8%): $7.40", 360, y + 40);
    doc.text("Total: $99.90", 360, y + 60);
    doc.text("Payment Terms: Net 30", 360, y + 80);

    doc.end();
  });
}

async function main() {
  const pdf = await buildInvoicePdf();
  console.log("Generated sample invoice PDF:", pdf.length, "bytes");

  const extracted = await analyzeInvoiceDocument(new Uint8Array(pdf));
  console.log("\n=== Extracted by AWS Textract (via app lib) ===");
  console.log("Vendor:       ", extracted.vendorName);
  console.log("Invoice #:    ", extracted.invoiceNumber);
  console.log("Invoice date: ", extracted.invoiceDate);
  console.log("Due date:     ", extracted.dueDate);
  console.log("Currency:     ", extracted.currency);
  console.log("Subtotal:     ", extracted.subtotal);
  console.log("Tax:          ", extracted.tax);
  console.log("Total:        ", extracted.total);
  console.log("Payment terms:", extracted.paymentTerms);
  console.log("Confidence:   ", extracted.confidence.toFixed(2));
  console.log("Pages:        ", extracted.pageCount);
  console.log("Line items:");
  for (const li of extracted.lineItems) {
    console.log(
      `  - ${li.description ?? ""} | qty=${li.quantity ?? "?"} | unit=${li.unitPrice ?? "?"} | amount=${li.amount ?? "?"}`
    );
  }

  console.log("\n=== RAW line item fields from Textract ===");
  const doc = (extracted.raw as { LineItemGroups?: any[]; SummaryFields?: any[] }).LineItemGroups ?? [];
  for (const g of doc) {
    for (const item of g.LineItems ?? []) {
      for (const f of item.LineItemExpenseFields ?? []) {
        const bb = f.ValueDetection?.Geometry?.BoundingBox;
        console.log(
          `  type=${f.Type?.Text ?? "?"} label=${f.LabelDetection?.Text ?? "?"} value=${f.ValueDetection?.Text ?? "?"} page=${f.PageNumber ?? "?"} box=${bb ? `L=${bb.Left.toFixed(3)} T=${bb.Top.toFixed(3)} W=${bb.Width.toFixed(3)} H=${bb.Height.toFixed(3)}` : "none"}`
        );
      }
      console.log("  ---");
    }
  }

  console.log("\n=== RAW summary field geometry ===");
  const sfields = (extracted.raw as { SummaryFields?: any[] }).SummaryFields ?? [];
  for (const f of sfields) {
    const bb = f.ValueDetection?.Geometry?.BoundingBox;
    console.log(
      `  type=${f.Type?.Text ?? "?"} value=${f.ValueDetection?.Text ?? "?"} page=${f.PageNumber ?? "?"} box=${bb ? `L=${bb.Left.toFixed(3)} T=${bb.Top.toFixed(3)} W=${bb.Width.toFixed(3)} H=${bb.Height.toFixed(3)}` : "none"}`
    );
  }
}

main().catch((e) => {
  console.error("E2E extraction FAILED:", e);
  process.exit(1);
});

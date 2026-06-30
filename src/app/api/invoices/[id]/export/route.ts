import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireApiUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const header = [
    "invoice_id",
    "vendor_name",
    "invoice_number",
    "invoice_date",
    "due_date",
    "currency",
    "subtotal",
    "tax",
    "total",
    "description",
    "quantity",
    "unit_price",
    "amount",
  ];

  const rows: string[] = [header.join(",")];

  if (invoice.lineItems.length === 0) {
    rows.push(
      [
        invoice.id,
        invoice.vendorName,
        invoice.invoiceNumber,
        invoice.invoiceDate,
        invoice.dueDate,
        invoice.currency,
        invoice.subtotal,
        invoice.tax,
        invoice.total,
        "",
        "",
        "",
        "",
      ]
        .map(csvCell)
        .join(",")
    );
  } else {
    for (const li of invoice.lineItems) {
      rows.push(
        [
          invoice.id,
          invoice.vendorName,
          invoice.invoiceNumber,
          invoice.invoiceDate,
          invoice.dueDate,
          invoice.currency,
          invoice.subtotal,
          invoice.tax,
          invoice.total,
          li.description,
          li.quantity,
          li.unitPrice,
          li.amount,
        ]
          .map(csvCell)
          .join(",")
      );
    }
  }

  const safeName = (invoice.fileName || "invoice").replace(/\.[a-z0-9]+$/i, "");
  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.csv"`,
    },
  });
}

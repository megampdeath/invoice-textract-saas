import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

function csvCell(v: string | null | undefined) {
  if (!v) return "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireApiUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = new URL(req.url).searchParams.get("format") || "csv";

  const doc = await prisma.document.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: {
      values: { orderBy: { sortOrder: "asc" } },
      documentType: { select: { name: true } },
    },
  });
  if (!doc)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (doc.reviewStatus !== "approved") {
    return NextResponse.json(
      { error: "Document must be approved before exporting", reviewStatus: doc.reviewStatus },
      { status: 409 }
    );
  }

  const safeName = (doc.fileName || "document").replace(/\.[a-z0-9]+$/i, "");

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Extracted data");
    ws.columns = [{ width: 26 }, { width: 40 }];
    ws.addRow(["Field", "Value"]);
    for (const v of doc.values) ws.addRow([v.label, v.value ?? ""]);
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const rows = ["field,value"];
  for (const v of doc.values) {
    rows.push(`${csvCell(v.label)},${csvCell(v.value)}`);
  }
  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.csv"`,
    },
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { buildOrgInvoicesXlsx } from "@/lib/xlsx";

export async function GET(req: Request) {
  const user = await requireApiUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoices = await prisma.invoice.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  const buf = await buildOrgInvoicesXlsx(invoices);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buf as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="invoices-${stamp}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}

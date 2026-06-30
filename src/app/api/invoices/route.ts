import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { assertWithinQuota } from "@/lib/usage";

export async function GET(req: Request) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("q");
  const take = Math.min(Number(searchParams.get("limit") ?? 50), 100);
  const cursor = searchParams.get("cursor");

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: user.organizationId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { vendorName: { contains: search } },
              { invoiceNumber: { contains: search } },
              { fileName: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { _count: { select: { lineItems: true } } },
  });

  const hasNext = invoices.length > take;
  const items = hasNext ? invoices.slice(0, -1) : invoices;

  const quota = await assertWithinQuota(user.organizationId);

  return NextResponse.json({
    invoices: items,
    nextCursor: hasNext ? items[items.length - 1].id : null,
    quota,
  });
}

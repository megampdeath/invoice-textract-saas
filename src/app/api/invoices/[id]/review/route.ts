import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { REVIEW_STATUS } from "@/lib/review";

const Body = z.object({
  status: z.enum(["approved", "needs_review"]),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireApiUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const approved = parsed.data.status === REVIEW_STATUS.APPROVED;
  const updated = await prisma.invoice.updateMany({
    where: { id: params.id, organizationId: user.organizationId },
    data: {
      reviewStatus: parsed.data.status,
      reviewedById: approved ? user.id : null,
      reviewedAt: approved ? new Date() : null,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    select: { id: true, reviewStatus: true, reviewReason: true, reviewedAt: true },
  });
  return NextResponse.json({ invoice });
}

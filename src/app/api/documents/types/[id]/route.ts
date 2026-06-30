import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

// DELETE: remove a custom document type owned by the org (presets are protected).
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireApiUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only allow deleting the org's own types (organizationId not null + matches).
  const result = await prisma.documentType.deleteMany({
    where: {
      id: params.id,
      organizationId: user.organizationId,
    },
  });
  if (result.count === 0) {
    return NextResponse.json(
      { error: "Type not found or cannot be deleted (preset)" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}

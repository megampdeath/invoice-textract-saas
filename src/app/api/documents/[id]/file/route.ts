import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { readFileBytes } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireApiUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.document.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    select: { storage: true, storageKey: true, mimeType: true, fileName: true },
  });
  if (!doc)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    let bytes: Uint8Array;
    if (doc.storage === "db") {
      const f = await prisma.documentFile.findUnique({
        where: { documentId: params.id },
        select: { bytes: true },
      });
      if (!f)
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      bytes = new Uint8Array(f.bytes);
    } else {
      bytes = await readFileBytes({
        storage: doc.storage as "local" | "s3",
        key: doc.storageKey,
      });
    }
    const safeName = (doc.fileName || "document").replace(/["\\]/g, "");
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "File not available", detail: err instanceof Error ? err.message : undefined },
      { status: 500 }
    );
  }
}

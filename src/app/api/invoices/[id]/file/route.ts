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

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    select: { storage: true, storageKey: true, mimeType: true, fileName: true },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    let bytes: Uint8Array;
    if (invoice.storage === "db") {
      const f = await prisma.invoiceFile.findUnique({
        where: { invoiceId: params.id },
        select: { bytes: true },
      });
      if (!f)
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      bytes = new Uint8Array(f.bytes);
    } else {
      bytes = await readFileBytes({
        storage: invoice.storage as "local" | "s3",
        key: invoice.storageKey,
      });
    }
    const safeName = (invoice.fileName || "invoice").replace(/["\\]/g, "");
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": invoice.mimeType,
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

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { assertWithinQuota, estimateCostCents } from "@/lib/usage";
import { storeFile, isAllowedMime } from "@/lib/storage";
import { analyzeInvoiceDocument, INVOICE_STATUS } from "@/lib/textract";
import { findDuplicate } from "@/lib/duplicates";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quota = await assertWithinQuota(user.organizationId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "Monthly quota exceeded",
        used: quota.used,
        limit: quota.limit,
      },
      { status: 402 }
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    file = form.get("file") as File | null;
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }
  if (!isAllowedMime(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PDF, PNG, JPEG, or TIFF." },
      { status: 415 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(bytes).digest("hex");

  // Storage backend: S3 if a bucket is configured, otherwise Postgres bytea
  // (stored with the invoice record below).
  const useS3 = Boolean(process.env.AWS_S3_BUCKET);
  let storage: "s3" | "db" = "db";
  let storageKey = "";
  if (useS3) {
    const stored = await storeFile(bytes, {
      organizationId: user.organizationId,
      fileName: file.name,
      mimeType: file.type,
    });
    storage = stored.storage === "s3" ? "s3" : "db";
    storageKey = stored.key;
  }

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: user.organizationId,
      uploadedById: user.id,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storage,
      storageKey,
      contentHash,
      status: INVOICE_STATUS.PROCESSING,
      ...(storage === "db" ? { file: { create: { bytes: Buffer.from(bytes) } } } : {}),
    },
  });

  try {
    const extracted = await analyzeInvoiceDocument(bytes);

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: INVOICE_STATUS.COMPLETED,
          pageCount: extracted.pageCount,
          confidence: extracted.confidence,
          vendorName: extracted.vendorName,
          vendorAddress: extracted.vendorAddress,
          vendorTaxId: extracted.vendorTaxId,
          invoiceNumber: extracted.invoiceNumber,
          invoiceDate: extracted.invoiceDate,
          dueDate: extracted.dueDate,
          currency: extracted.currency,
          subtotal: extracted.subtotal,
          tax: extracted.tax,
          total: extracted.total,
          paymentTerms: extracted.paymentTerms,
          rawJson: JSON.stringify(extracted.raw),
          lineItems: {
            create: extracted.lineItems.map((li, i) => ({
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              amount: li.amount,
              sortOrder: i,
            })),
          },
        },
      });

      await tx.usageRecord.create({
        data: {
          organizationId: user.organizationId,
          invoiceId: invoice.id,
          pages: extracted.pageCount,
          costCents: estimateCostCents(extracted.pageCount),
        },
      });
    });

    // Duplicate detection (after extraction so we can match on vendor/total/date).
    const dupOfId = await findDuplicate({
      organizationId: user.organizationId,
      contentHash,
      vendorName: extracted.vendorName,
      invoiceNumber: extracted.invoiceNumber,
      total: extracted.total,
      invoiceDate: extracted.invoiceDate,
      excludeId: invoice.id,
    });
    if (dupOfId) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { duplicate: true, duplicateOfId: dupOfId },
      });
    }

    const result = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({ invoice: result }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Textract processing failed";
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: INVOICE_STATUS.FAILED, errorMessage: message },
    });
    return NextResponse.json(
      { error: "Extraction failed", detail: message, invoiceId: invoice.id },
      { status: 502 }
    );
  }
}

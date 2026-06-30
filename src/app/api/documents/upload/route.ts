import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { storeFile, isAllowedMime } from "@/lib/storage";
import { extractDocumentWithQueries } from "@/lib/extract";
import { REVIEW_STATUS } from "@/lib/review";

export const runtime = "nodejs";
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await requireApiUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let file: File | null = null;
  let documentTypeId: string | null = null;
  try {
    const form = await req.formData();
    file = form.get("file") as File | null;
    documentTypeId = (form.get("documentTypeId") as string | null) || null;
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  if (!documentTypeId) {
    return NextResponse.json({ error: "documentTypeId is required" }, { status: 400 });
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

  // Document type must be a shared preset or owned by the org.
  const docType = await prisma.documentType.findFirst({
    where: {
      id: documentTypeId,
      OR: [{ organizationId: null }, { organizationId: user.organizationId }],
    },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!docType) {
    return NextResponse.json({ error: "Document type not found" }, { status: 404 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

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

  const doc = await prisma.document.create({
    data: {
      organizationId: user.organizationId,
      uploadedById: user.id,
      documentTypeId: docType.id,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storage,
      storageKey,
      status: "processing",
      ...(storage === "db" ? { file: { create: { bytes: Buffer.from(bytes) } } } : {}),
    },
  });

  try {
    const extracted = await extractDocumentWithQueries(
      bytes,
      docType.fields.map((f) => ({
        key: f.key,
        label: f.label,
        method: f.method,
        question: f.question,
        sortOrder: f.sortOrder,
      }))
    );

    // Review state: required fields present? confidence high enough?
    const requiredMissing = docType.fields
      .filter((f) => f.required)
      .some((f) => !extracted.values.find((v) => v.fieldKey === f.key && v.value));
    const lowConf = extracted.confidence < 0.85;
    let reviewStatus: string = REVIEW_STATUS.APPROVED;
    let reviewReason: string | null = null;
    if (requiredMissing) {
      reviewStatus = REVIEW_STATUS.NEEDS_REVIEW;
      reviewReason = "Missing required fields";
    } else if (lowConf) {
      reviewStatus = REVIEW_STATUS.NEEDS_REVIEW;
      reviewReason = `Low confidence (${Math.round(extracted.confidence * 100)}%)`;
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: "completed",
        pageCount: extracted.pageCount,
        confidence: extracted.confidence,
        rawJson: JSON.stringify(extracted.raw),
        reviewStatus,
        reviewReason,
        ...(reviewStatus === REVIEW_STATUS.APPROVED ? { reviewedAt: new Date() } : {}),
        values: {
          create: extracted.values.map((v) => ({
            fieldKey: v.fieldKey,
            label: v.label,
            value: v.value,
            confidence: v.confidence,
            page: v.page,
            left: v.left ?? null,
            top: v.top ?? null,
            width: v.width ?? null,
            height: v.height ?? null,
            sortOrder: v.sortOrder,
          })),
        },
      },
    });

    const result = await prisma.document.findUnique({
      where: { id: doc.id },
      include: { values: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({ document: result }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Textract processing failed";
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: "failed",
        errorMessage: message,
        reviewStatus: REVIEW_STATUS.NEEDS_REVIEW,
        reviewReason: "Extraction failed",
      },
    });
    return NextResponse.json(
      { error: "Extraction failed", detail: message, documentId: doc.id },
      { status: 502 }
    );
  }
}

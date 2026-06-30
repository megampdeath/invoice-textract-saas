import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

// Textract Queries Alias must match [a-zA-Z0-9_]{1,30}.
function deriveKey(label: string, index: number): string {
  let k = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  if (!k) k = `field_${index + 1}`;
  return k;
}

const FieldSchema = z.object({
  label: z.string().min(1).max(80),
  question: z.string().min(1).max(200),
  fieldType: z.enum(["string", "number", "date"]).default("string"),
  required: z.boolean().default(false),
});

const TypeSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
  fields: z.array(FieldSchema).min(1, "Add at least one field"),
});

// GET: list document types available to the org (shared presets + org's own).
export async function GET() {
  const user = await requireApiUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const types = await prisma.documentType.findMany({
    where: { OR: [{ organizationId: null }, { organizationId: user.organizationId }] },
    orderBy: [{ organizationId: "asc" }, { name: "asc" }],
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ types });
}

// POST: create a custom document type for the org.
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = TypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, description, fields } = parsed.data;

  // Derive unique keys within this type.
  const usedKeys = new Set<string>();
  const fieldsWithKeys = fields.map((f, i) => {
    let key = deriveKey(f.label, i);
    let n = 2;
    while (usedKeys.has(key)) {
      key = `${deriveKey(f.label, i).slice(0, 28)}_${n++}`;
    }
    usedKeys.add(key);
    return { ...f, key, sortOrder: i };
  });

  const docType = await prisma.documentType.create({
    data: {
      organizationId: user.organizationId,
      name,
      description: description ?? null,
      extractionMethod: "queries",
      fields: {
        create: fieldsWithKeys.map((f) => ({
          key: f.key,
          label: f.label,
          method: "query",
          question: f.question,
          fieldType: f.fieldType,
          required: f.required,
          sortOrder: f.sortOrder,
        })),
      },
    },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ type: docType }, { status: 201 });
}

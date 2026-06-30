import { prisma } from "./prisma";

export interface DuplicateCheckInput {
  organizationId: string;
  contentHash: string | null;
  vendorName: string | null;
  invoiceNumber: string | null;
  total: number | null;
  invoiceDate: string | null;
  excludeId: string;
}

/**
 * Find an existing invoice in the same org that looks like a duplicate.
 * Rules (any one triggers a flag):
 *   - same content hash (identical file bytes)
 *   - same vendor + invoice number
 *   - same vendor + total + invoice date
 * Returns the id of the earliest matching invoice (the "original"), or null.
 */
export async function findDuplicate(
  input: DuplicateCheckInput
): Promise<string | null> {
  // Normalize: trim + case-insensitive matching (Postgres mode: insensitive).
  const vn = input.vendorName?.trim() || null;
  const inum = input.invoiceNumber?.trim() || null;
  const idate = input.invoiceDate?.trim() || null;

  const or: Array<Record<string, unknown>> = [];
  if (input.contentHash) or.push({ contentHash: input.contentHash });
  if (vn && inum) {
    or.push({
      vendorName: { equals: vn, mode: "insensitive" },
      invoiceNumber: { equals: inum, mode: "insensitive" },
    });
  }
  if (vn && input.total != null && idate) {
    or.push({
      vendorName: { equals: vn, mode: "insensitive" },
      total: input.total,
      invoiceDate: { equals: idate, mode: "insensitive" },
    });
  }
  if (or.length === 0) return null;

  const match = await prisma.invoice.findFirst({
    where: {
      organizationId: input.organizationId,
      id: { not: input.excludeId },
      OR: or,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return match?.id ?? null;
}

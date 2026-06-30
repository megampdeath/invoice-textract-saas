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
  const or: Array<Record<string, unknown>> = [];
  if (input.contentHash) or.push({ contentHash: input.contentHash });
  if (input.vendorName && input.invoiceNumber) {
    or.push({ vendorName: input.vendorName, invoiceNumber: input.invoiceNumber });
  }
  if (input.vendorName && input.total != null && input.invoiceDate) {
    or.push({
      vendorName: input.vendorName,
      total: input.total,
      invoiceDate: input.invoiceDate,
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

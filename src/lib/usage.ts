import { prisma } from "./prisma";

/** Count invoices processed this calendar month for an organization. */
export async function monthlyUsageCount(organizationId: string): Promise<number> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return prisma.invoice.count({
    where: {
      organizationId,
      createdAt: { gte: start },
      // Only count processed attempts (completed or failed) against quota.
      status: { in: ["completed", "failed", "processing"] },
    },
  });
}

export async function assertWithinQuota(
  organizationId: string
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { monthlyLimit: true },
  });
  const limit = org?.monthlyLimit ?? 0;
  const used = await monthlyUsageCount(organizationId);
  return { allowed: used < limit, used, limit };
}

/** Rough internal cost estimate in cents (Textract AnalyzeExpense pricing). */
export function estimateCostCents(pages: number): number {
  // ~$0.05/page for the first tier -> 5 cents/page in cents.
  return Math.max(pages, 1) * 5;
}

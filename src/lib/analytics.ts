export interface AnalyticsInvoice {
  vendorName: string | null;
  total: number | null;
  currency: string | null;
  invoiceDate: string | null;
  createdAt: Date;
  duplicate: boolean;
  status: string;
}

export interface CurrencyTotal {
  currency: string;
  total: number;
  count: number;
}

export interface DashboardData {
  kpis: {
    invoiceCount: number; // unique (non-duplicate) completed invoices, any currency
    totalByCurrency: CurrencyTotal[]; // spend per currency, sorted by total desc
    primaryCurrency: string | null; // currency with the largest total
    primaryTotal: number;
    thisMonthCount: number;
    lastMonthCount: number;
    momChangePct: number | null; // month-over-month by volume
    duplicateCount: number;
  };
  monthly: { month: string; count: number }[];
  topSuppliers: { name: string; count: number }[];
}

function monthFloor(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildDashboardData(all: AnalyticsInvoice[]): DashboardData {
  const completed = all.filter((i) => i.status === "completed");
  // Unique invoices only — duplicates are the same invoice, not new volume/spend.
  const unique = completed.filter((i) => !i.duplicate);

  const invoiceCount = unique.length;
  const duplicateCount = all.filter((i) => i.duplicate).length;

  // Spend grouped per currency (no cross-currency summing).
  const byCur = new Map<string, { total: number; count: number }>();
  for (const i of unique) {
    if (i.total == null) continue;
    const c = i.currency || "USD";
    const e = byCur.get(c) ?? { total: 0, count: 0 };
    e.total += i.total;
    e.count += 1;
    byCur.set(c, e);
  }
  const totalByCurrency: CurrencyTotal[] = [...byCur.entries()]
    .map(([currency, v]) => ({ currency, ...v }))
    .sort((a, b) => b.total - a.total);
  const primary = totalByCurrency[0];
  const primaryCurrency = primary?.currency ?? null;
  const primaryTotal = primary?.total ?? 0;

  const now = new Date();
  const thisM = monthFloor(now);
  const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonthCount = unique.filter(
    (i) => monthFloor(i.createdAt).getTime() === thisM.getTime()
  ).length;
  const lastMonthCount = unique.filter(
    (i) => monthFloor(i.createdAt).getTime() === lastM.getTime()
  ).length;
  const momChangePct =
    lastMonthCount > 0 ? ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100 : null;

  // Monthly volume (count is currency-agnostic → no invoice is hidden).
  const monthly: { month: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const count = unique.filter(
      (r) => monthFloor(r.createdAt).getTime() === m.getTime()
    ).length;
    monthly.push({
      month: `${MONTH_NAMES[m.getMonth()]} ${String(m.getFullYear()).slice(2)}`,
      count,
    });
  }

  // Top suppliers by volume (currency-agnostic).
  const bySup = new Map<string, number>();
  for (const r of unique) {
    const name = (r.vendorName || "Unknown").trim() || "Unknown";
    bySup.set(name, (bySup.get(name) ?? 0) + 1);
  }
  const topSuppliers = [...bySup.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    kpis: {
      invoiceCount,
      totalByCurrency,
      primaryCurrency,
      primaryTotal,
      thisMonthCount,
      lastMonthCount,
      momChangePct,
      duplicateCount,
    },
    monthly,
    topSuppliers,
  };
}

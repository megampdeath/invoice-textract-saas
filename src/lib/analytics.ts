export interface AnalyticsInvoice {
  vendorName: string | null;
  total: number | null;
  currency: string | null;
  invoiceDate: string | null;
  createdAt: Date;
  duplicate: boolean;
  status: string;
}

export interface DashboardData {
  kpis: {
    totalSpend: number;
    invoiceCount: number;
    avgInvoice: number;
    thisMonth: number;
    lastMonth: number;
    momChangePct: number | null;
    duplicateCount: number;
    currency: string | null;
  };
  monthly: { month: string; spend: number }[];
  topSuppliers: { name: string; spend: number }[];
}

function monthFloor(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function parseMonth(inv: AnalyticsInvoice): Date {
  const s = inv.invoiceDate;
  if (s) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return monthFloor(d);
  }
  return monthFloor(inv.createdAt);
}

function modeCurrency(rows: AnalyticsInvoice[]): string | null {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.total == null) continue;
    const c = r.currency || "USD";
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = -1;
  for (const [c, n] of counts) {
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildDashboardData(all: AnalyticsInvoice[]): DashboardData {
  const completed = all.filter((i) => i.status === "completed");
  const currency = modeCurrency(completed);
  const spendRows = completed.filter(
    (i) => i.total != null && (i.currency === currency || i.currency == null)
  );

  const totalSpend = spendRows.reduce((s, i) => s + (i.total ?? 0), 0);
  const invoiceCount = completed.length;
  const avgInvoice = invoiceCount > 0 ? totalSpend / invoiceCount : 0;
  const duplicateCount = all.filter((i) => i.duplicate).length;

  const now = new Date();
  const thisMonthFloor = monthFloor(now);
  const lastMonthFloor = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisMonth = spendRows
    .filter((i) => parseMonth(i).getTime() === thisMonthFloor.getTime())
    .reduce((s, i) => s + (i.total ?? 0), 0);
  const lastMonth = spendRows
    .filter((i) => parseMonth(i).getTime() === lastMonthFloor.getTime())
    .reduce((s, i) => s + (i.total ?? 0), 0);
  const momChangePct =
    lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;

  // last 12 months series
  const monthly: { month: string; spend: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const spend = spendRows
      .filter((r) => parseMonth(r).getTime() === m.getTime())
      .reduce((s, r) => s + (r.total ?? 0), 0);
    monthly.push({ month: `${MONTH_NAMES[m.getMonth()]} ${String(m.getFullYear()).slice(2)}`, spend });
  }

  // top suppliers
  const bySupplier = new Map<string, number>();
  for (const r of spendRows) {
    const name = (r.vendorName || "Unknown").trim();
    if (!name) continue;
    bySupplier.set(name, (bySupplier.get(name) ?? 0) + (r.total ?? 0));
  }
  const topSuppliers = [...bySupplier.entries()]
    .map(([name, spend]) => ({ name, spend }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  return {
    kpis: { totalSpend, invoiceCount, avgInvoice, thisMonth, lastMonth, momChangePct, duplicateCount, currency },
    monthly,
    topSuppliers,
  };
}

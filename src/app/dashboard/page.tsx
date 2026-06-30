import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { monthlyUsageCount } from "@/lib/usage";
import { buildDashboardData } from "@/lib/analytics";
import { UploadForm } from "@/components/UploadForm";
import { SpendDashboard } from "@/components/SpendDashboard";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    processing: "bg-amber-100 text-amber-700",
    pending: "bg-slate-100 text-slate-600",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        map[status] || map.pending
      }`}
    >
      {status}
    </span>
  );
}

function dupBadge() {
  return (
    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      duplicate
    </span>
  );
}

function money(value: number | null, currency: string | null) {
  if (value === null || value === undefined) return "—";
  const symbol =
    currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";
  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { review?: string };
}) {
  const user = await requireUser();
  const reviewFilter =
    searchParams.review === "needs_review" || searchParams.review === "approved"
      ? (searchParams.review as string)
      : undefined;
  const [invoices, analyticsRows, used, org] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        organizationId: user.organizationId,
        ...(reviewFilter ? { reviewStatus: reviewFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { lineItems: true } } },
    }),
    prisma.invoice.findMany({
      where: { organizationId: user.organizationId },
      select: {
        vendorName: true,
        total: true,
        currency: true,
        invoiceDate: true,
        createdAt: true,
        duplicate: true,
        status: true,
        reviewStatus: true,
      },
    }),
    monthlyUsageCount(user.organizationId),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { plan: true, monthlyLimit: true },
    }),
  ]);

  const limit = org?.monthlyLimit ?? 0;
  const dashboard = buildDashboardData(analyticsRows);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">
            {org?.plan ?? "free"} plan · {used} / {limit} processed this month
          </p>
        </div>
        <a
          href="/api/invoices/export"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Export all (XLSX)
        </a>
      </div>

      <SpendDashboard data={dashboard} />

      {dashboard.kpis.needsReview > 0 && reviewFilter !== "needs_review" && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="text-sm text-amber-800">
            <span className="font-semibold">
              {dashboard.kpis.needsReview} invoice{dashboard.kpis.needsReview > 1 ? "s" : ""} need review
            </span>{" "}
            — exports are blocked until approved.
          </div>
          <Link
            href="/dashboard?review=needs_review"
            className="text-sm font-medium text-brand hover:underline"
          >
            Review queue →
          </Link>
        </div>
      )}

      <UploadForm />

      <div className="flex gap-2 text-sm">
        {[
          { label: "All", href: "/dashboard", key: undefined },
          { label: "Needs review", href: "/dashboard?review=needs_review", key: "needs_review" },
          { label: "Approved", href: "/dashboard?review=approved", key: "approved" },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={`rounded-md px-3 py-1.5 font-medium ${
              reviewFilter === t.key
                ? "bg-brand text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Invoice #</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Lines</th>
              <th className="px-4 py-3 font-medium">Review</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Uploaded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No invoices match this filter.
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/invoices/${inv.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {inv.vendorName || inv.fileName}
                  </Link>
                  {inv.duplicate && dupBadge()}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {inv.invoiceNumber || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {inv.invoiceDate || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {money(inv.total, inv.currency)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {inv._count.lineItems}
                </td>
                <td className="px-4 py-3">
                  {inv.reviewStatus === "approved" ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      approved
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      needs review
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(inv.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

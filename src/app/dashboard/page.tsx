import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { monthlyUsageCount } from "@/lib/usage";
import { UploadForm } from "@/components/UploadForm";

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

function money(value: number | null, currency: string | null) {
  if (value === null || value === undefined) return "—";
  const symbol =
    currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";
  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [invoices, used, org] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { lineItems: true } } },
    }),
    monthlyUsageCount(user.organizationId),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { plan: true, monthlyLimit: true },
    }),
  ]);

  const limit = org?.monthlyLimit ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">
            {org?.plan ?? "free"} plan · {used} / {limit} processed this month
          </p>
        </div>
      </div>

      <UploadForm />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Invoice #</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Lines</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Uploaded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No invoices yet. Upload one above to extract its data.
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

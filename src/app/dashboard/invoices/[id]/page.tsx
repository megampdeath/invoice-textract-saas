import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { buildAnnotations } from "@/lib/textract";
import { InvoiceViewer } from "@/components/InvoiceViewer";
import { ReviewActions } from "@/components/ReviewActions";

function money(value: number | null | undefined, currency: string | null) {
  if (value === null || value === undefined) return "—";
  const symbol =
    currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";
  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      uploadedBy: { select: { name: true, email: true } },
      usageRecord: true,
    },
  });

  if (!invoice) notFound();

  const annotations = buildAnnotations(
    invoice.rawJson ? JSON.parse(invoice.rawJson) : null
  );
  const fileUrl = `/api/invoices/${invoice.id}/file`;

  const confidencePct =
    invoice.confidence != null ? Math.round(invoice.confidence * 100) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to invoices
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">
            {invoice.vendorName || invoice.fileName}
            {invoice.duplicate && (
              <span className="ml-3 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-medium text-amber-700">
                suspected duplicate
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500">{invoice.fileName}</p>
          {invoice.duplicate && invoice.duplicateOfId && (
            <p className="mt-1 text-xs text-amber-700">
              This looks like a duplicate of{" "}
              <Link
                href={`/dashboard/invoices/${invoice.duplicateOfId}`}
                className="font-medium text-brand hover:underline"
              >
                the original invoice
              </Link>
              .
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {invoice.reviewStatus === "approved" ? (
            <>
              <a
                href={`/api/invoices/${invoice.id}/export?format=xlsx`}
                className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Export XLSX
              </a>
              <a
                href={`/api/invoices/${invoice.id}/export`}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                CSV
              </a>
            </>
          ) : (
            <span
              className="cursor-not-allowed rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400"
              title="Approve this invoice to enable export"
            >
              Export locked — approve first
            </span>
          )}
        </div>
      </div>

      <ReviewActions
        invoiceId={invoice.id}
        reviewStatus={invoice.reviewStatus}
        reviewReason={invoice.reviewReason}
      />

      <InvoiceViewer
        fileUrl={fileUrl}
        mimeType={invoice.mimeType}
        pageCount={invoice.pageCount ?? 1}
        annotations={annotations}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Invoice #" value={invoice.invoiceNumber} />
          <Field label="Invoice date" value={invoice.invoiceDate} />
          <Field label="Due date" value={invoice.dueDate} />
          <Field label="Currency" value={invoice.currency} />
          <Field label="Vendor" value={invoice.vendorName} />
          <Field label="Vendor tax ID" value={invoice.vendorTaxId} />
          <Field label="Payment terms" value={invoice.paymentTerms} />
          <Field label="Confidence" value={confidencePct != null ? `${confidencePct}%` : "—"} />
          <Field
            label="Subtotal"
            value={invoice.subtotal != null ? money(invoice.subtotal, invoice.currency) : null}
          />
          <Field
            label="Tax"
            value={invoice.tax != null ? money(invoice.tax, invoice.currency) : null}
          />
          <Field
            label="Total"
            value={invoice.total != null ? money(invoice.total, invoice.currency) : null}
          />
          <Field label="Pages" value={invoice.pageCount?.toString()} />
        </div>
        {invoice.status === "failed" && invoice.errorMessage && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Extraction failed: {invoice.errorMessage}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
          Line items ({invoice.lineItems.length})
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 text-right font-medium">Qty</th>
              <th className="px-4 py-3 text-right font-medium">Unit price</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.lineItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No line items detected.
                </td>
              </tr>
            )}
            {invoice.lineItems.map((li) => (
              <tr key={li.id}>
                <td className="px-4 py-3 text-slate-800">{li.description || "—"}</td>
                <td className="px-4 py-3 text-right text-slate-600">{li.quantity ?? "—"}</td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {money(li.unitPrice, invoice.currency)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">
                  {money(li.amount, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        Uploaded by {invoice.uploadedBy?.name || invoice.uploadedBy?.email || "—"} on{" "}
        {new Date(invoice.createdAt).toLocaleString()}
        {invoice.usageRecord
          ? ` · ${invoice.usageRecord.pages} page(s) processed`
          : ""}
      </div>
    </div>
  );
}

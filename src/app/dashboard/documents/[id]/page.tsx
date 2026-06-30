import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { InvoiceViewer, type Annotation } from "@/components/InvoiceViewer";
import { ReviewActions } from "@/components/ReviewActions";

export default async function DocumentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const doc = await prisma.document.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: {
      values: { orderBy: { sortOrder: "asc" } },
      documentType: { select: { name: true } },
    },
  });
  if (!doc) notFound();

  const annotations: Annotation[] = doc.values
    .filter(
      (v) =>
        v.left != null && v.top != null && v.width != null && v.height != null
    )
    .map((v) => ({
      field: v.fieldKey,
      label: v.label,
      group: "field" as const,
      page: v.page,
      left: v.left as number,
      top: v.top as number,
      width: v.width as number,
      height: v.height as number,
      text: v.value ?? "",
    }));

  const fileUrl = `/api/documents/${doc.id}/file`;
  const confidencePct =
    doc.confidence != null ? Math.round(doc.confidence * 100) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/documents"
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to documents
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">
            {doc.documentType?.name ?? "Document"}
          </h1>
          <p className="text-sm text-slate-500">{doc.fileName}</p>
        </div>
        <div className="flex gap-2">
          {doc.reviewStatus === "approved" ? (
            <>
              <a
                href={`/api/documents/${doc.id}/export?format=xlsx`}
                className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Export XLSX
              </a>
              <a
                href={`/api/documents/${doc.id}/export`}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                CSV
              </a>
            </>
          ) : (
            <span
              className="cursor-not-allowed rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400"
              title="Approve this document to enable export"
            >
              Export locked — approve first
            </span>
          )}
        </div>
      </div>

      <ReviewActions
        apiPath={`/api/documents/${doc.id}/review`}
        reviewStatus={doc.reviewStatus}
        reviewReason={doc.reviewReason}
      />

      <InvoiceViewer
        fileUrl={fileUrl}
        mimeType={doc.mimeType}
        pageCount={doc.pageCount ?? 1}
        annotations={annotations}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            Extracted data ({doc.values.length})
          </h2>
          {confidencePct != null && (
            <span className="text-xs text-slate-500">
              Confidence: {confidencePct}%
            </span>
          )}
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {doc.values.length === 0 && (
              <tr>
                <td className="px-2 py-6 text-center text-slate-400">
                  No fields extracted.
                </td>
              </tr>
            )}
            {doc.values.map((v) => (
              <tr key={v.id}>
                <td className="w-1/3 px-2 py-2 align-top text-xs uppercase tracking-wide text-slate-400">
                  {v.label}
                  {v.confidence != null && (
                    <span className="ml-2 normal-case text-slate-300">
                      {Math.round(v.confidence * 100)}%
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-slate-800">{v.value || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {doc.status === "failed" && doc.errorMessage && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Extraction failed: {doc.errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    processing: "bg-amber-100 text-amber-700",
    pending: "bg-slate-100 text-slate-600",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || map.pending}`}>
      {status}
    </span>
  );
}

export default async function DocumentsPage() {
  const user = await requireUser();
  const [documentTypes, documents] = await Promise.all([
    prisma.documentType.findMany({
      where: { OR: [{ organizationId: null }, { organizationId: user.organizationId }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
    }),
    prisma.document.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        documentType: { select: { name: true } },
        _count: { select: { values: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500">
            Extract structured data from any document type — invoices, part
            certificates, work orders, and more.
          </p>
        </div>
        <Link
          href="/dashboard/documents/types"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Manage types
        </Link>
      </div>

      <DocumentUploadForm documentTypes={documentTypes} />

      {documentTypes.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">
            Available document types
          </h2>
          <ul className="space-y-1 text-sm text-slate-600">
            {documentTypes.map((t) => (
              <li key={t.id}>
                <span className="font-medium text-slate-800">{t.name}</span>
                {t.description && (
                  <span className="text-slate-500"> — {t.description}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Values</th>
              <th className="px-4 py-3 font-medium">Review</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Uploaded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No documents yet. Upload one above.
                </td>
              </tr>
            )}
            {documents.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/documents/${d.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {d.fileName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {d.documentType?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{d._count.values}</td>
                <td className="px-4 py-3">
                  {d.reviewStatus === "approved" ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      approved
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      needs review
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{statusBadge(d.status)}</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

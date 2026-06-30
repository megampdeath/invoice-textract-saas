import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { DocumentTypeForm } from "@/components/DocumentTypeForm";
import { DeleteTypeButton } from "@/components/DeleteTypeButton";

export default async function DocumentTypesPage() {
  const user = await requireUser();
  const types = await prisma.documentType.findMany({
    where: { OR: [{ organizationId: null }, { organizationId: user.organizationId }] },
    orderBy: [{ organizationId: "asc" }, { name: "asc" }],
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/documents"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to documents
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">Document types</h1>
        <p className="text-sm text-slate-500">
 Define your own document types and the fields to extract from each.
        </p>
      </div>

      <DocumentTypeForm />

      <div className="space-y-3">
        {types.map((t) => {
          const isPreset = t.organizationId === null;
          return (
            <div
              key={t.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-800">
                      {t.name}
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {isPreset ? "preset" : "custom"}
                    </span>
                  </div>
                  {t.description && (
                    <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>
                  )}
                </div>
                {!isPreset && <DeleteTypeButton id={t.id} />}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.fields.map((f) => (
                  <span
                    key={f.id}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
                    title={f.question ?? undefined}
                  >
                    {f.label}
                    {f.required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                    <span className="ml-1 text-slate-300">·{f.fieldType}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

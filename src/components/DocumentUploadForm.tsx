"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.tif,.tiff";

export function DocumentUploadForm({
  documentTypes,
}: {
  documentTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [typeId, setTypeId] = useState(documentTypes[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    if (!typeId) {
      setError("Select a document type first");
      return;
    }
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("documentTypeId", typeId);
    try {
      const res = await fetch("/api/documents/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      router.refresh();
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  if (documentTypes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        No document types configured yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          disabled={loading}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        >
          {documentTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          {loading ? "Processing…" : "Upload document"}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
        <span className="text-sm text-slate-500">PDF, PNG, JPEG, or TIFF up to 10MB</span>
      </div>
      {error && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

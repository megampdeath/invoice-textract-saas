"use client";

import { useEffect, useState } from "react";

export interface Annotation {
  field: string;
  label: string;
  group: "vendor" | "id" | "dates" | "money" | "line" | "field";
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
}

const COLORS: Record<
  Annotation["group"],
  { bg: string; border: string; dot: string }
> = {
  vendor: { bg: "rgba(79,70,229,0.16)", border: "rgba(79,70,229,0.9)", dot: "#4f46e5" },
  id: { bg: "rgba(139,92,246,0.16)", border: "rgba(139,92,246,0.9)", dot: "#7c3aed" },
  dates: { bg: "rgba(14,165,233,0.16)", border: "rgba(14,165,233,0.9)", dot: "#0ea5e9" },
  money: { bg: "rgba(245,158,11,0.20)", border: "rgba(245,158,11,0.95)", dot: "#f59e0b" },
  line: { bg: "rgba(16,185,129,0.16)", border: "rgba(16,185,129,0.9)", dot: "#10b981" },
  field: { bg: "rgba(79,70,229,0.16)", border: "rgba(79,70,229,0.9)", dot: "#4f46e5" },
};

const GROUP_LABEL: Record<Annotation["group"], string> = {
  vendor: "Vendor",
  id: "Invoice ID",
  dates: "Dates",
  money: "Amounts",
  line: "Line items",
  field: "Fields",
};

type Indexed = { a: Annotation; idx: number };

export function InvoiceViewer({
  fileUrl,
  mimeType,
  pageCount,
  annotations,
}: {
  fileUrl: string;
  mimeType: string;
  pageCount: number;
  annotations: Annotation[];
}) {
  const [mod, setMod] = useState<{ Document: any; Page: any } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await import("react-pdf");
        // Use a CDN worker matching the installed pdfjs version. This avoids
        // bundling pdfjs's prebuilt worker through the JS pipeline (which SWC
        // cannot parse). The app already requires network for AWS Textract.
        m.pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${m.pdfjs.version}/build/pdf.worker.min.mjs`;
        if (!cancelled) setMod({ Document: m.Document, Page: m.Page });
      } catch (e) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : "Failed to load viewer");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isPdf = mimeType === "application/pdf";
  const isImage = /^image\/(png|jpe?g)$/i.test(mimeType);
  const pages = Array.from({ length: Math.max(pageCount || 1, 1) }, (_, i) => i + 1);

  const byPage = new Map<number, Indexed[]>();
  annotations.forEach((a, idx) => {
    const p = a.page || 1;
    if (!byPage.has(p)) byPage.set(p, []);
    byPage.get(p)!.push({ a, idx });
  });

  const groupsPresent = new Set(annotations.map((a) => a.group));

  function Overlay({ page }: { page: number }) {
    const list = byPage.get(page) ?? [];
    return (
      <div className="pointer-events-none absolute inset-0">
        {list.map(({ a, idx }, i) => {
          const c = COLORS[a.group];
          const active = hover === idx;
          return (
            <div
              key={i}
              className="pointer-events-auto absolute cursor-pointer transition-all"
              style={{
                left: `${a.left * 100}%`,
                top: `${a.top * 100}%`,
                width: `${a.width * 100}%`,
                height: `${a.height * 100}%`,
                background: c.bg,
                border: `${active ? 3 : 2}px solid ${c.border}`,
                boxShadow: active ? `0 0 0 3px ${c.border}` : "none",
                borderRadius: 3,
              }}
              onMouseEnter={() => setHover(idx)}
              onMouseLeave={() => setHover(null)}
            >
              {active && (
                <div
                  className="pointer-events-none absolute z-20 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white shadow"
                  style={{ bottom: "100%", left: 0, marginBottom: 4 }}
                >
                  <span style={{ color: c.dot }}>●</span> {a.label}: {a.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function Legend() {
    const groups = (Object.keys(GROUP_LABEL) as Annotation["group"][]).filter(
      (g) => groupsPresent.has(g)
    );
    if (groups.length === 0) return null;
    return (
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-600">
        {groups.map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: COLORS[g].dot }}
            />
            {GROUP_LABEL[g]}
          </span>
        ))}
      </div>
    );
  }

  const Document = mod?.Document;
  const Page = mod?.Page;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Document preview
        </h2>
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-brand hover:underline"
        >
          Open original ↗
        </a>
      </div>

      <Legend />

      {loadError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Viewer failed to load: {loadError}
        </div>
      )}

      {annotations.length === 0 && (
        <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No highlights available (extraction may be pending or failed).
        </div>
      )}

      <div className="overflow-x-auto">
        {isPdf && !Document && !loadError && (
          <div className="py-10 text-center text-sm text-slate-400">
            Loading PDF viewer…
          </div>
        )}

        {isPdf && Document && (
          <Document
            file={fileUrl}
            loading={<div className="py-10 text-center text-sm text-slate-400">Loading PDF…</div>}
            error={<div className="py-10 text-center text-sm text-red-600">Failed to load PDF.</div>}
          >
            {pages.map((p) => (
              <div key={p} className="relative mb-4 inline-block">
                <Page
                  pageNumber={p}
                  width={800}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="block"
                />
                <Overlay page={p} />
              </div>
            ))}
          </Document>
        )}

        {isImage && (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl} alt="invoice" className="block max-w-full" />
            <Overlay page={1} />
          </div>
        )}

        {!isPdf && !isImage && (
          <div className="py-10 text-center text-sm text-slate-400">
            Preview not supported for this file type.{" "}
            <a href={fileUrl} className="text-brand hover:underline">
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

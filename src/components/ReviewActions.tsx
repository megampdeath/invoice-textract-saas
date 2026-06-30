"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewActions({
  apiPath,
  reviewStatus,
  reviewReason,
}: {
  apiPath: string;
  reviewStatus: string;
  reviewReason: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const approved = reviewStatus === "approved";

  async function act(status: "approved" | "needs_review") {
    setBusy(true);
    setErr(null);
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Failed");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  if (approved) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
        <div className="text-sm text-emerald-800">
          <span className="font-semibold">Approved</span> — ready to export.
        </div>
        <button
          onClick={() => act("needs_review")}
          disabled={busy}
          className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
        >
          {busy ? "…" : "Reopen"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="text-sm text-amber-800">
        <span className="font-semibold">Needs review</span>
        {reviewReason ? ` — ${reviewReason}` : ""}
        <span className="block text-xs text-amber-700">
          Exports are blocked until this invoice is approved.
        </span>
      </div>
      <div className="flex items-center gap-2">
        {err && <span className="text-xs text-red-600">{err}</span>}
        <button
          onClick={() => act("approved")}
          disabled={busy}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? "…" : "Approve"}
        </button>
      </div>
    </div>
  );
}

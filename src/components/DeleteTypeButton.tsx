"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteTypeButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm("Delete this document type? Existing documents keep their data.")) return;
    setBusy(true);
    const r = await fetch(`/api/documents/types/${id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
    setBusy(false);
  }

  return (
    <button
      onClick={del}
      disabled={busy}
      className="text-xs font-medium text-slate-400 hover:text-red-600 disabled:opacity-60"
    >
      {busy ? "…" : "Delete"}
    </button>
  );
}

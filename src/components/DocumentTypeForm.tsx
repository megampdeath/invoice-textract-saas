"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FieldRow {
  label: string;
  question: string;
  fieldType: string;
  required: boolean;
}

const empty = (): FieldRow => ({
  label: "",
  question: "",
  fieldType: "string",
  required: false,
});

const input =
  "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export function DocumentTypeForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FieldRow[]>([empty()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<FieldRow>) {
    setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function add() {
    setFields((fs) => [...fs, empty()]);
  }
  function remove(i: number) {
    setFields((fs) => fs.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/documents/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || undefined,
        fields: fields.map((f) => ({
          label: f.label.trim(),
          question: f.question.trim(),
          fieldType: f.fieldType,
          required: f.required,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create type");
      setSaving(false);
      return;
    }
    setName("");
    setDescription("");
    setFields([empty()]);
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      <h2 className="text-sm font-semibold text-slate-700">New document type</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Type name
          </label>
          <input
            className={input}
            placeholder="e.g. Bill of Lading"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Description (optional)
          </label>
          <input
            className={input}
            placeholder="What this type is for"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-600">
            Fields to extract
          </label>
          <button
            type="button"
            onClick={add}
            className="text-xs font-medium text-brand hover:underline"
          >
            + Add field
          </button>
        </div>

        <div className="space-y-2">
          {fields.map((f, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-[1fr_1.6fr_auto_auto_auto]"
            >
              <input
                className={input}
                placeholder="Field label (e.g. Container #)"
                value={f.label}
                onChange={(e) => update(i, { label: e.target.value })}
                required
              />
              <input
                className={input}
                placeholder='Question (e.g. "What is the container number?")'
                value={f.question}
                onChange={(e) => update(i, { question: e.target.value })}
                required
              />
              <select
                className={input}
                value={f.fieldType}
                onChange={(e) => update(i, { fieldType: e.target.value })}
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="date">date</option>
              </select>
              <label className="flex items-center gap-1 px-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                />
                req
              </label>
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded px-2 text-xs text-slate-400 hover:text-red-600"
                disabled={fields.length === 1}
                title="Remove field"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Field keys are auto-derived from labels (Textract alias-safe).
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {saving ? "Creating…" : "Create document type"}
      </button>
    </form>
  );
}

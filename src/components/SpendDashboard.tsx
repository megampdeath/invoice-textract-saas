"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import type { DashboardData } from "@/lib/analytics";

function symbol(currency: string | null) {
  return currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
}

function fmt(n: number, currency: string | null) {
  return `${symbol(currency)}${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function Kpi({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "slate" | "indigo" | "emerald" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-200",
    indigo: "border-brand",
    emerald: "border-emerald-300",
    amber: "border-amber-300",
    rose: "border-rose-300",
  };
  return (
    <div className={`rounded-lg border ${tones[tone]} bg-white p-4`}>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function SpendDashboard({ data }: { data: DashboardData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const k = data.kpis;
  const mom =
    k.momChangePct == null
      ? "—"
      : `${k.momChangePct >= 0 ? "+" : ""}${k.momChangePct.toFixed(0)}% vs last month`;

  if (k.invoiceCount === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Spend analytics will appear here once you have processed invoices.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total spend" value={fmt(k.totalSpend, k.currency)} sub={`${k.invoiceCount} invoices`} tone="indigo" />
        <Kpi label="Avg invoice" value={fmt(k.avgInvoice, k.currency)} tone="slate" />
        <Kpi label="This month" value={fmt(k.thisMonth, k.currency)} sub={mom} tone="emerald" />
        <Kpi label="Duplicates" value={String(k.duplicateCount)} sub={k.duplicateCount ? "review flagged" : "none detected"} tone={k.duplicateCount ? "amber" : "slate"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Monthly spend
          </h3>
          <div style={{ width: "100%", height: 220 }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={48} />
                  <Tooltip
                    formatter={(value: unknown) => fmt(Number(value), k.currency)}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Bar dataKey="spend" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Top suppliers by spend
          </h3>
          <div style={{ width: "100%", height: 220 }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={data.topSuppliers}
                  margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    stroke="#94a3b8"
                    width={110}
                  />
                  <Tooltip
                    formatter={(value: unknown) => fmt(Number(value), k.currency)}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                    {data.topSuppliers.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#4338ca" : "#6366f1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

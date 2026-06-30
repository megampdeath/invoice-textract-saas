const BASE = process.env.BASE_URL || "http://localhost:3000";

const cookies = new Map();
function saveCookies(res) {
  const sc = res.headers.getSetCookie?.() ?? [];
  for (const c of sc) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
}
function cookieHeader() {
  return Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}
async function jget(url) {
  const r = await fetch(url, { headers: { Cookie: cookieHeader() }, redirect: "manual" });
  saveCookies(r);
  return r;
}
async function jpost(url, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Cookie: cookieHeader() },
    redirect: "manual",
  });
  saveCookies(r);
  return r;
}

async function main() {
  const csrfRes = await jget(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const form = new URLSearchParams({
    csrfToken,
    email: "demo@acme.test",
    password: "demo1234",
    callbackUrl: `${BASE}/dashboard`,
  });
  await jpost(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  // List invoices via API
  const listRes = await jget(`${BASE}/api/invoices`);
  const list = await listRes.json();
  const invs = list.invoices ?? [];
  console.log("Invoices in org:", invs.length);
  for (const i of invs.slice(0, 12)) {
    console.log(
      `  - ${i.vendorName ?? "(none)"} | #${i.invoiceNumber ?? "?"} | ${i.total ?? "?"} ${i.currency ?? ""} | dup=${i.duplicate} | ${i.status}`
    );
  }

  // Dashboard HTML (KPIs are server-rendered)
  const dash = await jget(`${BASE}/dashboard`);
  const html = await dash.text();
  console.log("\nDashboard:", dash.status);
  console.log("  has 'TechConsult':", html.includes("TechConsult"));
  console.log("  has '5,400' (EUR total spend):", html.includes("5,400"));
  console.log("  has 'Total spend':", html.includes("Total spend"));
  console.log("  has 'Monthly volume':", html.includes("Monthly volume"));
  console.log("  has 'Top suppliers by volume':", html.includes("Top suppliers by volume"));
  // Show the Total spend KPI value context
  const idx = html.indexOf("Total spend");
  if (idx >= 0) console.log("  KPI context:", html.slice(idx, idx + 120).replace(/\s+/g, " "));
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});

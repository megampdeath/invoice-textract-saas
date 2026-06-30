import PDFDocument from "pdfkit";

const BASE = process.env.BASE_URL || "http://localhost:3100";

// --- minimal cookie jar ---
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

function buildInvoicePdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(26).text("INVOICE", 50, 50, { align: "center" });
    doc.fontSize(12);
    doc.text("Acme Supplies Inc.", 50, 130);
    doc.text("123 Commerce Street");
    doc.text("New York, NY 10001");
    doc.text("Tax ID: 99-7654321");
    doc.text("Invoice #: INV-10042", 350, 130);
    doc.text("Invoice Date: 2024-06-30", 350, 150);
    doc.text("Due Date: 2024-07-30", 350, 170);
    doc.text("Bill To:", 50, 220);
    doc.text("Demo Customer Co.", 50, 240);
    doc.text("Description", 50, 300);
    doc.text("Qty", 280, 300);
    doc.text("Unit Price", 360, 300);
    doc.text("Amount", 460, 300);
    const rows = [
      ["Widget A", "2", "$15.00", "$30.00"],
      ["Widget B", "5", "$8.00", "$40.00"],
    ];
    let y = 320;
    for (const [d, q, u, a] of rows) {
      doc.text(d, 50, y); doc.text(q, 280, y); doc.text(u, 360, y); doc.text(a, 460, y);
      y += 20;
    }
    doc.text("Subtotal: $92.50", 360, y + 20);
    doc.text("Tax (8%): $7.40", 360, y + 40);
    doc.text("Total: $99.90", 360, y + 60);
    doc.end();
  });
}

async function main() {
  console.log("BASE:", BASE);

  // 1) CSRF
  const csrfRes = await jget(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  console.log("CSRF:", csrfToken ? "ok" : "missing");

  // 2) Login
  const form = new URLSearchParams({
    csrfToken,
    email: "demo@acme.test",
    password: "demo1234",
    callbackUrl: `${BASE}/dashboard`,
  });
  const loginRes = await jpost(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const hasSession = [...cookies.keys()].some((k) => k.includes("session"));
  console.log("Login status:", loginRes.status, "| session cookie:", hasSession);

  // 3) Upload
  const pdf = await buildInvoicePdf();
  const fd = new FormData();
  fd.append("file", new Blob([pdf], { type: "application/pdf" }), "sample-invoice.pdf");
  const upRes = await jpost(`${BASE}/api/invoices/upload`, { method: "POST", body: fd });
  const upData = await upRes.json();
  if (!upData.invoice) {
    console.error("Upload failed:", upRes.status, JSON.stringify(upData));
    process.exit(1);
  }
  const inv = upData.invoice;
  console.log("Upload:", upRes.status, "| id:", inv.id);
  console.log("  vendor:", inv.vendorName, "| invoice#:", inv.invoiceNumber, "| total:", inv.total, "| lines:", inv.lineItems?.length);

  // 4) Detail page HTML
  const det = await jget(`${BASE}/dashboard/invoices/${inv.id}`);
  const html = await det.text();
  console.log("Detail page:", det.status);
  console.log("  has 'Document preview':", html.includes("Document preview"));
  console.log("  has file link (/file):", html.includes(`/api/invoices/${inv.id}/file`));
  console.log("  has legend 'Amounts':", html.includes("Amounts"));
  console.log("  has legend 'Line items':", html.includes("Line items"));
  console.log("  has 'Loading PDF viewer':", html.includes("Loading PDF viewer"));

  // 5) File endpoint
  const fileRes = await jget(`${BASE}/api/invoices/${inv.id}/file`);
  const ct = fileRes.headers.get("content-type");
  const buf = Buffer.from(await fileRes.arrayBuffer());
  console.log("File endpoint:", fileRes.status, "| type:", ct, "| bytes:", buf.length);
}

main().catch((e) => {
  console.error("E2E FAILED:", e);
  process.exit(1);
});

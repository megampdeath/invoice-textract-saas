import PDFDocument from "pdfkit";

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

function buildCertPdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(20).text("CERTIFICATE OF CONFORMANCE", 50, 50, { align: "center" });
    doc.moveDown();
    doc.fontSize(12);
    const rows = [
      ["Part Number:", "P/N 737-AX-2048"],
      ["Supplier:", "Aero Components Inc."],
      ["Date of Machining:", "2026-06-15"],
      ["Heat Number:", "HT-99231"],
      ["Material:", "Aluminum 7075-T6"],
      ["Quantity:", "250"],
      ["Work Order:", "WO-2026-042"],
    ];
    let y = 140;
    for (const [k, v] of rows) {
      doc.text(k, 50, y);
      doc.text(v, 220, y);
      y += 24;
    }
    doc.text("Inspector: J. Rivera", 50, y + 30);
    doc.end();
  });
}

async function main() {
  // 1) Login
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

  // 2) Find the aerospace document type id from the documents page <select>
  const dp = await jget(`${BASE}/dashboard/documents`);
  const dhtml = await dp.text();
  console.log("documents page status:", dp.status, "| len:", dhtml.length, "| has Aerospace:", dhtml.includes("Aerospace"));
  console.log("has <select:", dhtml.includes("<select"), "| has <option:", dhtml.includes("<option"));
  const aeroIdx = dhtml.indexOf("Aerospace");
  if (aeroIdx >= 0) console.log("around Aerospace:", dhtml.slice(Math.max(0, aeroIdx - 120), aeroIdx + 60).replace(/\s+/g, " "));
  const opt = dhtml.match(/<option value="([^"]+)"[^>]*>/);
  if (!opt) {
    console.log("first 300 chars:", dhtml.slice(0, 300));
    throw new Error("No document type option found on /dashboard/documents");
  }
  const typeId = opt[1];
  console.log("Document type id:", typeId);

  // 3) Generate + upload the part certificate
  const pdf = await buildCertPdf();
  const fd = new FormData();
  fd.append("file", new Blob([pdf], { type: "application/pdf" }), "part-certificate.pdf");
  fd.append("documentTypeId", typeId);
  const up = await jpost(`${BASE}/api/documents/upload`, { method: "POST", body: fd });
  const upData = await up.json();
  if (!upData.document) {
    console.error("Upload failed:", up.status, JSON.stringify(upData));
    process.exit(1);
  }
  const d = upData.document;
  console.log("Upload:", up.status, "| id:", d.id, "| status:", d.status, "| review:", d.reviewStatus, d.reviewReason ?? "");
  console.log("Extracted values:");
  for (const v of d.values ?? []) {
    console.log(`  - ${v.label} (${v.fieldKey}): ${v.value ?? "(none)"}  conf=${v.confidence != null ? Math.round(v.confidence * 100) + "%" : "?"}`);
  }

  // 4) Detail page renders viewer + values
  const det = await jget(`${BASE}/dashboard/documents/${d.id}`);
  const detHtml = await det.text();
  console.log("\nDetail page:", det.status);
  console.log("  has 'Document preview':", detHtml.includes("Document preview"));
  console.log("  has 'Extracted data':", detHtml.includes("Extracted data"));
  console.log("  has 'P/N 737-AX-2048':", detHtml.includes("737-AX-2048"));
  console.log("  has 'Aero Components':", detHtml.includes("Aero Components"));
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});

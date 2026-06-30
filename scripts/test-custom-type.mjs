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

  // 1) Create a custom document type
  const create = await jpost(`${BASE}/api/documents/types`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Bill of Lading",
      description: "Ocean BOL — container, shipper, ports.",
      fields: [
        { label: "Container number", question: "What is the container number?", fieldType: "string", required: true },
        { label: "Shipper", question: "Who is the shipper?", fieldType: "string" },
        { label: "Port of loading", question: "What is the port of loading?", fieldType: "string" },
        { label: "Port of discharge", question: "What is the port of discharge?", fieldType: "string" },
      ],
    }),
  });
  const cd = await create.json();
  if (!create.ok) {
    console.error("Create failed:", create.status, JSON.stringify(cd));
    process.exit(1);
  }
  console.log("Created type:", cd.type.name, "| id:", cd.type.id);
  for (const f of cd.type.fields) {
    console.log(`  - ${f.label} (key=${f.key}, ${f.fieldType}${f.required ? ", required" : ""})`);
  }

  // 2) Verify it now appears in the upload dropdown on /dashboard/documents
  const dp = await jget(`${BASE}/dashboard/documents`);
  const html = await dp.text();
  const inSelect = html.includes(`<option value="${cd.type.id}"`);
  console.log("\nDocuments page:", dp.status);
  console.log("  custom type in <select>:", inSelect);
  console.log("  page mentions 'Bill of Lading':", html.includes("Bill of Lading"));
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});

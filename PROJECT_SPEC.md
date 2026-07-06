# InvoiceIQ — Project Specification (rebuild from scratch)

A multi-tenant SaaS that extracts structured data from documents (invoices and
arbitrary document types) using AWS Textract, with a highlighted PDF viewer,
review/approval workflow, spend analytics, and CSV/XLSX export.

- **Live site**: https://invoice-textract-saas.onrender.com
- **Repo**: https://github.com/megampdeath/invoice-textract-saas
- **Demo login**: `demo@acme.test` / `demo1234`

> Live credentials are in the gitignored `secrets.md` (not in this file).

---

## 1. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| ORM/DB | Prisma + PostgreSQL (Neon) |
| Auth | NextAuth (credentials provider, JWT sessions, one org per signup) |
| OCR | AWS Textract — `AnalyzeExpense` (invoices) + `AnalyzeDocument` Queries (any doc) |
| Storage | Postgres bytea (default) or S3 (optional) |
| Charts | recharts |
| PDF viewer | react-pdf (worker via CDN) |
| Excel | exceljs |
| Styling | Tailwind CSS |
| Host | Render (free web service) |

Node pinned to `20.x` via `engines`. Build-critical packages (prisma, tailwind,
typescript, eslint, @types/*) are in `dependencies` (not devDependencies)
because Render builds with `NODE_ENV=production`.

---

## 2. Features

- **Multi-tenant auth**: signup creates an Organization + owner User; NextAuth
  credentials login; session carries `organizationId` + `role`.
- **Invoice extraction**: upload PDF/PNG/JPEG/TIFF → `AnalyzeExpense` →
  normalized vendor/dates/totals/tax/line items + raw JSON stored.
- **Generalized document extraction**: define a `DocumentType` with `DocumentField`s
  (each a natural-language question); `AnalyzeDocument` Queries extracts any
  field from any document type. Ships an "Aerospace Part Certificate" preset;
  orgs can create custom types from the UI.
- **Highlighted PDF viewer**: renders the original PDF with color-coded
  bounding-box overlays for every extracted value (works for invoices + documents).
- **Review/approval workflow**: high-confidence + complete + non-duplicate invoices
  auto-approve; duplicates, low-confidence (<0.85), or missing key fields are
  flagged `needs_review` with a reason. Per-invoice exports are blocked until
  approved; org-wide XLSX includes an "Approved" column.
- **Duplicate detection**: sha256 file hash + (vendor + invoice #) + (vendor +
  total + date), case-insensitive; flagged with a link to the original.
- **Spend dashboard**: multi-currency KPIs (total spend per currency, invoice
  count, this-month volume + MoM%, needs-review count), 12-month volume chart,
  top-10 suppliers chart.
- **Export**: per-invoice CSV + XLSX; org-wide XLSX (all invoices + line items);
  per-document CSV + XLSX (field/value).
- **Usage/quota**: per-organization monthly invoice limit.

---

## 3. Data model (Prisma)

```
Organization  (id, name, plan, monthlyLimit)  ── users, invoices, documentTypes, documents, usage
User          (id, email, passwordHash, role, organizationId)  ── invoices, reviewedInvoices, documents, reviewedDocuments
Invoice       (org, uploadedBy, file meta, status, confidence, extracted summary fields,
               rawJson, contentHash, duplicate, duplicateOfId,
               reviewedBy, reviewStatus, reviewReason, reviewedAt) ── lineItems, usageRecord, file
InvoiceLineItem (invoiceId, description, quantity, unitPrice, amount, sortOrder)
InvoiceFile     (invoiceId @id, bytes Bytes)          # original file bytes (db storage)
UsageRecord     (org, invoiceId, pages, costCents)

DocumentType  (org? nullable = shared preset, name, description, extractionMethod, slug) ── fields, documents
DocumentField (documentTypeId, key, label, method, question, fieldType, required, sortOrder)
Document      (org, uploadedBy, documentType, file meta, status, confidence, rawJson,
               reviewedBy, reviewStatus, reviewReason, reviewedAt) ── values, file
DocumentValue (documentId, fieldKey, label, value, confidence, page, left/top/width/height, sortOrder)
DocumentFile  (documentId @id, bytes Bytes)
```

Indexes: `[organizationId, createdAt]`, `[organizationId, contentHash]`,
`[organizationId, vendorName, invoiceNumber]`, `[invoiceId]`, `[documentTypeId]`,
`[documentId]`.

Migrations live in `prisma/migrations/` and are applied via `prisma migrate deploy`.

---

## 4. Architecture / file layout

```
prisma/
  schema.prisma            # all models (postgresql provider, directUrl for Neon)
  seed.ts                  # demo org/user + aerospace preset
  migrations/              # init, phase1_duplicates, review_workflow, generic_documents, document_file
src/
  lib/
    prisma.ts              # Prisma singleton
    auth.ts                # NextAuth options (credentials, JWT callbacks → org in session)
    session.ts             # requireUser (server components) / requireApiUser (route handlers)
    aws.ts                 # TextractClient
    textract.ts            # AnalyzeExpense + normalization + buildAnnotations (invoices)
    extract.ts             # AnalyzeDocument Queries engine (documents) → values + geometry
    storage.ts             # storeFile/readFileBytes (S3 or local), isAllowedMime
    duplicates.ts          # findDuplicate (case-insensitive)
    review.ts              # REVIEW_STATUS + computeReviewState (invoices)
    usage.ts               # monthly quota + cost estimate
    analytics.ts           # buildDashboardData (multi-currency KPIs/charts)
    xlsx.ts                # buildInvoiceXlsx / buildOrgInvoicesXlsx
    documentTypes.ts       # DOCUMENT_PRESETS (aerospace part certificate)
    types/next-auth.d.ts   # session type augmentation
  components/
    InvoiceViewer.tsx      # react-pdf + bbox overlays (exports Annotation type)
    ReviewActions.tsx      # approve/reopen (takes apiPath)
    UploadForm.tsx         # invoice upload (client)
    DocumentUploadForm.tsx # document upload with type selector (client)
    DocumentTypeForm.tsx   # create custom document type (client)
    DeleteTypeButton.tsx   # delete custom type (client)
    SpendDashboard.tsx     # KPIs + recharts (client)
    SignOutButton.tsx
  app/
    layout.tsx, providers.tsx, globals.css, page.tsx (redirect)
    login/page.tsx, signup/page.tsx
    api/
      auth/[...nextauth]/route.ts
      signup/route.ts
      invoices/
        route.ts                  # GET list (tenant-scoped)
        upload/route.ts           # POST file → AnalyzeExpense → persist → review state
        [id]/route.ts             # GET detail
        [id]/file/route.ts        # GET original file bytes
        [id]/export/route.ts      # GET CSV/XLSX (?format=xlsx), gated on approval
        [id]/review/route.ts      # POST approve/reopen
        export/route.ts           # GET org-wide XLSX
      documents/
        upload/route.ts           # POST file+documentTypeId → AnalyzeDocument Queries → values
        types/route.ts            # GET/POST custom document types
        types/[id]/route.ts       # DELETE custom type
        [id]/file/route.ts        # GET original file bytes
        [id]/export/route.ts      # GET CSV/XLSX, gated on approval
        [id]/review/route.ts      # POST approve/reopen
    dashboard/
      layout.tsx                  # nav (Invoices / Documents), sign out
      page.tsx                    # invoice list + dashboard + upload + review filter
      invoices/[id]/page.tsx     # invoice detail (viewer + summary + review + export)
      documents/page.tsx         # document list + upload
      documents/[id]/page.tsx    # document detail (viewer + values + review + export)
      documents/types/page.tsx   # manage document types (presets + custom)
```

---

## 5. Environment variables

Copy `.env.example` → `.env` and fill (live values in `secrets.md`):

```env
NEXTAUTH_SECRET=<random base64>
NEXTAUTH_URL=http://localhost:3000            # prod: https://<service>.onrender.com
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<iam user with textract perms>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_S3_BUCKET=                                  # empty = Postgres bytea storage
PREVIEW_TOKEN_SECRET=<random hex>
DATABASE_URL=<neon pooled connection string>
DIRECT_DATABASE_URL=<neon direct connection string>
```

---

## 6. AWS IAM (least privilege)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["textract:AnalyzeExpense", "textract:AnalyzeDocument", "textract:DetectDocumentText"],
      "Resource": "*" }
  ]
}
```
Add S3 perms (`s3:PutObject/GetObject/DeleteObject` on `arn:aws:s3:::BUCKET/*`,
`s3:ListBucket` on `arn:aws:s3:::BUCKET`) only if `AWS_S3_BUCKET` is set.

---

## 7. Deploy (free tier)

**Database — Neon**: create project (free), copy pooled (`DATABASE_URL`) and
direct (`DIRECT_DATABASE_URL`) connection strings.

**Host — Render**: web service from the GitHub repo:
- Runtime: Node, plan: free
- Build command: `npm install --include=dev && npm run prisma:generate && npm run build`
- Start command: `npm run db:deploy && npm start`
- `render.yaml` blueprint included.
- Env vars: all from section 5 (set `NEXTAUTH_URL` to the Render URL).

Render builds with `NODE_ENV=production`, so build-critical packages must be in
`dependencies` (they are). `prisma migrate deploy` runs on each boot
(idempotent). The pdf.js worker loads from a CDN (jsDelivr) at runtime.

---

## 8. Rebuild from scratch

```bash
git clone https://github.com/megampdeath/invoice-textract-saas
cd invoice-textract-saas
cp .env.example .env            # fill from secrets.md
npm install                     # postinstall runs prisma generate
npm run db:migrate -- --name init   # if migrations absent; else npm run db:deploy
npm run seed                    # demo tenant + aerospace preset
npm run dev                     # http://localhost:3000
```

Verify:
```bash
npm run typecheck && npm run lint && npm run build
node --env-file=.env scripts/check-aws.mjs          # STS caller identity
node --env-file=.env scripts/check-textract.mjs     # AnalyzeExpense authorized
BASE_URL=http://localhost:3000 node scripts/e2e-app.mjs        # login+upload+extract+viewer+export
BASE_URL=http://localhost:3000 node scripts/test-documents.mjs # aerospace part cert extraction
```

Scripts (`scripts/`): `check-aws.mjs`, `check-textract.mjs`, `sample-invoice.ts`,
`e2e-app.mjs`, `check-dashboard.mjs`, `test-documents.mjs`, `test-custom-type.mjs`.

---

## 9. Key implementation notes

- **Textract mapping gotcha**: `AnalyzeExpense` uses `Type=UNIT_PRICE` for unit
  price and `Type=PRICE` (label "Amount") for the line amount — not the reverse.
- **Currency**: Textract rarely returns a `CURRENCY` field; the code infers
  `USD/EUR/GBP` from the `$`/`€`/`£` symbol in totals.
- **Page count** for documents = count of `PAGE` blocks (not `Block.Page`).
- **pdf.js worker**: bundling the prebuilt worker broke the SWC parse step, so
  it loads from `https://cdn.jsdelivr.net/npm/pdfjs-dist@<version>/build/pdf.worker.min.mjs`.
- **Duplicate matching** is case-insensitive (`mode: "insensitive"`) and trimmed.
- **Dashboard** sums spend per currency (no cross-currency summing); charts are
  volume-based (currency-agnostic) so no invoice is hidden.
- **Review gating**: per-invoice/document export returns 409 until `reviewStatus === "approved"`.

---

## 10. Known limits / next steps (see `next-steps.md`)

- Sync Textract in the request → timeout risk on large/multi-page docs. **Next:
  async refactor (S3 + SQS + worker)**, which also unblocks email ingestion,
  batch, and a public API.
- Only the `query` field method is wired (Forms/Tables/regex defined but not
  implemented).
- No LLM fallback for low-confidence fields yet (accuracy moat — planned).
- No Stripe billing; documents don't count against quota.
- Render free spins down after ~15 min idle (cold start ~30s).

---

## 11. Cost reality (verified on AWS pricing)

- Textract `AnalyzeExpense` = $0.01/page (first 1M/mo); `AnalyzeDocument Queries`
  = $0.015/page. Free tier: 100 pages/mo (new accounts, 3 months).
- Fixed infra (Render free + Neon free + S3 free tier) = $0 at low volume;
  paid prod ~$50-80/mo + ~1¢/page.

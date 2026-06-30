# InvoiceIQ — Textract Invoice Extraction SaaS

A multi-tenant SaaS that extracts structured data from invoices and receipts
(PDF / PNG / JPEG / TIFF) using **AWS Textract `AnalyzeExpense`**.

Each company (tenant) signs up, uploads invoices, and gets back a normalized
invoice record (vendor, dates, totals, tax, line items) with a **highlighted
PDF viewer** (original document with color-coded bounding boxes over every
extracted field), CSV export, and usage/quota tracking.

## Stack

- **Next.js 14 (App Router) + TypeScript** — full-stack in one repo
- **Prisma + SQLite** (swap `DATABASE_URL` for Postgres in production)
- **NextAuth (credentials, JWT sessions)** — multi-tenant, one org per signup
- **AWS SDK v3 — Textract `AnalyzeExpense`**
- **Tailwind CSS** dashboard
- Optional **S3** file storage (local disk by default)

## Project layout

```
src/
  app/
    api/
      auth/[...nextauth]/route.ts   # NextAuth handler
      signup/route.ts               # create tenant + owner user
      invoices/route.ts            # GET list (tenant-scoped)
      invoices/upload/route.ts     # POST file -> Textract -> persist
      invoices/[id]/route.ts       # GET one invoice (+line items)
      invoices/[id]/export/route.ts# GET CSV
    dashboard/                     # server components + UI
    login / signup                 # auth pages
  lib/
    aws.ts          # Textract client
    textract.ts     # AnalyzeExpense + normalization
    storage.ts      # local/S3 file storage
    prisma.ts       # Prisma singleton
    auth.ts         # NextAuth options (credentials, JWT callbacks)
    session.ts      # requireUser / requireApiUser
    usage.ts        # monthly quota + cost estimate
```

## Prerequisites

1. Node 18+ (built/tested on Node 20/24)
2. An AWS account with an IAM user allowed to call `textract:AnalyzeExpense`.

## Setup

```bash
npm install
cp .env.example .env      # fill in AWS creds + NEXTAUTH_SECRET
npx prisma migrate dev --name init
npm run seed              # creates demo tenant: demo@acme.test / demo1234
npm run dev
```

Open http://localhost:3000. Sign in with the demo account or create a new
tenant at `/signup`.

### Generate a NEXTAUTH_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## AWS IAM (least privilege)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["textract:AnalyzeExpense"],
      "Resource": "*"
    }
  ]
}
```

Add S3 permissions only if you set `AWS_S3_BUCKET` for file storage.

## API quick reference

| Method | Path                       | Auth | Description                      |
|--------|----------------------------|------|----------------------------------|
| POST   | `/api/signup`              | no   | Create tenant + owner            |
| POST   | `/api/auth/callback/credentials` | no | NextAuth login             |
| GET    | `/api/invoices`            | yes  | List tenant invoices             |
| POST   | `/api/invoices/upload`     | yes  | Upload + extract (multipart)     |
| GET    | `/api/invoices/:id`        | yes  | Invoice detail + line items      |
| GET    | `/api/invoices/:id/file`   | yes  | Original PDF/image (for viewer)  |
| GET    | `/api/invoices/:id/export` | yes  | CSV export                       |

### Upload example

```bash
curl -X POST http://localhost:3000/api/invoices/upload \
  -b cookies.txt \
  -F "file=@invoice.pdf"
```

## Scripts

| Script              | Purpose                          |
|---------------------|----------------------------------|
| `npm run dev`       | Start dev server                 |
| `npm run build`     | Production build                 |
| `npm run lint`      | ESLint                           |
| `npm run typecheck` | `tsc --noEmit`                   |
| `npm run seed`      | Seed demo tenant/user            |
| `npm run db:migrate`| Create/apply migration (dev)     |
| `npm run db:deploy` | Apply migrations (prod build)    |

## Deploy (free tier)

Stack: **Render** (free web service) + **Neon** (free Postgres) + **AWS S3**
(free tier, 12 months). Keeps the synchronous Textract flow (no serverless
timeouts). The app is provider-agnostic; these are the recommended free hosts.

### 1. Database — Neon (free Postgres)

1. Sign up at https://neon.tech and create a project (free).
2. From the dashboard, copy **two** connection strings:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** (no `-pooler`) → `DIRECT_DATABASE_URL`
3. Put them in `.env` (and on the host later). Append
   `?sslmode=require&pgbouncer=true&connect_timeout=15` to the pooled URL.
4. Generate + apply the migration and seed:

   ```bash
   npm run db:migrate -- --name init   # creates prisma/migrations/* + applies to Neon
   npm run seed                        # demo tenant: demo@acme.test / demo1234
   ```

### 2. File storage — AWS S3 (free tier) — OPTIONAL

Files default to **Postgres bytea** (stored in Neon), which needs no extra
setup and is fine for an MVP. Skip this section for the simplest free deploy.

To use S3 instead:

1. Create a bucket in `AWS_REGION` (e.g. `us-east-1`). Keep "Block all public
   access" ON — the backend reads objects with credentials, no public access.
2. Attach this inline policy to the IAM user used by the app (the same one with
   `textract:AnalyzeExpense`):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::YOUR-BUCKET" },
       { "Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::YOUR-BUCKET/*" }
     ]
   }
   ```

3. Set `AWS_S3_BUCKET=YOUR-BUCKET` in `.env`.

### 3. Host — Render (free web service)

1. Push this repo to GitHub.
2. In Render: **New → Web Service**, connect the repo. A `render.yaml` is
   included; alternatively configure manually:
   - **Runtime:** Node
   - **Build Command:** `npx prisma generate && npm run db:deploy && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free
3. Set environment variables (Environment tab):
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your Render URL, e.g.
   `https://invoice-textract-saas.onrender.com`), `AWS_REGION`,
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`,
   `DATABASE_URL`, `DIRECT_DATABASE_URL`, `PREVIEW_TOKEN_SECRET`.
4. Deploy. On each push Render runs `prisma migrate deploy` (idempotent) then
   builds.

> Render's free tier spins the service down after ~15 min idle (first request
> after idle takes ~30s to wake). Upgrade to a paid plan for always-on.

## Production notes (out of scope for MVP)

- Move Textract processing to a queue (SQS + Lambda or a worker) instead of
  synchronous request handling for large/many-page documents.
- Add Stripe billing tied to `Organization.plan` / `monthlyLimit`.
- Add team membership (multiple users per org) and RBAC on `User.role`.
- Rate limiting, webhooks for ERP/accounting integrations, audit logs.

## Disclaimer

Textract may misread values. Validate extracted totals/line items before
using them for accounting or payments.

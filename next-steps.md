# Next Steps

Two steps, in priority order. Step 1 is foundational (do it first); step 2 is the
moat that turns extraction into something buyers pay for.

---

## Step 1 — Async extraction (S3 + SQS + worker)

**Why now**
- The current upload routes call Textract **synchronously** in the HTTP request.
  That works at low volume but is a ticking bomb: a multi-page PDF can take
  5-10s+ and any large/many-page document will hit the request timeout on a real
  host (and already does on serverless).
- It's the **prerequisite for the three highest-value features**: email
  ingestion, batch upload, and the public API. Building any of those on top of
  sync extraction is rework.
- It gives you **retries and observability** for free (failed extractions get
  re-queued instead of leaving a `failed` invoice the user must re-upload).

**What to build**
1. Move file storage to **S3** (the code already supports it — set
   `AWS_S3_BUCKET` + add S3 perms to the IAM user).
2. Introduce a **job queue** (AWS SQS) and a **worker** (Lambda, or a separate
   Render background service).
3. Change the upload routes (`/api/invoices/upload`, `/api/documents/upload`)
   to: store file → create the invoice/document with `status: "processing"` →
   enqueue a job (with the resource id + kind) → return `201` immediately.
4. Worker: dequeue → fetch file bytes → run Textract (`AnalyzeExpense` for
   invoices, `AnalyzeDocument Queries` for documents) → write extracted values
   + review state → mark `completed` (or `failed` after N retries).
5. The existing UI already handles `processing`/`completed`/`failed` states, so
   no front-end rewrite — just refresh.

**Effort / risk**: Medium (1-2 days). Low product risk (no UI change), but it's
infra — test the queue/worker path end-to-end before relying on it.

**Unblocks**: email ingestion, batch upload, public API, scale past ~1 page.

---

## Step 2 — Accuracy moat: LLM fallback for low-confidence fields

**Why now**
- Textract `Queries` is good on *labeled* fields ("Part Number: 12345") but
  weak on fields that need **inference** (a machining date buried in a
  paragraph, a supplier inferred from a letterhead). Raw Textract accuracy is
  the #1 reason buyers choose Rossum/Veryfi over a Textract-wrapper — closing
  that gap is the moat.
- You already capture per-field **confidence** and a **review queue**. The
  natural next move is: don't just *flag* low-confidence answers for a human —
  try to *fix* them with an LLM first, then flag only what the LLM also can't
  resolve.

**What to build**
1. After Textract, for any field with `confidence < 0.85` **or** a null value,
   run an LLM pass: send the document's OCR text (`DetectDocumentText` output,
   already cheap) + the field's question + a strict "answer only, or empty"
   prompt (Claude Haiku / GPT-4o-mini — a few cents per doc).
2. Store the value with a `source` marker (`textract` vs `llm`) and the LLM
   confidence, so the reviewer can see *how* each value was obtained (the
   highlighted viewer already shows the bbox for Textract-sourced values; LLM
   values show without a box + an "AI" tag).
3. Only fields the LLM *also* fails get routed to the human review queue —
   shrinking the queue dramatically and improving perceived accuracy.

**Effort / risk**: Small-medium (~1 day). Main risk is LLM cost/latency — keep
it strictly behind the confidence gate (not every field, only weak ones) and
cache OCR text so you don't pay twice.

---

### After these
- **Supplier/part memory** — auto-learn per-supplier defaults from past docs
  and pre-fill new ones (the lock-in moat; compounds with usage).
- **Email ingestion + public API** — both now trivial because Step 1's queue
  exists (inbound email → drop file in S3 → enqueue; API → enqueue → webhook).
- **Stripe billing** tied to `Organization.plan` / per-page quota (invoices
  *and* documents).
- **GTM** — talk to 10-20 bookkeepers / aerospace QA leads before building more;
  features without demand is the real risk.

> Rule of thumb: **Step 1 unlocks scale and the next three features; Step 2 is
> what lets you charge a premium.** Do 1, then 2, then pick distribution over
> more features.

# Review: InvoiceIQ Competitor Analysis & Monetization Roadmap

> Reviewer notes on `competitor_analysis.md`. Verdict up front: this is a strong,
> clear-eyed document, and its best line is the last one —
> *"anyone can call Textract; users pay for the workflow, not the extraction."*
> That is the correct strategic frame. A few spots are too rosy and a couple of
> features are mis-costed. Details below.

---

## 1. What the analysis gets right

- **Tiering and pricing** are sensible and match the market:
  - Dext ~$25+/mo entry, DocuClipper ~$29-99, Invoscope free/cheap, Hubdoc free
    with Xero, Rossum enterprise, Nanonets/Docsumo mid-market.
- **Build priority Phase 1** (XLSX export, duplicate detection, basic spend
  dashboard) is the correct low-effort / high-signal starting point.
- **Textract cost ($0.01/page)** is accurate — verified against AWS's published
  pricing (AnalyzeExpense: $0.01/page for the first 1M pages/mo, $0.008 after;
  100 free pages/mo for *new* accounts, first 3 months only).
- **Supplier memory + integrations as the moat.** Extraction is commoditised;
  accumulated supplier data and workflow are what reduce churn. Correct.

---

## 2. What is wrong / risky

### 2.1 The "97% margin" math omits the real costs

The COGS line only counts Textract + Render + Neon. At 500 users / ~$19.5K MRR
you would also carry:

| Omitted cost | Rough impact at scale |
|---|---|
| **Stripe fees** (2.9% + $0.30/txn) | ~$700/mo at $19.5K MRR; ~5% of MRR when small |
| **Email-ingestion infra** (SES inbound, spam/AV, attachment parsing) | non-trivial, ongoing |
| **Async worker** (SQS + Lambda) + **S3** for files | required before email/batch/API can ship |
| **Database growth** past $25/mo | files can't live in Postgres bytea at 50K invoices |
| **Support labour** | accounting users need hand-holding — the real hidden cost, not $0 |

True contribution margin is still high (~80-90%), but **"97%" is not honest**
and will mislead pricing decisions.

### 2.2 Revenue ramp is optimistic without a funnel

50 → 500 → 1,500 users assumes distribution that does not yet exist.
Free→paid conversion for tools of this type is typically **2-5%**, so 500
*paying* users implies **10-25K free signups** — that is a serious acquisition
problem, not a feature problem.

> The spreadsheet should model **conversion rate** and **CAC**, not just
> ARPU × users.

### 2.3 Free-tier economics bite

Free = 10 invoices/mo, but your AWS account likely gets **no** Textract free
tier (100 pages/mo is for *new* accounts, first 3 months only). So every free
user costs you ~$0.01-0.02/page out of pocket.

**Fix:** cap free hard — 5 invoices, watermarked, or trial-style — or it
becomes a cost sink while you scale acquisition.

### 2.4 Several features are under-costed in effort

| Feature | Claim | Reality |
|---|---|---|
| **QuickBooks / Xero sync** | Phase 3, week 5-8 | OAuth partner apps with marketplace review/approval cycles (weeks-months), API churn, invoice→bill mapping edge cases. Budget **1 month+ each**, plus ongoing maintenance. 3-4× the estimate. |
| **FEC export** | "export format" | FEC is a *legal double-entry journal file*, not a column layout. Invoices alone don't produce an FEC — you must generate accounting entries (credit 401 / debit 6xx + 4456 VAT). That is an accounting-logic layer, ideally co-designed with a French accountant. Strong niche, real build. |
| **Bank statement parsing** | "same Textract API" | `AnalyzeExpense` is for invoices/receipts and performs poorly on statements. You'd need `Analyze Document (Tables)` + custom heuristics. Different problem, more work. |
| **AI auto-categorisation** | ~$0.01/invoice (GPT-4o-mini) | Cost is plausible (likely cheaper, ~$0.001-0.005), but *quality* and learning-from-corrections is the hard part, not the API call. |

### 2.5 Accuracy positioning gap

Rossum / Nanonets / Veryfi compete on **accuracy** via custom models +
human-in-the-loop validation. Raw Textract `AnalyzeExpense` is good-but-not-great
on messy invoices. You already store a confidence score but have **no review
queue** (surfacing low-confidence fields for a human). For accounting buyers,
"wrong total = wrong books" is existential — a validation UI is a real
differentiator and a gap the document does not name.

---

## 3. What is missing entirely

- **Go-to-market / distribution** — the single biggest omission. Pricing is a
  spreadsheet; acquisition is the business. Concrete channels worth naming:
  - **Xero + QuickBooks app marketplaces** (free, high-intent distribution),
  - **accountant / bookkeeper partnerships** (referral + co-design),
  - **SEO** ("extract invoice data" / "parse facture").
- **GDPR / EU data residency** — if targeting French accountants (FEC), where
  invoices are stored and the Textract region matter. Rossum leans hard on EU
  hosting; it is a real checkbox.
- **Moat durability** — Textract extraction is trivial to copy. Name the moat
  explicitly: supplier memory (accumulates), integrations (switching cost),
  analytics stickiness — not "we extract".
- **Churn assumption** — absent from the revenue math; integrations reduce it,
  but model it.
- **SOC 2 / ISO 27001** — "Enterprise = custom" implies it, but you cannot sell
  AP automation to enterprise without SOC 2.

---

## 4. Suggested changes

1. **Validate distribution before building Tier 2-4.** Talk to 10-20
   bookkeepers (French ones if FEC is your wedge) before building integrations.
   *Features without demand is the #1 startup killer.*
2. **Reorder the roadmap:**
   1. Phase 1 (XLSX, duplicates, dashboard), then
   2. **Async refactor** (SQS + Lambda + S3) — unlocks email ingestion, batch,
      API, and scale, then
   3. Email ingestion + **validation/review queue** — a stronger moat than
      chasing Xero early, then
   4. Integrations + FEC.
3. **Fix the economics:** add Stripe fees, support, CAC, and a free→paid
   conversion assumption to the model; cap the free tier to 5 invoices.
4. **Own a niche, not the whole map.** "French accountants, FEC-ready,
   EU-hosted" is a winnable wedge. "Better than Dext at everything" is not.

---

## 5. Bottom line

Keep the document — the strategy is sound. Fix the margin/funnel realism, add a
GTM section, and treat the **async refactor + validation queue** as
foundational (they unlock roughly half the roadmap). The roadmap is good; the
spreadsheet is doing some hopium.

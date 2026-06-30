# InvoiceIQ — Competitor Analysis & Monetization Roadmap

## What You Have Now (InvoiceIQ MVP)

| Feature | Status |
|---------|--------|
| Upload PDF/PNG/JPEG/TIFF | ✅ |
| AWS Textract extraction | ✅ |
| Vendor, dates, totals, tax, line items | ✅ |
| PDF viewer with bounding boxes | ✅ |
| CSV export | ✅ |
| Multi-tenant (org per signup) | ✅ |
| Usage/quota tracking | ✅ |
| Basic auth (NextAuth credentials) | ✅ |

**What's missing**: Everything below is what competitors charge $25–$149/mo for.

---

## Competitor Breakdown

| Competitor | Target | Pricing | Core Monetization Lever |
|-----------|--------|---------|------------------------|
| **Dext** | Accountants & bookkeepers | $25–$149/mo | Volume caps + add-ons (AI Assist, Commerce, Vault) |
| **DocuClipper** | Accounting firms, CPAs | $29–$99/mo | Page volume tiers + bank statement parsing |
| **Invoscope** | SMBs, freelancers | Free–$9.99/mo | Freemium, invoice count caps |
| **Hubdoc** | Xero users | Free (bundled) | Lock-in to Xero ecosystem |
| **Rossum** | Enterprise AP | $$$$ custom | Validation, ERP integration, compliance |
| **Nanonets** | Custom doc types | Mid-range usage | Custom model training |
| **Docsumo** | Mid-market | Mid-range | Pre-trained models, reviewer UI |

---

## 💰 Features That Make Money (Ranked by Revenue Impact)

### TIER 1 — The "Upgrade Now" Features (Drives free → paid conversion)

#### 1. 📊 Smart Dashboard & Spend Analytics
> **Why it makes money**: Users get addicted to the insights, can't leave
- Monthly/quarterly spend by supplier (bar charts, trends)
- Top 10 suppliers by spend
- Average invoice amount, payment terms
- Tax summary (total VAT paid per period) — **accountants NEED this**
- Overdue invoice alerts
- **Competitor gap**: Invoscope has ZERO analytics. Dext charges extra for it.

#### 2. 🔄 Accounting Software Integrations
> **Why it makes money**: This is the #1 reason users pick Dext over cheaper tools
- **QuickBooks Online** sync (push invoices as bills)
- **Xero** sync
- **Sage** sync
- Even just **Google Sheets** auto-push is huge for small businesses
- **Competitor gap**: Invoscope only exports to Excel. You can beat them here.

#### 3. 📧 Email Forwarding Ingestion
> **Why it makes money**: Removes friction = more invoices processed = higher stickiness
- Give each org a unique email: `invoices-abc123@invoiceiq.app`
- Auto-extract PDF attachments from forwarded emails
- **Every competitor has this** — Dext, Hubdoc, DocuClipper. Not having it is a dealbreaker.

#### 4. 🔍 Duplicate Invoice Detection
> **Why it makes money**: Prevents double-payments, builds TRUST, justifies premium pricing
- Same supplier + same invoice number = flag
- Same supplier + same total + same date = flag
- Same document hash = flag
- **Competitor gap**: Most small tools skip this. Enterprise tools (Rossum) charge for it.

---

### TIER 2 — The "Pro Plan" Features ($29–$49/mo)

#### 5. 📋 Approval Workflows
> **Why it makes money**: Multi-user orgs NEED this, it's what separates $10/mo from $49/mo
- Invoice status: `needs_review` → `approved` → `exported`
- Assign reviewer per invoice
- Approval notifications (email)
- Block export until approved
- **Who pays for this**: Any business with >1 person handling invoices

#### 6. 🏢 Supplier Management / Vendor Memory
> **Why it makes money**: Auto-categorization saves HOURS, reduces human review time
- Auto-learn supplier defaults (category, payment terms, IBAN)
- Next time same supplier → pre-fill fields, skip review
- Supplier directory with contact info, tax IDs, invoice history
- Default GL/expense category per supplier
- **Competitor price**: Dext includes this in mid-tier ($49+)

#### 7. 📑 Multi-Format Export (XLSX, FEC, Accounting Formats)
> **Why it makes money**: Niche accounting formats create lock-in
- **XLSX** with formatted headers, number formatting ✅ (you have CSV, need XLSX)
- **FEC format** — French legal accounting export (Fichier des Écritures Comptables)
- **DATEV format** — German accounting standard
- **MT940** — bank statement format
- **Custom column mapping** — let users define their own export template
- **Competitor gap**: FEC export alone makes you THE choice for French accountants

#### 8. 🏷️ Custom Fields & Tags
> **Why it makes money**: Every business has unique categorization needs
- User-defined fields (project code, cost center, department)
- Tags for filtering and export grouping
- **Competitor price**: Dext Advanced tier, DocuClipper mid-tier

---

### TIER 3 — The "Business Plan" Features ($79–$149/mo)

#### 9. 🤖 AI Auto-Categorization
> **Why it makes money**: This is the #1 time-saver. Users will pay $50+ just for this
- Auto-assign expense category based on supplier + description
- Learn from user corrections
- Suggest GL codes
- **API cost to you**: ~$0.01/invoice (GPT-4o-mini)
- **Competitor price**: Dext charges extra as "AI Assist" add-on

#### 10. 📱 Mobile Upload (WhatsApp / Mobile App)
> **Why it makes money**: Captures the "receipt at dinner" moment
- WhatsApp bot: send photo → extracted invoice appears in dashboard
- Progressive web app for mobile camera upload
- **Every competitor has this**: Dext, Hubdoc, DocuClipper all have mobile apps

#### 11. 🔐 Team Management & RBAC
> **Why it makes money**: Unlocks multi-seat pricing
- Multiple users per org (you only have 1 user/org now)
- Roles: Owner, Admin, Member, Viewer
- Per-seat pricing ($10/seat/mo adds up fast)
- Activity log / audit trail
- **Competitor price**: Dext, DocuClipper charge per user

#### 12. 🌍 Multi-Currency with Auto-Conversion
> **Why it makes money**: International businesses will pay premium for this
- Detect currency from invoice
- Show converted amount in org's base currency
- Use ECB/forex API for daily rates
- **Competitor gap**: Most small tools ignore this

#### 13. 📊 Tax Summary Reports
> **Why it makes money**: Tax season = accountants NEED this, will pay anything
- Quarterly VAT summary (input VAT by rate)
- Annual tax report per supplier
- Reverse-charge detection for EU cross-border
- Export tax summary as PDF report
- **Competitor price**: Dext Practice Advanced tier

---

### TIER 4 — The "Enterprise/API" Features ($149+/mo or usage-based)

#### 14. 🔌 Public API
> **Why it makes money**: Developers will pay per-call forever
- `POST /v1/extract` → returns structured JSON
- Webhook callbacks on completion
- API key management
- Usage-based pricing ($0.05–$0.10/page)
- **Your cost**: ~$0.01/page (Textract) → 5-10x markup
- **Competitor price**: Veryfi, Nanonets charge $0.05–$0.15/page

#### 15. 📦 Batch Processing
> **Why it makes money**: Accounting firms process 100+ invoices at once
- Upload ZIP file with 50 invoices
- Batch progress bar
- Batch export all results
- **Competitor price**: DocuClipper mid-tier

#### 16. 🏦 Bank Statement Parsing
> **Why it makes money**: Same tech, new document type, doubles your addressable market
- Parse PDF bank statements into transactions
- DocuClipper built their ENTIRE business on this
- **Your cost**: Same Textract API
- **Competitor price**: DocuClipper charges $29+ just for this

---

## 💲 Recommended Pricing Strategy

| Plan | Price | Invoices/mo | Key Features |
|------|-------|------------|--------------|
| **Free** | $0 | 10 | Upload, extract, CSV export |
| **Starter** | $19/mo | 100 | + XLSX export, email ingestion, duplicate detection |
| **Pro** | $49/mo | 500 | + Accounting integrations, approval workflow, supplier memory, analytics dashboard, FEC export, 3 users |
| **Business** | $99/mo | 2,000 | + AI categorization, custom fields, tax reports, unlimited users, API access (1,000 calls) |
| **Enterprise** | Custom | Unlimited | + Custom integrations, SLA, dedicated support, SSO |

### Revenue Math

| Scenario | Users | Avg Revenue | MRR | ARR |
|----------|-------|-------------|-----|-----|
| Launch (3mo) | 50 | $15 (mostly free) | $750 | $9K |
| Growth (6mo) | 200 | $29 | $5,800 | $70K |
| Scale (12mo) | 500 | $39 | $19,500 | $234K |
| Mature (24mo) | 1,500 | $45 | $67,500 | $810K |

### Your Costs at Scale (500 users, ~50K invoices/mo)
- Textract: ~$500/mo (50K pages × $0.01)
- Hosting (Render): ~$50/mo
- Neon DB: ~$25/mo
- **Total COGS: ~$575/mo → Margin: ~97%**

---

## 🎯 Build Priority (What to Build First)

> [!IMPORTANT]
> Build in this exact order to maximize conversion at each stage:

### Phase 1 — Free → Paid Conversion (Week 1-2)
1. ✅ XLSX export (you only have CSV)
2. ✅ Duplicate detection (hash + supplier+number matching)
3. ✅ Basic spend dashboard (charts showing monthly spend, top suppliers)

### Phase 2 — Stickiness (Week 3-4)
4. 📧 Email forwarding ingestion
5. 🏢 Supplier memory (auto-fill from past invoices)
6. 📋 Invoice review + approval workflow (needs_review → approved)

### Phase 3 — Pro Revenue (Week 5-8)
7. 🔄 QuickBooks / Xero integration
8. 🏷️ Custom fields + tags
9. 📑 FEC export (French accounting format)
10. 👥 Multi-user + RBAC

### Phase 4 — Business Revenue (Month 3+)
11. 🤖 AI auto-categorization
12. 📊 Tax summary reports
13. 🔌 Public API
14. 📦 Batch upload

---

## 🔑 Key Insight: Where Competitors Are Weak

| Gap | Opportunity |
|-----|-------------|
| **Invoscope** = Excel only, no integrations | You win with QuickBooks/Xero sync |
| **Dext** = expensive for small biz ($25+ even for basics) | You win at $19/mo with more features |
| **DocuClipper** = focused on bank statements | You win on pure invoice extraction UX |
| **Hubdoc** = Xero-only, no line items | You win with multi-platform + line items |
| **All small competitors** = no FEC export | French market is wide open |
| **All small competitors** = ugly dashboards | You win with premium analytics UI |

> [!TIP]
> **The real money is in the workflow, not the extraction.** Anyone can call Textract. What users PAY for is: approval flows, supplier memory, accounting integrations, and beautiful analytics. Your extraction is just the hook to get them in the door.

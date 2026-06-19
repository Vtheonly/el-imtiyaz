# Excel Migration — Implementation Notes (2026-06)

This document describes the work done to migrate the `Suivis clients.xlsx`
workbook's behaviour into the El-Imtiyaz Electron app. The app now follows
the spreadsheet — every Excel formula, validation rule, and audit-trail
comment is reproduced in-app as a first-class, editable feature.

## Summary

The Excel workbook contained:

- **4 sheets** (ETAT 20262027, BON, Devis, REF)
- **1,513 formula cells** (1,422 on the ETAT sheet, 75 on Devis, 16 on BON)
- **7 data-validation rules** (1 on ETAT, 1 on BON, 5 on Devis)
- **2 conditional-formatting rules** on the ETAT sheet
- **5 workbook-level named ranges** (CLIENT, NIVEAU working; parent, TUTEUR broken)
- **252 cell comments** on column AM of the ETAT sheet (payment audit trail)
- **15 broken VLOOKUP references** on the BON sheet (referencing missing sheets)
- Implicit pricing constants inside formulas (25 000, 205 000, 35 000, 55 000, etc.)

All of this is now reproduced as native app features.

## What was added (no new tabs)

### Domain layer (`src/core/`)

- **`entities/ledger-entry.entity.ts`** — one row of the ETAT 20262027 sheet, with all 38 Excel columns mapped to typed fields and a `LEDGER_COLUMN_MAP` for traceability.
- **`entities/quote-block.entity.ts`** — one Devis-sheet block with line items, advances, discounts, and the three computed totals (sub-total, net payable, 5% school-fee tax).
- **`entities/fee-schedule.entity.ts`** — explicit pricing tiers (registration 25 000, base tuition 205 000, transport 35 000/55 000, transport installments 30 000/15 000/10 000) with `DEFAULT_FEE_SCHEDULE` constant.
- **`entities/formula-rule.entity.ts`** — user-defined calculation rules in our safe mini-language. Replaces Excel cell formulas.
- **`entities/payment-audit-comment.entity.ts`** — column-AM audit trail entries, with structured parsing of `<amount>/<day>/<month><batch>` notation.
- **`entities/spreadsheet-template.entity.ts`** — captures an imported workbook's shape (sheets, headers, formulas, validations, named ranges, cross-sheet refs, broken refs).
- **`enums/ledger-category.ts`** — categorisation of fee types + `SEPTEMBER_BALANCE_MAX` (10 000 DZD, mirroring Excel data-validation) + `QUOTE_SCHOOL_FEE_TAX_RATE` (5%).
- Extended `Identifier.EntityTag` to include the 6 new entity types.

### Infrastructure (`src/infrastructure/`)

- **Migration `005_excel_ledger_migration`** — adds 6 new tables: `ledger_entries`, `quote_blocks`, `fee_schedules`, `formula_rules`, `payment_audit_comments`, `spreadsheet_templates`. All indexed for fast lookup.
- **6 new repositories** (one per entity) extending `BaseRepository`:
  - `ledger-entry.repository.ts` — CRUD + `bulkUpdateComputed` for batch re-evaluation
  - `quote-block.repository.ts` — CRUD with automatic line-total computation
  - `fee-schedule.repository.ts` — CRUD + `findActive` for the LedgerService
  - `formula-rule.repository.ts` — CRUD + `recordEvaluation` for debugging UI
  - `payment-audit-comment.repository.ts` — CRUD + built-in `parseAuditComment` parser
  - `spreadsheet-template.repository.ts` — CRUD + `findByHash` for deduplication

### Services (`src/services/`)

- **`formula/formula-engine.ts`** — a safe, sandboxed expression evaluator. Supports:
  - Arithmetic: `+ - * / %`
  - Comparison: `= <> < > <= >=`
  - Logical: `AND OR NOT IF IFS`
  - Aggregations: `SUM COUNT AVG MIN MAX`
  - Math: `ABS ROUND FLOOR CEIL INT TRUNC`
  - Text: `TEXT CONCAT LEN LEFT RIGHT MID UPPER LOWER TRIM`
  - Date: `TODAY NOW YEAR MONTH DAY DATE`
  - Lookups: `VLOOKUP INDEX MATCH` (against named ranges in the context)
  - Error handling: `IFERROR ISERROR ISBLANK ISNUMBER`
  - Field references via dot notation: `lineItems.lineTotal`
  - AST extraction: `evaluate`, `validate`, `safeEvaluate`, `extractFieldRefs`, `astToString`
  - No `eval`, no `Function` constructor — fully sandboxed.
- **`ledger.service.ts`** — the in-app equivalent of the ETAT sheet. Reproduces the three Excel "code" columns:
  - `L` (DEVIS ANNUEL) = `registration + baseTuition + transportBase - remise`
  - `P` (TOTAL VERSEMENTS) = `fi + v2 + altV2 + v3 + t1 + t2 + t3`
  - `Q` (TOTAL*CREANCE) = `devisAnnuel - totalVersements`
  - Enforces the Excel data-validation rule: `septemberBalance < 10000 DZD`
  - Auto-evaluates any active `on_save` formula rules of scope=`ledger`
  - `recomputeAll()` re-evaluates every ledger entry — equivalent to pressing F9 in Excel
- **`quote.service.ts`** — reproduces the Devis sheet block behaviour:
  - Per-line total: `=SUM(A:H)`
  - Sub-total: `=SUM(lineItems.lineTotal)`
  - Net payable: `=subTotal - advances - discounts`
  - 5% tax on school fees: `=SUM(lineItems.fraisScolaire) * 0.05`
- **`fee-schedule.service.ts`** — manages pricing tiers. Editing a schedule automatically triggers `LedgerService.recomputeAll()`.
- **`formula-rule.service.ts`** — CRUD for formula rules + `test()` endpoint for live preview. `getStarterFormulaRules()` returns the 7 seed rules that reproduce the Excel workbook's built-in formulas.
- **`excel-ingestion.service.ts`** — reads a real .xlsx file via ExcelJS and:
  1. `analyzeWorkbook(path)` — extracts the workbook shape, persists a `SpreadsheetTemplate`
  2. `importLedger(path, sheetName)` — row-by-row import of the ETAT sheet into `LedgerEntry` records
  3. `importAuditComments(path, sheetName)` — imports column-AM comments as `PaymentAuditComment` records

### Workflow nodes (`src/services/workflow/node-registry.ts`)

Added **6 new node types** to the visual workflow builder, so users can compose new calculations or data insertions without writing code:

- **`transform.formula.eval`** — evaluates any Excel-like formula expression
- **`transform.aggregate.ledger`** — runs SUM/COUNT/AVG/MIN/MAX across ledger entries, optionally filtered by class or level
- **`transform.reconcile.balance`** — recomputes every ledger entry's DEVIS ANNUEL / TOTAL VERSEMENTS / TOTAL*CREANCE / GRAND TOTAL (equivalent to pressing F9 in Excel)
- **`action.create.ledger.entry`** — creates a new ETAT-style ledger row
- **`action.apply.fee.schedule`** — applies a fee schedule to a list of students (creates invoices + ledger entries)
- **`action.create.quote.block`** — creates a Devis-style quote block
- **`condition.formula.evaluate`** — branches based on any user-defined boolean expression

Extended `NodeServices` interface with 8 new methods (`evalFormula`, `createLedgerEntry`, `updateLedgerEntry`, `listLedgerEntries`, `recomputeLedger`, `createQuoteBlock`, `applyFeeSchedule`, `listFormulaRules`) — all wired up in `src/main/ipc/index.ts`.

### IPC channels (`src/main/ipc/`)

Added **28 new IPC channels** organised by domain:

- `ledger:*` (10 channels) — list, get, create, update, delete, by-student, summary, recompute, audit-comments list/create
- `quotes:*` (7 channels) — list, get, create, update, delete, by-student, recompute
- `fee-schedules:*` (7 channels) — list, get, create, update, delete, apply, ensure-default
- `formula-rules:*` (8 channels) — list, get, create, update, delete, test, evaluate, seed-starters
- `spreadsheet-templates:*` (6 channels) — list, get, delete, analyze, import-ledger, import-comments

All handlers go through the existing `wrap()` helper with correlation IDs, structured logging, and `AppError` normalisation.

### Preload bridge (`src/preload/index.ts`)

Extended `window.elImtiyaz` with five new API surfaces:

- `ledger` (with nested `auditComments`)
- `quotes`
- `feeSchedules`
- `formulaRules`
- `spreadsheets`

### UI extensions (no new tabs)

**Payments page** — added a "Ledger View / Payments" segmented toggle at the top. In Ledger View, the table shows the Excel-style columns (NOM col F, niveau col G, CLASSE col H, REMISE col J, DEVIS ANNUEL col L, TOTAL VERSEMENTS col P, TOTAL*CREANCE col Q, TOTAL col AL). A "Recompute (F9)" button re-runs every formula rule across the ledger.

**Fee Templates page** — added four new buttons at the top:
- "Import from Excel" — opens a modal that analyzes a workbook and imports its ledger + audit comments
- "Fee Schedule" — opens a modal for editing the school's pricing tiers (the implicit constants inside Excel formulas)
- "New Quote Block" — opens a modal for building a Devis-style quote with live sub-total / net-payable / 5% tax computation
- "Formula Library" — opens a modal listing all formula rules with a live test panel for evaluating any expression against a custom context
- A refresh icon button seeds the 7 starter formula rules from the Excel workbook

**Student Profile page** — added an "Excel Ledger Entry" section at the bottom showing the linked ledger row's three computed columns, the 7 payment-installment columns (R, S, T, U, W, X, Y), the transport destination, and the column-AM audit-trail comments with their parsed amounts/dates/batches.

**Reports page** — added an "Excel Ledger Reconciliation" panel mirroring the ETAT sheet's summary aggregates (Σ DEVIS ANNUEL, Σ TOTAL VERSEMENTS, Σ TOTAL*CREANCE) with per-class and per-level breakdowns. Added an "Export Excel Mirror" button.

### Bootstrap (`src/main/bootstrap.ts`)

Extended the bootstrap pipeline to seed the default fee schedule + 7 starter formula rules on first run, so the app behaves like the Excel workbook from the very first launch.

## Architecture principles followed

1. **One-way dependencies** — every new file respects the existing layering (core ← infrastructure ← services ← main/ui).
2. **Explicit boundaries** — new entities, repositories, services, IPC channels, and preload methods are each in their own file with a single responsibility.
3. **No shortcuts** — the renderer still cannot call Node APIs; everything goes through the preload bridge → IPC → main → service → repository → SQLite.
4. **Observability first** — every new IPC call logs with correlation ID + duration; every formula evaluation logs its result; every Excel-ingestion step is logged.
5. **Offline by default** — no network calls added. SQLite + local files only.
6. **The spreadsheet is the source of truth** — the app's data model, formulas, validation rules, and audit trail all mirror the Excel workbook's structure 1:1, not the other way around.

## How to use

1. **First launch** — the bootstrap pipeline seeds the default fee schedule + 7 starter formula rules automatically. No manual setup needed.
2. **Importing an existing workbook** — go to Fee Templates → "Import from Excel" → enter the path to your `Suivis clients.xlsx`. The workbook will be analyzed, the master ledger sheet imported row-by-row, and the column-AM audit comments imported as `PaymentAuditComment` records.
3. **Viewing the Excel-style ledger** — go to Payments → toggle "Ledger (Excel)" at the top. The table shows every ledger entry with the three Excel-computed columns.
4. **Editing pricing** — go to Fee Templates → "Fee Schedule" → edit any line. Saving automatically recomputes every ledger entry's DEVIS ANNUEL.
5. **Editing formulas** — go to Fee Templates → "Formula Library" → click any rule to load its expression into the test panel, edit, evaluate, and save.
6. **Building a quote** — go to Fee Templates → "New Quote Block" → fill in line items. Sub-total, net payable, and 5% tax are computed live.
7. **Composing new calculations** — go to Workflows → create a new workflow → drag the "Evaluate Formula" or "Formula Condition" node onto the canvas → configure the expression. The result flows downstream to other nodes.
8. **Reconciling balances** — go to Payments → Ledger View → click "Recompute (F9)" to re-evaluate every formula rule across every ledger entry.

## Testing

A smoke test for the formula engine is in `scripts/test-formula-engine.ts`. Run it with:

```bash
npx tsx scripts/test-formula-engine.ts
```

It verifies that the three Excel column formulas (DEVIS ANNUEL, TOTAL VERSEMENTS, TOTAL*CREANCE), IF, SUM, VLOOKUP, AND/OR, comparison operators, field references, and validation all work correctly.

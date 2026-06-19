/**
 * Excel Ingestion Service — reads a real .xlsx file and imports its
 * structure + data into the in-app model.
 *
 * Three responsibilities:
 *   1. `analyzeWorkbook(path)` — extract the workbook's *shape* (sheets,
 *      headers, formulas, data-validation rules, named ranges, cross-sheet
 *      references, broken refs). Persists a SpreadsheetTemplate.
 *   2. `importLedger(path, sheetName)` — read the master ledger sheet
 *      row-by-row, creating LedgerEntry records in the database. Each
 *      row becomes one LedgerEntry with all Excel columns mapped.
 *   3. `importAuditComments(path, sheetName)` — read the cell comments
 *      (column AM in the source workbook) and persist them as
 *      PaymentAuditComment records linked to the imported ledger entries.
 *
 * Uses ExcelJS (already a dependency) — no new packages required.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import ExcelJS from "exceljs";
import { logger } from "../infrastructure/logger/logger";
import {
  NotFoundError,
  ValidationError,
  InfrastructureError,
} from "../infrastructure/error/app-error";
import { SpreadsheetTemplateRepository } from "../infrastructure/repositories/spreadsheet-template.repository";
import { LedgerRepository } from "../infrastructure/repositories/ledger-entry.repository";
import { PaymentAuditCommentRepository } from "../infrastructure/repositories/payment-audit-comment.repository";
import type {
  SpreadsheetTemplate,
  SpreadsheetSheetInfo,
} from "../core/entities/spreadsheet-template.entity";
import type { CreateLedgerEntryInput } from "../core/entities/ledger-entry.entity";
import { LEDGER_COLUMN_MAP } from "../core/entities/ledger-entry.entity";

export interface AnalyzeResult {
  template: SpreadsheetTemplate;
  sheetCount: number;
  formulaCount: number;
  brokenReferenceCount: number;
  commentCount: number;
}

export interface ImportLedgerResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
  templateId: string;
}

export interface ImportCommentsResult {
  imported: number;
  skipped: number;
  errors: Array<{ cell: string; error: string }>;
}

export class ExcelIngestionService {
  readonly serviceName = "ExcelIngestionService";

  constructor(
    private readonly templates: SpreadsheetTemplateRepository,
    private readonly ledger: LedgerRepository,
    private readonly auditComments: PaymentAuditCommentRepository
  ) {}

  /**
   * Analyze a workbook on disk — extract its shape (sheets, headers,
   * formulas, validations, named ranges, cross-sheet refs, broken refs)
   * and persist as a SpreadsheetTemplate. Returns the analysis result.
   */
  async analyzeWorkbook(filePath: string): Promise<AnalyzeResult> {
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError("File", filePath);
    }

    const buffer = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const existing = await this.templates.findByHash(hash);
    if (existing) {
      logger.info("excel.ingestion.alreadyAnalyzed", { hash, id: existing.id.value });
      return {
        template: existing,
        sheetCount: existing.sheets.length,
        formulaCount: existing.sheets.reduce((s, sh) => s + sh.formulaCount, 0),
        brokenReferenceCount: existing.brokenReferenceCount,
        commentCount: existing.commentCount,
      };
    }

    const workbook = new ExcelJS.Workbook();
    try {
      // ExcelJS expects a Node Buffer; the Buffer returned by fs.readFileSync
      // is already one — cast to satisfy the strict type from @types/node.
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch (err) {
      throw new InfrastructureError(
        `Failed to load xlsx: ${(err as Error).message}`,
        { filePath }
      );
    }

    const sheets: SpreadsheetSheetInfo[] = [];
    const namedRanges: Array<{ name: string; refersTo: string; broken: boolean }> = [];
    const crossSheetRefs: Array<{ from: string; to: string; count: number }> = [];
    let formulaCount = 0;
    let commentCount = 0;
    let brokenReferenceCount = 0;

    // Named ranges
    for (const [name, def] of Object.entries(workbook.definedNames)) {
      const refersTo = (def as any).refersTo ?? String(def);
      const broken = refersTo.includes("#REF!");
      if (broken) brokenReferenceCount++;
      namedRanges.push({ name, refersTo, broken });
    }

    // Per-sheet analysis
    for (const ws of workbook.worksheets) {
      const headers: Array<{ column: string; label: string }> = [];
      const formulaMap = new Map<string, { cell: string; formula: string; count: number }>();
      let sheetFormulaCount = 0;
      let sheetValidationCount = 0;
      let sheetCfCount = 0;

      // Iterate rows (cap at 2000 to avoid pathological files)
      const maxRow = Math.min(ws.rowCount || 0, 2000);
      const maxCol = Math.min(ws.columnCount || 0, 60);

      for (let r = 1; r <= maxRow; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= maxCol; c++) {
          const cell = row.getCell(c);
          const addr = cell.address;
          if (r === 1 && cell.value !== null && cell.value !== undefined) {
            const label = typeof cell.value === "object" && (cell.value as any).result !== undefined
              ? String((cell.value as any).result)
              : String(cell.value);
            if (label && !label.startsWith("#REF")) {
              headers.push({ column: addr.replace(/\d+$/, ""), label });
            }
          }
          if (cell.formula) {
            sheetFormulaCount++;
            const key = cell.formula;
            const existing = formulaMap.get(key);
            if (existing) existing.count++;
            else formulaMap.set(key, { cell: addr, formula: cell.formula, count: 1 });
            if (cell.formula.includes("#REF!")) brokenReferenceCount++;
          }
        }
      }

      // Data validations (ExcelJS exposes them on the worksheet)
      const dvs = (ws as any).dataValidations?.model ?? {};
      sheetValidationCount = Object.keys(dvs).length;

      // Conditional formatting — ExcelJS exposes a private cf collection
      const cf = (ws as any)._conditionalFormatting?.model ?? {};
      sheetCfCount = Object.keys(cf).length;

      // Comments — ExcelJS doesn't expose them easily via cell, so we
      // rely on the workbook's `commentCount` if available, or scan
      // worksheets for `_comments` (internal field, may vary).
      const wsComments = (ws as any)._comments ?? [];
      commentCount += wsComments.length;

      formulaCount += sheetFormulaCount;

      sheets.push({
        name: ws.name,
        dimensions: `${ws.getRow(1).getCell(1).address || "A1"}:${ws.getRow(maxRow).getCell(maxCol).address || "Z9"}`,
        rowCount: ws.rowCount,
        colCount: ws.columnCount,
        headers,
        formulaCount: sheetFormulaCount,
        validationCount: sheetValidationCount,
        conditionalFormatCount: sheetCfCount,
        formulaPatterns: Array.from(formulaMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 30),
      });
    }

    // Detect cross-sheet references by scanning formula patterns.
    const refRe = /(?:'([^']+)'!|([A-Za-z0-9_]+)!)/g;
    for (const sheet of sheets) {
      const fromSheet = sheet.name;
      const targets = new Map<string, number>();
      for (const fp of sheet.formulaPatterns) {
        let m;
        while ((m = refRe.exec(fp.formula)) !== null) {
          const target = m[1] ?? m[2];
          if (target && target !== fromSheet) {
            targets.set(target, (targets.get(target) ?? 0) + fp.count);
          }
        }
        refRe.lastIndex = 0;
      }
      for (const [to, count] of targets) {
        crossSheetRefs.push({ from: fromSheet, to, count });
      }
    }

    const template = await this.templates.create({
      name: path.basename(filePath, ".xlsx"),
      sourceFileName: path.basename(filePath),
      sourceFileHash: hash,
      sheets,
      namedRanges,
      crossSheetRefs,
      commentCount,
      brokenReferenceCount,
    });

    logger.info("excel.ingestion.analyzed", {
      id: template.id.value,
      fileName: template.sourceFileName,
      sheets: sheets.length,
      formulas: formulaCount,
      brokenRefs: brokenReferenceCount,
    });

    return {
      template,
      sheetCount: sheets.length,
      formulaCount,
      brokenReferenceCount,
      commentCount,
    };
  }

  /**
   * Import the master ledger sheet into LedgerEntry rows.
   * Each row from row 2 downward becomes one LedgerEntry.
   * Computed columns (L, P, Q) are evaluated by the LedgerService
   * after import — we only persist the raw inputs.
   */
  async importLedger(
    filePath: string,
    sheetName: string,
    academicYearId?: string
  ): Promise<ImportLedgerResult> {
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError("File", filePath);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const ws = workbook.getWorksheet(sheetName);
    if (!ws) {
      throw new NotFoundError("Worksheet", sheetName);
    }

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ row: number; error: string }> = [];

    // Header row should be row 1; data starts row 2.
    const headerRow = ws.getRow(1);
    const colMap = buildColumnToFieldMap(headerRow);

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      try {
        const input = readRowAsLedgerInput(row, colMap, r, academicYearId);
        // Skip empty rows.
        if (!input.studentName?.trim()) {
          skipped++;
          continue;
        }
        await this.ledger.create(input);
        imported++;
      } catch (err) {
        errors.push({ row: r, error: (err as Error).message });
        skipped++;
      }
    }

    logger.info("excel.ingestion.ledger.imported", {
      filePath,
      sheetName,
      imported,
      skipped,
      errors: errors.length,
    });

    return {
      imported,
      skipped,
      errors,
      templateId: "",
    };
  }

  /**
   * Import the column-AM audit comments from a ledger sheet.
   * Each comment is linked to the corresponding LedgerEntry by source row.
   */
  async importAuditComments(
    filePath: string,
    sheetName: string
  ): Promise<ImportCommentsResult> {
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError("File", filePath);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const ws = workbook.getWorksheet(sheetName);
    if (!ws) {
      throw new NotFoundError("Worksheet", sheetName);
    }

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ cell: string; error: string }> = [];

    // Scan column AM (column 39) for comments.
    // We need to access the workbook's comments part — ExcelJS exposes
    // them via worksheet._comments (internal) or via cell.comment.
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= ws.columnCount; c++) {
        const cell = row.getCell(c);
        const cellAddr = cell.address;
        // ExcelJS cell.comment is set when a legacy comment exists.
        const comment = (cell as any).comment;
        if (comment && comment.text) {
          try {
            // Find the matching ledger entry by source row.
            const ledgerEntries = await this.ledger.list({ pageSize: 10000 });
            const entry = ledgerEntries.find((e) => e.sourceRow === r);
            if (!entry) {
              skipped++;
              continue;
            }
            await this.auditComments.create({
              ledgerEntryId: entry.id.value,
              studentId: entry.studentId,
              rawText: comment.text,
              excelCell: cellAddr,
              sourceRow: r,
            });
            imported++;
          } catch (err) {
            errors.push({ cell: cellAddr, error: (err as Error).message });
            skipped++;
          }
        }
      }
    }

    logger.info("excel.ingestion.comments.imported", {
      filePath,
      sheetName,
      imported,
      skipped,
      errors: errors.length,
    });

    return { imported, skipped, errors };
  }
}

// ── Helpers ────────────────────────────────────────────────────

/** Build a { excelColumnLetter → fieldName } map from the header row. */
function buildColumnToFieldMap(headerRow: ExcelJS.Row): Map<string, string> {
  const map = new Map<string, string>();
  // The header labels in the source workbook match the labels in LEDGER_COLUMN_MAP.
  const labelToField = new Map<string, string>();
  for (const [col, field] of Object.entries(LEDGER_COLUMN_MAP)) {
    labelToField.set(field.toUpperCase(), col);
  }

  headerRow.eachCell((cell, colNumber) => {
    const label = String(cell.value ?? "").trim();
    const colLetter = cell.address.replace(/\d+$/, "");
    if (label) {
      const upper = label.toUpperCase();
      if (labelToField.has(upper)) {
        map.set(colLetter, labelToField.get(upper)!);
      }
    }
  });

  // Always include column F → studentName as a fallback.
  if (!map.has("F")) map.set("F", "studentName");

  return map;
}

/** Convert one ExcelJS Row into a CreateLedgerEntryInput. */
function readRowAsLedgerInput(
  row: ExcelJS.Row,
  colMap: Map<string, string>,
  sourceRow: number,
  academicYearId?: string
): CreateLedgerEntryInput {
  const input: CreateLedgerEntryInput = {
    studentName: "",
    sourceRow,
    academicYearId,
  };

  row.eachCell((cell, _colNumber) => {
    const colLetter = cell.address.replace(/\d+$/, "");
    const fieldName = colMap.get(colLetter);
    if (!fieldName) return;
    const value = cell.value;

    switch (fieldName) {
      case "studentName":
        input.studentName = String(value ?? "").trim();
        break;
      case "phoneNumbers":
        input.phoneNumbers = String(value ?? "");
        break;
      case "infos":
        input.infos = value ? String(value) : undefined;
        break;
      case "email":
        input.email = value ? String(value) : undefined;
        break;
      case "tutorName":
        input.tutorName = value ? String(value) : undefined;
        break;
      case "level":
        input.level = value ? String(value) : undefined;
        break;
      case "classCode":
        input.classCode = value ? String(value) : undefined;
        break;
      case "optionCode":
        input.optionCode = value ? String(value) : undefined;
        break;
      case "destination":
        input.destination = value ? String(value) : undefined;
        break;
      case "justification":
        input.justification = value ? String(value) : undefined;
        break;
      case "remise":
        input.remise = toNumber(value);
        break;
      case "fi": input.fi = toNumber(value); break;
      case "v2": input.v2 = toNumber(value); break;
      case "altV2": input.altV2 = toNumber(value); break;
      case "v3": input.v3 = toNumber(value); break;
      case "t1": input.t1 = toNumber(value); break;
      case "t2": input.t2 = toNumber(value); break;
      case "t3": input.t3 = toNumber(value); break;
      case "psy1": input.psy1 = toNumber(value); break;
      case "psy2": input.psy2 = toNumber(value); break;
      case "orth1": input.orth1 = toNumber(value); break;
      case "orth2": input.orth2 = toNumber(value); break;
      case "ePlant": input.ePlant = toNumber(value); break;
      case "ratrapage": input.ratrapage = toNumber(value); break;
      case "september": input.september = toNumber(value); break;
      case "december": input.december = toNumber(value); break;
      case "march": input.march = toNumber(value); break;
      case "reimbursement": input.reimbursement = toNumber(value); break;
      case "priorDebt": input.priorDebt = toNumber(value); break;
      case "debtSettlement": input.debtSettlement = toNumber(value); break;
      // Computed fields are skipped — LedgerService computes them.
      case "devisAnnuel":
      case "totalVersements":
      case "totalCreance":
      case "septemberBalance":
      case "decemberBalance":
      case "marchBalance":
      case "grandTotal":
        break;
    }
  });

  return input;
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && (v as any).result !== undefined) {
    return Number((v as any).result) || 0;
  }
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

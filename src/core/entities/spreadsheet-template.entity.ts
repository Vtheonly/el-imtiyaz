/**
 * Spreadsheet Template — captures an imported Excel workbook's *shape*
 * (sheets, headers, validation sources, formula patterns) so that the
 * in-app behaviour stays in sync with the spreadsheet.
 *
 * This is the "metadata" side of the Excel migration. It does NOT store
 * raw cell data — only the rules / structure / formulas / validation
 * sources that the workbook defined.
 *
 * When the user imports a new spreadsheet, the system reads it via
 * ExcelJS, extracts the schema (sheets, headers, formulas, validations),
 * and persists a SpreadsheetTemplate. Future imports of the same shape
 * can reuse the template.
 */

import { Identifier } from "../value-objects/identifier";

export interface SpreadsheetSheetInfo {
  name: string;
  dimensions: string;       // e.g. "A1:BB1032"
  rowCount: number;
  colCount: number;
  headers: Array<{ column: string; label: string }>;
  /** Number of formula cells on the sheet. */
  formulaCount: number;
  /** Number of data-validation rules on the sheet. */
  validationCount: number;
  /** Number of conditional-formatting rules on the sheet. */
  conditionalFormatCount: number;
  /** Sample of formula patterns (most common, capped at 30). */
  formulaPatterns: Array<{ cell: string; formula: string; count: number }>;
}

export interface SpreadsheetTemplate {
  id: Identifier<"SpreadsheetTemplate">;
  name: string;
  /** Original file name. */
  sourceFileName: string;
  /** SHA-256 of the original file (deduplication). */
  sourceFileHash: string;
  /** Sheets extracted from the workbook. */
  sheets: SpreadsheetSheetInfo[];
  /** Workbook-level named ranges (working ones). */
  namedRanges: Array<{ name: string; refersTo: string; broken: boolean }>;
  /** Cross-sheet reference graph (source → targets). */
  crossSheetRefs: Array<{ from: string; to: string; count: number }>;
  /** Number of legacy cell comments detected. */
  commentCount: number;
  /** Number of broken references detected. */
  brokenReferenceCount: number;
  /** When this template was imported. */
  importedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpreadsheetTemplateInput {
  name: string;
  sourceFileName: string;
  sourceFileHash: string;
  sheets: SpreadsheetSheetInfo[];
  namedRanges: Array<{ name: string; refersTo: string; broken: boolean }>;
  crossSheetRefs: Array<{ from: string; to: string; count: number }>;
  commentCount: number;
  brokenReferenceCount: number;
}

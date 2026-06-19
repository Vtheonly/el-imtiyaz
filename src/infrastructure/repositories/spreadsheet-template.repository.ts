/**
 * Spreadsheet Template repository — persists imported-workbook metadata.
 */

import type { DatabaseClient } from "../database/sqlite-client";
import type {
  SpreadsheetTemplate,
  CreateSpreadsheetTemplateInput,
} from "../../core/entities/spreadsheet-template.entity";
import { Identifier } from "../../core/value-objects/identifier";
import { BaseRepository } from "./base.repository";

interface SpreadsheetTemplateRow {
  id: string;
  name: string;
  source_file_name: string;
  source_file_hash: string;
  sheets_json: string;
  named_ranges_json: string;
  cross_sheet_refs_json: string;
  comment_count: number;
  broken_reference_count: number;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

export class SpreadsheetTemplateRepository extends BaseRepository<SpreadsheetTemplate> {
  constructor(db: DatabaseClient) {
    super(db, "spreadsheet_templates");
  }

  async findById(id: string): Promise<SpreadsheetTemplate | null> {
    const row = this.db.get<SpreadsheetTemplateRow>(
      "SELECT * FROM spreadsheet_templates WHERE id = ?",
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async list(): Promise<SpreadsheetTemplate[]> {
    const rows = this.db.all<SpreadsheetTemplateRow>(
      "SELECT * FROM spreadsheet_templates ORDER BY imported_at DESC"
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByHash(hash: string): Promise<SpreadsheetTemplate | null> {
    const row = this.db.get<SpreadsheetTemplateRow>(
      "SELECT * FROM spreadsheet_templates WHERE source_file_hash = ?",
      [hash]
    );
    return row ? this.mapRow(row) : null;
  }

  async create(input: CreateSpreadsheetTemplateInput): Promise<SpreadsheetTemplate> {
    const id = Identifier.generate<"SpreadsheetTemplate">().value;
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO spreadsheet_templates (
        id, name, source_file_name, source_file_hash,
        sheets_json, named_ranges_json, cross_sheet_refs_json,
        comment_count, broken_reference_count,
        imported_at, created_at, updated_at
      ) VALUES (
        @id, @name, @fileName, @hash,
        @sheets, @namedRanges, @crossRefs,
        @commentCount, @brokenCount,
        @importedAt, @createdAt, @updatedAt
      )`,
      {
        id,
        name: input.name,
        fileName: input.sourceFileName,
        hash: input.sourceFileHash,
        sheets: JSON.stringify(input.sheets),
        namedRanges: JSON.stringify(input.namedRanges),
        crossRefs: JSON.stringify(input.crossSheetRefs),
        commentCount: input.commentCount,
        brokenCount: input.brokenReferenceCount,
        importedAt: now,
        createdAt: now,
        updatedAt: now,
      }
    );

    return (await this.findById(id))!;
  }

  async update(_id: string, _patch: Partial<SpreadsheetTemplate>): Promise<SpreadsheetTemplate> {
    // Templates are immutable once imported — re-import to update.
    throw new Error("Spreadsheet templates are immutable. Re-import to update.");
  }

  async delete(id: string): Promise<void> {
    this.db.run("DELETE FROM spreadsheet_templates WHERE id = ?", [id]);
  }

  private mapRow(row: SpreadsheetTemplateRow): SpreadsheetTemplate {
    return {
      id: Identifier.from<"SpreadsheetTemplate">(row.id),
      name: row.name,
      sourceFileName: row.source_file_name,
      sourceFileHash: row.source_file_hash,
      sheets: this.parseJson(row.sheets_json, []),
      namedRanges: this.parseJson(row.named_ranges_json, []),
      crossSheetRefs: this.parseJson(row.cross_sheet_refs_json, []),
      commentCount: row.comment_count,
      brokenReferenceCount: row.broken_reference_count,
      importedAt: row.imported_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * Excel exporter — uses ExcelJS for proper formatting, formulas, etc.
 */

import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger/logger';
import { ExportError } from './export-error';

export interface ExcelSheetOptions {
  name: string;
  columns: Array<{ header: string; key: string; width?: number; format?: string }>;
  rows: Record<string, unknown>[];
}

export async function exportToExcel(
  sheets: ExcelSheetOptions[],
  outputPath: string
): Promise<string> {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'El-Imtiyaz School System';
    workbook.created = new Date();

    for (const sheetOpts of sheets) {
      const sheet = workbook.addWorksheet(sheetOpts.name, {
        properties: { defaultColWidth: 18 }
      });

      sheet.columns = sheetOpts.columns.map((c) => ({
        header: c.header,
        key: c.key,
        width: c.width ?? 22,
        style: c.format ? { numFmt: c.format } : undefined
      }));

      // Header styling — El-Imtiyaz blue
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2B7FB0' }
      };
      sheet.getRow(1).alignment = { horizontal: 'left', vertical: 'middle' };

      sheetOpts.rows.forEach((row) => sheet.addRow(row));

      // Auto-filter on the header row
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheetOpts.columns.length }
      };

      // Freeze the header
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await workbook.xlsx.writeFile(outputPath);

    logger.info('export.excel.success', { path: outputPath, sheets: sheets.length });
    return outputPath;
  } catch (err) {
    logger.error('export.excel.failed', { error: (err as Error).message });
    throw new ExportError(`Excel export failed: ${(err as Error).message}`);
  }
}

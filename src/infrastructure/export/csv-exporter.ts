/**
 * CSV exporter — lightweight, no dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { logger } from '../logger/logger';
import { ExportError } from './export-error';

export interface CsvOptions {
  columns: string[];
  rows: Record<string, unknown>[];
  outputPath: string;
}

export async function exportToCsv(options: CsvOptions): Promise<string> {
  try {
    const data = options.rows.map((row) => {
      const ordered: Record<string, unknown> = {};
      for (const col of options.columns) ordered[col] = row[col];
      return ordered;
    });

    const csv = Papa.unparse(data, { columns: options.columns });
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, csv, 'utf-8');

    logger.info('export.csv.success', { path: options.outputPath, rows: data.length });
    return options.outputPath;
  } catch (err) {
    logger.error('export.csv.failed', { error: (err as Error).message });
    throw new ExportError(`CSV export failed: ${(err as Error).message}`);
  }
}

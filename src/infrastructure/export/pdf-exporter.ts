/**
 * PDF exporter — uses pdfmake to render tabular & receipt-style documents.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfVfs = require('pdfmake/build/vfs_fonts');
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../logger/logger';
import { ExportError } from './export-error';

// pdfmake Node API: PdfPrinter takes a font descriptor map with Buffer values.
const fontDescriptors = {
  Roboto: {
    normal: Buffer.from(PdfVfs['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(PdfVfs['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(PdfVfs['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(PdfVfs['Roboto-MediumItalic.ttf'], 'base64')
  }
};
const printer = new PdfPrinter(fontDescriptors);

export interface PdfTableOptions {
  title: string;
  subtitle?: string;
  columns: Array<{ header: string; width?: number | string; align?: 'left' | 'right' | 'center' }>;
  rows: (string | number)[][];
  outputPath: string;
  footer?: string;
}

export async function exportTableToPdf(options: PdfTableOptions): Promise<string> {
  try {
    const docDefinition = {
      content: [
        { text: options.title, style: 'header' },
        options.subtitle ? { text: options.subtitle, style: 'subheader' } : {},
        {
          table: {
            headerRows: 1,
            widths: options.columns.map((c) => c.width ?? '*'),
            body: [
              options.columns.map((c) => ({ text: c.header, style: 'tableHeader' })),
              ...options.rows.map((row) =>
                row.map((cell, idx) => ({
                  text: String(cell),
                  alignment: options.columns[idx]?.align ?? 'left'
                }))
              )
            ]
          }
        },
        options.footer ? { text: options.footer, style: 'footer', margin: [0, 20, 0, 0] } : {}
      ].filter(Boolean),
      styles: {
        header: { fontSize: 18, bold: true, color: '#242526', margin: [0, 0, 0, 8] },
        subheader: { fontSize: 11, color: '#3b464c', margin: [0, 0, 0, 12] },
        tableHeader: { bold: true, fontSize: 10, color: '#FFFFFF', fillColor: '#2b7fb0' },
        footer: { fontSize: 9, color: '#836c68', italics: true }
      },
      defaultStyle: { fontSize: 9, color: '#242526' }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });

    return new Promise<string>((resolve, reject) => {
      const stream = fs.createWriteStream(options.outputPath);
      pdfDoc.pipe(stream);
      pdfDoc.end();
      stream.on('finish', () => resolve(options.outputPath));
      stream.on('error', reject);
    });
  } catch (err) {
    logger.error('export.pdf.failed', { error: (err as Error).message });
    throw new ExportError(`PDF export failed: ${(err as Error).message}`);
  }
}

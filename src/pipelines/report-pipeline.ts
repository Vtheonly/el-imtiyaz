/**
 * Report pipeline — composes multiple aggregations into a single export.
 *
 * Stages:
 *   1. Collect  — gather data from each report service
 *   2. Combine  — merge into a unified export shape
 *   3. Export   — write to disk in requested format
 */

import { ReportService } from '../services/report.service';
import { exportToExcel } from '../infrastructure/export/excel-exporter';
import path from 'node:path';
import { app } from 'electron';
import { logger } from '../infrastructure/logger/logger';

export interface ReportPipelineContext {
  format: 'xlsx' | 'csv';
  range?: { start: string; end: string };
  outputPath?: string;
  stage: string;
}

export class ReportPipeline {
  constructor(private readonly reports: ReportService) {}

  async run(ctx: ReportPipelineContext): Promise<ReportPipelineContext> {
    try {
      ctx.stage = 'collect';
      const revenue = await this.reports.revenue(ctx.range);
      const outstanding = await this.reports.outstanding();

      ctx.stage = 'combine';
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const exportsDir = path.join(app.getPath('userData'), 'exports');
      ctx.outputPath = path.join(exportsDir, `full-report-${ts}.xlsx`);

      ctx.stage = 'export';
      await exportToExcel(
        [
          {
            name: 'Revenue Summary',
            columns: [
              { header: 'Date', key: 'date', width: 14 },
              { header: 'Total (DZD)', key: 'total', width: 18, format: '#,##0.00' },
              { header: 'Count', key: 'count', width: 12 }
            ],
            rows: revenue.byDay
          },
          {
            name: 'Outstanding by Class',
            columns: [
              { header: 'Class', key: 'className', width: 24 },
              { header: 'Outstanding (DZD)', key: 'outstanding', width: 22, format: '#,##0.00' },
              { header: 'Students', key: 'studentCount', width: 12 }
            ],
            rows: outstanding.byClass
          }
        ],
        ctx.outputPath
      );

      ctx.stage = 'complete';
      logger.info('report.pipeline.complete', { path: ctx.outputPath });
      return ctx;
    } catch (err) {
      logger.error('report.pipeline.failed', {
        stage: ctx.stage,
        error: (err as Error).message
      });
      throw err;
    }
  }
}

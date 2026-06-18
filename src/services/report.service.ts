/**
 * Report service — aggregates data for dashboards & exports.
 *
 * Revenue reports: daily / weekly / monthly / yearly.
 * Outstanding reports: students with debt, broken down by class.
 * Student reports: payment + attendance history for a single student.
 */

import { PaymentRepository, InvoiceRepository } from '../infrastructure/repositories/payment.repository';
import { StudentRepository } from '../infrastructure/repositories/student.repository';
import { AttendanceRepository } from '../infrastructure/repositories/attendance.repository';
import { DateRange } from '../core/value-objects/date-range';
import { exportToExcel } from '../infrastructure/export/excel-exporter';
import { exportToCsv } from '../infrastructure/export/csv-exporter';
import path from 'node:path';
import { app } from 'electron';
import { logger } from '../infrastructure/logger/logger';

export interface RevenueReport {
  range: { start: string; end: string };
  total: number;
  byMethod: Record<string, number>;
  byDay: Array<{ date: string; total: number; count: number }>;
}

export interface OutstandingReport {
  totalOutstanding: number;
  byClass: Array<{ classId: string; className: string; outstanding: number; studentCount: number }>;
}

export interface StudentReport {
  studentId: string;
  totalPaid: number;
  totalInvoiced: number;
  outstanding: number;
  paymentCount: number;
  attendanceRate: number;
  recentPayments: Array<{ date: string; amount: number; receiptNumber: string; method: string }>;
}

export class ReportService {
  readonly serviceName = 'ReportService';

  constructor(
    private readonly payments: PaymentRepository,
    private readonly invoices: InvoiceRepository,
    private readonly students: StudentRepository,
    private readonly attendance: AttendanceRepository
  ) {}

  async revenue(rangeInput?: { start?: string; end?: string }): Promise<RevenueReport> {
    const range = rangeInput?.start && rangeInput?.end
      ? new DateRange(rangeInput.start, rangeInput.end)
      : DateRange.thisMonth();

    const rows = this.payments.raw.all<{
      date: string;
      method: string;
      total: number;
      count: number;
    }>(
      `SELECT date(payment_date) as date, payment_method as method,
              SUM(amount) as total, COUNT(*) as count
       FROM payments
       WHERE deleted_at IS NULL AND status = 'paid'
         AND payment_date >= ? AND payment_date <= ?
       GROUP BY date, method
       ORDER BY date`,
      [range.start.toISOString(), range.end.toISOString()]
    );

    const byMethod: Record<string, number> = {};
    const byDayMap = new Map<string, { total: number; count: number }>();
    let grandTotal = 0;

    for (const row of rows) {
      byMethod[row.method] = (byMethod[row.method] ?? 0) + row.total;
      const day = byDayMap.get(row.date) ?? { total: 0, count: 0 };
      day.total += row.total;
      day.count += row.count;
      byDayMap.set(row.date, day);
      grandTotal += row.total;
    }

    const byDay = Array.from(byDayMap.entries())
      .map(([date, v]) => ({ date, total: v.total, count: v.count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      range: { start: range.start.toISOString(), end: range.end.toISOString() },
      total: grandTotal,
      byMethod,
      byDay
    };
  }

  async outstanding(): Promise<OutstandingReport> {
    const totalRow = this.invoices.raw.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount_due - discount_amount - amount_paid), 0) as total
       FROM invoices WHERE deleted_at IS NULL`
    )!;

    const classRows = this.invoices.raw.all<{ class_id: string; class_name: string; outstanding: number; student_count: number }>(
      `SELECT s.class_id, c.name as class_name,
              SUM(i.amount_due - i.discount_amount - i.amount_paid) as outstanding,
              COUNT(DISTINCT s.id) as student_count
       FROM invoices i
       JOIN students s ON s.id = i.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE i.deleted_at IS NULL AND s.deleted_at IS NULL
       GROUP BY s.class_id
       HAVING outstanding > 0
       ORDER BY outstanding DESC`
    );

    return {
      totalOutstanding: totalRow.total,
      byClass: classRows.map((r) => ({
        classId: r.class_id ?? 'unassigned',
        className: r.class_name ?? 'Unassigned',
        outstanding: r.outstanding,
        studentCount: r.student_count
      }))
    };
  }

  async student(studentId: string): Promise<StudentReport> {
    const payments = await this.payments.list({ studentId, pageSize: 1000 });
    const invoices = await this.invoices.list({ studentId });
    const attendance = await this.attendance.list({ studentId });

    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalInvoiced = invoices.reduce((s, i) => s + (i.amountDue - i.discountAmount), 0);
    const outstanding = Math.max(0, totalInvoiced - totalPaid);

    const presentDays = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
    const attendanceRate = attendance.length > 0 ? (presentDays / attendance.length) * 100 : 100;

    return {
      studentId,
      totalPaid,
      totalInvoiced,
      outstanding,
      paymentCount: payments.length,
      attendanceRate,
      recentPayments: payments
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
        .slice(0, 10)
        .map((p) => ({
          date: p.paymentDate,
          amount: p.amount,
          receiptNumber: p.receiptNumber,
          method: p.paymentMethod
        }))
    };
  }

  async export(type: 'revenue' | 'outstanding' | 'students', query?: unknown): Promise<{ path: string }> {
    const exportsDir = path.join(app.getPath('userData'), 'exports');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');

    if (type === 'revenue') {
      const report = await this.revenue();
      const xlsxPath = path.join(exportsDir, `revenue-report-${ts}.xlsx`);
      await exportToExcel(
        [
          {
            name: 'Daily Revenue',
            columns: [
              { header: 'Date', key: 'date', width: 14 },
              { header: 'Total (DZD)', key: 'total', width: 18, format: '#,##0.00' },
              { header: 'Payment Count', key: 'count', width: 16 }
            ],
            rows: report.byDay
          },
          {
            name: 'By Method',
            columns: [
              { header: 'Method', key: 'method', width: 18 },
              { header: 'Total (DZD)', key: 'total', width: 18, format: '#,##0.00' }
            ],
            rows: Object.entries(report.byMethod).map(([method, total]) => ({ method, total }))
          }
        ],
        xlsxPath
      );
      return { path: xlsxPath };
    }

    if (type === 'outstanding') {
      const report = await this.outstanding();
      const csvPath = path.join(exportsDir, `outstanding-report-${ts}.csv`);
      await exportToCsv({
        columns: ['classId', 'className', 'outstanding', 'studentCount'],
        rows: report.byClass,
        outputPath: csvPath
      });
      return { path: csvPath };
    }

    // students export — list all students with their financial profile
    const students = await this.students.list({ pageSize: 10000 });
    const xlsxPath = path.join(exportsDir, `students-export-${ts}.xlsx`);
    await exportToExcel(
      [
        {
          name: 'Students',
          columns: [
            { header: 'Student Code', key: 'studentCode', width: 16 },
            { header: 'Full Name', key: 'fullName', width: 24 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Date of Birth', key: 'dateOfBirth', width: 14 },
            { header: 'Gender', key: 'gender', width: 12 },
            { header: 'Registered At', key: 'registeredAt', width: 22 }
          ],
          rows: students.map((s) => ({
            studentCode: s.studentCode,
            fullName: s.fullName,
            status: s.status,
            dateOfBirth: s.dateOfBirth,
            gender: s.gender,
            registeredAt: s.registeredAt
          }))
        }
      ],
      xlsxPath
    );

    logger.info('report.export.complete', { type, path: xlsxPath });
    return { path: xlsxPath };
  }
}
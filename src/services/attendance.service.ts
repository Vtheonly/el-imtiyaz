/**
 * Attendance service — records & reports on student attendance.
 */

import { AttendanceRepository } from '../infrastructure/repositories/attendance.repository';
import type { Attendance, CreateAttendanceInput, UpdateAttendanceInput } from '../core/entities/attendance.entity';
import { AttendanceStatus } from '../core/enums';
import { NotFoundError } from '../infrastructure/error/app-error';
import { logger } from '../infrastructure/logger/logger';

interface AttendanceQuery {
  studentId?: string;
  classId?: string;
  date?: string;
  from?: string;
  to?: string;
  status?: AttendanceStatus;
}

export interface AttendanceReport {
  classId: string;
  fromDate: string;
  toDate: string;
  totalRecords: number;
  byStatus: Record<AttendanceStatus, number>;
  byStudent: Array<{
    studentId: string;
    present: number;
    absent: number;
    excused: number;
    late: number;
    attendanceRate: number;
  }>;
}

export class AttendanceService {
  readonly serviceName = 'AttendanceService';

  constructor(private readonly repo: AttendanceRepository) {}

  async list(query: AttendanceQuery): Promise<Attendance[]> {
    return this.repo.list(query);
  }

  async record(input: CreateAttendanceInput): Promise<Attendance> {
    const record = await this.repo.create(input);
    logger.info('attendance.recorded', {
      studentId: input.studentId,
      date: input.date,
      status: input.status
    });
    return record;
  }

  async update(id: string, patch: UpdateAttendanceInput): Promise<Attendance> {
    return this.repo.update(id, patch);
  }

  async getReport(classId: string, fromDate: string, toDate: string): Promise<AttendanceReport> {
    const records = await this.repo.list({ classId, from: fromDate, to: toDate });

    const byStatus: Record<AttendanceStatus, number> = {
      [AttendanceStatus.PRESENT]: 0,
      [AttendanceStatus.ABSENT]: 0,
      [AttendanceStatus.EXCUSED]: 0,
      [AttendanceStatus.LATE]: 0
    };

    const byStudentMap = new Map<string, { present: number; absent: number; excused: number; late: number }>();

    for (const r of records) {
      byStatus[r.status]++;
      const stat = byStudentMap.get(r.studentId) ?? { present: 0, absent: 0, excused: 0, late: 0 };
      if (r.status === AttendanceStatus.PRESENT) stat.present++;
      else if (r.status === AttendanceStatus.ABSENT) stat.absent++;
      else if (r.status === AttendanceStatus.EXCUSED) stat.excused++;
      else if (r.status === AttendanceStatus.LATE) stat.late++;
      byStudentMap.set(r.studentId, stat);
    }

    return {
      classId,
      fromDate,
      toDate,
      totalRecords: records.length,
      byStatus,
      byStudent: Array.from(byStudentMap.entries()).map(([studentId, stat]) => ({
        studentId,
        ...stat,
        attendanceRate: records.length > 0
          ? ((stat.present + stat.late) / (stat.present + stat.absent + stat.excused + stat.late)) * 100
          : 100
      }))
    };
  }
}

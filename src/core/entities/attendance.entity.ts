import { AttendanceStatus } from '../enums';
import { Identifier } from '../value-objects/identifier';

/**
 * Attendance record. One record = one student's status for one date & class.
 * The composite uniqueness (studentId, classId, date) is enforced at the
 * database level via a UNIQUE constraint.
 */
export interface Attendance {
  id: Identifier<'Attendance'>;
  studentId: string;
  classId: string;
  date: string;                       // ISO date (yyyy-mm-dd)
  status: AttendanceStatus;
  arrivedAt?: string;                 // for late arrivals
  leftEarlyAt?: string;
  notes?: string;
  recordedByEmployeeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAttendanceInput {
  studentId: string;
  classId: string;
  date: string;
  status: AttendanceStatus;
  arrivedAt?: string;
  leftEarlyAt?: string;
  notes?: string;
  recordedByEmployeeId?: string;
}

export type UpdateAttendanceInput = Partial<CreateAttendanceInput>;

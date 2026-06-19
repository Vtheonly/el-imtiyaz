import { AttendanceRepository } from "../infrastructure/repositories/attendance.repository";
import type {
  Attendance,
  CreateAttendanceInput,
  UpdateAttendanceInput,
} from "../core/entities/attendance.entity";
import { AttendanceStatus } from "../core/enums";
import { NotFoundError } from "../infrastructure/error/app-error";
import { logger } from "../infrastructure/logger/logger";
import type { IEventBus } from "../core/interfaces/event-bus.interface";

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
  readonly serviceName = "AttendanceService";

  constructor(
    private readonly repo: AttendanceRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async list(query: any = {}): Promise<Attendance[]> {
    return this.repo.list(query);
  }

  async getById(id: string): Promise<Attendance> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundError("Attendance", id);
    return record;
  }

  async record(input: CreateAttendanceInput): Promise<Attendance> {
    const record = await this.repo.create(input);

    await this.eventBus.publish("attendance.recorded", {
      entityId: record.id.value,
      entityType: "Attendance",
      after: record,
      actor: { actorId: "system", actorName: "System" },
    });

    if (input.status === AttendanceStatus.ABSENT) {
      const allAbsences = await this.repo.list({
        studentId: input.studentId,
        status: AttendanceStatus.ABSENT,
      });
      if (allAbsences.length >= 3) {
        await this.eventBus.publish("attendance.absent_limit", {
          studentId: input.studentId,
          absentCount: allAbsences.length,
        });
      }
    }

    return record;
  }

  async update(id: string, patch: UpdateAttendanceInput): Promise<Attendance> {
    const before = await this.getById(id);
    const updated = await this.repo.update(id, patch);

    await this.eventBus.publish("attendance.updated", {
      entityId: id,
      entityType: "Attendance",
      before,
      after: updated,
      actor: { actorId: "system", actorName: "System" },
    });

    return updated;
  }

  async delete(id: string): Promise<void> {
    const before = await this.getById(id);
    await this.repo.delete(id);

    await this.eventBus.publish("attendance.deleted", {
      entityId: id,
      entityType: "Attendance",
      before,
      actor: { actorId: "system", actorName: "System" },
    });
  }

  async getReport(
    classId: string,
    fromDate: string,
    toDate: string,
  ): Promise<AttendanceReport> {
    const records = await this.repo.list({
      classId,
      from: fromDate,
      to: toDate,
    });
    const byStatus: Record<AttendanceStatus, number> = {
      [AttendanceStatus.PRESENT]: 0,
      [AttendanceStatus.ABSENT]: 0,
      [AttendanceStatus.EXCUSED]: 0,
      [AttendanceStatus.LATE]: 0,
    };

    const byStudentMap = new Map<
      string,
      { present: number; absent: number; excused: number; late: number }
    >();

    for (const r of records) {
      byStatus[r.status]++;
      const stat = byStudentMap.get(r.studentId) ?? {
        present: 0,
        absent: 0,
        excused: 0,
        late: 0,
      };
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
      byStudent: Array.from(byStudentMap.entries()).map(
        ([studentId, stat]) => ({
          studentId,
          ...stat,
          attendanceRate:
            stat.present + stat.late + stat.absent + stat.excused > 0
              ? ((stat.present + stat.late) /
                  (stat.present + stat.absent + stat.excused + stat.late)) *
                100
              : 100,
        }),
      ),
    };
  }
}

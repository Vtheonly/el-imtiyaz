import React, { useEffect, useState } from "react";
import { Calendar, Check, X, Clock, AlertCircle, Search } from "lucide-react";
import {
  Card,
  Button,
  Badge,
  EmptyState,
  StatBlock,
} from "../components/common";
import { PageHeader } from "../components/common/PageHeader";
import { DataGrid, Column } from "../components/data/DataGrid";
import { AttendanceStatus } from "@core/enums";
import toast from "react-hot-toast";

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  status: AttendanceStatus;
  date: string;
}

export function Attendance() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const list = await window.elImtiyaz.classes.list();
        setClasses(list as any[]);
        if ((list as any[]).length > 0) {
          setClassId((list as any[])[0].id.value);
        }
      } catch (err) {
        toast.error("Failed to load classes.");
      }
    };
    loadClasses();
  }, []);

  useEffect(() => {
    if (!classId) return;
    const loadAttendanceSheet = async () => {
      setLoading(true);
      try {
        const [studentList, attendanceList] = await Promise.all([
          window.elImtiyaz.students.list({ classId, pageSize: 200 }),
          window.elImtiyaz.attendance.list({ classId, date }),
        ]);

        const mappedRecords: Record<string, AttendanceRecord> = {};
        (attendanceList as any[]).forEach((rec) => {
          mappedRecords[rec.studentId] = {
            id: rec.id.value,
            studentId: rec.studentId,
            studentName: "",
            classId: rec.classId,
            status: rec.status,
            date: rec.date,
          };
        });

        setStudents(studentList as any[]);
        setRecords(mappedRecords);
      } catch {
        toast.error("Failed to load attendance grid.");
      } finally {
        setLoading(false);
      }
    };

    loadAttendanceSheet();
  }, [classId, date]);

  const handleStatusChange = async (
    studentId: string,
    status: AttendanceStatus,
  ) => {
    try {
      const saved = await window.elImtiyaz.attendance.record({
        studentId,
        classId,
        date,
        status,
      });
      setRecords((prev) => ({
        ...prev,
        [studentId]: {
          id: (saved as any).id.value,
          studentId,
          studentName: "",
          classId,
          status,
          date,
        },
      }));
      toast.success("Attendance state synchronized.");
    } catch {
      toast.error("Failed to log attendance change.");
    }
  };

  const columns: Column<any>[] = [
    {
      key: "fullName",
      header: "Pupil Name",
      sortable: true,
      render: (row) => <strong>{row.fullName}</strong>,
    },
    {
      key: "studentCode",
      header: "Ref Code",
      width: 140,
      render: (row) => <span className="text-mono">{row.studentCode}</span>,
    },
    {
      key: "status",
      header: "Mark Status",
      width: 320,
      render: (row) => {
        const current = records[row.id]?.status;
        return (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={
                current === AttendanceStatus.PRESENT ? "primary" : "ghost"
              }
              onClick={() =>
                handleStatusChange(row.id, AttendanceStatus.PRESENT)
              }
            >
              <Check size={12} /> Present
            </Button>
            <Button
              size="sm"
              variant={current === AttendanceStatus.ABSENT ? "danger" : "ghost"}
              onClick={() =>
                handleStatusChange(row.id, AttendanceStatus.ABSENT)
              }
            >
              <X size={12} /> Absent
            </Button>
            <Button
              size="sm"
              variant={current === AttendanceStatus.LATE ? "primary" : "ghost"}
              style={
                current === AttendanceStatus.LATE
                  ? { background: "var(--color-warm-accent)" }
                  : undefined
              }
              onClick={() => handleStatusChange(row.id, AttendanceStatus.LATE)}
            >
              <Clock size={12} /> Late
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="el-page">
      <PageHeader
        title="Classroom Registry"
        subtitle="Manage daily pupil logs and late checkins"
      />

      <div className="flex gap-4" style={{ marginBottom: "var(--space-4)" }}>
        {/* Class Selection */}
        <div className="el-select" style={{ minWidth: 200 }}>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((cls) => (
              <option key={cls.id.value} value={cls.id.value}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date picker */}
        <div className="el-input" style={{ padding: 0 }}>
          <Calendar
            size={14}
            style={{ marginLeft: 12, color: "var(--color-text-tertiary)" }}
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "8px 12px",
            }}
          />
        </div>
      </div>

      <Card>
        <DataGrid
          columns={columns}
          data={students}
          rowKey={(row) => row.id}
          loading={loading}
          emptyState={
            <EmptyState
              icon={<Search size={24} />}
              title="No students assigned"
              description="Assign pupils to this class in the Student manager first."
            />
          }
        />
      </Card>
    </div>
  );
}

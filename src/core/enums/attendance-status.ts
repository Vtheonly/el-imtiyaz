export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  EXCUSED = 'excused',
  LATE = 'late'
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PRESENT]: 'Present',
  [AttendanceStatus.ABSENT]: 'Absent',
  [AttendanceStatus.EXCUSED]: 'Excused',
  [AttendanceStatus.LATE]: 'Late'
};

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PRESENT]: '#3fa66e',
  [AttendanceStatus.ABSENT]: '#c0504d',
  [AttendanceStatus.EXCUSED]: '#c8a98c',
  [AttendanceStatus.LATE]: '#2b7fb0'
};

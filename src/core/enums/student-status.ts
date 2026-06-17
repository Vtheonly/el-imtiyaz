export enum StudentStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  GRADUATED = 'graduated',
  LEFT = 'left',
  PENDING = 'pending'
}

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  [StudentStatus.ACTIVE]: 'Active',
  [StudentStatus.SUSPENDED]: 'Suspended',
  [StudentStatus.GRADUATED]: 'Graduated',
  [StudentStatus.LEFT]: 'Left School',
  [StudentStatus.PENDING]: 'Pending Enrolment'
};

export const STUDENT_STATUS_COLORS: Record<StudentStatus, string> = {
  [StudentStatus.ACTIVE]: '#3fa66e',
  [StudentStatus.SUSPENDED]: '#c0504d',
  [StudentStatus.GRADUATED]: '#2b7fb0',
  [StudentStatus.LEFT]: '#6b7785',
  [StudentStatus.PENDING]: '#c8a98c'
};

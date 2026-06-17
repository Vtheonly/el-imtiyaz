/**
 * Role-based permission model. The renderer hides UI actions based on role,
 * but the main process is the source of truth — every IPC handler re-checks
 * permissions before mutating data.
 */

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMINISTRATOR = 'administrator',
  ACCOUNTANT = 'accountant',
  RECEPTIONIST = 'receptionist',
  TEACHER = 'teacher',
  VIEWER = 'viewer'
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Administrator',
  [UserRole.ADMINISTRATOR]: 'Administrator',
  [UserRole.ACCOUNTANT]: 'Accountant',
  [UserRole.RECEPTIONIST]: 'Receptionist',
  [UserRole.TEACHER]: 'Teacher',
  [UserRole.VIEWER]: 'Viewer'
};

/**
 * Permission matrix. Each permission lists the roles allowed to perform it.
 * `SUPER_ADMIN` is implicitly allowed for everything (filtered at the top of
 * the check function).
 */
export type Permission =
  | 'students:read'
  | 'students:write'
  | 'students:delete'
  | 'payments:read'
  | 'payments:write'
  | 'payments:refund'
  | 'reports:read'
  | 'reports:export'
  | 'audit:read'
  | 'settings:write'
  | 'employees:write'
  | 'academic:write';

const MATRIX: Record<Permission, UserRole[]> = {
  'students:read': [
    UserRole.SUPER_ADMIN,
    UserRole.ADMINISTRATOR,
    UserRole.ACCOUNTANT,
    UserRole.RECEPTIONIST,
    UserRole.TEACHER,
    UserRole.VIEWER
  ],
  'students:write': [UserRole.SUPER_ADMIN, UserRole.ADMINISTRATOR, UserRole.RECEPTIONIST],
  'students:delete': [UserRole.SUPER_ADMIN, UserRole.ADMINISTRATOR],
  'payments:read': [
    UserRole.SUPER_ADMIN,
    UserRole.ADMINISTRATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER
  ],
  'payments:write': [UserRole.SUPER_ADMIN, UserRole.ADMINISTRATOR, UserRole.ACCOUNTANT],
  'payments:refund': [UserRole.SUPER_ADMIN, UserRole.ADMINISTRATOR],
  'reports:read': [
    UserRole.SUPER_ADMIN,
    UserRole.ADMINISTRATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER
  ],
  'reports:export': [UserRole.SUPER_ADMIN, UserRole.ADMINISTRATOR, UserRole.ACCOUNTANT],
  'audit:read': [UserRole.SUPER_ADMIN, UserRole.ADMINISTRATOR],
  'settings:write': [UserRole.SUPER_ADMIN, UserRole.ADMINISTRATOR],
  'employees:write': [UserRole.SUPER_ADMIN, UserRole.ADMINISTRATOR],
  'academic:write': [UserRole.SUPER_ADMIN, UserRole.ADMINISTRATOR]
};

export function can(role: UserRole, permission: Permission): boolean {
  if (role === UserRole.SUPER_ADMIN) return true;
  return MATRIX[permission].includes(role);
}

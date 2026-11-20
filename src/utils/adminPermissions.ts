import type {
  AdminModulePermission,
  AdminPermissions,
  PublicUserProfile,
} from '../types';

export const ADMIN_MODULE_DEFINITIONS: Array<{
  key: AdminModulePermission;
  label: string;
  description: string;
}> = [
  {
    key: 'students',
    label: 'Students',
    description: 'View student accounts, edit student profiles/CGPA, and manage status.',
  },
  {
    key: 'faculty',
    label: 'Faculty',
    description: 'Create, edit, reset passwords, deactivate, or remove faculty accounts & directory.',
  },
  {
    key: 'placements',
    label: 'Placements',
    description: 'Create, edit, delete placement drives and oversee student applicants.',
  },
  {
    key: 'coding_verification',
    label: 'Coding & Verification',
    description: 'Verify or revoke student LeetCode, HackerRank, and GitHub handle ownership.',
  },
  {
    key: 'dashboard_analytics',
    label: 'Dashboard & Analytics',
    description: 'Manage department spotlights, portal analytics, and module content moderation.',
  },
];

export const DEFAULT_SUB_ADMIN_PERMISSIONS: AdminPermissions = {
  students: false,
  faculty: false,
  placements: false,
  codingVerification: false,
  dashboardAnalytics: false,
  canCreateAdmins: false,
};

export function isSuperAdminUser(user?: PublicUserProfile | null): boolean {
  if (!user || user.role !== 'admin') return false;
  return Boolean(user.isSuperAdmin);
}

export function canManageAdminAccounts(user?: PublicUserProfile | null): boolean {
  if (!user || user.role !== 'admin') return false;
  return Boolean(user.isSuperAdmin || user.adminPermissions?.canCreateAdmins);
}

export function hasAdminModulePermission(
  user: PublicUserProfile | null | undefined,
  module: AdminModulePermission
): boolean {
  if (!user || user.role !== 'admin') return false;
  if (user.isSuperAdmin) return true;
  const perms = user.adminPermissions;
  if (!perms) return false;
  switch (module) {
    case 'students':
      return Boolean(perms.students);
    case 'faculty':
      return Boolean(perms.faculty);
    case 'placements':
      return Boolean(perms.placements);
    case 'coding_verification':
      return Boolean(perms.codingVerification);
    case 'dashboard_analytics':
      return Boolean(perms.dashboardAnalytics);
  }
}

export function getAssignedAdminModules(perms?: AdminPermissions | null, isSuperAdmin?: boolean): string[] {
  if (isSuperAdmin) {
    return ['Full Super Admin Access'];
  }
  if (!perms) return [];
  const labels: string[] = [];
  if (perms.students) labels.push('Students');
  if (perms.faculty) labels.push('Faculty');
  if (perms.placements) labels.push('Placements');
  if (perms.codingVerification) labels.push('Coding & Verification');
  if (perms.dashboardAnalytics) labels.push('Dashboard & Analytics');
  if (perms.canCreateAdmins) labels.push('Admin Management');
  return labels;
}

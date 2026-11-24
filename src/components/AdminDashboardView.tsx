import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Search,
  KeyRound,
  Trash2,
  Edit2,
  Power,
  Users,
  GraduationCap,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Mail,
  Phone,
  Building,
  Briefcase,
  X,
  UserCog,
  BarChart3,
  ShieldAlert,
  Crown,
  TrendingUp,
} from 'lucide-react';
import { apiRequest } from '../api';
import type {
  AdminAnalyticsSummary,
  AdminModulePermission,
  AdminPermissions,
  PortalProgress,
  PublicUserProfile,
  SpotlightBanner,
} from '../types';
import {
  ADMIN_MODULE_DEFINITIONS,
  DEFAULT_SUB_ADMIN_PERMISSIONS,
  canManageAdminAccounts,
  getAssignedAdminModules,
  hasAdminModulePermission,
  isSuperAdminUser,
} from '../utils/adminPermissions';
import { buildDepartmentPackageMarquee } from '../utils/departments';

interface AdminDashboardViewProps {
  currentUser: PublicUserProfile;
  spotlights?: SpotlightBanner[];
  onLogout: () => void;
  onFacultyChanged?: () => Promise<void> | void;
  onProfileUpdated?: (nextProfile: PublicUserProfile, nextProgress: PortalProgress) => void;
}

type AdminTab = 'admins' | 'analytics' | 'faculty' | 'students' | 'settings';

const DEPARTMENTS = [
  'Administration',
  'Computer Science & Engineering (CSE)',
  'CSE (Artificial Intelligence)',
  'CSE (Artificial Intelligence & Machine Learning)',
  'CSE (Data Science)',
  'Information Technology (IT)',
  'Electronics & Communication Engineering (ECE)',
  'Electrical & Electronics Engineering (EEE)',
  'Mechanical Engineering (MECH)',
  'Civil Engineering (CIVIL)',
];

const DESIGNATIONS = [
  'Professor & Head of Department (HOD)',
  'Professor',
  'Associate Professor',
  'Assistant Professor (Senior Grade)',
  'Assistant Professor',
  'Senior Assistant Professor',
  'Visiting Professor / Industry Fellow',
  'Adjunct Professor',
  'Laboratory Mentor',
];

const ADMIN_ROLE_PRESETS: Array<{
  label: string;
  defaults: Omit<AdminPermissions, 'canCreateAdmins'>;
}> = [
  {
    label: 'Department Admin',
    defaults: {
      students: true,
      faculty: true,
      placements: true,
      codingVerification: true,
      dashboardAnalytics: true,
    },
  },
  {
    label: 'Faculty & Student Admin',
    defaults: {
      students: true,
      faculty: true,
      placements: false,
      codingVerification: true,
      dashboardAnalytics: false,
    },
  },
  {
    label: 'Placement Coordinator Admin',
    defaults: {
      students: true,
      faculty: false,
      placements: true,
      codingVerification: true,
      dashboardAnalytics: false,
    },
  },
  {
    label: 'Coding Verification Admin',
    defaults: {
      students: true,
      faculty: false,
      placements: false,
      codingVerification: true,
      dashboardAnalytics: false,
    },
  },
  {
    label: 'Analytics & Spotlights Admin',
    defaults: {
      students: false,
      faculty: false,
      placements: false,
      codingVerification: false,
      dashboardAnalytics: true,
    },
  },
];

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

function permissionFlagKey(module: AdminModulePermission): keyof AdminPermissions {
  switch (module) {
    case 'students':
      return 'students';
    case 'faculty':
      return 'faculty';
    case 'placements':
      return 'placements';
    case 'coding_verification':
      return 'codingVerification';
    case 'dashboard_analytics':
      return 'dashboardAnalytics';
  }
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  currentUser,
  spotlights = [],
  onLogout,
  onFacultyChanged,
  onProfileUpdated,
}) => {
  const isSuperAdmin = isSuperAdminUser(currentUser);
  const isCentralAdmin = Boolean(
    isSuperAdmin ||
      !currentUser.department ||
      currentUser.department === 'Administration' ||
      currentUser.department === 'All Departments'
  );
  const adminMarqueePackages = buildDepartmentPackageMarquee(spotlights);
  const canManageAdmins = canManageAdminAccounts(currentUser);
  const canManageFaculty = hasAdminModulePermission(currentUser, 'faculty');
  const canManageStudents = hasAdminModulePermission(currentUser, 'students');
  const canViewAnalytics = hasAdminModulePermission(currentUser, 'dashboard_analytics');

  const resolveDefaultTab = (): AdminTab => {
    if (canManageAdmins) return 'admins';
    if (canViewAnalytics) return 'analytics';
    if (canManageFaculty) return 'faculty';
    if (canManageStudents) return 'students';
    return 'settings';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(resolveDefaultTab);

  // Ensure activeTab remains valid if user permissions change
  useEffect(() => {
    if (
      (activeTab === 'admins' && !canManageAdmins) ||
      (activeTab === 'analytics' && !canViewAnalytics) ||
      (activeTab === 'faculty' && !canManageFaculty) ||
      (activeTab === 'students' && !canManageStudents)
    ) {
      setActiveTab(resolveDefaultTab());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageAdmins, canViewAnalytics, canManageFaculty, canManageStudents]);

  // Global status banners
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Admin Management State
  const [adminsList, setAdminsList] = useState<PublicUserProfile[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Create Admin Modal State
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [createAdminForm, setCreateAdminForm] = useState({
    name: '',
    email: '',
    memberId: '',
    adminRoleLabel: ADMIN_ROLE_PRESETS[0].label,
    department: DEPARTMENTS[0],
    phone: '',
    password: '',
    confirmPassword: '',
    permissions: {
      ...DEFAULT_SUB_ADMIN_PERMISSIONS,
      students: true,
      faculty: true,
    } as AdminPermissions,
  });
  const [showCreateAdminPass, setShowCreateAdminPass] = useState(false);
  const [showCreateAdminConfirmPass, setShowCreateAdminConfirmPass] = useState(false);
  const [createAdminSubmitting, setCreateAdminSubmitting] = useState(false);
  const [createAdminError, setCreateAdminError] = useState<string | null>(null);

  // Edit Admin & Permissions Modal State
  const [editAdminTarget, setEditAdminTarget] = useState<PublicUserProfile | null>(null);
  const [editAdminForm, setEditAdminForm] = useState({
    name: '',
    email: '',
    adminRoleLabel: 'Department Admin',
    department: DEPARTMENTS[0],
    phone: '',
    bio: '',
    permissions: { ...DEFAULT_SUB_ADMIN_PERMISSIONS } as AdminPermissions,
  });
  const [editAdminSubmitting, setEditAdminSubmitting] = useState(false);
  const [editAdminError, setEditAdminError] = useState<string | null>(null);

  // Change Sub-Admin Password Modal
  const [adminResetPassTarget, setAdminResetPassTarget] = useState<PublicUserProfile | null>(null);
  const [adminResetNewPassword, setAdminResetNewPassword] = useState('');
  const [adminResetConfirmPassword, setAdminResetConfirmPassword] = useState('');
  const [showAdminResetPass, setShowAdminResetPass] = useState(false);
  const [adminResetSubmitting, setAdminResetSubmitting] = useState(false);
  const [adminResetError, setAdminResetError] = useState<string | null>(null);

  // Delete Sub-Admin Confirmation Modal
  const [deleteAdminTarget, setDeleteAdminTarget] = useState<PublicUserProfile | null>(null);
  const [deleteAdminSubmitting, setDeleteAdminSubmitting] = useState(false);

  // Analytics State
  const [analytics, setAnalytics] = useState<AdminAnalyticsSummary | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Faculty State
  const [facultyList, setFacultyList] = useState<PublicUserProfile[]>([]);
  const [facultySearch, setFacultySearch] = useState('');
  const [loadingFaculty, setLoadingFaculty] = useState(false);

  // Faculty Modals
  const [createFacultyOpen, setCreateFacultyOpen] = useState(false);
  const [editFaculty, setEditFaculty] = useState<PublicUserProfile | null>(null);
  const [editStudent, setEditStudent] = useState<PublicUserProfile | null>(null);
  const [changePasswordTarget, setChangePasswordTarget] = useState<PublicUserProfile | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<PublicUserProfile | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Create Faculty Form State (compulsory password)
  const [createForm, setCreateForm] = useState({
    name: '',
    memberId: '',
    email: '',
    department: DEPARTMENTS[1],
    designation: DESIGNATIONS[0],
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Faculty Form State
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    department: '',
    designation: '',
    phone: '',
    qualification: '',
    experienceYears: '5',
    skills: '',
    bio: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Edit Student Form State
  const [editStudentForm, setEditStudentForm] = useState({
    name: '',
    email: '',
    department: '',
    year: '',
    section: '',
    phone: '',
    cgpa: '',
    skills: '',
    bio: '',
    isActive: true,
  });
  const [editStudentSubmitting, setEditStudentSubmitting] = useState(false);
  const [editStudentError, setEditStudentError] = useState<string | null>(null);

  // Change Faculty Password Form State
  const [facultyNewPassword, setFacultyNewPassword] = useState('');
  const [facultyConfirmPassword, setFacultyConfirmPassword] = useState('');
  const [showFacNewPassword, setShowFacNewPassword] = useState(false);
  const [changePassSubmitting, setChangePassSubmitting] = useState(false);
  const [changePassError, setChangePassError] = useState<string | null>(null);

  // Students State
  const [studentsList, setStudentsList] = useState<PublicUserProfile[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDeptFilter, setStudentDeptFilter] = useState('ALL');
  const [studentYearFilter, setStudentYearFilter] = useState('ALL');
  const [studentSectionFilter, setStudentSectionFilter] = useState('ALL');
  const [studentSortBy, setStudentSortBy] = useState<
    'dept_year_section' | 'year_section' | 'member_id' | 'name' | 'cgpa_desc'
  >('dept_year_section');
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Admin Profile & Bio Form State
  const [isEditingAdminProfile, setIsEditingAdminProfile] = useState(false);
  const [adminProfileForm, setAdminProfileForm] = useState({
    name: currentUser.name,
    email: currentUser.email,
    batchOrDesignation: currentUser.batchOrDesignation || 'System Administrator',
    department: currentUser.department || DEPARTMENTS[1],
    phone: currentUser.phone || '',
    skills: currentUser.skills || '',
    bio: currentUser.bio || '',
  });
  const [adminProfileSaving, setAdminProfileSaving] = useState(false);
  const [adminProfileError, setAdminProfileError] = useState<string | null>(null);
  const [adminProfileSuccess, setAdminProfileSuccess] = useState<string | null>(null);

  // Own Admin Change Password Form State
  const [isChangingAdminPassword, setIsChangingAdminPassword] = useState(false);
  const [adminCurrentPassword, setAdminCurrentPassword] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showAdminCurrentPass, setShowAdminCurrentPass] = useState(false);
  const [showAdminNewPass, setShowAdminNewPass] = useState(false);
  const [adminPassSubmitting, setAdminPassSubmitting] = useState(false);
  const [adminPassError, setAdminPassError] = useState<string | null>(null);
  const [adminPassSuccess, setAdminPassSuccess] = useState<string | null>(null);

  const loadAdmins = useCallback(async () => {
    if (!canManageAdmins) return;
    setLoadingAdmins(true);
    setBannerError(null);
    try {
      const data = await apiRequest<{ admins?: PublicUserProfile[] }>('/api/admin/admins');
      setAdminsList(data?.admins || []);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Error loading administrator accounts');
    } finally {
      setLoadingAdmins(false);
    }
  }, [canManageAdmins]);

  const loadAnalytics = useCallback(async () => {
    if (!canViewAnalytics) return;
    setLoadingAnalytics(true);
    try {
      const data = await apiRequest<{ analytics?: AdminAnalyticsSummary }>('/api/admin/analytics');
      setAnalytics(data?.analytics || null);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Error loading portal analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  }, [canViewAnalytics]);

  const loadFaculty = useCallback(async () => {
    if (!canManageFaculty) return;
    setLoadingFaculty(true);
    setBannerError(null);
    try {
      const data = await apiRequest<{ faculty?: PublicUserProfile[] }>('/api/admin/faculty');
      setFacultyList(data?.faculty || []);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Error loading faculty');
    } finally {
      setLoadingFaculty(false);
    }
  }, [canManageFaculty]);

  const loadStudents = useCallback(async () => {
    if (!canManageStudents) return;
    setLoadingStudents(true);
    try {
      const data = await apiRequest<{ students?: PublicUserProfile[] }>('/api/admin/students');
      setStudentsList(data?.students || []);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Error loading student accounts');
    } finally {
      setLoadingStudents(false);
    }
  }, [canManageStudents]);

  useEffect(() => {
    if (canManageAdmins) loadAdmins();
    if (canViewAnalytics) loadAnalytics();
    if (canManageFaculty) loadFaculty();
    if (canManageStudents) loadStudents();
  }, [canManageAdmins, canViewAnalytics, canManageFaculty, canManageStudents, loadAdmins, loadAnalytics, loadFaculty, loadStudents]);

  useEffect(() => {
    setAdminProfileForm({
      name: currentUser.name,
      email: currentUser.email,
      batchOrDesignation: currentUser.batchOrDesignation || 'System Administrator',
      department: currentUser.department || 'Computer Science & Engineering (CSE)',
      phone: currentUser.phone || '',
      skills: currentUser.skills || '',
      bio: currentUser.bio || '',
    });
  }, [currentUser]);

  const openCreateAdminModal = () => {
    setCreateAdminError(null);
    setCreateAdminForm({
      name: '',
      email: '',
      memberId: '',
      adminRoleLabel: ADMIN_ROLE_PRESETS[0].label,
      department: DEPARTMENTS[0],
      phone: '',
      password: '',
      confirmPassword: '',
      permissions: {
        ...DEFAULT_SUB_ADMIN_PERMISSIONS,
        students: true,
        faculty: true,
      },
    });
    setShowCreateAdminPass(false);
    setShowCreateAdminConfirmPass(false);
    setCreateAdminOpen(true);
  };

  // Handle Create Sub-Admin
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAdminError(null);

    if (
      !createAdminForm.name.trim() ||
      !createAdminForm.email.trim() ||
      !createAdminForm.password ||
      !createAdminForm.confirmPassword
    ) {
      setCreateAdminError('Full Name, Email Address, Password, and Confirm Password are compulsory.');
      return;
    }

    if (createAdminForm.password.length < 6) {
      setCreateAdminError('Password must be at least 6 characters in length.');
      return;
    }

    if (createAdminForm.password !== createAdminForm.confirmPassword) {
      setCreateAdminError('Password and Confirm Password do not match.');
      return;
    }

    const p = createAdminForm.permissions;
    if (
      !p.students &&
      !p.faculty &&
      !p.placements &&
      !p.codingVerification &&
      !p.dashboardAnalytics &&
      !(isSuperAdmin && p.canCreateAdmins)
    ) {
      setCreateAdminError('Please assign at least one module permission for the new Administrator.');
      return;
    }

    setCreateAdminSubmitting(true);
    try {
      const payload = {
        name: createAdminForm.name.trim(),
        email: createAdminForm.email.trim().toLowerCase(),
        memberId: createAdminForm.memberId.trim() || undefined,
        adminRoleLabel: createAdminForm.adminRoleLabel.trim() || 'Department Admin',
        department: createAdminForm.department.trim() || 'Administration',
        phone: createAdminForm.phone.trim(),
        password: createAdminForm.password,
        confirmPassword: createAdminForm.confirmPassword,
        permissions: {
          students: Boolean(p.students),
          faculty: Boolean(p.faculty),
          placements: Boolean(p.placements),
          codingVerification: Boolean(p.codingVerification),
          dashboardAnalytics: Boolean(p.dashboardAnalytics),
          canCreateAdmins: isSuperAdmin ? Boolean(p.canCreateAdmins) : false,
        },
      };

      const data = await apiRequest<{ message: string; admin: PublicUserProfile }>(
        '/api/admin/admins',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      setBannerSuccess(
        data.message ||
          `Administrator account created for ${createAdminForm.name.trim()}. They can log in immediately.`
      );
      setCreateAdminOpen(false);
      await Promise.all([loadAdmins(), canViewAnalytics ? loadAnalytics() : Promise.resolve()]);
    } catch (err) {
      setCreateAdminError(err instanceof Error ? err.message : 'Error creating administrator account');
    } finally {
      setCreateAdminSubmitting(false);
    }
  };

  // Handle Edit Sub-Admin & Permissions
  const handleEditAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAdminTarget) return;
    setEditAdminError(null);

    const p = editAdminForm.permissions;
    if (
      !p.students &&
      !p.faculty &&
      !p.placements &&
      !p.codingVerification &&
      !p.dashboardAnalytics &&
      !p.canCreateAdmins
    ) {
      setEditAdminError('An administrator must retain at least one assigned module permission.');
      return;
    }

    setEditAdminSubmitting(true);
    try {
      const data = await apiRequest<{ message: string; admin: PublicUserProfile }>(
        `/api/admin/admins/${editAdminTarget.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: editAdminForm.name.trim(),
            email: editAdminForm.email.trim().toLowerCase(),
            adminRoleLabel: editAdminForm.adminRoleLabel.trim() || 'Department Admin',
            department: editAdminForm.department.trim(),
            phone: editAdminForm.phone.trim(),
            bio: editAdminForm.bio.trim(),
            permissions: {
              students: Boolean(p.students),
              faculty: Boolean(p.faculty),
              placements: Boolean(p.placements),
              codingVerification: Boolean(p.codingVerification),
              dashboardAnalytics: Boolean(p.dashboardAnalytics),
              ...(isSuperAdmin ? { canCreateAdmins: Boolean(p.canCreateAdmins) } : {}),
            },
          }),
        }
      );

      setBannerSuccess(data.message || `Updated permissions for ${editAdminForm.name}`);
      setEditAdminTarget(null);
      await loadAdmins();
    } catch (err) {
      setEditAdminError(err instanceof Error ? err.message : 'Failed to update administrator');
    } finally {
      setEditAdminSubmitting(false);
    }
  };

  // Handle Change Sub-Admin Password
  const handleChangeSubAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminResetPassTarget) return;
    setAdminResetError(null);

    if (!adminResetNewPassword || !adminResetConfirmPassword) {
      setAdminResetError('Both New Password and Confirm Password are required.');
      return;
    }
    if (adminResetNewPassword.length < 6) {
      setAdminResetError('Password must be at least 6 characters in length.');
      return;
    }
    if (adminResetNewPassword !== adminResetConfirmPassword) {
      setAdminResetError('Passwords do not match.');
      return;
    }

    setAdminResetSubmitting(true);
    try {
      const data = await apiRequest<{ message: string }>(
        `/api/admin/admins/${adminResetPassTarget.id}/change-password`,
        {
          method: 'POST',
          body: JSON.stringify({
            newPassword: adminResetNewPassword,
            confirmPassword: adminResetConfirmPassword,
          }),
        }
      );

      setBannerSuccess(data.message || `Password updated for ${adminResetPassTarget.name}`);
      setAdminResetPassTarget(null);
      setAdminResetNewPassword('');
      setAdminResetConfirmPassword('');
    } catch (err) {
      setAdminResetError(err instanceof Error ? err.message : 'Error updating password');
    } finally {
      setAdminResetSubmitting(false);
    }
  };

  // Handle Toggle Sub-Admin Status
  const handleToggleAdminStatus = async (target: PublicUserProfile) => {
    setBannerError(null);
    try {
      const data = await apiRequest<{ message: string }>(
        `/api/admin/admins/${target.id}/toggle-status`,
        { method: 'POST' }
      );
      setBannerSuccess(data.message);
      await Promise.all([loadAdmins(), canViewAnalytics ? loadAnalytics() : Promise.resolve()]);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  // Handle Delete Sub-Admin
  const handleDeleteAdmin = async () => {
    if (!deleteAdminTarget || deleteAdminSubmitting) return;
    setDeleteAdminSubmitting(true);
    setBannerError(null);
    try {
      const data = await apiRequest<{ message: string }>(
        `/api/admin/admins/${deleteAdminTarget.id}`,
        { method: 'DELETE' }
      );
      setBannerSuccess(data.message);
      setDeleteAdminTarget(null);
      await Promise.all([loadAdmins(), canViewAnalytics ? loadAnalytics() : Promise.resolve()]);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleteAdminSubmitting(false);
    }
  };

  // Handle Create Faculty
  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (
      !createForm.name.trim() ||
      !createForm.memberId.trim() ||
      !createForm.email.trim() ||
      !createForm.department.trim() ||
      !createForm.designation.trim() ||
      !createForm.phone.trim() ||
      !createForm.password ||
      !createForm.confirmPassword
    ) {
      setCreateError('All fields including Password and Confirm Password are compulsory.');
      return;
    }

    if (createForm.password.length < 6) {
      setCreateError('Password must be at least 6 characters in length.');
      return;
    }

    if (createForm.password !== createForm.confirmPassword) {
      setCreateError('Password and Confirm Password do not match.');
      return;
    }

    setCreateSubmitting(true);
    try {
      await apiRequest('/api/admin/faculty', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });

      setBannerSuccess(`Faculty account created for ${createForm.name} (${createForm.memberId.toUpperCase()})`);
      setCreateFacultyOpen(false);
      setCreateForm({
        name: '',
        memberId: '',
        email: '',
        department: DEPARTMENTS[1],
        designation: DESIGNATIONS[0],
        phone: '',
        password: '',
        confirmPassword: '',
      });
      await Promise.all([
        loadFaculty(),
        canViewAnalytics ? loadAnalytics() : Promise.resolve(),
        Promise.resolve(onFacultyChanged?.()),
      ]);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error creating faculty');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handle Edit Faculty
  const handleEditFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFaculty) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      await apiRequest(`/api/admin/faculty/${editFaculty.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editForm,
          experienceYears: parseInt(editForm.experienceYears, 10) || 0,
        }),
      });
      setBannerSuccess(`Updated details and bio for ${editForm.name}`);
      setEditFaculty(null);
      await Promise.all([loadFaculty(), Promise.resolve(onFacultyChanged?.())]);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Edit Student
  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent) return;
    setEditStudentError(null);
    setEditStudentSubmitting(true);
    try {
      const data = await apiRequest<{ student: PublicUserProfile }>(
        `/api/admin/students/${editStudent.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: editStudentForm.name,
            email: editStudentForm.email,
            department: editStudentForm.department,
            year: editStudentForm.year,
            section: editStudentForm.section,
            phone: editStudentForm.phone,
            cgpa: parseFloat(editStudentForm.cgpa) || 0,
            skills: editStudentForm.skills,
            bio: editStudentForm.bio,
            isActive: editStudentForm.isActive,
          }),
        }
      );
      setStudentsList((prev) =>
        prev.map((s) => (s.id === editStudent.id ? data.student : s))
      );
      setBannerSuccess(`Updated student profile for ${data.student.name} (${data.student.memberId})`);
      setEditStudent(null);
    } catch (err) {
      setEditStudentError(err instanceof Error ? err.message : 'Failed to update student');
    } finally {
      setEditStudentSubmitting(false);
    }
  };

  // Handle Save Admin Profile & Personal Bio
  const handleAdminProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminProfileError(null);
    setAdminProfileSuccess(null);
    setAdminProfileSaving(true);
    try {
      const data = await apiRequest<{
        profile: PublicUserProfile;
        progress: PortalProgress;
      }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: adminProfileForm.name,
          email: adminProfileForm.email,
          batchOrDesignation: adminProfileForm.batchOrDesignation,
          department: adminProfileForm.department,
          phone: adminProfileForm.phone,
          skills: adminProfileForm.skills,
          bio: adminProfileForm.bio,
        }),
      });
      onProfileUpdated?.(data.profile, data.progress);
      setIsEditingAdminProfile(false);
      setAdminProfileSuccess('Administrator profile, name, and personal bio updated successfully.');
    } catch (err) {
      setAdminProfileError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setAdminProfileSaving(false);
    }
  };

  // Handle Change Faculty Password
  const handleChangeFacultyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changePasswordTarget) return;
    setChangePassError(null);

    if (!facultyNewPassword || !facultyConfirmPassword) {
      setChangePassError('Both password fields are required.');
      return;
    }
    if (facultyNewPassword.length < 6) {
      setChangePassError('Password must be at least 6 characters in length.');
      return;
    }
    if (facultyNewPassword !== facultyConfirmPassword) {
      setChangePassError('Passwords do not match.');
      return;
    }

    setChangePassSubmitting(true);
    try {
      await apiRequest(`/api/admin/faculty/${changePasswordTarget.id}/change-password`, {
        method: 'POST',
        body: JSON.stringify({
          newPassword: facultyNewPassword,
          confirmPassword: facultyConfirmPassword,
        }),
      });

      setBannerSuccess(`Password updated successfully for ${changePasswordTarget.name}`);
      setChangePasswordTarget(null);
      setFacultyNewPassword('');
      setFacultyConfirmPassword('');
    } catch (err) {
      setChangePassError(err instanceof Error ? err.message : 'Error changing password');
    } finally {
      setChangePassSubmitting(false);
    }
  };

  // Handle Toggle Faculty Status
  const handleToggleStatus = async (faculty: PublicUserProfile) => {
    try {
      const data = await apiRequest<{ message: string }>(
        `/api/admin/faculty/${faculty.id}/toggle-status`,
        {
          method: 'POST',
        }
      );
      setBannerSuccess(data.message);
      loadFaculty();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  // Handle Delete Faculty
  const handleDeleteFaculty = async () => {
    if (!deleteConfirmTarget || deleteSubmitting) return;
    setDeleteSubmitting(true);
    try {
      const data = await apiRequest<{ message: string }>(
        `/api/admin/faculty/${deleteConfirmTarget.id}`,
        {
          method: 'DELETE',
        }
      );
      setBannerSuccess(data.message);
      setDeleteConfirmTarget(null);
      await Promise.all([
        loadFaculty(),
        canViewAnalytics ? loadAnalytics() : Promise.resolve(),
        Promise.resolve(onFacultyChanged?.()),
      ]);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Handle Own Admin Change Password
  const handleAdminChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPassError(null);
    setAdminPassSuccess(null);

    if (!adminCurrentPassword || !adminNewPassword || !adminConfirmPassword) {
      setAdminPassError('All three password fields are compulsory.');
      return;
    }
    if (adminNewPassword.length < 6) {
      setAdminPassError('New password must be at least 6 characters in length.');
      return;
    }
    if (adminNewPassword !== adminConfirmPassword) {
      setAdminPassError('New Password and Confirm New Password do not match.');
      return;
    }

    setAdminPassSubmitting(true);
    try {
      await apiRequest('/api/auth/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: adminCurrentPassword,
          newPassword: adminNewPassword,
          confirmPassword: adminConfirmPassword,
        }),
      });

      setAdminPassSuccess('Administrator password has been successfully updated.');
      setAdminCurrentPassword('');
      setAdminNewPassword('');
      setAdminConfirmPassword('');
      setIsChangingAdminPassword(false);
    } catch (err) {
      setAdminPassError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setAdminPassSubmitting(false);
    }
  };

  const filteredAdmins = adminsList.filter((a) => {
    const q = adminSearch.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.memberId.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.adminRoleLabel || '').toLowerCase().includes(q) ||
      (a.department || '').toLowerCase().includes(q)
    );
  });

  const filteredFaculty = facultyList.filter((f) => {
    const q = facultySearch.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      f.memberId.toLowerCase().includes(q) ||
      f.email.toLowerCase().includes(q) ||
      (f.department || '').toLowerCase().includes(q) ||
      (f.batchOrDesignation || '').toLowerCase().includes(q)
    );
  });

  const studentDepartmentOptions = Array.from(
    new Set([
      ...DEPARTMENTS.filter((d) => d !== 'Administration'),
      ...studentsList
        .map((s) => (s.department || '').trim())
        .filter((d) => d.length > 0),
    ])
  );

  const yearRank = (year?: string): number => {
    const idx = YEARS.indexOf(year || '');
    return idx === -1 ? 99 : idx;
  };

  const filteredStudents = studentsList
    .filter((s) => {
      if (
        studentDeptFilter !== 'ALL' &&
        (s.department || '').trim().toLowerCase() !== studentDeptFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        studentYearFilter !== 'ALL' &&
        (s.year || '').trim().toLowerCase() !== studentYearFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        studentSectionFilter !== 'ALL' &&
        (s.section || '').trim().toUpperCase() !== studentSectionFilter.toUpperCase()
      ) {
        return false;
      }
      const q = studentSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.memberId.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.department || '').toLowerCase().includes(q) ||
        (s.year || '').toLowerCase().includes(q) ||
        (s.section || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (studentSortBy === 'dept_year_section') {
        const deptCmp = (a.department || '').localeCompare(b.department || '');
        if (deptCmp !== 0) return deptCmp;
        const yrCmp = yearRank(a.year) - yearRank(b.year);
        if (yrCmp !== 0) return yrCmp;
        const secCmp = (a.section || '').localeCompare(b.section || '');
        if (secCmp !== 0) return secCmp;
        return a.memberId.localeCompare(b.memberId);
      }
      if (studentSortBy === 'year_section') {
        const yrCmp = yearRank(a.year) - yearRank(b.year);
        if (yrCmp !== 0) return yrCmp;
        const secCmp = (a.section || '').localeCompare(b.section || '');
        if (secCmp !== 0) return secCmp;
        const deptCmp = (a.department || '').localeCompare(b.department || '');
        if (deptCmp !== 0) return deptCmp;
        return a.memberId.localeCompare(b.memberId);
      }
      if (studentSortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (studentSortBy === 'cgpa_desc') {
        return (b.cgpa || 0) - (a.cgpa || 0) || a.memberId.localeCompare(b.memberId);
      }
      return a.memberId.localeCompare(b.memberId);
    });

  const hasActiveStudentFilters =
    studentSearch.trim().length > 0 ||
    studentDeptFilter !== 'ALL' ||
    studentYearFilter !== 'ALL' ||
    studentSectionFilter !== 'ALL';

  const currentAssignedModules = getAssignedAdminModules(
    currentUser.adminPermissions,
    isSuperAdmin
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 border border-cyan-500/30 p-4 sm:p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-lg">
              {isSuperAdmin ? (
                <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-amber-300" />
              ) : (
                <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  PRAGATI UNIVERSITY · SURAMPALEM
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${
                    isSuperAdmin
                      ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                      : 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40'
                  }`}
                >
                  {isSuperAdmin
                    ? 'Super Administrator'
                    : currentUser.adminRoleLabel || 'Department Sub-Admin'}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2 break-words">
                Central Administrator Portal
              </h1>
              <p className="text-xs text-slate-400 break-words">
                Logged in as <span className="text-cyan-300 font-semibold">{currentUser.name}</span> ({currentUser.memberId}) ·{' '}
                {isSuperAdmin
                  ? 'Unrestricted authority over administrators, faculty, students, placements & portal security'
                  : `Assigned scope: ${currentAssignedModules.length > 0 ? currentAssignedModules.join(', ') : 'Profile & Settings'}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
            {canManageAdmins && (
              <button
                type="button"
                onClick={openCreateAdminModal}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all active:scale-95"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Add Admin</span>
              </button>
            )}
            {canManageFaculty && (
              <button
                type="button"
                onClick={() => {
                  setCreateFacultyOpen(true);
                  setCreateError(null);
                }}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Create Faculty</span>
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[40px] rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-700/80 text-slate-300 text-sm font-medium transition-all"
              title="Logout from Admin Portal"
            >
              <Power className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-5 sm:mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1">
          {canManageAdmins && (
            <button
              type="button"
              onClick={() => setActiveTab('admins')}
              className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all ${
                activeTab === 'admins'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Manage Admins ({adminsList.length})</span>
            </button>
          )}
          {canViewAnalytics && (
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all ${
                activeTab === 'analytics'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Analytics Overview</span>
            </button>
          )}
          {canManageFaculty && (
            <button
              type="button"
              onClick={() => setActiveTab('faculty')}
              className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all ${
                activeTab === 'faculty'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Manage Faculty ({facultyList.length})</span>
            </button>
          )}
          {canManageStudents && (
            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all ${
                activeTab === 'students'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>Registered Students ({studentsList.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'settings'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span>Settings / Change Password</span>
          </button>
        </div>
      </div>

      {/* Global Notification Banners */}
      {bannerSuccess && (
        <div className="flex items-center justify-between gap-2 p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-sm animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="break-words">{bannerSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs px-2 py-0.5 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {bannerError && (
        <div className="flex items-center justify-between gap-2 p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-sm animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="break-words">{bannerError}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs px-2 py-0.5 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB: MANAGE ADMINS */}
      {activeTab === 'admins' && canManageAdmins && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search administrators by name, Admin ID, email, or role..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadAdmins}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                title="Refresh Administrators"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAdmins ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={openCreateAdminModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Admin</span>
              </button>
            </div>
          </div>

          {loadingAdmins ? (
            <div className="p-10 sm:p-12 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-400 mb-2" />
              <p className="text-sm">Loading administrator accounts...</p>
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="p-10 sm:p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
              <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-white font-medium">No administrators found</p>
              <p className="text-xs text-slate-400 mt-1">
                {adminSearch
                  ? 'No administrator accounts matched your search query.'
                  : 'Click "Add Admin" to directly provision a department or module administrator.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
              {filteredAdmins.map((a) => {
                const isProtectedSuper = Boolean(a.isSuperAdmin);
                const isSelf = a.id === currentUser.id;
                const assignedLabels = getAssignedAdminModules(a.adminPermissions, isProtectedSuper);

                return (
                  <div
                    key={a.id}
                    className={`p-4 sm:p-5 rounded-2xl bg-slate-900/90 border transition-all flex flex-col justify-between min-w-0 ${
                      isProtectedSuper
                        ? 'border-amber-500/45 shadow-lg shadow-amber-950/20'
                        : a.isActive === false
                        ? 'border-rose-900/50 opacity-75'
                        : 'border-slate-800/90 hover:border-cyan-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-bold text-base shadow ${
                              isProtectedSuper
                                ? 'bg-gradient-to-tr from-amber-500 to-orange-600 text-slate-950'
                                : 'bg-gradient-to-tr from-indigo-600 to-cyan-600 text-white'
                            }`}
                          >
                            {isProtectedSuper ? <Crown className="w-5 h-5" /> : a.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-white leading-tight truncate">
                              {a.name} {isSelf ? '(You)' : ''}
                            </h3>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-semibold">
                                {a.memberId}
                              </span>
                              {isProtectedSuper ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <Lock className="w-2.5 h-2.5" />
                                  Super Admin (Protected)
                                </span>
                              ) : (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                    a.isActive !== false
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                      : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                                  }`}
                                >
                                  {a.isActive !== false ? 'Active' : 'Deactivated'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-1.5 text-xs text-slate-300 min-w-0">
                        <div className="flex items-center gap-2 text-slate-300 min-w-0">
                          <Briefcase className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate font-medium">
                            {a.adminRoleLabel || a.batchOrDesignation || 'Administrator'}
                          </span>
                        </div>
                        {a.department && (
                          <div className="flex items-center gap-2 text-slate-400 min-w-0">
                            <Building className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="truncate">{a.department}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-slate-400 min-w-0">
                          <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">{a.email}</span>
                        </div>
                        {a.phone && (
                          <div className="flex items-center gap-2 text-slate-400">
                            <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="truncate">{a.phone}</span>
                          </div>
                        )}

                        {/* Assigned Module Permissions */}
                        <div className="pt-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                            Assigned Permissions
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {assignedLabels.length === 0 ? (
                              <span className="text-[11px] text-slate-500 italic">No module access</span>
                            ) : (
                              assignedLabels.map((lbl) => (
                                <span
                                  key={lbl}
                                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                                    isProtectedSuper
                                      ? 'bg-amber-950/60 text-amber-200 border-amber-700/50'
                                      : lbl === 'Admin Management'
                                      ? 'bg-purple-950/70 text-purple-200 border-purple-700/50'
                                      : 'bg-slate-800/90 text-cyan-200 border-slate-700'
                                  }`}
                                >
                                  {lbl}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-5 pt-3.5 border-t border-slate-800/80">
                      {isProtectedSuper ? (
                        <div className="flex items-center gap-2 text-[11px] text-amber-300/90 bg-amber-950/35 border border-amber-500/25 rounded-lg px-3 py-2">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                          <span>Protected Super Admin · Cannot be modified or removed</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditAdminError(null);
                              setEditAdminTarget(a);
                              setEditAdminForm({
                                name: a.name,
                                email: a.email,
                                adminRoleLabel: a.adminRoleLabel || a.batchOrDesignation || 'Department Admin',
                                department: a.department || DEPARTMENTS[0],
                                phone: a.phone || '',
                                bio: a.bio || '',
                                permissions: {
                                  ...DEFAULT_SUB_ADMIN_PERMISSIONS,
                                  ...(a.adminPermissions || {}),
                                },
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                            title="Edit Details & Permissions"
                          >
                            <Edit2 className="w-3 h-3 text-cyan-400" />
                            <span>Edit & Permissions</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setAdminResetPassTarget(a);
                              setAdminResetNewPassword('');
                              setAdminResetConfirmPassword('');
                              setAdminResetError(null);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                            title="Reset Administrator Password"
                          >
                            <KeyRound className="w-3 h-3 text-amber-400" />
                            <span>Password</span>
                          </button>

                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => handleToggleAdminStatus(a)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              a.isActive !== false
                                ? 'bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/50'
                                : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/50'
                            }`}
                            title={
                              isSelf
                                ? 'You cannot deactivate your own active session'
                                : a.isActive !== false
                                ? 'Deactivate Admin Account'
                                : 'Reactivate Admin Account'
                            }
                          >
                            <Power className="w-3 h-3" />
                            <span>{a.isActive !== false ? 'Deactivate' : 'Activate'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => setDeleteAdminTarget(a)}
                            className="inline-flex items-center justify-center p-2 min-h-[34px] min-w-[34px] rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={
                              isSelf
                                ? 'You cannot delete your own active session'
                                : 'Revoke & Delete Admin Account'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: ANALYTICS OVERVIEW */}
      {activeTab === 'analytics' && canViewAnalytics && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Department Portal Analytics Overview
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Live institution-wide counts across user accounts, coding verification, placements, and knowledge submissions.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAnalytics}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loadingAnalytics && !analytics ? (
            <div className="p-10 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400 mb-2" />
              <p className="text-sm">Calculating analytics...</p>
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Registered Students</div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {analytics.totalStudents}
                </div>
                <div className="text-[11px] text-emerald-400">
                  {analytics.activeStudents} active · {analytics.verifiedCodingStudents} coding verified
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Faculty Accounts</div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {analytics.totalFaculty}
                </div>
                <div className="text-[11px] text-cyan-300">{analytics.activeFaculty} active faculty accounts</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Administrator Accounts</div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {analytics.totalAdmins}
                </div>
                <div className="text-[11px] text-amber-300">{analytics.activeAdmins} active admins</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Placement Drives</div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {analytics.totalPlacements}
                </div>
                <div className="text-[11px] text-cyan-300">
                  {analytics.totalPlacementApplications} student applications
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Department Projects</div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {analytics.totalProjects}
                </div>
                <div className="text-[11px] text-slate-400">Published full-stack & research builds</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Hackathons & Interviews</div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {analytics.totalHackathons + analytics.totalInterviews}
                </div>
                <div className="text-[11px] text-slate-400">
                  {analytics.totalHackathons} hackathons · {analytics.totalInterviews} interviews
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Problem Statements</div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {analytics.openProblems + analytics.solvedProblems}
                </div>
                <div className="text-[11px] text-emerald-400">
                  {analytics.openProblems} open · {analytics.solvedProblems} solved
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Courses & Resources</div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {analytics.totalCourses + analytics.totalResources}
                </div>
                <div className="text-[11px] text-slate-400">
                  {analytics.totalCourses} courses · {analytics.totalResources} lab resources ·{' '}
                  {analytics.totalSpotlights} spotlights
                </div>
              </div>
            </div>
          ) : null}

          {isCentralAdmin && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 sm:p-5 space-y-3 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h3 className="text-sm font-bold text-white">
                    Central Portal · All Departments Live Side-by-Side Showcase
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  Shown only in the Central Portal &amp; Public Overview
                </span>
              </div>
              <div className="dept-marquee-wrapper relative overflow-hidden">
                <div className="animate-dept-marquee gap-3">
                  {[0, 1].map((loopIdx) => (
                    <div
                      key={loopIdx}
                      aria-hidden={loopIdx === 1}
                      className="flex items-stretch gap-3 shrink-0 pr-3"
                    >
                      {adminMarqueePackages.map((item) => (
                        <div
                          key={`${loopIdx}-${item.department}`}
                          className={`w-[260px] shrink-0 rounded-xl border p-3 flex flex-col justify-between gap-2 ${
                            item.isPublished
                              ? 'border-emerald-500/40 bg-emerald-950/40'
                              : 'border-slate-800 bg-slate-900/80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 truncate">
                              {item.shortLabel}
                            </span>
                            {item.isPublished && (
                              <span className="text-[9px] font-bold uppercase text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                Live
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-lg font-extrabold font-mono tabular-nums text-emerald-400">
                              {item.packageValue}
                            </div>
                            <div className="text-[11px] font-medium text-slate-200 truncate">
                              {item.title}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-800/80 text-center">
                            <div>
                              <div className="text-[10px] font-bold font-mono text-blue-300 truncate">
                                {item.placementRate}
                              </div>
                              <div className="text-[8px] text-slate-400">Placement</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold font-mono text-amber-300 truncate">
                                {item.hackathonPrize}
                              </div>
                              <div className="text-[8px] text-slate-400">Hackathon</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold font-mono text-indigo-300 truncate">
                                {item.projectsTraining}
                              </div>
                              <div className="text-[8px] text-slate-400">Projects</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: MANAGE FACULTY */}
      {activeTab === 'faculty' && canManageFaculty && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search faculty by name, Faculty ID, email, or department..."
                value={facultySearch}
                onChange={(e) => setFacultySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadFaculty}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                title="Refresh List"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingFaculty ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateFacultyOpen(true);
                  setCreateError(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Faculty</span>
              </button>
            </div>
          </div>

          {/* Faculty Table / Cards */}
          {loadingFaculty ? (
            <div className="p-10 sm:p-12 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400 mb-2" />
              <p className="text-sm">Loading faculty members...</p>
            </div>
          ) : filteredFaculty.length === 0 ? (
            <div className="p-10 sm:p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-white font-medium">No faculty members found</p>
              <p className="text-xs text-slate-400 mt-1">
                {facultySearch ? 'No matches for your query' : 'Click "Create Faculty" to add authorized faculty accounts'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
              {filteredFaculty.map((f) => (
                <div
                  key={f.id}
                  className={`p-4 sm:p-5 rounded-2xl bg-slate-900/90 border transition-all hover:border-cyan-500/40 flex flex-col justify-between min-w-0 ${
                    f.isActive === false
                      ? 'border-rose-900/50 opacity-75'
                      : 'border-slate-800/90 hover:shadow-xl hover:shadow-cyan-950/30'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-700 flex items-center justify-center text-white font-bold text-base shadow">
                          {f.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-white leading-tight truncate">{f.name}</h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-semibold">
                              {f.memberId}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                f.isActive !== false
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                  : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                              }`}
                            >
                              {f.isActive !== false ? 'Active' : 'Deactivated'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs text-slate-300 min-w-0">
                      <div className="flex items-center gap-2 text-slate-400 min-w-0">
                        <Briefcase className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{f.batchOrDesignation || 'Faculty'}</span>
                      </div>
                      {f.department && (
                        <div className="flex items-center gap-2 text-slate-400 min-w-0">
                          <Building className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">{f.department}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-slate-400 min-w-0">
                        <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{f.email}</span>
                      </div>
                      {f.phone && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">{f.phone}</span>
                        </div>
                      )}
                      {f.bio && (
                        <p className="pt-1.5 text-[11px] text-slate-400 line-clamp-2 leading-relaxed break-words">
                          {f.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditError(null);
                        setEditFaculty(f);
                        setEditForm({
                          name: f.name,
                          email: f.email,
                          department: f.department || DEPARTMENTS[1],
                          designation:
                            f.designation ||
                            (f.batchOrDesignation || '').split(',')[0]?.trim() ||
                            DESIGNATIONS[4],
                          phone: f.phone || '',
                          qualification: f.qualification || '',
                          experienceYears:
                            f.experienceYears !== undefined ? String(f.experienceYears) : '5',
                          skills: f.skills || '',
                          bio: f.bio || '',
                        });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                      title="Edit Faculty Details"
                    >
                      <Edit2 className="w-3 h-3 text-cyan-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setChangePasswordTarget(f);
                        setFacultyNewPassword('');
                        setFacultyConfirmPassword('');
                        setChangePassError(null);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                      title="Reset Faculty Password"
                    >
                      <KeyRound className="w-3 h-3 text-amber-400" />
                      <span>Password</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(f)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-lg text-xs font-medium transition-colors ${
                        f.isActive !== false
                          ? 'bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/50'
                          : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/50'
                      }`}
                      title={f.isActive !== false ? 'Deactivate this account' : 'Activate this account'}
                    >
                      <Power className="w-3 h-3" />
                      <span>{f.isActive !== false ? 'Deactivate' : 'Activate'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmTarget(f)}
                      className="inline-flex items-center justify-center p-2 min-h-[34px] min-w-[34px] rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 transition-colors"
                      title="Delete Faculty Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: REGISTERED STUDENTS */}
      {activeTab === 'students' && canManageStudents && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search registered students by Roll No, name, email, branch, year..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={loadStudents}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingStudents ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Department
                </label>
                <select
                  value={studentDeptFilter}
                  onChange={(e) => setStudentDeptFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-cyan-400"
                >
                  <option value="ALL">All Departments</option>
                  {studentDepartmentOptions.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Year
                </label>
                <select
                  value={studentYearFilter}
                  onChange={(e) => setStudentYearFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-cyan-400"
                >
                  <option value="ALL">All Years</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Section
                </label>
                <select
                  value={studentSectionFilter}
                  onChange={(e) => setStudentSectionFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-cyan-400"
                >
                  <option value="ALL">All Sections</option>
                  {SECTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Sort Order
                </label>
                <select
                  value={studentSortBy}
                  onChange={(e) =>
                    setStudentSortBy(
                      e.target.value as
                        | 'dept_year_section'
                        | 'year_section'
                        | 'member_id'
                        | 'name'
                        | 'cgpa_desc'
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-cyan-400"
                >
                  <option value="dept_year_section">Department · Year · Section</option>
                  <option value="year_section">Year · Section · Dept</option>
                  <option value="member_id">Roll Number (A–Z)</option>
                  <option value="name">Student Name (A–Z)</option>
                  <option value="cgpa_desc">CGPA (High to Low)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
              <span>
                Showing <span className="font-semibold text-slate-200">{filteredStudents.length}</span> of{' '}
                <span className="font-semibold text-slate-200">{studentsList.length}</span> registered students
              </span>
              {hasActiveStudentFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentSearch('');
                    setStudentDeptFilter('ALL');
                    setStudentYearFilter('ALL');
                    setStudentSectionFilter('ALL');
                  }}
                  className="text-cyan-300 hover:text-cyan-200 font-medium hover:underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Mobile Stacked Student Cards */}
          <div className="md:hidden space-y-3">
            {filteredStudents.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center text-xs text-slate-500">
                No students found matching your criteria.
              </div>
            ) : (
              filteredStudents.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-cyan-300 block">
                        {s.memberId}
                      </span>
                      <div className="font-semibold text-white text-sm truncate mt-0.5">
                        {s.name}
                      </div>
                      <div className="text-xs text-slate-400 break-all mt-0.5">{s.email}</div>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        s.isActive !== false
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                          : 'bg-rose-950 text-rose-400 border-rose-800/60'
                      }`}
                    >
                      {s.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {s.bio && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 break-words">{s.bio}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="text-slate-300">
                      <span>{s.department || 'CSE'}</span>
                      <span className="mx-1.5 text-slate-600">·</span>
                      <span>
                        {s.year ? `${s.year} · Sec ${s.section || 'A'}` : s.batchOrDesignation}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditStudentError(null);
                        setEditStudent(s);
                        setEditStudentForm({
                          name: s.name,
                          email: s.email,
                          department: s.department || DEPARTMENTS[1],
                          year: s.year || YEARS[0],
                          section: s.section || SECTIONS[0],
                          phone: s.phone || '',
                          cgpa: s.cgpa ? String(s.cgpa) : '0',
                          skills: s.skills || '',
                          bio: s.bio || '',
                          isActive: s.isActive !== false,
                        });
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                    >
                      <Edit2 className="w-3 h-3 text-cyan-400" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/90 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Roll Number</th>
                  <th className="py-3.5 px-4 font-semibold">Full Name</th>
                  <th className="py-3.5 px-4 font-semibold">Email</th>
                  <th className="py-3.5 px-4 font-semibold">Department</th>
                  <th className="py-3.5 px-4 font-semibold">Year & Section</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No students found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-300">{s.memberId}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{s.name}</div>
                        {s.bio && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                            {s.bio}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{s.email}</td>
                      <td className="py-3 px-4 text-slate-300">{s.department || 'CSE'}</td>
                      <td className="py-3 px-4 text-slate-300">
                        {s.year ? `${s.year} · Sec ${s.section || 'A'}` : s.batchOrDesignation}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            s.isActive !== false
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                              : 'bg-rose-950 text-rose-400 border-rose-800/60'
                          }`}
                        >
                          {s.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditStudentError(null);
                            setEditStudent(s);
                            setEditStudentForm({
                              name: s.name,
                              email: s.email,
                              department: s.department || DEPARTMENTS[1],
                              year: s.year || YEARS[0],
                              section: s.section || SECTIONS[0],
                              phone: s.phone || '',
                              cgpa: s.cgpa ? String(s.cgpa) : '0',
                              skills: s.skills || '',
                              bio: s.bio || '',
                              isActive: s.isActive !== false,
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                          title="Edit Student Profile & Bio"
                        >
                          <Edit2 className="w-3 h-3 text-cyan-400" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: ADMIN SETTINGS / PROFILE & CHANGE PASSWORD */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Administrator Profile & Personal Bio Card */}
          <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-cyan-400 shrink-0" />
                  Administrator Profile & Personal Bio
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {isEditingAdminProfile
                    ? 'Select options and update your administrator full name, official title, department, contact details, and personal bio.'
                    : 'Click "Edit Admin Profile & Bio" to change your name, personal bio, department, or contact details.'}
                </p>
              </div>

              {!isEditingAdminProfile ? (
                <button
                  type="button"
                  onClick={() => {
                    setAdminProfileError(null);
                    setAdminProfileSuccess(null);
                    setIsEditingAdminProfile(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Admin Profile & Bio</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAdminProfileForm({
                      name: currentUser.name,
                      email: currentUser.email,
                      batchOrDesignation: currentUser.batchOrDesignation || 'System Administrator',
                      department: currentUser.department || DEPARTMENTS[1],
                      phone: currentUser.phone || '',
                      skills: currentUser.skills || '',
                      bio: currentUser.bio || '',
                    });
                    setAdminProfileError(null);
                    setIsEditingAdminProfile(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              )}
            </div>

            {adminProfileError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{adminProfileError}</span>
              </div>
            )}

            {adminProfileSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{adminProfileSuccess}</span>
              </div>
            )}

            {!isEditingAdminProfile ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 min-w-0">
                    <span className="text-slate-400 block">Full Name</span>
                    <span className="mt-1 block text-sm font-semibold text-white break-words">{currentUser.name}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 min-w-0">
                    <span className="text-slate-400 block">Administrator Tier & Role</span>
                    <span className="mt-1 block text-sm font-medium text-cyan-300 break-words">
                      {isSuperAdmin
                        ? 'Super Administrator (System Owner)'
                        : currentUser.adminRoleLabel || currentUser.batchOrDesignation || 'Sub-Administrator'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 min-w-0">
                    <span className="text-slate-400 block">Login Email</span>
                    <span className="mt-1 block text-sm text-slate-200 break-all">{currentUser.email}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 min-w-0">
                    <span className="text-slate-400 block">Department</span>
                    <span className="mt-1 block text-sm text-slate-200 break-words">
                      {currentUser.department || DEPARTMENTS[1]}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 min-w-0">
                    <span className="text-slate-400 block">Phone / Office Ext</span>
                    <span className="mt-1 block text-sm font-mono text-slate-200 break-words">
                      {currentUser.phone || 'Not set'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 min-w-0">
                    <span className="text-slate-400 block">Assigned Modules</span>
                    <span className="mt-1 block text-sm text-slate-200 break-words">
                      {currentAssignedModules.length > 0 ? currentAssignedModules.join(', ') : 'Profile Only'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs font-semibold text-cyan-300 block mb-1">Personal Bio</span>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line break-words">
                    {currentUser.bio || 'No personal bio added yet. Click "Edit Admin Profile & Bio" above to add one.'}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAdminProfileSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={adminProfileForm.name}
                      onChange={(e) =>
                        setAdminProfileForm({ ...adminProfileForm, name: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Administrator Title / Designation
                    </label>
                    <input
                      type="text"
                      value={adminProfileForm.batchOrDesignation}
                      onChange={(e) =>
                        setAdminProfileForm({
                          ...adminProfileForm,
                          batchOrDesignation: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Login Email <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={adminProfileForm.email}
                      onChange={(e) =>
                        setAdminProfileForm({ ...adminProfileForm, email: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Department
                    </label>
                    <select
                      value={adminProfileForm.department}
                      onChange={(e) =>
                        setAdminProfileForm({
                          ...adminProfileForm,
                          department: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-400"
                    >
                      {!DEPARTMENTS.includes(adminProfileForm.department) &&
                        adminProfileForm.department && (
                          <option value={adminProfileForm.department}>
                            {adminProfileForm.department}
                          </option>
                        )}
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept === 'Administration' ? 'All Departments (Central Administration)' : dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Phone / Office Ext
                    </label>
                    <input
                      type="text"
                      value={adminProfileForm.phone}
                      onChange={(e) =>
                        setAdminProfileForm({ ...adminProfileForm, phone: e.target.value })
                      }
                      placeholder="e.g. +91 9876543210"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Skills / Responsibilities
                    </label>
                    <input
                      type="text"
                      value={adminProfileForm.skills}
                      onChange={(e) =>
                        setAdminProfileForm({ ...adminProfileForm, skills: e.target.value })
                      }
                      placeholder="e.g. Portal Governance, Faculty Coordination"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Personal Bio
                  </label>
                  <textarea
                    rows={3}
                    value={adminProfileForm.bio}
                    onChange={(e) =>
                      setAdminProfileForm({ ...adminProfileForm, bio: e.target.value })
                    }
                    placeholder="Write your personal bio, academic background, or department note..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminProfileForm({
                        name: currentUser.name,
                        email: currentUser.email,
                        batchOrDesignation: currentUser.batchOrDesignation || 'System Administrator',
                        department: currentUser.department || DEPARTMENTS[1],
                        phone: currentUser.phone || '',
                        skills: currentUser.skills || '',
                        bio: currentUser.bio || '',
                      });
                      setAdminProfileError(null);
                      setIsEditingAdminProfile(false);
                    }}
                    className="px-4 py-2.5 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adminProfileSaving}
                    className="px-5 py-2.5 min-h-[40px] rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {adminProfileSaving ? 'Saving Profile...' : 'Save Admin Profile & Bio'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Change Own Password Card */}
            <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Lock className="w-5 h-5 text-cyan-400" />
                    Change Administrator Password
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Update your own administrator login password. This change takes effect immediately.
                  </p>
                </div>
                {!isChangingAdminPassword && (
                  <button
                    type="button"
                    onClick={() => {
                      setAdminPassError(null);
                      setAdminPassSuccess(null);
                      setIsChangingAdminPassword(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold shrink-0 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Change Password
                  </button>
                )}
              </div>

              {adminPassError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{adminPassError}</span>
                </div>
              )}

              {adminPassSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{adminPassSuccess}</span>
                </div>
              )}

              {!isChangingAdminPassword ? (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <span>
                    Your password is protected and hidden. Click <strong className="text-white">Change Password</strong> to reveal the password update form.
                  </span>
                </div>
              ) : (
                <form onSubmit={handleAdminChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Current Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminCurrentPass ? 'text' : 'password'}
                        required
                        value={adminCurrentPassword}
                        onChange={(e) => setAdminCurrentPassword(e.target.value)}
                        placeholder="Enter existing admin password"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminCurrentPass(!showAdminCurrentPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showAdminCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      New Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminNewPass ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={adminNewPassword}
                        onChange={(e) => setAdminNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminNewPass(!showAdminNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showAdminNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Confirm New Password <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={adminConfirmPassword}
                      onChange={(e) => setAdminConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminCurrentPassword('');
                        setAdminNewPassword('');
                        setAdminConfirmPassword('');
                        setAdminPassError(null);
                        setIsChangingAdminPassword(false);
                      }}
                      className="px-4 py-2.5 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={adminPassSubmitting}
                      className="px-5 py-2.5 min-h-[40px] rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
                    >
                      {adminPassSubmitting ? 'Updating Password...' : 'Update Admin Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Admin Identity & Safeguards Info Card */}
            <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                Security Architecture & Rules
              </h2>
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="font-semibold text-amber-300 block mb-1">Super Admin Protection & RBAC</span>
                  Only the Super Admin (or explicitly authorized delegate) can directly provision sub-admin accounts. Super Admin accounts are permanently protected against demotion, editing, deactivation, or deletion.
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="font-semibold text-cyan-300 block mb-1">Server-Enforced Module Boundaries</span>
                  Module permissions (Students, Faculty, Placements, Coding & Verification, Dashboard & Analytics) are enforced on every Express API route, never solely in frontend UI.
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="font-semibold text-cyan-300 block mb-1">Immediate Credential Provisioning</span>
                  New faculty and sub-admin accounts are provisioned directly via Supabase Auth with compulsory passwords and require no external invitation links.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL A1: ADD / CREATE ADMIN */}
      {createAdminOpen && canManageAdmins && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-slate-900 border border-amber-500/40 p-4 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white">Add Administrator Account</h3>
                  <p className="text-xs text-slate-400">
                    Direct provisioning — newly created admins can log in immediately with their email & password.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateAdminOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createAdminError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{createAdminError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={createAdminForm.name}
                    onChange={(e) =>
                      setCreateAdminForm({ ...createAdminForm, name: e.target.value })
                    }
                    placeholder="Enter Administrator Full Name"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={createAdminForm.email}
                    onChange={(e) =>
                      setCreateAdminForm({ ...createAdminForm, email: e.target.value })
                    }
                    placeholder="admin@pragati.edu"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Admin ID <span className="text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={createAdminForm.memberId}
                    onChange={(e) =>
                      setCreateAdminForm({ ...createAdminForm, memberId: e.target.value })
                    }
                    placeholder="Auto (ADM-XXXX)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={createAdminForm.department}
                    onChange={(e) =>
                      setCreateAdminForm({ ...createAdminForm, department: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept === 'Administration' ? 'All Departments (Central Administration)' : dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone / Ext
                  </label>
                  <input
                    type="tel"
                    autoComplete="off"
                    value={createAdminForm.phone}
                    onChange={(e) =>
                      setCreateAdminForm({ ...createAdminForm, phone: e.target.value })
                    }
                    placeholder="Optional contact"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Admin Role & Preset Assignment */}
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Role Preset (Applies Recommended Permissions)
                    </label>
                    <select
                      value={
                        ADMIN_ROLE_PRESETS.some((p) => p.label === createAdminForm.adminRoleLabel)
                          ? createAdminForm.adminRoleLabel
                          : '__custom__'
                      }
                      onChange={(e) => {
                        const preset = ADMIN_ROLE_PRESETS.find((p) => p.label === e.target.value);
                        if (preset) {
                          setCreateAdminForm((prev) => ({
                            ...prev,
                            adminRoleLabel: preset.label,
                            permissions: {
                              ...preset.defaults,
                              canCreateAdmins: prev.permissions.canCreateAdmins,
                            },
                          }));
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                    >
                      {ADMIN_ROLE_PRESETS.map((p) => (
                        <option key={p.label} value={p.label}>
                          {p.label}
                        </option>
                      ))}
                      <option value="__custom__">Custom Admin Role</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Admin Role / Designation Label
                    </label>
                    <input
                      type="text"
                      value={createAdminForm.adminRoleLabel}
                      onChange={(e) =>
                        setCreateAdminForm({ ...createAdminForm, adminRoleLabel: e.target.value })
                      }
                      placeholder="e.g. Placement Coordinator Admin"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-200 mb-2">
                    Module Permissions Assignment <span className="text-rose-400">*</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ADMIN_MODULE_DEFINITIONS.map((mod) => {
                      const propKey = permissionFlagKey(mod.key);
                      const checked = Boolean(createAdminForm.permissions[propKey]);
                      return (
                        <label
                          key={mod.key}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-cyan-950/40 border-cyan-500/40 text-white'
                              : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setCreateAdminForm((prev) => ({
                                ...prev,
                                permissions: {
                                  ...prev.permissions,
                                  [propKey]: e.target.checked,
                                },
                              }))
                            }
                            className="mt-0.5 rounded border-slate-600 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold leading-tight">{mod.label}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                              {mod.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {isSuperAdmin && (
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/35 bg-amber-950/25 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(createAdminForm.permissions.canCreateAdmins)}
                        onChange={(e) =>
                          setCreateAdminForm((prev) => ({
                            ...prev,
                            permissions: {
                              ...prev.permissions,
                              canCreateAdmins: e.target.checked,
                            },
                          }))
                        }
                        className="mt-0.5 rounded border-amber-500 bg-slate-950 text-amber-400 focus:ring-amber-400"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                          <span>Authorize to Create / Manage Admins (Delegated Privilege)</span>
                        </div>
                        <div className="text-[11px] text-amber-200/80 mt-0.5">
                          Super-Admin-only option. Keeps Super Admin accounts permanently protected.
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-[11px] text-cyan-300">
                <strong>Direct Provisioning:</strong> No email invitation or verification link is needed. The new administrator can sign in immediately via the Admin login tab using their Email (or Admin ID) and this password.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCreateAdminPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={createAdminForm.password}
                      onChange={(e) =>
                        setCreateAdminForm({ ...createAdminForm, password: e.target.value })
                      }
                      placeholder="At least 6 characters"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreateAdminPass(!showCreateAdminPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showCreateAdminPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Confirm Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCreateAdminConfirmPass ? 'text' : 'password'}
                      required
                      value={createAdminForm.confirmPassword}
                      onChange={(e) =>
                        setCreateAdminForm({
                          ...createAdminForm,
                          confirmPassword: e.target.value,
                        })
                      }
                      placeholder="Re-enter password"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreateAdminConfirmPass(!showCreateAdminConfirmPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showCreateAdminConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateAdminOpen(false)}
                  className="px-4 py-2 min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAdminSubmitting}
                  className="px-5 py-2 min-h-[38px] rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 disabled:opacity-50"
                >
                  {createAdminSubmitting ? 'Creating Admin...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL A2: EDIT SUB-ADMIN & PERMISSIONS */}
      {editAdminTarget && canManageAdmins && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 min-w-0 break-words">
                <Edit2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Edit Admin & Permissions: {editAdminTarget.name} ({editAdminTarget.memberId})</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditAdminTarget(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editAdminError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editAdminError}</span>
              </div>
            )}

            <form onSubmit={handleEditAdmin} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editAdminForm.name}
                    onChange={(e) => setEditAdminForm({ ...editAdminForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editAdminForm.email}
                    onChange={(e) => setEditAdminForm({ ...editAdminForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Role Label</label>
                  <input
                    type="text"
                    value={editAdminForm.adminRoleLabel}
                    onChange={(e) =>
                      setEditAdminForm({ ...editAdminForm, adminRoleLabel: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                  <select
                    value={editAdminForm.department}
                    onChange={(e) =>
                      setEditAdminForm({ ...editAdminForm, department: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {!DEPARTMENTS.includes(editAdminForm.department) && editAdminForm.department && (
                      <option value={editAdminForm.department}>{editAdminForm.department}</option>
                    )}
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept === 'Administration' ? 'All Departments (Central Administration)' : dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editAdminForm.phone}
                    onChange={(e) => setEditAdminForm({ ...editAdminForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-xs font-semibold text-slate-200">Module Permissions</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ADMIN_MODULE_DEFINITIONS.map((mod) => {
                    const propKey = permissionFlagKey(mod.key);
                    const checked = Boolean(editAdminForm.permissions[propKey]);
                    return (
                      <label
                        key={mod.key}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-cyan-950/40 border-cyan-500/40 text-white'
                            : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setEditAdminForm((prev) => ({
                              ...prev,
                              permissions: {
                                ...prev.permissions,
                                [propKey]: e.target.checked,
                              },
                            }))
                          }
                          className="mt-0.5 rounded border-slate-600 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold leading-tight">{mod.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                            {mod.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {isSuperAdmin && (
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/35 bg-amber-950/25 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editAdminForm.permissions.canCreateAdmins)}
                        onChange={(e) =>
                          setEditAdminForm((prev) => ({
                            ...prev,
                            permissions: {
                              ...prev.permissions,
                              canCreateAdmins: e.target.checked,
                            },
                          }))
                        }
                        className="mt-0.5 rounded border-amber-500 bg-slate-950 text-amber-400 focus:ring-amber-400"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-amber-300">
                          Authorize to Create / Manage Admins (Delegated Privilege)
                        </div>
                        <div className="text-[11px] text-amber-200/80 mt-0.5">
                          Only Super Admin can grant or revoke this privilege.
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Bio / Note</label>
                <textarea
                  rows={2}
                  value={editAdminForm.bio}
                  onChange={(e) => setEditAdminForm({ ...editAdminForm, bio: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditAdminTarget(null)}
                  className="px-3.5 py-2 min-h-[36px] rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editAdminSubmitting}
                  className="px-4 py-2 min-h-[36px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  {editAdminSubmitting ? 'Saving...' : 'Save Permissions & Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL A3: RESET SUB-ADMIN PASSWORD */}
      {adminResetPassTarget && canManageAdmins && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-slate-900 border border-amber-500/40 p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 min-w-0 break-words">
                <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Reset Admin Password: {adminResetPassTarget.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setAdminResetPassTarget(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adminResetError && (
              <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs">
                {adminResetError}
              </div>
            )}

            <form onSubmit={handleChangeSubAdminPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminResetPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={adminResetNewPassword}
                    onChange={(e) => setAdminResetNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminResetPass(!showAdminResetPass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showAdminResetPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={adminResetConfirmPassword}
                  onChange={(e) => setAdminResetConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminResetPassTarget(null)}
                  className="px-3.5 py-2 min-h-[36px] rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminResetSubmitting}
                  className="px-4 py-2 min-h-[36px] rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20"
                >
                  {adminResetSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL A4: DELETE / REVOKE SUB-ADMIN CONFIRMATION */}
      {deleteAdminTarget && canManageAdmins && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl bg-slate-900 border border-rose-500/40 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-white">Revoke & Remove Admin?</h3>
              <p className="text-xs text-slate-400 mt-1 break-words">
                Are you sure you want to permanently remove administrator access for{' '}
                <strong className="text-white">{deleteAdminTarget.name}</strong> ({deleteAdminTarget.memberId})? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteAdminTarget(null)}
                disabled={deleteAdminSubmitting}
                className="flex-1 py-2.5 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAdmin}
                disabled={deleteAdminSubmitting}
                className="flex-1 py-2.5 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
              >
                {deleteAdminSubmitting ? 'Removing...' : 'Revoke & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE FACULTY ACCOUNT */}
      {createFacultyOpen && canManageFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-slate-900 border border-cyan-500/40 p-4 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white">Create Faculty Account</h3>
                  <p className="text-xs text-slate-400">
                    Administrator faculty provisioning with compulsory password
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateFacultyOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFaculty} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Faculty Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Enter Faculty Full Name"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Faculty ID <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={createForm.memberId}
                    onChange={(e) => setCreateForm({ ...createForm, memberId: e.target.value })}
                    placeholder="Enter Faculty ID"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="Enter Faculty Email Address"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    autoComplete="off"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="Enter Phone Number"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Department <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={createForm.department}
                    onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Designation <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={createForm.designation}
                    onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {DESIGNATIONS.map((desig) => (
                      <option key={desig} value={desig}>
                        {desig}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-[11px] text-cyan-300">
                <strong>Compulsory Password Requirement:</strong> As administrator, you must define the initial password for this faculty member. They will use this password to log in.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCreatePassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      placeholder="At least 6 characters"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showCreatePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Confirm Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCreateConfirmPassword ? 'text' : 'password'}
                      required
                      value={createForm.confirmPassword}
                      onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                      placeholder="Re-enter password"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreateConfirmPassword(!showCreateConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showCreateConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateFacultyOpen(false)}
                  className="px-4 py-2 min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 min-h-[38px] rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 disabled:opacity-50"
                >
                  {createSubmitting ? 'Creating Faculty...' : 'Create Faculty Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT FACULTY DETAILS */}
      {editFaculty && canManageFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 min-w-0 break-words">
                <Edit2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Edit Details: {editFaculty.name} ({editFaculty.memberId})</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditFaculty(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditFaculty} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                  <select
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {!DEPARTMENTS.includes(editForm.department) && editForm.department && (
                      <option value={editForm.department}>{editForm.department}</option>
                    )}
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Designation</label>
                  <select
                    required
                    value={editForm.designation}
                    onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {!DESIGNATIONS.includes(editForm.designation) && editForm.designation && (
                      <option value={editForm.designation}>{editForm.designation}</option>
                    )}
                    {DESIGNATIONS.map((desig) => (
                      <option key={desig} value={desig}>
                        {desig}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone / Cabin</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Qualification</label>
                  <input
                    type="text"
                    value={editForm.qualification}
                    onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })}
                    placeholder="e.g. Ph.D, M.Tech"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={editForm.experienceYears}
                    onChange={(e) => setEditForm({ ...editForm, experienceYears: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Research & Technical Skills</label>
                <input
                  type="text"
                  value={editForm.skills}
                  onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                  placeholder="e.g. Distributed Systems, Cloud Computing, AI/ML"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Personal Bio</label>
                <textarea
                  rows={3}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Academic bio, research areas, or office hours..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditFaculty(null)}
                  className="px-3.5 py-2 min-h-[36px] rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 min-h-[36px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: EDIT STUDENT DETAILS */}
      {editStudent && canManageStudents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 min-w-0 break-words">
                <Edit2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Edit Student: {editStudent.name} ({editStudent.memberId})</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditStudent(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editStudentError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editStudentError}</span>
              </div>
            )}

            <form onSubmit={handleEditStudent} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editStudentForm.name}
                    onChange={(e) =>
                      setEditStudentForm({ ...editStudentForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editStudentForm.email}
                    onChange={(e) =>
                      setEditStudentForm({ ...editStudentForm, email: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                  <select
                    value={editStudentForm.department}
                    onChange={(e) =>
                      setEditStudentForm({ ...editStudentForm, department: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {!DEPARTMENTS.includes(editStudentForm.department) &&
                      editStudentForm.department && (
                        <option value={editStudentForm.department}>
                          {editStudentForm.department}
                        </option>
                      )}
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Year</label>
                  <select
                    value={editStudentForm.year}
                    onChange={(e) =>
                      setEditStudentForm({ ...editStudentForm, year: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {!YEARS.includes(editStudentForm.year) && editStudentForm.year && (
                      <option value={editStudentForm.year}>{editStudentForm.year}</option>
                    )}
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Section</label>
                  <select
                    value={editStudentForm.section}
                    onChange={(e) =>
                      setEditStudentForm({ ...editStudentForm, section: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {!SECTIONS.includes(editStudentForm.section) &&
                      editStudentForm.section && (
                        <option value={editStudentForm.section}>
                          Section {editStudentForm.section}
                        </option>
                      )}
                    {SECTIONS.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editStudentForm.phone}
                    onChange={(e) =>
                      setEditStudentForm({ ...editStudentForm, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">CGPA (0 - 10)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={editStudentForm.cgpa}
                    onChange={(e) =>
                      setEditStudentForm({ ...editStudentForm, cgpa: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editStudentForm.isActive}
                      onChange={(e) =>
                        setEditStudentForm({ ...editStudentForm, isActive: e.target.checked })
                      }
                      className="rounded border-slate-600 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Account Active</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Technical Skills</label>
                <input
                  type="text"
                  value={editStudentForm.skills}
                  onChange={(e) =>
                    setEditStudentForm({ ...editStudentForm, skills: e.target.value })
                  }
                  placeholder="e.g. C++, Java, TypeScript, SQL"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Personal Bio</label>
                <textarea
                  rows={3}
                  value={editStudentForm.bio}
                  onChange={(e) =>
                    setEditStudentForm({ ...editStudentForm, bio: e.target.value })
                  }
                  placeholder="Student personal bio, interests, or project focus..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditStudent(null)}
                  className="px-3.5 py-2 min-h-[36px] rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editStudentSubmitting}
                  className="px-4 py-2 min-h-[36px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  {editStudentSubmitting ? 'Saving...' : 'Save Student Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CHANGE FACULTY PASSWORD */}
      {changePasswordTarget && canManageFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-slate-900 border border-amber-500/40 p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 min-w-0 break-words">
                <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Change Password: {changePasswordTarget.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setChangePasswordTarget(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {changePassError && (
              <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs">
                {changePassError}
              </div>
            )}

            <form onSubmit={handleChangeFacultyPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showFacNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={facultyNewPassword}
                    onChange={(e) => setFacultyNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFacNewPassword(!showFacNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showFacNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={facultyConfirmPassword}
                  onChange={(e) => setFacultyConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangePasswordTarget(null)}
                  className="px-3.5 py-2 min-h-[36px] rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePassSubmitting}
                  className="px-4 py-2 min-h-[36px] rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20"
                >
                  {changePassSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE FACULTY CONFIRMATION */}
      {deleteConfirmTarget && canManageFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl bg-slate-900 border border-rose-500/40 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-white">Delete Faculty Account?</h3>
              <p className="text-xs text-slate-400 mt-1 break-words">
                Are you sure you want to permanently delete the account for{' '}
                <strong className="text-white">{deleteConfirmTarget.name}</strong> ({deleteConfirmTarget.memberId})? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={deleteSubmitting}
                className="flex-1 py-2.5 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFaculty}
                disabled={deleteSubmitting}
                className="flex-1 py-2.5 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
              >
                {deleteSubmitting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

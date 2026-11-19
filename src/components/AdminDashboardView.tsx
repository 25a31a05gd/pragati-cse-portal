import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { getStoredToken } from '../api';
import type { PortalProgress, PublicUserProfile } from '../types';

interface AdminDashboardViewProps {
  currentUser: PublicUserProfile;
  onLogout: () => void;
  onFacultyChanged?: () => Promise<void> | void;
  onProfileUpdated?: (nextProfile: PublicUserProfile, nextProgress: PortalProgress) => void;
}

const DEPARTMENTS = [
  'Computer Science & Engineering (CSE)',
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

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  currentUser,
  onLogout,
  onFacultyChanged,
  onProfileUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'faculty' | 'students' | 'settings'>('faculty');

  // Faculty State
  const [facultyList, setFacultyList] = useState<PublicUserProfile[]>([]);
  const [facultySearch, setFacultySearch] = useState('');
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [facultyError, setFacultyError] = useState<string | null>(null);
  const [facultySuccess, setFacultySuccess] = useState<string | null>(null);

  // Modals
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
    department: DEPARTMENTS[0],
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
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Admin Profile & Bio Form State
  const [isEditingAdminProfile, setIsEditingAdminProfile] = useState(false);
  const [adminProfileForm, setAdminProfileForm] = useState({
    name: currentUser.name,
    email: currentUser.email,
    batchOrDesignation: currentUser.batchOrDesignation || 'System Administrator',
    department: currentUser.department || DEPARTMENTS[0],
    phone: currentUser.phone || '',
    skills: currentUser.skills || '',
    bio: currentUser.bio || '',
  });
  const [adminProfileSaving, setAdminProfileSaving] = useState(false);
  const [adminProfileError, setAdminProfileError] = useState<string | null>(null);
  const [adminProfileSuccess, setAdminProfileSuccess] = useState<string | null>(null);

  // Admin Change Password Form State
  const [adminCurrentPassword, setAdminCurrentPassword] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showAdminCurrentPass, setShowAdminCurrentPass] = useState(false);
  const [showAdminNewPass, setShowAdminNewPass] = useState(false);
  const [adminPassSubmitting, setAdminPassSubmitting] = useState(false);
  const [adminPassError, setAdminPassError] = useState<string | null>(null);
  const [adminPassSuccess, setAdminPassSuccess] = useState<string | null>(null);

  const getAuthToken = () => getStoredToken() || '';

  // Load Faculty
  const loadFaculty = async () => {
    setLoadingFaculty(true);
    setFacultyError(null);
    try {
      const res = await fetch('/api/admin/faculty', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) {
        throw new Error('Failed to load faculty accounts');
      }
      const data = await res.json();
      setFacultyList(data.faculty || []);
    } catch (err) {
      setFacultyError(err instanceof Error ? err.message : 'Error loading faculty');
    } finally {
      setLoadingFaculty(false);
    }
  };

  // Load Students
  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const res = await fetch('/api/admin/students', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStudentsList(data.students || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadFaculty();
    loadStudents();
  }, []);

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

  // Handle Create Faculty
  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    // Validate 8 compulsory fields
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
      const res = await fetch('/api/admin/faculty', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create faculty account');
      }

      setFacultySuccess(`Faculty account created for ${createForm.name} (${createForm.memberId.toUpperCase()})`);
      setCreateFacultyOpen(false);
      setCreateForm({
        name: '',
        memberId: '',
        email: '',
        department: DEPARTMENTS[0],
        designation: DESIGNATIONS[0],
        phone: '',
        password: '',
        confirmPassword: '',
      });
      await Promise.all([loadFaculty(), Promise.resolve(onFacultyChanged?.())]);
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
      const res = await fetch(`/api/admin/faculty/${editFaculty.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          ...editForm,
          experienceYears: parseInt(editForm.experienceYears, 10) || 0,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error || 'Failed to update faculty');
      }
      setFacultySuccess(`Updated details and bio for ${editForm.name}`);
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
      const res = await fetch(`/api/admin/students/${editStudent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
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
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update student profile');
      }
      setStudentsList((prev) =>
        prev.map((s) => (s.id === editStudent.id ? data.student : s))
      );
      setFacultySuccess(`Updated student profile for ${data.student.name} (${data.student.memberId})`);
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
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
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
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update administrator profile');
      }
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
      const res = await fetch(`/api/admin/faculty/${changePasswordTarget.id}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          newPassword: facultyNewPassword,
          confirmPassword: facultyConfirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setFacultySuccess(`Password updated successfully for ${changePasswordTarget.name}`);
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
      const res = await fetch(`/api/admin/faculty/${faculty.id}/toggle-status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle status');
      setFacultySuccess(data.message);
      loadFaculty();
    } catch (err) {
      setFacultyError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  // Handle Delete Faculty
  const handleDeleteFaculty = async () => {
    if (!deleteConfirmTarget || deleteSubmitting) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/admin/faculty/${deleteConfirmTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete faculty');
      setFacultySuccess(data.message);
      setDeleteConfirmTarget(null);
      await Promise.all([loadFaculty(), Promise.resolve(onFacultyChanged?.())]);
    } catch (err) {
      setFacultyError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Handle Admin Change Password
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
      const res = await fetch('/api/auth/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          currentPassword: adminCurrentPassword,
          newPassword: adminNewPassword,
          confirmPassword: adminConfirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update admin password');

      setAdminPassSuccess('Administrator password has been successfully updated.');
      setAdminCurrentPassword('');
      setAdminNewPassword('');
      setAdminConfirmPassword('');
    } catch (err) {
      setAdminPassError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setAdminPassSubmitting(false);
    }
  };

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

  const filteredStudents = studentsList.filter((s) => {
    const q = studentSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.memberId.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q) ||
      (s.year || '').toLowerCase().includes(q) ||
      (s.section || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 border border-cyan-500/30 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-lg">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mb-1">
                PRAGATI ENGINEERING COLLEGE · SURAMPALEM
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Central Administrator Portal
              </h1>
              <p className="text-xs text-slate-400">
                Logged in as <span className="text-cyan-300 font-semibold">{currentUser.name}</span> ({currentUser.memberId}) · Complete authority over faculty accounts & security
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto">
            <button
              onClick={() => {
                setCreateFacultyOpen(true);
                setCreateError(null);
              }}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Faculty</span>
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-700/80 text-slate-300 text-sm font-medium transition-all"
              title="Logout from Admin Portal"
            >
              <Power className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('faculty')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'faculty'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Manage Faculty ({facultyList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'students'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Registered Students ({studentsList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Settings / Change Password</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {facultySuccess && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{facultySuccess}</span>
          </div>
          <button
            onClick={() => setFacultySuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs px-2 py-0.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: MANAGE FACULTY */}
      {activeTab === 'faculty' && (
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
                onClick={loadFaculty}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                title="Refresh List"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingFaculty ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
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
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400 mb-2" />
              <p className="text-sm">Loading faculty members...</p>
            </div>
          ) : filteredFaculty.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-white font-medium">No faculty members found</p>
              <p className="text-xs text-slate-400 mt-1">
                {facultySearch ? 'No matches for your query' : 'Click "Create Faculty" to add authorized faculty accounts'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFaculty.map((f) => (
                <div
                  key={f.id}
                  className={`p-5 rounded-2xl bg-slate-900/90 border transition-all hover:border-cyan-500/40 ${
                    f.isActive === false
                      ? 'border-rose-900/50 opacity-75'
                      : 'border-slate-800/90 hover:shadow-xl hover:shadow-cyan-950/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-700 flex items-center justify-center text-white font-bold text-base shadow">
                        {f.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white leading-tight">{f.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
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

                  <div className="mt-4 space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Briefcase className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{f.batchOrDesignation || 'Faculty'}</span>
                    </div>
                    {f.department && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Building className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{f.department}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-400">
                      <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{f.email}</span>
                    </div>
                    {f.phone && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{f.phone}</span>
                      </div>
                    )}
                    {f.bio && (
                      <p className="pt-1.5 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {f.bio}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between gap-1">
                    <button
                      onClick={() => {
                        setEditError(null);
                        setEditFaculty(f);
                        setEditForm({
                          name: f.name,
                          email: f.email,
                          department: f.department || DEPARTMENTS[0],
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
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                      title="Edit Faculty Details"
                    >
                      <Edit2 className="w-3 h-3 text-cyan-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => {
                        setChangePasswordTarget(f);
                        setFacultyNewPassword('');
                        setFacultyConfirmPassword('');
                        setChangePassError(null);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                      title="Reset Faculty Password"
                    >
                      <KeyRound className="w-3 h-3 text-amber-400" />
                      <span>Password</span>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(f)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
                      onClick={() => setDeleteConfirmTarget(f)}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 transition-colors"
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

      {/* TAB 2: REGISTERED STUDENTS */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search registered students by Roll No, name, branch, year..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
            <button
              onClick={loadStudents}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStudents ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
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
                              department: s.department || DEPARTMENTS[0],
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

      {/* TAB 3: ADMIN SETTINGS / PROFILE & CHANGE PASSWORD */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Administrator Profile & Personal Bio Card (View-first; click Edit option to modify) */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-cyan-400" />
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-colors"
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
                      department: currentUser.department || DEPARTMENTS[0],
                      phone: currentUser.phone || '',
                      skills: currentUser.skills || '',
                      bio: currentUser.bio || '',
                    });
                    setAdminProfileError(null);
                    setIsEditingAdminProfile(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
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
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block">Full Name</span>
                    <span className="mt-1 block text-sm font-semibold text-white">{currentUser.name}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block">Administrator Title</span>
                    <span className="mt-1 block text-sm font-medium text-cyan-300">
                      {currentUser.batchOrDesignation || 'System Administrator'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block">Login Email</span>
                    <span className="mt-1 block text-sm text-slate-200 truncate">{currentUser.email}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block">Department</span>
                    <span className="mt-1 block text-sm text-slate-200">
                      {currentUser.department || DEPARTMENTS[0]}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block">Phone / Office Ext</span>
                    <span className="mt-1 block text-sm font-mono text-slate-200">
                      {currentUser.phone || 'Not set'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block">Skills & Responsibilities</span>
                    <span className="mt-1 block text-sm text-slate-200">
                      {currentUser.skills || 'Not specified'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs font-semibold text-cyan-300 block mb-1">Personal Bio</span>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
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
                          {dept}
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

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminProfileForm({
                        name: currentUser.name,
                        email: currentUser.email,
                        batchOrDesignation: currentUser.batchOrDesignation || 'System Administrator',
                        department: currentUser.department || DEPARTMENTS[0],
                        phone: currentUser.phone || '',
                        skills: currentUser.skills || '',
                        bio: currentUser.bio || '',
                      });
                      setAdminProfileError(null);
                      setIsEditingAdminProfile(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adminProfileSaving}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {adminProfileSaving ? 'Saving Profile...' : 'Save Admin Profile & Bio'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Change Password Card */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-cyan-400" />
                Change Administrator Password
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Update your administrator master password. This change takes effect immediately across all sessions.
              </p>
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

              <button
                type="submit"
                disabled={adminPassSubmitting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
              >
                {adminPassSubmitting ? 'Updating Password...' : 'Update Admin Password'}
              </button>
            </form>
          </div>

          {/* Admin Identity & Safeguards Info Card */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Security Architecture & Rules
            </h2>
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="font-semibold text-cyan-300 block mb-1">One-Time Account Setup Protected</span>
                Admin initialization is permanently locked in the database. First-time setup forms are disabled forever to prevent unauthorized administrative takeover.
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="font-semibold text-cyan-300 block mb-1">Exclusive Faculty Provisioning</span>
                Faculty accounts cannot be self-registered publicly. Only the authenticated administrator can issue faculty credentials with compulsory passwords.
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="font-semibold text-cyan-300 block mb-1">Cryptographic Safeguards</span>
                All credentials are saved using scrypt password hashing with high-entropy cryptographic salts.
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE FACULTY ACCOUNT */}
      {createFacultyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-cyan-500/40 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Create Faculty Account</h3>
                  <p className="text-xs text-slate-400">
                    Administrator faculty provisioning with compulsory password
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateFacultyOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
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

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateFacultyOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 disabled:opacity-50"
                >
                  {createSubmitting ? 'Creating Faculty...' : 'Create Faculty Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT FACULTY DETAILS */}
      {editFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                Edit Details: {editFaculty.name} ({editFaculty.memberId})
              </h3>
              <button onClick={() => setEditFaculty(null)} className="text-slate-400 hover:text-white">
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

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditFaculty(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: EDIT STUDENT DETAILS */}
      {editStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                Edit Student: {editStudent.name} ({editStudent.memberId})
              </h3>
              <button onClick={() => setEditStudent(null)} className="text-slate-400 hover:text-white">
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

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditStudent(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editStudentSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  {editStudentSubmitting ? 'Saving...' : 'Save Student Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CHANGE FACULTY PASSWORD */}
      {changePasswordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-amber-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                Change Password: {changePasswordTarget.name}
              </h3>
              <button
                onClick={() => setChangePasswordTarget(null)}
                className="text-slate-400 hover:text-white"
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

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangePasswordTarget(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePassSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20"
                >
                  {changePassSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-rose-500/40 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-white">Delete Faculty Account?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to permanently delete the account for{' '}
                <strong className="text-white">{deleteConfirmTarget.name}</strong> ({deleteConfirmTarget.memberId})? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={deleteSubmitting}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFaculty}
                disabled={deleteSubmitting}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
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

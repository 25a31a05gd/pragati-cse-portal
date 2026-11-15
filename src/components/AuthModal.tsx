import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  GraduationCap,
  BookOpen,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Lock,
  User,
  Mail,
  Building,
  KeyRound,
  LogOut,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { apiRequest, setStoredToken } from '../api';
import type { PublicUserProfile, PortalProgress } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (profile: PublicUserProfile, progress: PortalProgress) => void;
  currentUser?: PublicUserProfile | null;
  onLogout?: () => void;
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

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'] as const;
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  currentUser,
  onLogout,
}) => {
  // Selected Tab: student | faculty | admin
  const [selectedRole, setSelectedRole] = useState<'student' | 'faculty' | 'admin'>('student');

  // Student Mode: login vs register
  const [studentMode, setStudentMode] = useState<'login' | 'register'>('login');

  // Admin Initialized State (fetched from DB)
  const [adminInitialized, setAdminInitialized] = useState<boolean | null>(null);
  const [loadingAdminStatus, setLoadingAdminStatus] = useState<boolean>(false);

  // Common UI State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- Student Fields ---
  const [studentLoginId, setStudentLoginId] = useState('');
  const [studentLoginPassword, setStudentLoginPassword] = useState('');

  const [studentRegName, setStudentRegName] = useState('');
  const [studentRegMemberId, setStudentRegMemberId] = useState('');
  const [studentRegEmail, setStudentRegEmail] = useState('');
  const [studentRegDept, setStudentRegDept] = useState(DEPARTMENTS[0]);
  const [studentRegYear, setStudentRegYear] = useState<string>(YEARS[0]);
  const [studentRegSection, setStudentRegSection] = useState<string>(SECTIONS[0]);
  const [studentRegPassword, setStudentRegPassword] = useState('');
  const [studentRegConfirmPassword, setStudentRegConfirmPassword] = useState('');

  // --- Faculty Fields (Login only) ---
  const [facultyLoginId, setFacultyLoginId] = useState('');
  const [facultyLoginPassword, setFacultyLoginPassword] = useState('');

  // --- Admin Fields ---
  // Setup fields (only shown when adminInitialized === false)
  const [adminSetupName, setAdminSetupName] = useState('');
  const [adminSetupId, setAdminSetupId] = useState('');
  const [adminSetupEmail, setAdminSetupEmail] = useState('');
  const [adminSetupPassword, setAdminSetupPassword] = useState('');
  const [adminSetupConfirmPassword, setAdminSetupConfirmPassword] = useState('');

  // Login fields (shown when adminInitialized === true)
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminLoginPassword, setAdminLoginPassword] = useState('');

  // Fetch admin setup status whenever modal opens or admin tab is selected
  const fetchAdminStatus = async () => {
    setLoadingAdminStatus(true);
    try {
      const res = await fetch('/api/auth/admin-status');
      if (res.ok) {
        const data = await res.json();
        setAdminInitialized(Boolean(data.initialized));
      }
    } catch {
      // fallback
    } finally {
      setLoadingAdminStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdminStatus();
      setErrorMessage(null);
      setSuccessMessage(null);
      setStudentLoginId('');
      setStudentLoginPassword('');
      setStudentRegName('');
      setStudentRegMemberId('');
      setStudentRegEmail('');
      setStudentRegPassword('');
      setStudentRegConfirmPassword('');
      setFacultyLoginId('');
      setFacultyLoginPassword('');
      setAdminSetupName('');
      setAdminSetupId('');
      setAdminSetupEmail('');
      setAdminSetupPassword('');
      setAdminSetupConfirmPassword('');
      setAdminLoginId('');
      setAdminLoginPassword('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedRole === 'admin') {
      fetchAdminStatus();
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [selectedRole]);

  if (!isOpen) return null;

  // Handle Student Login
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!studentLoginId.trim() || !studentLoginPassword) {
      setErrorMessage('Please enter your Student ID / Email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest<{
        token: string;
        profile: PublicUserProfile;
        progress: PortalProgress;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: studentLoginId.trim(),
          password: studentLoginPassword,
          role: 'student',
        }),
      });

      setStoredToken(data.token);
      localStorage.setItem('dept_portal_token', data.token);
      setSuccessMessage('Login successful! Welcome back.');
      setTimeout(() => {
        onAuthenticated(data.profile, data.progress);
        onClose();
      }, 500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid student credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Student Registration
  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (
      !studentRegName.trim() ||
      !studentRegMemberId.trim() ||
      !studentRegEmail.trim() ||
      !studentRegDept ||
      !studentRegYear ||
      !studentRegSection ||
      !studentRegPassword ||
      !studentRegConfirmPassword
    ) {
      setErrorMessage('All registration fields are compulsory.');
      return;
    }

    if (studentRegPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters in length.');
      return;
    }

    if (studentRegPassword !== studentRegConfirmPassword) {
      setErrorMessage('Password and Confirm Password do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest<{
        token: string;
        profile: PublicUserProfile;
        progress: PortalProgress;
        message?: string;
      }>('/api/auth/student-register', {
        method: 'POST',
        body: JSON.stringify({
          name: studentRegName.trim(),
          memberId: studentRegMemberId.trim().toUpperCase(),
          email: studentRegEmail.trim().toLowerCase(),
          department: studentRegDept,
          year: studentRegYear,
          section: studentRegSection,
          password: studentRegPassword,
          confirmPassword: studentRegConfirmPassword,
        }),
      });

      setStoredToken(data.token);
      localStorage.setItem('dept_portal_token', data.token);
      setSuccessMessage('Student registration successful! Logging you in...');
      setTimeout(() => {
        onAuthenticated(data.profile, data.progress);
        onClose();
      }, 600);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed. Check details.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Faculty Login
  const handleFacultyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!facultyLoginId.trim() || !facultyLoginPassword) {
      setErrorMessage('Please enter your Faculty ID / Email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest<{
        token: string;
        profile: PublicUserProfile;
        progress: PortalProgress;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: facultyLoginId.trim(),
          password: facultyLoginPassword,
          role: 'faculty',
        }),
      });

      setStoredToken(data.token);
      localStorage.setItem('dept_portal_token', data.token);
      setSuccessMessage('Faculty login verified successfully.');
      setTimeout(() => {
        onAuthenticated(data.profile, data.progress);
        onClose();
      }, 500);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Faculty login failed. Faculty accounts must be created by the College Administrator.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Admin First-Time Setup
  const handleAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (
      !adminSetupName.trim() ||
      !adminSetupId.trim() ||
      !adminSetupEmail.trim() ||
      !adminSetupPassword ||
      !adminSetupConfirmPassword
    ) {
      setErrorMessage('All admin setup fields are compulsory.');
      return;
    }

    if (adminSetupPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters in length.');
      return;
    }

    if (adminSetupPassword !== adminSetupConfirmPassword) {
      setErrorMessage('Password and Confirm Password do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest<{
        token: string;
        profile: PublicUserProfile;
        progress: PortalProgress;
        message?: string;
      }>('/api/auth/admin-setup', {
        method: 'POST',
        body: JSON.stringify({
          name: adminSetupName.trim(),
          memberId: adminSetupId.trim().toUpperCase(),
          email: adminSetupEmail.trim().toLowerCase(),
          password: adminSetupPassword,
          confirmPassword: adminSetupConfirmPassword,
        }),
      });

      setStoredToken(data.token);
      localStorage.setItem('dept_portal_token', data.token);
      setAdminInitialized(true);
      setSuccessMessage('Administrator initialized and saved to database! First-time setup is now permanently locked.');
      setTimeout(() => {
        onAuthenticated(data.profile, data.progress);
        onClose();
      }, 700);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Admin setup failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Admin Login (when adminInitialized === true)
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!adminLoginId.trim() || !adminLoginPassword) {
      setErrorMessage('Please enter your Admin ID / Email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest<{
        token: string;
        profile: PublicUserProfile;
        progress: PortalProgress;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: adminLoginId.trim(),
          password: adminLoginPassword,
          role: 'admin',
        }),
      });

      setStoredToken(data.token);
      localStorage.setItem('dept_portal_token', data.token);
      setSuccessMessage('Administrator authenticated successfully.');
      setTimeout(() => {
        onAuthenticated(data.profile, data.progress);
        onClose();
      }, 500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid administrator credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-900/95 border border-cyan-500/30 p-6 sm:p-8 shadow-2xl shadow-cyan-950/60 backdrop-blur-2xl">
        {/* Glow Highlights */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors z-20"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* College Header & Branding */}
        <div className="relative z-10 text-center pb-5 border-b border-slate-800/80">
          <div className="flex items-center justify-center gap-3 mb-2.5">
            <img
              src="/pragati-logo.png"
              alt="Pragati Engineering College"
              className="w-14 h-14 object-contain rounded-full shadow-lg p-0.5 bg-white/5 border border-cyan-400/40"
            />
            <div className="text-left">
              <span className="text-[10px] tracking-wider font-extrabold uppercase text-cyan-400 block">
                AUTONOMOUS · NBA & NAAC ACCREDITED 'A' GRADE
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight leading-tight">
                PRAGATI ENGINEERING COLLEGE
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                SURAMPALEM, NEAR PEDDAPURAM, ADB ROAD, E.G. DIST., A.P.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-950/80 to-blue-950/80 text-cyan-300 border border-cyan-500/30">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Institutional Unified Campus Portal</span>
          </div>
        </div>

        {/* If Already Logged In */}
        {currentUser ? (
          <div className="relative z-10 py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 mx-auto text-xl font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase mb-1">
                {currentUser.role}
              </div>
              <h3 className="text-xl font-bold text-white">{currentUser.name}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{currentUser.memberId} · {currentUser.email}</p>
              {currentUser.batchOrDesignation && (
                <p className="text-xs text-slate-300 mt-1">{currentUser.batchOrDesignation}</p>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Continue to Portal
              </button>
              {onLogout && (
                <button
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 text-xs font-semibold transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative z-10 pt-5 space-y-5">
            {/* THREE ROLE SELECTION TABS */}
            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-950/80 border border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedRole('student')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  selectedRole === 'student'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/25 scale-[1.02]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('faculty')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  selectedRole === 'faculty'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/25 scale-[1.02]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>Faculty</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('admin')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  selectedRole === 'admin'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/25 scale-[1.02]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Admin</span>
              </button>
            </div>

            {/* ERROR BANNER */}
            {errorMessage && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* SUCCESS BANNER */}
            {successMessage && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* ======================================================== */}
            {/* 1. STUDENT TAB (LOGIN + SIGN UP) */}
            {/* ======================================================== */}
            {selectedRole === 'student' && (
              <div className="space-y-4">
                {/* Mode Selector: Login vs Sign Up */}
                <div className="flex items-center justify-center gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStudentMode('login');
                      setErrorMessage(null);
                    }}
                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      studentMode === 'login'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Student Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentMode('register');
                      setErrorMessage(null);
                    }}
                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      studentMode === 'register'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Student Sign Up
                  </button>
                </div>

                {/* STUDENT LOGIN FORM */}
                {studentMode === 'login' ? (
                  <form onSubmit={handleStudentLogin} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Student ID / Roll Number or Email <span className="text-cyan-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          autoComplete="off"
                          value={studentLoginId}
                          onChange={(e) => setStudentLoginId(e.target.value)}
                          placeholder="Enter Student ID / Roll Number or Email"
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Password <span className="text-cyan-400">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={studentLoginPassword}
                          onChange={(e) => setStudentLoginPassword(e.target.value)}
                          placeholder="Enter your student password"
                          className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2"
                    >
                      {submitting ? 'Authenticating...' : 'Sign In as Student'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="text-center pt-2 text-xs text-slate-400">
                      Don't have a student account?{' '}
                      <button
                        type="button"
                        onClick={() => setStudentMode('register')}
                        className="text-cyan-400 hover:underline font-semibold"
                      >
                        Create one now
                      </button>
                    </div>
                  </form>
                ) : (
                  /* STUDENT REGISTRATION FORM */
                  <form onSubmit={handleStudentRegister} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Full Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="off"
                          value={studentRegName}
                          onChange={(e) => setStudentRegName(e.target.value)}
                          placeholder="Enter full name"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Student ID / Roll No <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="off"
                          value={studentRegMemberId}
                          onChange={(e) => setStudentRegMemberId(e.target.value)}
                          placeholder="Enter Student ID / Roll Number"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 font-mono uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Email Address <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        autoComplete="off"
                        value={studentRegEmail}
                        onChange={(e) => setStudentRegEmail(e.target.value)}
                        placeholder="Enter email address"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Department <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={studentRegDept}
                        onChange={(e) => setStudentRegDept(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-cyan-400"
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Year <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={studentRegYear}
                          onChange={(e) => setStudentRegYear(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-cyan-400"
                        >
                          {YEARS.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Section (A to I) <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={studentRegSection}
                          onChange={(e) => setStudentRegSection(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-cyan-400"
                        >
                          {SECTIONS.map((sec) => (
                            <option key={sec} value={sec}>
                              Section {sec}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Password <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={studentRegPassword}
                            onChange={(e) => setStudentRegPassword(e.target.value)}
                            placeholder="At least 6 chars"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 pr-9"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Confirm Password <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            value={studentRegConfirmPassword}
                            onChange={(e) => setStudentRegConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 pr-9"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 mt-2"
                    >
                      {submitting ? 'Creating Student Account...' : 'Register Student Account'}
                    </button>

                    <div className="text-center pt-1 text-xs text-slate-400">
                      Already registered?{' '}
                      <button
                        type="button"
                        onClick={() => setStudentMode('login')}
                        className="text-cyan-400 hover:underline font-semibold"
                      >
                        Sign in here
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* 2. FACULTY TAB (LOGIN ONLY) */}
            {/* ======================================================== */}
            {selectedRole === 'faculty' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-200 text-xs flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-cyan-300">Authorized Faculty Login</span>
                    Faculty accounts are provisioned exclusively by the College Administrator. Enter your Faculty ID or registered email with the password provided by administration.
                  </div>
                </div>

                <form onSubmit={handleFacultyLogin} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Faculty ID / Institutional Email <span className="text-cyan-400">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        autoComplete="off"
                        value={facultyLoginId}
                        onChange={(e) => setFacultyLoginId(e.target.value)}
                        placeholder="Enter Faculty ID or Email Address"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Password <span className="text-cyan-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={facultyLoginPassword}
                        onChange={(e) => setFacultyLoginPassword(e.target.value)}
                        placeholder="Enter faculty password"
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2"
                  >
                    {submitting ? 'Verifying Faculty Access...' : 'Sign In as Faculty'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="text-center pt-1 text-[11px] text-slate-500">
                    Faculty cannot self-register. Contact the Central Administrator to request portal access.
                  </div>
                </form>
              </div>
            )}

            {/* ======================================================== */}
            {/* 3. ADMIN TAB (FIRST-TIME SETUP ONCE vs ONLY LOGIN) */}
            {/* ======================================================== */}
            {selectedRole === 'admin' && (
              <div className="space-y-4">
                {loadingAdminStatus ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Verifying administrative initialization state...
                  </div>
                ) : adminInitialized === false ? (
                  /* FIRST TIME ADMIN ACCOUNT SETUP */
                  <div className="space-y-3.5">
                    <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block text-amber-300">
                          First-Time Administrator Setup
                        </span>
                        Initialize the primary Administrator account for Pragati Engineering College. Once saved, this setup screen is permanently locked and only regular Admin Login will be available.
                      </div>
                    </div>

                    <form onSubmit={handleAdminSetup} className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Admin Full Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="off"
                          value={adminSetupName}
                          onChange={(e) => setAdminSetupName(e.target.value)}
                          placeholder="Enter Admin Full Name"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Admin ID <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            autoComplete="off"
                            value={adminSetupId}
                            onChange={(e) => setAdminSetupId(e.target.value)}
                            placeholder="Enter Admin ID"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 uppercase font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Email Address <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="email"
                            required
                            autoComplete="off"
                            value={adminSetupEmail}
                            onChange={(e) => setAdminSetupEmail(e.target.value)}
                            placeholder="Enter Admin Email Address"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Password <span className="text-rose-400">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              value={adminSetupPassword}
                              onChange={(e) => setAdminSetupPassword(e.target.value)}
                              placeholder="At least 6 chars"
                              className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 pr-9"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                            >
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Confirm Password <span className="text-rose-400">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              required
                              value={adminSetupConfirmPassword}
                              onChange={(e) => setAdminSetupConfirmPassword(e.target.value)}
                              placeholder="Re-enter password"
                              className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 pr-9"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                            >
                              {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2"
                      >
                        {submitting ? 'Saving Admin Account...' : 'Create Admin Account (One-Time)'}
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                ) : (
                  /* AFTER FIRST-TIME SETUP: SHOW ONLY ADMIN LOGIN */
                  <div className="space-y-3.5">
                    <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-200 text-xs flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block text-cyan-300">Central Portal Administrator</span>
                        Sign in with your established Administrator ID and password to access the administration dashboard.
                      </div>
                    </div>

                    <form onSubmit={handleAdminLogin} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Admin ID / Email <span className="text-cyan-400">*</span>
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            autoComplete="off"
                            value={adminLoginId}
                            onChange={(e) => setAdminLoginId(e.target.value)}
                            placeholder="Enter Admin ID or Email Address"
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 uppercase font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Password <span className="text-cyan-400">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={adminLoginPassword}
                            onChange={(e) => setAdminLoginPassword(e.target.value)}
                            placeholder="Enter administrator password"
                            className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2"
                      >
                        {submitting ? 'Verifying Admin Access...' : 'Sign In as Administrator'}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 text-center">
                        <Lock className="w-3 h-3 inline mr-1 text-slate-500" />
                        Admin setup is initialized. Password changes must be done inside the Admin Dashboard Settings after logging in.
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

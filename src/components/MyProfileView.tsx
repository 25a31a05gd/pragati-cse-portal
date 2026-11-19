import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  ExternalLink,
  Bell,
  CheckCheck,
  Save,
  Pencil,
  X,
  Mail,
  Building2,
  Phone,
  GraduationCap,
  Award,
  Copy,
  Check,
  Code2,
  FolderGit2,
  ShieldCheck,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { apiRequest, safeExternalHref } from '../api';
import type {
  NavSection,
  PortalNotification,
  PortalProgress,
  PublicUserProfile,
} from '../types';

interface MyProfileViewProps {
  profile: PublicUserProfile;
  progress: PortalProgress;
  notifications: PortalNotification[];
  onProfileSaved: (nextProfile: PublicUserProfile, nextProgress: PortalProgress) => void;
  onMarkNotificationsRead: (notificationId?: string) => void;
  onNavigate: (section: NavSection) => void;
  onOpenReminders?: () => void;
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

export const MyProfileView: React.FC<MyProfileViewProps> = ({
  profile,
  progress,
  notifications,
  onProfileSaved,
  onMarkNotificationsRead,
  onNavigate,
  onOpenReminders,
}) => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<'id' | 'email' | null>(null);

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [department, setDepartment] = useState(profile.department || DEPARTMENTS[0]);
  const [phone, setPhone] = useState(profile.phone || '');
  const [batchOrDesignation, setBatchOrDesignation] = useState(
    profile.batchOrDesignation
  );

  // Student-specific fields
  const [year, setYear] = useState(profile.year || YEARS[0]);
  const [section, setSection] = useState(profile.section || SECTIONS[0]);

  // Faculty-specific fields
  const [designation, setDesignation] = useState(
    profile.designation ||
      (profile.batchOrDesignation || '').split(',')[0]?.trim() ||
      DESIGNATIONS[4]
  );
  const [specialization, setSpecialization] = useState(
    profile.specialization || profile.department || ''
  );
  const [qualification, setQualification] = useState(profile.qualification || '');
  const [experienceYears, setExperienceYears] = useState(
    profile.experienceYears !== undefined ? String(profile.experienceYears) : '5'
  );

  const [skills, setSkills] = useState(profile.skills);
  const [bio, setBio] = useState(profile.bio);

  const [leetcodeUrl, setLeetcodeUrl] = useState(profile.codingStats.leetcodeUrl);
  const [hackerrankUrl, setHackerrankUrl] = useState(
    profile.codingStats.hackerrankUrl
  );
  const [githubUrl, setGithubUrl] = useState(profile.codingStats.githubUrl);

  const [saving, setSaving] = useState(false);
  const [syncingOnly, setSyncingOnly] = useState(false);
  const [ownerChallenges, setOwnerChallenges] = useState<
    Partial<
      Record<
        'leetcode' | 'hackerrank' | 'github',
        { code: string; instructions: string; username: string }
      >
    >
  >({});
  const [ownerBusy, setOwnerBusy] = useState<
    Partial<Record<'leetcode' | 'hackerrank' | 'github', 'challenge' | 'verify' | null>>
  >({});
  const [copiedOwnerCode, setCopiedOwnerCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const syncFormFromProfile = (source: PublicUserProfile) => {
    setName(source.name);
    setEmail(source.email);
    setDepartment(source.department || DEPARTMENTS[0]);
    setPhone(source.phone || '');
    setBatchOrDesignation(source.batchOrDesignation);
    setYear(source.year || YEARS[0]);
    setSection(source.section || SECTIONS[0]);
    setDesignation(
      source.designation ||
        (source.batchOrDesignation || '').split(',')[0]?.trim() ||
        DESIGNATIONS[4]
    );
    setSpecialization(source.specialization || source.department || '');
    setQualification(source.qualification || '');
    setExperienceYears(
      source.experienceYears !== undefined ? String(source.experienceYears) : '5'
    );
    setSkills(source.skills);
    setBio(source.bio);
    setLeetcodeUrl(source.codingStats.leetcodeUrl);
    setHackerrankUrl(source.codingStats.hackerrankUrl);
    setGithubUrl(source.codingStats.githubUrl);
  };

  useEffect(() => {
    syncFormFromProfile(profile);
  }, [profile]);

  const openEditModal = () => {
    syncFormFromProfile(profile);
    setModalError(null);
    setEditModalOpen(true);
  };

  const handleCopy = async (text: string, field: 'id' | 'email') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // ignore clipboard failures in restricted contexts
    }
  };

  const handleQuickSyncCoding = async () => {
    if (profile.role !== 'student') return;
    setSyncingOnly(true);
    setFeedback(null);
    try {
      const res = await apiRequest<{
        profile: PublicUserProfile;
        progress: PortalProgress;
        syncWarnings?: string[];
      }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ syncCodingLinks: true }),
      });
      onProfileSaved(res.profile, res.progress);
      if (res.syncWarnings && res.syncWarnings.length > 0) {
        setFeedback({
          type: 'warning',
          message: res.syncWarnings.join(' '),
        });
      } else {
        setFeedback({
          type: 'success',
          message: 'Coding platform statistics synced cleanly.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to sync coding metrics.',
      });
    } finally {
      setSyncingOnly(false);
    }
  };

  const handleRequestOwnerChallenge = async (
    platform: 'leetcode' | 'hackerrank' | 'github'
  ) => {
    if (profile.role !== 'student') return;
    setOwnerBusy((prev) => ({ ...prev, [platform]: 'challenge' }));
    setFeedback(null);
    try {
      const res = await apiRequest<{
        platform: string;
        username: string;
        verificationCode: string;
        instructions: string;
      }>('/api/profile/coding-ownership/challenge', {
        method: 'POST',
        body: JSON.stringify({ platform }),
      });
      setOwnerChallenges((prev) => ({
        ...prev,
        [platform]: {
          code: res.verificationCode,
          instructions: res.instructions,
          username: res.username,
        },
      }));
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Unable to generate ownership verification code.',
      });
    } finally {
      setOwnerBusy((prev) => ({ ...prev, [platform]: null }));
    }
  };

  const handleVerifyOwnerChallenge = async (
    platform: 'leetcode' | 'hackerrank' | 'github'
  ) => {
    const challenge = ownerChallenges[platform];
    if (profile.role !== 'student' || !challenge?.code) return;
    setOwnerBusy((prev) => ({ ...prev, [platform]: 'verify' }));
    setFeedback(null);
    try {
      const res = await apiRequest<{
        ok: boolean;
        message: string;
        profile: PublicUserProfile;
        progress: PortalProgress;
      }>('/api/profile/coding-ownership/verify', {
        method: 'POST',
        body: JSON.stringify({ platform, verificationCode: challenge.code }),
      });
      onProfileSaved(res.profile, res.progress);
      setOwnerChallenges((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
      setFeedback({
        type: 'success',
        message: res.message || `${platform} ownership verified.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Could not verify coding profile ownership yet.',
      });
    } finally {
      setOwnerBusy((prev) => ({ ...prev, [platform]: null }));
    }
  };

  const handleCopyOwnerCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedOwnerCode(code);
      setTimeout(() => setCopiedOwnerCode(null), 1800);
    } catch {
      // ignore clipboard failures in restricted contexts
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    setFeedback(null);
    try {
      const payload: Record<string, unknown> = {
        name,
        department,
        phone,
        skills,
        bio,
      };

      const codingUrlsChanged =
        profile.role === 'student' &&
        (leetcodeUrl.trim() !== (profile.codingStats.leetcodeUrl || '') ||
          hackerrankUrl.trim() !== (profile.codingStats.hackerrankUrl || '') ||
          githubUrl.trim() !== (profile.codingStats.githubUrl || ''));

      if (profile.role === 'student') {
        payload.year = year;
        payload.section = section;
        if (codingUrlsChanged) {
          payload.leetcodeUrl = leetcodeUrl;
          payload.hackerrankUrl = hackerrankUrl;
          payload.githubUrl = githubUrl;
          payload.syncCodingLinks = true;
        }
      } else if (profile.role === 'faculty') {
        payload.designation = designation;
        payload.specialization = specialization;
        payload.qualification = qualification;
        payload.experienceYears = parseInt(experienceYears, 10) || 0;
      } else if (profile.role === 'admin') {
        payload.email = email;
        payload.batchOrDesignation = batchOrDesignation;
      }

      const res = await apiRequest<{
        profile: PublicUserProfile;
        progress: PortalProgress;
        syncWarnings?: string[];
      }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      onProfileSaved(res.profile, res.progress);
      setEditModalOpen(false);
      if (res.syncWarnings && res.syncWarnings.length > 0) {
        setFeedback({
          type: 'warning',
          message: `Profile updated, with sync notices: ${res.syncWarnings.join(' ')}`,
        });
      } else {
        setFeedback({
          type: 'success',
          message:
            codingUrlsChanged
              ? 'Your personal bio, profile details, and coding metrics have been updated.'
              : 'Your personal bio, name, and profile details have been updated.',
        });
      }
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const unreadCount = notifications.filter(
    (n) => !n.readByUserIds.includes(profile.id)
  ).length;

  const totalPortalActions =
    progress.appsUploaded +
    progress.problemsSolved +
    progress.projectsPublished +
    progress.hackathonsShared +
    (progress.interviewsShared || 0);

  const skillTags = (profile.skills || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const initials = profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || profile.name.slice(0, 2).toUpperCase();

  const joinedLabel = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
      })
    : 'Active Member';

  const formatExternalUrl = (raw: string) => safeExternalHref(raw);

  return (
    <div className="space-y-6">
      {/* 1. Clean Profile Hero Card */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-4 sm:px-6 py-5 sm:py-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-5">
            <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 border border-white/20 flex items-center justify-center text-lg sm:text-xl font-bold tracking-tight text-white shadow-md shrink-0">
                {initials}
              </div>

              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 font-semibold text-cyan-300 capitalize">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>{profile.role} Account</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(profile.memberId, 'id')}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800/90 hover:bg-slate-700 px-2 py-0.5 font-mono font-semibold text-slate-100 transition-colors"
                    title="Copy Member ID"
                  >
                    <span>{profile.memberId}</span>
                    {copiedField === 'id' ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                  {profile.isActive !== false && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Active
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
                  {profile.name}
                </h1>

                <p className="text-xs sm:text-sm text-slate-300 truncate">
                  {profile.role === 'faculty'
                    ? `${profile.designation || profile.batchOrDesignation || 'Faculty'} · ${profile.department || 'CSE'}`
                    : profile.role === 'admin'
                    ? `${profile.batchOrDesignation || 'System Administrator'} · ${profile.department || 'CSE'}`
                    : `${profile.batchOrDesignation || `${profile.year || ''} ${profile.department || 'CSE'}`}`}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={openEditModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 sm:px-4 py-2 sm:py-2.5 min-h-[38px] text-xs font-semibold text-white shadow-sm transition-colors whitespace-nowrap"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit Profile & Bio</span>
              </button>

              {profile.role === 'student' && (
                <button
                  type="button"
                  onClick={handleQuickSyncCoding}
                  disabled={syncingOnly}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 sm:px-3.5 py-2 sm:py-2.5 min-h-[38px] text-xs font-semibold text-white transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncingOnly ? 'animate-spin' : ''}`} />
                  <span>{syncingOnly ? 'Syncing...' : 'Sync Coding Stats'}</span>
                </button>
              )}

              {profile.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => onNavigate('admin-control')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 sm:px-3.5 py-2 sm:py-2.5 min-h-[38px] text-xs font-semibold text-cyan-200 transition-colors whitespace-nowrap"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Admin Dashboard</span>
                </button>
              )}

              {onOpenReminders && (
                <button
                  type="button"
                  onClick={onOpenReminders}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 sm:px-3.5 py-2 sm:py-2.5 min-h-[38px] text-xs font-semibold text-white transition-colors whitespace-nowrap"
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span>Reminders</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-cyan-400 text-slate-950 px-1.5 py-0.2 font-mono text-[10px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200/80 border-t border-slate-200/80 text-xs">
          <div className="bg-slate-50/90 px-4 sm:px-5 py-3 min-w-0">
            <div className="text-slate-500">Department</div>
            <div className="mt-0.5 font-semibold text-slate-900 truncate">
              {profile.department || 'Computer Science & Engineering (CSE)'}
            </div>
          </div>

          {profile.role === 'student' ? (
            <div className="bg-slate-50/90 px-4 sm:px-5 py-3 min-w-0">
              <div className="text-slate-500">Current CGPA</div>
              <div className="mt-0.5 font-bold font-mono tabular-nums text-slate-900">
                {profile.cgpa ? profile.cgpa.toFixed(2) : '0.00'} / 10.0
              </div>
            </div>
          ) : profile.role === 'faculty' ? (
            <div className="bg-slate-50/90 px-4 sm:px-5 py-3 min-w-0">
              <div className="text-slate-500">Experience</div>
              <div className="mt-0.5 font-bold font-mono tabular-nums text-slate-900">
                {profile.experienceYears ? `${profile.experienceYears}+ Years` : 'Faculty'}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/90 px-4 sm:px-5 py-3 min-w-0">
              <div className="text-slate-500">Authority</div>
              <div className="mt-0.5 font-semibold text-slate-900 truncate">
                Central Portal Admin
              </div>
            </div>
          )}

          <div className="bg-slate-50/90 px-4 sm:px-5 py-3 min-w-0">
            <div className="text-slate-500">Portal Contributions</div>
            <div className="mt-0.5 font-bold font-mono tabular-nums text-blue-700 truncate">
              {totalPortalActions} Published / Solved
            </div>
          </div>

          <div className="bg-slate-50/90 px-4 sm:px-5 py-3 min-w-0">
            <div className="text-slate-500">Member Since</div>
            <div className="mt-0.5 font-semibold text-slate-900 truncate">{joinedLabel}</div>
          </div>
        </div>
      </section>

      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : feedback.type === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-semibold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Balanced 2-Column Profile Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Main Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Personal Bio & Skills Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Personal Bio & Skills
                </h2>
              </div>
              <button
                type="button"
                onClick={openEditModal}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
              >
                <Pencil className="h-3 w-3" />
                <span>{profile.bio ? 'Edit Bio' : 'Add Bio'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                About
              </div>
              {profile.bio ? (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {profile.bio}
                </p>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    Share a short personal bio about your academic background, research interests, or goals.
                  </p>
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                  >
                    + Add Personal Bio
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2.5 pt-3 border-t border-slate-100">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {profile.role === 'student'
                  ? 'Technical Skills'
                  : profile.role === 'faculty'
                  ? 'Research & Teaching Areas'
                  : 'Areas of Responsibility'}
              </div>
              {skillTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {skillTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No skills added yet. Click{' '}
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="font-semibold text-blue-700 hover:underline"
                  >
                    Edit Profile & Bio
                  </button>{' '}
                  to list your skills.
                </p>
              )}
            </div>
          </section>

          {/* Student Coding Platforms Section */}
          {profile.role === 'student' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Synced Coding Platforms
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleQuickSyncCoding}
                    disabled={syncingOnly}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3 w-3 ${syncingOnly ? 'animate-spin' : ''}`} />
                    <span>{syncingOnly ? 'Syncing...' : 'Sync Now'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Update Links</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between gap-2.5 h-full min-w-0">
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-slate-500">LeetCode Solved</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {profile.codingStats.leetcodeSolved}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500">
                      Easy {profile.codingStats.leetcodeEasy} · Med {profile.codingStats.leetcodeMedium} · Hard{' '}
                      {profile.codingStats.leetcodeHard}
                    </div>
                    {(profile.codingStats.leetcodeUrl || profile.codingStats.leetcodeSolved > 0) && (
                      <div
                        className={`text-[11px] font-medium ${
                          profile.codingStats.leetcodeVerified &&
                          profile.codingStats.leetcodeOwnerVerified
                            ? 'text-emerald-700'
                            : profile.codingStats.leetcodeVerified
                            ? 'text-slate-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {profile.codingStats.leetcodeVerified &&
                        profile.codingStats.leetcodeOwnerVerified
                          ? 'Verified Stats & Owner'
                          : profile.codingStats.leetcodeVerified
                          ? 'Public Stats Synced · Ownership Unverified'
                          : 'Unverified · Click Sync Now'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    {profile.codingStats.leetcodeUrl && formatExternalUrl(profile.codingStats.leetcodeUrl) ? (
                      <a
                        href={formatExternalUrl(profile.codingStats.leetcodeUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                      >
                        <span>@{profile.codingStats.leetcodeUsername || 'leetcode'}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={openEditModal}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        + Add LeetCode Link
                      </button>
                    )}

                    {profile.codingStats.leetcodeUrl && !profile.codingStats.leetcodeOwnerVerified && (
                      <div className="pt-1.5 border-t border-slate-200/80 space-y-1.5">
                        {!ownerChallenges.leetcode ? (
                          <button
                            type="button"
                            onClick={() => handleRequestOwnerChallenge('leetcode')}
                            disabled={ownerBusy.leetcode === 'challenge'}
                            className="w-full rounded-lg border border-blue-200 bg-white hover:bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 transition-colors disabled:opacity-60"
                          >
                            {ownerBusy.leetcode === 'challenge'
                              ? 'Generating Code...'
                              : 'Verify Handle Ownership'}
                          </button>
                        ) : (
                          <div className="rounded-lg border border-blue-200 bg-white p-2 space-y-1.5 text-[11px]">
                            <div className="flex items-center justify-between gap-1">
                              <code className="font-mono font-bold text-slate-900 text-[10px] truncate">
                                {ownerChallenges.leetcode.code}
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopyOwnerCode(ownerChallenges.leetcode!.code)}
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700 hover:underline shrink-0"
                              >
                                {copiedOwnerCode === ownerChallenges.leetcode.code ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-600 leading-snug">
                              Add code to LeetCode Bio/Summary, save, then verify:
                            </p>
                            <button
                              type="button"
                              onClick={() => handleVerifyOwnerChallenge('leetcode')}
                              disabled={ownerBusy.leetcode === 'verify'}
                              className="w-full rounded-md bg-blue-600 hover:bg-blue-700 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                            >
                              {ownerBusy.leetcode === 'verify'
                                ? 'Checking Bio...'
                                : 'Check Bio & Verify'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between gap-2.5 h-full min-w-0">
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-slate-500">
                      HackerRank 5★ Badges
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {profile.codingStats.hackerrankFiveStars}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      5-star skill badges
                    </div>
                    {(profile.codingStats.hackerrankUrl ||
                      profile.codingStats.hackerrankFiveStars > 0) && (
                      <div
                        className={`text-[11px] font-medium ${
                          profile.codingStats.hackerrankVerified &&
                          profile.codingStats.hackerrankOwnerVerified
                            ? 'text-emerald-700'
                            : profile.codingStats.hackerrankVerified
                            ? 'text-slate-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {profile.codingStats.hackerrankVerified &&
                        profile.codingStats.hackerrankOwnerVerified
                          ? 'Verified Stats & Owner'
                          : profile.codingStats.hackerrankVerified
                          ? 'Public Stats Synced · Ownership Unverified'
                          : 'Unverified · Click Sync Now'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    {profile.codingStats.hackerrankUrl &&
                    formatExternalUrl(profile.codingStats.hackerrankUrl) ? (
                      <a
                        href={formatExternalUrl(profile.codingStats.hackerrankUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                      >
                        <span>@{profile.codingStats.hackerrankUsername || 'hackerrank'}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={openEditModal}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        + Add HackerRank Link
                      </button>
                    )}

                    {profile.codingStats.hackerrankUrl &&
                      !profile.codingStats.hackerrankOwnerVerified && (
                        <div className="pt-1.5 border-t border-slate-200/80 space-y-1.5">
                          {!ownerChallenges.hackerrank ? (
                            <button
                              type="button"
                              onClick={() => handleRequestOwnerChallenge('hackerrank')}
                              disabled={ownerBusy.hackerrank === 'challenge'}
                              className="w-full rounded-lg border border-blue-200 bg-white hover:bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 transition-colors disabled:opacity-60"
                            >
                              {ownerBusy.hackerrank === 'challenge'
                                ? 'Generating Code...'
                                : 'Verify Handle Ownership'}
                            </button>
                          ) : (
                            <div className="rounded-lg border border-blue-200 bg-white p-2 space-y-1.5 text-[11px]">
                              <div className="flex items-center justify-between gap-1">
                                <code className="font-mono font-bold text-slate-900 text-[10px] truncate">
                                  {ownerChallenges.hackerrank.code}
                                </code>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyOwnerCode(ownerChallenges.hackerrank!.code)
                                  }
                                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700 hover:underline shrink-0"
                                >
                                  {copiedOwnerCode === ownerChallenges.hackerrank.code ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-600" />
                                      <span>Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="text-[10px] text-slate-600 leading-snug">
                                Add to public About / Headline (or ask Faculty/Admin coordinator), then verify:
                              </p>
                              <button
                                type="button"
                                onClick={() => handleVerifyOwnerChallenge('hackerrank')}
                                disabled={ownerBusy.hackerrank === 'verify'}
                                className="w-full rounded-md bg-blue-600 hover:bg-blue-700 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                              >
                                {ownerBusy.hackerrank === 'verify'
                                  ? 'Checking Bio...'
                                  : 'Check Bio & Verify'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between gap-2.5 h-full min-w-0">
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-slate-500">GitHub Projects</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {profile.codingStats.githubProjects}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Public repositories & builds
                    </div>
                    {(profile.codingStats.githubUrl || profile.codingStats.githubProjects > 0) && (
                      <div
                        className={`text-[11px] font-medium ${
                          profile.codingStats.githubVerified &&
                          profile.codingStats.githubOwnerVerified
                            ? 'text-emerald-700'
                            : profile.codingStats.githubVerified
                            ? 'text-slate-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {profile.codingStats.githubVerified &&
                        profile.codingStats.githubOwnerVerified
                          ? 'Verified Stats & Owner'
                          : profile.codingStats.githubVerified
                          ? 'Public Stats Synced · Ownership Unverified'
                          : 'Unverified · Click Sync Now'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    {profile.codingStats.githubUrl && formatExternalUrl(profile.codingStats.githubUrl) ? (
                      <a
                        href={formatExternalUrl(profile.codingStats.githubUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                      >
                        <span>@{profile.codingStats.githubUsername || 'github'}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={openEditModal}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        + Add GitHub Link
                      </button>
                    )}

                    {profile.codingStats.githubUrl && !profile.codingStats.githubOwnerVerified && (
                      <div className="pt-1.5 border-t border-slate-200/80 space-y-1.5">
                        {!ownerChallenges.github ? (
                          <button
                            type="button"
                            onClick={() => handleRequestOwnerChallenge('github')}
                            disabled={ownerBusy.github === 'challenge'}
                            className="w-full rounded-lg border border-blue-200 bg-white hover:bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 transition-colors disabled:opacity-60"
                          >
                            {ownerBusy.github === 'challenge'
                              ? 'Generating Code...'
                              : 'Verify Handle Ownership'}
                          </button>
                        ) : (
                          <div className="rounded-lg border border-blue-200 bg-white p-2 space-y-1.5 text-[11px]">
                            <div className="flex items-center justify-between gap-1">
                              <code className="font-mono font-bold text-slate-900 text-[10px] truncate">
                                {ownerChallenges.github.code}
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopyOwnerCode(ownerChallenges.github!.code)}
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700 hover:underline shrink-0"
                              >
                                {copiedOwnerCode === ownerChallenges.github.code ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-600 leading-snug">
                              Add code to GitHub profile Bio, save, then verify:
                            </p>
                            <button
                              type="button"
                              onClick={() => handleVerifyOwnerChallenge('github')}
                              disabled={ownerBusy.github === 'verify'}
                              className="w-full rounded-md bg-blue-600 hover:bg-blue-700 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                            >
                              {ownerBusy.github === 'verify'
                                ? 'Checking Bio...'
                                : 'Check Bio & Verify'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Reminders & Notifications */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="h-4 w-4 text-blue-600 shrink-0" />
                <h2 className="text-base font-bold text-slate-900">
                  Notifications & Reminders
                </h2>
                {unreadCount > 0 && (
                  <span className="text-xs font-mono tabular-nums font-semibold text-blue-700 shrink-0">
                    ({unreadCount} unread)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onOpenReminders && (
                  <button
                    type="button"
                    onClick={onOpenReminders}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 py-1.5 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    <span>Reminders Center</span>
                  </button>
                )}
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onMarkNotificationsRead()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Mark All Read</span>
                  </button>
                )}
              </div>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500">
                No notifications yet. Whenever anyone posts a Problem Statement or shares an update, reminders appear here automatically.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notif) => {
                  const isUnread = !notif.readByUserIds.includes(profile.id);
                  return (
                    <div
                      key={notif.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
                    >
                      <div className="space-y-0.5 max-w-xl min-w-0">
                        <div className="text-xs text-slate-500">
                          <span
                            className={
                              isUnread
                                ? 'font-semibold text-blue-700'
                                : 'font-normal text-slate-500'
                            }
                          >
                            {isUnread ? 'Unread' : 'Read'}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span>From {notif.actorName}</span>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 break-words">
                          {notif.title}
                        </div>
                        <p className="text-xs text-slate-600 break-words">{notif.message}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onMarkNotificationsRead(notif.id);
                          onNavigate(notif.targetSection);
                        }}
                        className="self-start sm:self-center rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-3 min-h-[34px] text-xs font-semibold text-slate-800 hover:border-blue-400 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
                      >
                        Open →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Account & Contact Details Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Account Details</h2>
              <button
                type="button"
                onClick={openEditModal}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Edit
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-slate-500">Email Address</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-medium text-slate-900 truncate">{profile.email}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(profile.email, 'email')}
                      className="text-slate-400 hover:text-slate-700 shrink-0"
                      title="Copy Email"
                    >
                      {copiedField === 'email' ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-slate-500">Department</div>
                  <div className="mt-0.5 font-medium text-slate-900">
                    {profile.department || 'Computer Science & Engineering (CSE)'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-slate-500">
                    {profile.role === 'faculty' ? 'Phone / Cabin & Ext' : 'Phone Number'}
                  </div>
                  <div className="mt-0.5 font-mono text-slate-900">
                    {profile.phone || 'Not added yet'}
                  </div>
                </div>
              </div>

              {profile.role === 'student' && (
                <>
                  <div className="flex items-start gap-3">
                    <GraduationCap className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-slate-500">Academic Year & Section</div>
                      <div className="mt-0.5 font-medium text-slate-900">
                        {profile.year || 'Not set'}
                        {profile.section ? ` · Section ${profile.section}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Award className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-slate-500">CGPA</div>
                      <div className="mt-0.5 font-bold font-mono text-slate-900">
                        {profile.cgpa ? profile.cgpa.toFixed(2) : '0.00'} / 10.0
                      </div>
                    </div>
                  </div>
                </>
              )}

              {profile.role === 'faculty' && (
                <>
                  <div className="flex items-start gap-3">
                    <GraduationCap className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-slate-500">Designation & Qualification</div>
                      <div className="mt-0.5 font-medium text-slate-900">
                        {profile.designation || profile.batchOrDesignation || 'Faculty'}
                      </div>
                      {profile.qualification && (
                        <div className="text-slate-600 mt-0.5">{profile.qualification}</div>
                      )}
                    </div>
                  </div>
                  {profile.specialization && (
                    <div className="flex items-start gap-3">
                      <Award className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-slate-500">Specialization</div>
                        <div className="mt-0.5 font-medium text-slate-900">
                          {profile.specialization}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {profile.role === 'admin' && (
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-slate-500">Administrative Title</div>
                    <div className="mt-0.5 font-medium text-slate-900">
                      {profile.batchOrDesignation || 'System Administrator'}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-slate-500">Member Since</div>
                  <div className="mt-0.5 font-medium text-slate-900">{joinedLabel}</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={openEditModal}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 py-2 px-3 text-xs font-semibold text-slate-700 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Name, Bio & Details</span>
            </button>
          </section>

          {/* Portal Activity Summary Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Portal Activity</h2>
              </div>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700">
                {totalPortalActions} Total
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                {
                  label: 'Projects Published',
                  value: progress.projectsPublished,
                  section: 'projects' as NavSection,
                },
                {
                  label: 'Apps & Tech Uploaded',
                  value: progress.appsUploaded,
                  section: 'apps' as NavSection,
                },
                {
                  label: profile.role === 'student' ? 'Problems Solved' : 'Problems Posted',
                  value:
                    profile.role === 'student'
                      ? progress.problemsSolved
                      : progress.problemsPosted,
                  section: 'problems' as NavSection,
                },
                {
                  label: 'Hackathons Shared',
                  value: progress.hackathonsShared,
                  section: 'hackathons' as NavSection,
                },
                {
                  label: 'Interviews Shared',
                  value: progress.interviewsShared || 0,
                  section: 'interview-experience' as NavSection,
                },
              ].map((row) => (
                <button
                  key={row.label}
                  type="button"
                  onClick={() => onNavigate(row.section)}
                  className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-slate-50 transition-colors text-left"
                >
                  <span className="text-slate-600">{row.label}</span>
                  <span className="font-mono font-bold tabular-nums text-slate-900">
                    {row.value}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* 3. Edit Profile & Personal Bio Modal (Opens only when user clicks an Edit option) */}
      {editModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="my-profile-edit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 id="my-profile-edit-modal-title" className="text-base font-bold text-slate-900">
                  Edit Profile & Personal Bio
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your name, personal bio, department options, and role details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {profile.role === 'faculty' ? 'Phone / Cabin & Ext' : 'Phone Number'}
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={
                      profile.role === 'faculty'
                        ? 'e.g. Cabin LH-302 · Ext 210'
                        : 'e.g. +91 9876543210'
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  {!DEPARTMENTS.includes(department) && department && (
                    <option value={department}>{department}</option>
                  )}
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {profile.role === 'student' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Academic Year
                      </label>
                      <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      >
                        {!YEARS.includes(year) && year && <option value={year}>{year}</option>}
                        {YEARS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Section
                      </label>
                      <select
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      >
                        {!SECTIONS.includes(section) && section && (
                          <option value={section}>Section {section}</option>
                        )}
                        {SECTIONS.map((sec) => (
                          <option key={sec} value={sec}>
                            Section {sec}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Verified CGPA (Read-Only)
                      </label>
                      <div
                        aria-readonly="true"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono tabular-nums text-slate-700"
                      >
                        {profile.cgpa ? profile.cgpa.toFixed(2) : '0.00'} / 10.0
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Updated only by Faculty or Admin.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        LeetCode URL
                      </label>
                      <input
                        type="text"
                        value={leetcodeUrl}
                        onChange={(e) => setLeetcodeUrl(e.target.value)}
                        placeholder="https://leetcode.com/u/..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        HackerRank URL
                      </label>
                      <input
                        type="text"
                        value={hackerrankUrl}
                        onChange={(e) => setHackerrankUrl(e.target.value)}
                        placeholder="https://hackerrank.com/profile/..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        GitHub URL
                      </label>
                      <input
                        type="text"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        placeholder="https://github.com/..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {profile.role === 'faculty' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Designation
                    </label>
                    <select
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      {!DESIGNATIONS.includes(designation) && designation && (
                        <option value={designation}>{designation}</option>
                      )}
                      {DESIGNATIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Specialization
                    </label>
                    <input
                      type="text"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      placeholder="e.g. Distributed Systems, AI/ML"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Highest Qualification
                    </label>
                    <input
                      type="text"
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      placeholder="e.g. Ph.D, M.Tech"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {profile.role === 'admin' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Administrator Title
                    </label>
                    <input
                      type="text"
                      value={batchOrDesignation}
                      onChange={(e) => setBatchOrDesignation(e.target.value)}
                      placeholder="e.g. Central Portal Administrator"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Administrator Login Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. C++, Java, TypeScript, React, SQL"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Personal Bio
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Write a personal bio about your background, research focus, achievements, or role in the department..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white py-2 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 py-2 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Award,
  Lock,
  ArrowRight,
  Sparkles,
  Trophy,
  FolderGit2,
  Building2,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { apiRequest } from '../api';
import { hasAdminModulePermission, isSuperAdminUser } from '../utils/adminPermissions';
import {
  ALL_DEPARTMENTS_KEY,
  DASHBOARD_DEPARTMENT_OPTIONS,
  buildDepartmentPackageMarquee,
  getDepartmentDashboardMeta,
  getDepartmentHeroTiles,
  isPackageSpotlight,
  normalizeDashboardDepartment,
  resolveUserDashboardDepartment,
} from '../utils/departments';
import showcaseBannerUrl from '../assets/images/cse_dept_showcase_banner_1793583760073.jpg';
import type {
  NavSection,
  PublicUserProfile,
  SpotlightBanner,
  HackathonExperience,
  InterviewExperience,
  DepartmentProject,
  ProblemStatement,
  AppTechnology,
  PlacementDrive,
  DepartmentCourse,
  FacultyMember,
  PortalPublicCounts,
} from '../types';

interface DashboardViewProps {
  currentUser: PublicUserProfile | null;
  spotlights: SpotlightBanner[];
  hackathons: HackathonExperience[];
  projects: DepartmentProject[];
  interviews: InterviewExperience[];
  problems: ProblemStatement[];
  apps: AppTechnology[];
  placements: PlacementDrive[];
  courses: DepartmentCourse[];
  facultyMembers: FacultyMember[];
  publicCounts?: PortalPublicCounts;
  selectedDepartment?: string;
  onSelectedDepartmentChange?: (department: string) => void;
  onNavigate: (section: NavSection) => void;
  onSpotlightsChange: (next: SpotlightBanner[]) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  spotlights,
  hackathons,
  projects,
  interviews,
  problems,
  apps,
  placements,
  courses,
  facultyMembers,
  publicCounts,
  selectedDepartment: controlledDepartment,
  onSelectedDepartmentChange,
  onNavigate,
  onSpotlightsChange,
}) => {
  const isOutsider = !currentUser;
  const isAdmin = currentUser?.role === 'admin';
  const isCentralAdmin = Boolean(
    isAdmin &&
      (isSuperAdminUser(currentUser) ||
        !currentUser?.department ||
        currentUser.department === 'Administration' ||
        currentUser.department === ALL_DEPARTMENTS_KEY)
  );
  const canAdminDashboard = hasAdminModulePermission(
    currentUser,
    'dashboard_analytics'
  );
  const defaultDepartment = resolveUserDashboardDepartment(currentUser);
  const [internalDepartment, setInternalDepartment] = useState<string>(defaultDepartment);

  useEffect(() => {
    setInternalDepartment(resolveUserDashboardDepartment(currentUser));
  }, [currentUser?.id, currentUser?.role, currentUser?.department, currentUser?.isSuperAdmin]);

  const effectiveDepartment = isAdmin
    ? controlledDepartment || internalDepartment
    : defaultDepartment;

  const handleDepartmentChange = (nextDept: string) => {
    if (!isAdmin) return;
    setInternalDepartment(nextDept);
    onSelectedDepartmentChange?.(nextDept);
  };

  // Only Central Admin and authorized Admins can modify Dashboard content; Students (and non-admin users) are strictly view-only
  const canManageSpotlights = Boolean(isAdmin && canAdminDashboard);
  const adminHomeDepartment = normalizeDashboardDepartment(currentUser?.department);
  const canModifySpotlight = (item: SpotlightBanner) => {
    if (!canManageSpotlights) return false;
    if (isCentralAdmin) return true;
    const itemDept = normalizeDashboardDepartment(item.department);
    return itemDept === adminHomeDepartment || item.authorId === currentUser?.id;
  };

  const deptMeta = getDepartmentDashboardMeta(effectiveDepartment);
  const heroTiles = getDepartmentHeroTiles(effectiveDepartment, spotlights);
  const marqueePackages = buildDepartmentPackageMarquee(spotlights);

  const visibleSpotlights =
    effectiveDepartment === ALL_DEPARTMENTS_KEY
      ? spotlights
      : [
          ...spotlights.filter(
            (s) => normalizeDashboardDepartment(s.department) === effectiveDepartment
          ),
          ...spotlights.filter(
            (s) => normalizeDashboardDepartment(s.department) === ALL_DEPARTMENTS_KEY
          ),
        ];

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [spotlightDepartment, setSpotlightDepartment] = useState<string>(effectiveDepartment);
  const [category, setCategory] = useState('Highest Placement Package');
  const [headlineValue, setHeadlineValue] = useState('');
  const [title, setTitle] = useState('');
  const [recipients, setRecipients] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imgError, setImgError] = useState(false);

  const resolveModalDefaultDept = (preferredDept?: string) => {
    if (!isCentralAdmin && adminHomeDepartment !== ALL_DEPARTMENTS_KEY) {
      return adminHomeDepartment;
    }
    return preferredDept || effectiveDepartment;
  };

  const openCreateHighlightModal = (
    targetCategory:
      | 'Highest Placement Package'
      | 'Placement Rate'
      | 'First Prize — National Hackathon'
      | 'Projects & Training',
    preferredDept?: string
  ) => {
    setEditingId(null);
    setSpotlightDepartment(resolveModalDefaultDept(preferredDept));
    setCategory(targetCategory);
    setHeadlineValue('');
    setTitle('');
    setRecipients('');
    setDescription('');
    setError('');
    setIsFormOpen(true);
  };

  const openCreatePackageForm = (preferredDept?: string) => {
    openCreateHighlightModal('Highest Placement Package', preferredDept);
  };

  const openCreateForm = (preferredDept?: string) => {
    openCreateHighlightModal('First Prize — National Hackathon', preferredDept);
  };

  const openEditForm = (item: SpotlightBanner) => {
    setEditingId(item.id);
    setSpotlightDepartment(
      item.department ? normalizeDashboardDepartment(item.department) : resolveModalDefaultDept()
    );
    setCategory(item.category);
    setHeadlineValue(item.headlineValue);
    setTitle(item.title);
    setRecipients(item.recipients);
    setDescription(item.description);
    setError('');
    setIsFormOpen(true);
  };

  const handleSaveSpotlight = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const targetDepartment = isCentralAdmin
      ? spotlightDepartment
      : adminHomeDepartment !== ALL_DEPARTMENTS_KEY
      ? adminHomeDepartment
      : spotlightDepartment;
    try {
      if (editingId) {
        const updated = await apiRequest<SpotlightBanner>(`/api/spotlights/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({
            category,
            headlineValue,
            title,
            recipients,
            description,
            department: targetDepartment,
          }),
        });
        onSpotlightsChange(spotlights.map((s) => (s.id === editingId ? updated : s)));
      } else {
        const created = await apiRequest<SpotlightBanner>('/api/spotlights', {
          method: 'POST',
          body: JSON.stringify({
            category,
            headlineValue,
            title,
            recipients,
            description,
            department: targetDepartment,
          }),
        });
        onSpotlightsChange([created, ...spotlights]);
      }
      setIsFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save spotlight.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSpotlight = async (id: string) => {
    try {
      await apiRequest(`/api/spotlights/${id}`, { method: 'DELETE' });
      onSpotlightsChange(spotlights.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove spotlight.');
    }
  };

  const openProblemsCount = problems.filter((p) => p.status === 'open').length;
  const solvedProblemsCount = problems.filter((p) => p.status === 'solved').length;

  const summaryCounters: Array<{
    label: string;
    count: number;
    subtext: string;
    section: NavSection;
    isLocked?: boolean;
    colorAccent?: string;
  }> = [
    {
      label: 'Hackathon Experiences',
      count: isOutsider ? (publicCounts?.hackathons ?? hackathons.length) : hackathons.length,
      subtext: isOutsider ? 'Locked · Login to read' : 'Shared event & jury reflections',
      section: 'hackathons',
      isLocked: isOutsider,
      colorAccent: 'border-amber-500/20 text-amber-600',
    },
    {
      label: 'Our Projects',
      count: isOutsider ? (publicCounts?.projects ?? projects.length) : projects.length,
      subtext: isOutsider ? 'Locked · Login to inspect' : 'Department web & systems builds',
      section: 'projects',
      isLocked: isOutsider,
      colorAccent: 'border-blue-500/20 text-blue-600',
    },
    {
      label: 'Interview Experiences',
      count: isOutsider ? (publicCounts?.interviews ?? interviews.length) : interviews.length,
      subtext: isOutsider ? 'Locked · Login to view Qs' : 'Company rounds, questions & tips',
      section: 'interview-experience',
      isLocked: isOutsider,
      colorAccent: 'border-emerald-500/20 text-emerald-600',
    },
    {
      label: 'Problem Statements',
      count: isOutsider ? (publicCounts?.problems ?? problems.length) : problems.length,
      subtext: isOutsider ? 'Locked · Login to solve' : `${openProblemsCount} open · ${solvedProblemsCount} solved`,
      section: 'problems',
      isLocked: isOutsider,
      colorAccent: 'border-rose-500/20 text-rose-600',
    },
    {
      label: 'Apps & Technologies',
      count: isOutsider ? (publicCounts?.apps ?? apps.length) : apps.length,
      subtext: isOutsider ? 'Locked · Login to use' : 'Tools & utilities cataloged',
      section: 'apps',
      isLocked: isOutsider,
      colorAccent: 'border-indigo-500/20 text-indigo-600',
    },
    {
      label: 'Placement Drives',
      count: isOutsider ? (publicCounts?.placements ?? placements.length) : placements.length,
      subtext: isOutsider ? 'Locked · Login to apply' : 'Active campus recruitment drives',
      section: 'placements',
      isLocked: isOutsider,
      colorAccent: 'border-teal-500/20 text-teal-600',
    },
    {
      label: 'Department Courses',
      count: isOutsider ? (publicCounts?.courses ?? courses.length) : courses.length,
      subtext: isOutsider ? 'Locked · Login to enroll' : 'Core & elective offerings',
      section: 'courses',
      isLocked: isOutsider,
      colorAccent: 'border-sky-500/20 text-sky-600',
    },
    {
      label: 'Faculty Directory',
      count: isOutsider ? (publicCounts?.facultyMembers ?? facultyMembers.length) : facultyMembers.length,
      subtext: isOutsider ? 'Locked · Login to view' : 'HOD, Professors & Lecturers',
      section: 'faculty',
      isLocked: isOutsider,
      colorAccent: 'border-purple-500/20 text-purple-600',
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Logged In Member Welcome Banner */}
      {currentUser && (
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-4 sm:p-5 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-mono font-bold text-sm shrink-0">
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-blue-200">
                {isCentralAdmin
                  ? 'Central Administrator · Multi-Department View'
                  : `${deptMeta.shortLabel} Member Dashboard`}
              </div>
              <div className="text-base sm:text-lg font-bold truncate">
                Welcome back, {currentUser.name}!
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAdmin ? (
              <label
                htmlFor="admin-dashboard-dept-select"
                className="inline-flex items-center gap-2 bg-slate-950/35 border border-white/25 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <Building2 className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span className="font-semibold text-blue-100 whitespace-nowrap">Dept View:</span>
                <select
                  id="admin-dashboard-dept-select"
                  value={effectiveDepartment}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer max-w-[210px] sm:max-w-[260px]"
                >
                  {DASHBOARD_DEPARTMENT_OPTIONS.map((dept) => (
                    <option key={dept} value={dept} className="bg-slate-900 text-white">
                      {dept}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs bg-white/15 border border-white/20 px-2.5 sm:px-3 py-1 rounded-full font-semibold">
                <Building2 className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span>{deptMeta.shortLabel} · View Only</span>
              </span>
            )}
            <span className="text-[11px] sm:text-xs bg-white/15 px-2.5 sm:px-3 py-1 rounded-full font-mono font-medium">
              {currentUser.memberId} · {currentUser.role.toUpperCase()}
            </span>
            <span className="text-[11px] sm:text-xs bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 px-2.5 sm:px-3 py-1 rounded-full font-semibold">
              All Modules Unlocked
            </span>
          </div>
        </div>
      )}

      {/* Hero Banner: Designed to be attractive for both Outsiders and Students */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 sm:p-8 lg:p-10 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/3 w-72 h-72 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 lg:gap-8">
          <div className="space-y-4 max-w-2xl min-w-0 w-full">
            <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs font-bold tracking-wider uppercase text-blue-300">
              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md bg-blue-500/20 text-blue-200 border border-blue-400/30">
                <Sparkles className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                <span>{deptMeta.badgeText}</span>
              </span>
              <span aria-hidden="true" className="text-slate-600 hidden xs:inline">·</span>
              <span className="text-slate-300">NBA Tier-1 Accredited · NAAC A++</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-[2.75rem] font-black tracking-tight text-white leading-[1.12]">
              {deptMeta.heroTitle}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed text-balance">
              {isOutsider ? deptMeta.heroSubtitlePublic : deptMeta.heroSubtitleMember}
            </p>

            {/* Quick action buttons: Public login for visitors; Admin-only display highlight publishers (hidden from Students) */}
            {isOutsider ? (
              <div className="pt-1 sm:pt-2 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('interview-experience')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 sm:py-3 px-4 sm:px-5 text-xs font-bold text-white transition-all shadow-md active:scale-98 min-h-[42px]"
                >
                  <Lock className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                  <span>Login to Unlock Full Portal</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>

                <a
                  href="#dept-spotlights-heading"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 py-2.5 sm:py-3 px-4 sm:px-5 text-xs font-semibold text-white border border-white/20 transition-colors min-h-[42px]"
                >
                  <span>View Top Placement Highlights</span>
                </a>
              </div>
            ) : canManageSpotlights ? (
              <div className="pt-1 sm:pt-2 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => openCreateHighlightModal('Highest Placement Package', effectiveDepartment)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2.5 px-4 text-xs font-bold text-slate-950 transition-all shadow-sm min-h-[40px]"
                >
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  <span>Highest Package</span>
                </button>

                <button
                  type="button"
                  onClick={() => openCreateHighlightModal('Placement Rate', effectiveDepartment)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 px-4 text-xs font-bold text-white transition-all shadow-sm min-h-[40px]"
                >
                  <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                  <span>Placement Rate</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openCreateHighlightModal('First Prize — National Hackathon', effectiveDepartment)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 py-2.5 px-4 text-xs font-bold text-slate-950 transition-all shadow-sm min-h-[40px]"
                >
                  <Trophy className="w-3.5 h-3.5 shrink-0" />
                  <span>Hackathon Prize Winner</span>
                </button>

                <button
                  type="button"
                  onClick={() => openCreateHighlightModal('Projects & Training', effectiveDepartment)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 py-2.5 px-4 text-xs font-bold text-white transition-all shadow-sm min-h-[40px]"
                >
                  <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Projects / Training</span>
                </button>
              </div>
            ) : null}
          </div>

          {/* Key Department Statistics Ribbon (Balanced 2x2 Tile Ratios Across Devices) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 shrink-0 w-full lg:w-[360px] xl:w-[390px]">
            {heroTiles.map((tile) => (
              <div
                key={`${tile.label}-${tile.value}`}
                className={`rounded-2xl border bg-white/5 p-3 sm:p-4 text-center backdrop-blur-sm shadow-xs flex flex-col items-center justify-center min-h-[86px] sm:min-h-[100px] relative ${
                  tile.isLive ? 'border-emerald-400/30' : 'border-white/10'
                }`}
              >
                {tile.isLive && (
                  <span className="absolute top-1.5 right-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                    Live
                  </span>
                )}
                <div
                  className={`text-lg sm:text-2xl font-extrabold font-mono tabular-nums whitespace-nowrap ${tile.colorClass}`}
                >
                  {tile.value}
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-300 mt-1 leading-tight line-clamp-2">
                  {tile.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Recruiters Ticker Ribbon */}
        <div className="mt-6 sm:mt-8 pt-4 sm:pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 sm:gap-4 text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-slate-300">
            Top Hiring Partners:
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-x-5 font-mono text-slate-300 font-medium">
            {deptMeta.recruiters.map((partner, idx) => (
              <React.Fragment key={partner}>
                {idx > 0 && (
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                )}
                <span>{partner}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* All-Departments Side-by-Side Scrolling Showcase (Only for Central Portal: Outsiders & All-Departments View) */}
      {effectiveDepartment === ALL_DEPARTMENTS_KEY && (
        <section
          aria-label="All Departments Highest Placement Packages"
          className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-950 text-white p-4 sm:p-5 shadow-lg overflow-hidden space-y-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                    Central Department Showcase · Packages, Placements & Prizes
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                    All Departments Live
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Side-by-side branch highlights across every engineering department for Central Portal visitors & administrators.
                </p>
              </div>
            </div>

            {canManageSpotlights && (
              <button
                type="button"
                onClick={() => openCreatePackageForm(ALL_DEPARTMENTS_KEY)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Dept Package</span>
              </button>
            )}
          </div>

          <div className="dept-marquee-wrapper relative overflow-hidden">
            <div className="animate-dept-marquee gap-3.5">
              {[0, 1].map((loopIndex) => (
                <div
                  key={loopIndex}
                  aria-hidden={loopIndex === 1}
                  className="flex items-stretch gap-3.5 shrink-0 pr-3.5"
                >
                  {marqueePackages.map((item) => (
                    <div
                      key={`${loopIndex}-${item.department}`}
                      onClick={() => {
                        if (isAdmin) {
                          handleDepartmentChange(item.department);
                        }
                      }}
                      className={`w-[275px] sm:w-[300px] shrink-0 rounded-2xl border p-3.5 flex flex-col justify-between gap-2.5 transition-colors ${
                        item.isPublished
                          ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900'
                          : 'border-slate-800 bg-slate-900/90'
                      } ${isAdmin ? 'cursor-pointer hover:border-cyan-400/60' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-400/25 truncate">
                          {item.shortLabel}
                        </span>
                        {item.isPublished && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shrink-0">
                            Admin Verified
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-emerald-400">
                          {item.packageValue}
                        </div>
                        <div className="text-xs font-semibold text-white truncate mt-0.5">
                          {item.title}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800/80 text-center">
                        <div className="rounded-lg bg-white/5 px-1.5 py-1">
                          <div className="text-[11px] font-bold font-mono text-blue-300 truncate">
                            {item.placementRate}
                          </div>
                          <div className="text-[9px] text-slate-400">Placement</div>
                        </div>
                        <div className="rounded-lg bg-white/5 px-1.5 py-1">
                          <div className="text-[11px] font-bold font-mono text-amber-300 truncate">
                            {item.hackathonPrize}
                          </div>
                          <div className="text-[9px] text-slate-400">Hackathon</div>
                        </div>
                        <div className="rounded-lg bg-white/5 px-1.5 py-1">
                          <div className="text-[11px] font-bold font-mono text-indigo-300 truncate">
                            {item.projectsTraining}
                          </div>
                          <div className="text-[9px] text-slate-400">Projects</div>
                        </div>
                      </div>

                      {item.recipients && (
                        <div className="text-[11px] text-slate-400 truncate border-t border-slate-800/80 pt-1.5">
                          {item.recipients}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Outsider Locking Notice / Unlocked Portal Indicator */}
      {isOutsider ? (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-500/10 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-700">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Visitor Access Notice
              </div>
              <div className="text-sm font-semibold text-amber-950">
                Dashboard is public. All internal modules (Interviews, Projects, Courses, Faculty) are locked before login.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('courses')}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 py-2 px-4 text-xs font-bold text-white transition-colors whitespace-nowrap"
          >
            Sign In to Unlock All Modules →
          </button>
        </div>
      ) : null}

      {/* Department Summary Counts (Shows Lock badges when unauthenticated, Unlocked when logged in) */}
      <section aria-labelledby="dept-counts-heading">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              id="dept-counts-heading"
              className="text-xl font-extrabold tracking-tight text-slate-900"
            >
              Portal Activity & Statistics
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isOutsider
                ? effectiveDepartment === ALL_DEPARTMENTS_KEY
                  ? 'University-wide live statistics across all departments. Sign in to inspect full repositories, reviews, and questions.'
                  : `${deptMeta.shortLabel} live statistics. Sign in to inspect full repositories, reviews, and questions.`
                : 'Click any module to jump directly to its active workspace.'}
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 hidden sm:inline">
            {isOutsider ? 'Preview Mode' : 'All Modules Unlocked'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
          {summaryCounters.map((item) => (
            <button
              key={item.section}
              type="button"
              onClick={() => onNavigate(item.section)}
              className={`group h-full min-h-[112px] sm:min-h-[124px] flex flex-col justify-between text-left rounded-2xl border bg-white p-3.5 sm:p-5 transition-all hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden ${
                item.isLocked
                  ? 'border-amber-200/80 bg-amber-50/15 hover:border-amber-300'
                  : 'border-slate-200 hover:border-blue-400'
              }`}
            >
              <div className="flex items-start justify-between gap-1.5 w-full min-w-0">
                <span className="text-[11px] sm:text-xs font-bold text-slate-700 group-hover:text-blue-700 transition-colors leading-snug line-clamp-2">
                  {item.label}
                </span>
                {item.isLocked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 sm:px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                    <Lock className="w-3 h-3 text-amber-600" />
                    <span className="hidden sm:inline">Locked</span>
                  </span>
                )}
              </div>

              <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900">
                  {item.count}
                </span>
              </div>

              <div className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-slate-500 truncate w-full">{item.subtext}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Main Departmental Spotlights: Highest Package & First Prize Highlights */}
      <section id="dept-spotlights-heading" aria-labelledby="dept-spotlights-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Highest Package & Major Prize Highlights
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Official departmental recognitions, highest placement offers, and first-prize achievements.
            </p>
          </div>

          {canManageSpotlights && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openCreatePackageForm(effectiveDepartment)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 px-4 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shadow-sm"
                title="Publish Highest Placement Package for Department"
              >
                <TrendingUp className="h-4 w-4 shrink-0" />
                <span>Add Highest Package</span>
              </button>
              <button
                type="button"
                onClick={() => (isFormOpen ? setIsFormOpen(false) : openCreateForm(effectiveDepartment))}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm"
                title="Add Prize or Departmental Highlight"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>Add Prize / Highlight</span>
              </button>
            </div>
          )}
        </div>

        {isFormOpen && canManageSpotlights && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="spotlight-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsFormOpen(false);
            }}
          >
            <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-7 shadow-2xl border border-slate-200">
              <form onSubmit={handleSaveSpotlight} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 id="spotlight-modal-title" className="text-base font-bold text-slate-900">
                      {editingId
                        ? 'Update Departmental Highlight / Package'
                        : category === 'Highest Placement Package'
                        ? 'Publish Department Highest Placement Package'
                        : category === 'Placement Rate'
                        ? 'Publish Department Placement Rate'
                        : category === 'First Prize — National Hackathon'
                        ? 'Publish Hackathon Prize Winner'
                        : category === 'Projects & Training'
                        ? 'Publish Projects / Training Highlight'
                        : 'Publish Departmental Highlight'}
                    </h3>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Highlight Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="Highest Placement Package">Highest Placement Package</option>
                      <option value="Placement Rate">Placement Rate</option>
                      <option value="First Prize — National Hackathon">
                        First Prize — National Hackathon
                      </option>
                      <option value="Projects & Training">Projects & Training</option>
                      <option value="Departmental Award">Departmental Award</option>
                      <option value="Research & Innovation Milestone">
                        Research & Innovation Milestone
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Target Department
                    </label>
                    {isCentralAdmin ? (
                      <select
                        value={spotlightDepartment}
                        onChange={(e) => setSpotlightDepartment(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      >
                        {DASHBOARD_DEPARTMENT_OPTIONS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        readOnly
                        value={
                          adminHomeDepartment !== ALL_DEPARTMENTS_KEY
                            ? adminHomeDepartment
                            : spotlightDepartment
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 font-medium cursor-not-allowed"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {category === 'Highest Placement Package'
                        ? 'Highest Package (CTC)'
                        : category === 'Placement Rate'
                        ? 'Placement Percentage'
                        : category === 'Projects & Training'
                        ? 'Projects / Trained Count or Metric'
                        : 'Highest Amount / Prize Figure'}
                    </label>
                    <input
                      type="text"
                      required
                      value={headlineValue}
                      onChange={(e) => setHeadlineValue(e.target.value)}
                      placeholder={
                        category === 'Highest Placement Package'
                          ? 'e.g. ₹35.5 LPA'
                          : category === 'Placement Rate'
                          ? 'e.g. 98.4%'
                          : category === 'Projects & Training'
                          ? 'e.g. 120+ Live Projects or 450+ Trained'
                          : 'e.g. 1st Prize · ₹1,50,000'
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {category === 'Placement Rate'
                        ? 'Batch / Placement Cell Coordinator'
                        : category === 'Projects & Training'
                        ? 'Lead Faculty / Student Cohort'
                        : 'Main People / Recipients'}
                    </label>
                    <input
                      type="text"
                      required
                      value={recipients}
                      onChange={(e) => setRecipients(e.target.value)}
                      placeholder={
                        category === 'Placement Rate'
                          ? 'e.g. Class of 2026 (240 / 244 Placed)'
                          : category === 'Projects & Training'
                          ? 'e.g. 3rd Year Batch · Industry Mentors'
                          : 'Student or team names & IDs'
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {category === 'Highest Placement Package'
                      ? 'Company Name & Offer Role'
                      : category === 'Placement Rate'
                      ? 'Placement Rate Label / Season'
                      : category === 'Projects & Training'
                      ? 'Project Showcase / Training Program Title'
                      : 'Announcement Headline'}
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      category === 'Highest Placement Package'
                        ? 'e.g. Qualcomm — Staff SoC Engineer Offer'
                        : category === 'Placement Rate'
                        ? 'e.g. 2025–26 Campus Placement Rate'
                        : category === 'Projects & Training'
                        ? 'e.g. Full-Stack & Cloud Certification Training Program'
                        : 'e.g. National Smart India Hackathon Grand Finale First Prize'
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Details
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={`Brief recognition context for ${getDepartmentDashboardMeta(spotlightDepartment).shortLabel}...`}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="rounded-lg border border-slate-300 bg-white py-2 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-blue-600 py-2 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap transition-colors"
                  >
                    {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Highlight'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Featured Banner + Spotlight Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-5 relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 aspect-[4/3] sm:aspect-[16/9] lg:aspect-auto lg:min-h-[340px] flex flex-col justify-end shadow-lg">
            {!imgError ? (
              <img
                src={showcaseBannerUrl}
                alt={`${deptMeta.heroTitle} Innovation Laboratory`}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center">
                <Award className="h-14 w-14 text-slate-700" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/55 to-transparent" />
            <div className="relative p-5 sm:p-6 text-white space-y-1.5 sm:space-y-2">
              <div className="text-[11px] sm:text-xs font-bold text-blue-300 tracking-wider uppercase">
                {deptMeta.innovationTag}
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold leading-snug text-balance text-white">
                {deptMeta.innovationTitle}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {deptMeta.innovationDesc}
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col gap-4 min-w-0">
            {visibleSpotlights.length === 0 ? (
              <div className="flex-1 rounded-3xl border border-slate-200 bg-white p-8 flex flex-col items-center justify-center text-center shadow-xs">
                <p className="text-sm font-medium text-slate-700">
                  No featured highest package or prize spotlights published yet for {deptMeta.shortLabel}.
                </p>
                {canManageSpotlights && (
                  <button
                    type="button"
                    onClick={() => openCreatePackageForm(effectiveDepartment)}
                    className="mt-3 rounded-lg bg-emerald-600 py-2 px-4 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                  >
                    Publish {deptMeta.shortLabel} Highest Package
                  </button>
                )}
              </div>
            ) : (
              visibleSpotlights.map((spot) => {
                const isPackage = isPackageSpotlight(spot);
                const isPrize = spot.category.toLowerCase().includes('prize') || spot.category.toLowerCase().includes('hackathon');
                const spotDeptLabel = spot.department
                  ? getDepartmentDashboardMeta(spot.department).shortLabel
                  : 'All Engineering Departments';

                return (
                  <div
                    key={spot.id}
                    className={`rounded-2xl border p-5 flex flex-col justify-between gap-3 shadow-xs transition-all hover:shadow-md ${
                      isPackage
                        ? 'border-emerald-300 bg-gradient-to-r from-emerald-50/50 via-white to-white'
                        : isPrize
                        ? 'border-amber-300 bg-gradient-to-r from-amber-50/50 via-white to-white'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider border border-slate-200">
                            {spotDeptLabel}
                          </span>
                          <span
                            className={`font-bold ${
                              isPackage
                                ? 'text-emerald-700'
                                : isPrize
                                ? 'text-amber-700'
                                : 'text-blue-700'
                            }`}
                          >
                            {spot.category}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Published by {spot.authorName}</span>
                        </div>

                        <div
                          className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums ${
                            isPackage
                              ? 'text-emerald-700'
                              : isPrize
                              ? 'text-amber-600'
                              : 'text-blue-700'
                          }`}
                        >
                          {spot.headlineValue}
                        </div>

                        <h3 className="text-base font-bold text-slate-900 leading-snug">
                          {spot.title}
                        </h3>
                      </div>

                      {canModifySpotlight(spot) && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditForm(spot)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            title="Edit Highlight"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSpotlight(spot.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Remove Highlight"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {spot.recipients && (
                      <div className="text-xs font-semibold text-slate-800">
                        Honorees: <span className="font-normal text-slate-600">{spot.recipients}</span>
                      </div>
                    )}

                    {spot.description && (
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {spot.description}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Department Research Labs & Infrastructure Overview (Attractive for Outsiders) */}
      <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-xs">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            {deptMeta.infrastructureTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {deptMeta.infrastructureSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-stretch">
          {deptMeta.labs.map((lab) => (
            <div
              key={lab.title}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-2 h-full flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className={`text-xs font-bold uppercase tracking-wider ${lab.tagColorClass}`}>
                  {lab.tag}
                </div>
                <h3 className="text-sm font-bold text-slate-900">{lab.title}</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{lab.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

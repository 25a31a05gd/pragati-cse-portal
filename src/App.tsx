import React, { Suspense, lazy, useCallback, useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard,
  Trophy,
  FolderGit2,
  HelpCircle,
  Cpu,
  Briefcase,
  BookOpen,
  GraduationCap,
  Library,
  Search,
  UserCheck,
  Bell,
  LogOut,
  Menu,
  X,
  FileText,
  Lock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { ApiError, apiRequest, getStoredToken, setStoredToken } from './api';
import type {
  AcademicResource,
  AppTechnology,
  DepartmentCourse,
  DepartmentProject,
  FacultyMember,
  HackathonExperience,
  InterviewExperience,
  NavSection,
  PlacementDrive,
  PortalBootstrapPayload,
  PortalNotification,
  PortalProgress,
  PortalPublicCounts,
  PortalReminderItem,
  ProblemStatement,
  PublicUserProfile,
  SpotlightBanner,
} from './types';
import { LockedGateView } from './components/LockedGateView';
import {
  getDepartmentDashboardMeta,
  resolveUserDashboardDepartment,
} from './utils/departments';

const DashboardView = lazy(() =>
  import('./components/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const AuthModal = lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const HackathonsView = lazy(() =>
  import('./components/HackathonsView').then((m) => ({ default: m.HackathonsView }))
);
const ProjectsView = lazy(() =>
  import('./components/ProjectsView').then((m) => ({ default: m.ProjectsView }))
);
const InterviewExperienceView = lazy(() =>
  import('./components/InterviewExperienceView').then((m) => ({
    default: m.InterviewExperienceView,
  }))
);
const ProblemsView = lazy(() =>
  import('./components/ProblemsView').then((m) => ({ default: m.ProblemsView }))
);
const AppsTechView = lazy(() =>
  import('./components/AppsTechView').then((m) => ({ default: m.AppsTechView }))
);
const PlacementsView = lazy(() =>
  import('./components/PlacementsView').then((m) => ({ default: m.PlacementsView }))
);
const CoursesView = lazy(() =>
  import('./components/CoursesAndFacultyView').then((m) => ({ default: m.CoursesView }))
);
const ResourcesView = lazy(() =>
  import('./components/CoursesAndFacultyView').then((m) => ({ default: m.ResourcesView }))
);
const FacultyView = lazy(() =>
  import('./components/FacultyView').then((m) => ({ default: m.FacultyView }))
);
const StudentSearchView = lazy(() =>
  import('./components/StudentSearchView').then((m) => ({ default: m.StudentSearchView }))
);
const MyProfileView = lazy(() =>
  import('./components/MyProfileView').then((m) => ({ default: m.MyProfileView }))
);
const RemindersModal = lazy(() =>
  import('./components/RemindersModal').then((m) => ({ default: m.RemindersModal }))
);
const AdminDashboardView = lazy(() =>
  import('./components/AdminDashboardView').then((m) => ({ default: m.AdminDashboardView }))
);

const EMPTY_PROGRESS: PortalProgress = {
  appsUploaded: 0,
  problemsSolved: 0,
  projectsPublished: 0,
  hackathonsShared: 0,
  problemsPosted: 0,
  placementsApplied: 0,
  coursesEnrolled: 0,
  interviewsShared: 0,
};

const SECTION_LABELS: Record<NavSection, string> = {
  dashboard: 'Department Overview',
  hackathons: 'Hackathon Experience',
  projects: 'Our Projects',
  'interview-experience': 'Interview Experience',
  problems: 'Problem Statements',
  apps: 'Apps & Technologies',
  placements: 'Placements & Campus Drives',
  courses: 'Department Courses',
  faculty: 'Faculty Directory',
  resources: 'Lab & Dept Resources',
  'student-search': 'Search Student ID',
  profile: 'My Profile & Benchmarks',
  'admin-control': 'Admin Control Center',
};

export function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Automatically scroll main matter to top when user switches section
  useEffect(() => {
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSection]);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [remindersModalOpen, setRemindersModalOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<PublicUserProfile | null>(null);
  const [userProgress, setUserProgress] = useState<PortalProgress>(EMPTY_PROGRESS);

  const [spotlights, setSpotlights] = useState<SpotlightBanner[]>([]);
  const [hackathons, setHackathons] = useState<HackathonExperience[]>([]);
  const [projects, setProjects] = useState<DepartmentProject[]>([]);
  const [interviews, setInterviews] = useState<InterviewExperience[]>([]);
  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [apps, setApps] = useState<AppTechnology[]>([]);
  const [placements, setPlacements] = useState<PlacementDrive[]>([]);
  const [courses, setCourses] = useState<DepartmentCourse[]>([]);
  const [facultyMembers, setFacultyMembers] = useState<FacultyMember[]>([]);
  const [resources, setResources] = useState<AcademicResource[]>([]);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [personalReminders, setPersonalReminders] = useState<PortalReminderItem[]>([]);
  const [publicCounts, setPublicCounts] = useState<PortalPublicCounts | undefined>(undefined);

  const [studentSearchSeed, setStudentSearchSeed] = useState('');
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);

  // Before login: ONLY dashboard is unlocked. All other sections are locked.
  // After login: ALL sections unlock!
  const isOutsider = !currentUser;
  const isStaff = currentUser?.role === 'faculty' || currentUser?.role === 'admin';

  const [dashboardDepartment, setDashboardDepartment] = useState<string>(() =>
    resolveUserDashboardDepartment(null)
  );

  useEffect(() => {
    setDashboardDepartment(resolveUserDashboardDepartment(currentUser));
  }, [currentUser?.id, currentUser?.role, currentUser?.department, currentUser?.isSuperAdmin]);

  const activeDeptShortLabel = getDepartmentDashboardMeta(dashboardDepartment).shortLabel;

  const fetchBootstrap = useCallback(async () => {
    try {
      const data = await apiRequest<PortalBootstrapPayload>('/api/bootstrap');
      setSpotlights(data.spotlights || []);
      setHackathons(data.hackathons || []);
      setProjects(data.projects || []);
      setInterviews(data.interviews || []);
      setProblems(data.problems || []);
      setApps(data.apps || []);
      setPlacements(data.placements || []);
      setCourses(data.courses || []);
      setFacultyMembers(data.facultyMembers || []);
      setResources(data.resources || []);
      setNotifications(data.notifications || []);
      setPublicCounts(data.publicCounts);
      if (data.personalReminders) {
        setPersonalReminders(data.personalReminders);
      }
    } catch {
      // handled silently
    } finally {
      setLoadingBootstrap(false);
    }
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setCurrentUser(null);
      setUserProgress(EMPTY_PROGRESS);
      setPersonalReminders([]);
      return;
    }
    try {
      const me = await apiRequest<{
        profile: PublicUserProfile;
        progress: PortalProgress;
      }>('/api/auth/me');
      setCurrentUser(me.profile);
      setUserProgress(me.progress);
      try {
        const rems = await apiRequest<{ reminders: PortalReminderItem[] }>('/api/reminders');
        setPersonalReminders(rems.reminders || []);
      } catch {
        // ignore
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setStoredToken(null);
      }
      setCurrentUser(null);
      setUserProgress(EMPTY_PROGRESS);
      setPersonalReminders([]);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await refreshCurrentUser();
      await fetchBootstrap();
    };
    init();
  }, [refreshCurrentUser, fetchBootstrap]);

  const handleAuthenticated = async (
    profile: PublicUserProfile,
    progress: PortalProgress
  ) => {
    setCurrentUser(profile);
    setUserProgress(progress);
    if (profile.role === 'admin') {
      setActiveSection('admin-control');
    }
    await fetchBootstrap();
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    localStorage.removeItem('dept_portal_token');
    localStorage.removeItem('cse_dept_portal_token');
    setCurrentUser(null);
    setUserProgress(EMPTY_PROGRESS);
    setPersonalReminders([]);
    setActiveSection('dashboard');
    await fetchBootstrap();
  };

  const handleNavigate = (section: NavSection) => {
    setActiveSection(section);
    setMobileNavOpen(false);
  };

  const handleInspectStudentId = (memberId: string) => {
    setStudentSearchSeed(memberId);
    setActiveSection('student-search');
    setMobileNavOpen(false);
  };

  const handleMarkNotificationsRead = async (notificationId?: string) => {
    if (!currentUser) return;
    try {
      await apiRequest('/api/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ notificationId }),
      });
      setNotifications((prev) =>
        prev.map((n) => {
          if (!notificationId || n.id === notificationId) {
            if (!n.readByUserIds.includes(currentUser.id)) {
              return { ...n, readByUserIds: [...n.readByUserIds, currentUser.id] };
            }
          }
          return n;
        })
      );
    } catch {
      // ignore
    }
  };

  const unreadNotificationsCount = currentUser
    ? notifications.filter((n) => !n.readByUserIds.includes(currentUser.id)).length
    : 0;

  // Grouped Navigation:
  // Before login: All items except Dashboard show Lock icon and 'Locked' tag.
  // After login: ALL items unlock with their native icons and counters.
  const navGroups: Array<{
    groupTitle: string;
    items: Array<{
      id: NavSection;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      count?: number;
      isLocked: boolean;
    }>;
  }> = [
    {
      groupTitle: 'OVERVIEW',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          isLocked: false,
        },
      ],
    },
    {
      groupTitle: 'CAREERS & RECRUITMENT',
      items: [
        {
          id: 'interview-experience',
          label: 'Interview Experience',
          icon: isOutsider ? Lock : FileText,
          count: isOutsider ? undefined : interviews.length,
          isLocked: isOutsider,
        },
        {
          id: 'placements',
          label: 'Placements & Drives',
          icon: isOutsider ? Lock : Briefcase,
          count: isOutsider ? undefined : placements.length,
          isLocked: isOutsider,
        },
      ],
    },
    {
      groupTitle: 'ENGINEERING & LABS',
      items: [
        {
          id: 'projects',
          label: 'Our Projects',
          icon: isOutsider ? Lock : FolderGit2,
          count: isOutsider ? undefined : projects.length,
          isLocked: isOutsider,
        },
        {
          id: 'apps',
          label: 'Apps & Technologies',
          icon: isOutsider ? Lock : Cpu,
          count: isOutsider ? undefined : apps.length,
          isLocked: isOutsider,
        },
        {
          id: 'problems',
          label: 'Problem Statements',
          icon: isOutsider ? Lock : HelpCircle,
          count: isOutsider ? undefined : problems.length,
          isLocked: isOutsider,
        },
        {
          id: 'hackathons',
          label: 'Hackathon Experience',
          icon: isOutsider ? Lock : Trophy,
          count: isOutsider ? undefined : hackathons.length,
          isLocked: isOutsider,
        },
      ],
    },
    {
      groupTitle: 'ACADEMICS',
      items: [
        {
          id: 'courses',
          label: 'Courses',
          icon: isOutsider ? Lock : BookOpen,
          count: isOutsider ? undefined : courses.length,
          isLocked: isOutsider,
        },
        {
          id: 'faculty',
          label: 'Faculty Directory',
          icon: isOutsider ? Lock : GraduationCap,
          count: isOutsider ? undefined : facultyMembers.length,
          isLocked: isOutsider,
        },
        {
          id: 'resources',
          label: 'Lab & Dept Resources',
          icon: isOutsider ? Lock : Library,
          count: isOutsider ? undefined : resources.length,
          isLocked: isOutsider,
        },
      ],
    },
    {
      groupTitle: 'DIRECTORY',
      items: [
        {
          id: 'student-search',
          label: 'Search Student ID',
          icon: isOutsider ? Lock : Search,
          isLocked: isOutsider,
        },
      ],
    },
    ...(currentUser?.role === 'admin'
      ? [
          {
            groupTitle: 'ADMINISTRATION',
            items: [
              {
                id: 'admin-control' as NavSection,
                label: 'Admin Dashboard',
                icon: ShieldCheck,
                isLocked: false,
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="h-dvh flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white overflow-hidden">
      {/* Outsider Visitor Header Ribbon */}
      {isOutsider && (
        <div className="shrink-0 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 text-white text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 border-b border-slate-800">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
              <span className="font-semibold text-blue-200 shrink-0">Public Mode:</span>
              <span className="text-slate-300 truncate sm:whitespace-normal">
                <span className="sm:hidden">Overview open · Login to unlock portal</span>
                <span className="hidden sm:inline">
                  Department Overview is public. Login with a Student, Faculty, or Admin account to unlock all modules.
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="inline-flex items-center gap-1 font-bold text-amber-300 hover:text-amber-200 hover:underline cursor-pointer whitespace-nowrap shrink-0 py-0.5"
            >
              <span className="sm:hidden">Login</span>
              <span className="hidden sm:inline">Login / Register Now</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Top Header Bar */}
      <header className="shrink-0 z-30 h-14 sm:h-16 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Toggle navigation menu"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Pragati University Crest & Title */}
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="flex items-center gap-2.5 sm:gap-3 text-left group min-w-0"
          >
            <img
              src="/pragati-logo.png"
              alt="Pragati University"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl object-contain shadow-xs shrink-0 p-0.5 border border-slate-200 bg-white"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm sm:text-base lg:text-lg font-extrabold tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors truncate leading-tight">
                Pragati University
              </span>
              <span className="text-[10px] font-medium text-slate-500 truncate hidden sm:block leading-none mt-0.5">
                Surampalem · University Campus Portal
              </span>
            </div>
          </button>

          <span className="hidden xl:inline text-slate-300 font-light shrink-0" aria-hidden="true">
            /
          </span>
          <span className="hidden xl:inline text-xs font-semibold text-slate-600 truncate tracking-wide uppercase">
            {activeSection === 'dashboard' ? activeDeptShortLabel : SECTION_LABELS[activeSection]}
          </span>
        </div>

        {/* Right Zone: Reminders + Admin Dashboard / Profile / Login */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Admin Dashboard shortcut for Admins */}
          {currentUser?.role === 'admin' && (
            <button
              type="button"
              onClick={() => handleNavigate('admin-control')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 text-xs font-bold transition-all shadow-xs ${
                activeSection === 'admin-control'
                  ? 'border-cyan-600 bg-cyan-950 text-cyan-300 ring-1 ring-cyan-500/40 shadow-sm'
                  : 'border-slate-800 bg-slate-900 text-cyan-400 hover:bg-slate-800'
              }`}
              title="Open Central Admin Portal"
            >
              <ShieldCheck className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Admin Dashboard</span>
            </button>
          )}

          {/* Reminders Button */}
          <button
            type="button"
            onClick={() => setRemindersModalOpen(true)}
            className="relative inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-slate-200 bg-white min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 transition-all shadow-xs"
            title="Open Reminders, Deadlines & Personal Study Tasks"
          >
            <Bell className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-slate-600 shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">Reminders</span>
            {unreadNotificationsCount > 0 ? (
              <span className="font-mono tabular-nums text-[11px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded-full">
                {unreadNotificationsCount}
              </span>
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            )}
          </button>

          {isOutsider ? (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 min-h-[38px] sm:min-h-[40px] px-3 sm:px-4 text-xs font-bold text-white transition-all shadow-sm active:scale-98 whitespace-nowrap"
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">Login</span>
              <span className="hidden sm:inline">Login / Create Account</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => handleNavigate('profile')}
                className={`inline-flex items-center gap-2 rounded-xl border min-h-[38px] sm:min-h-[40px] px-2 sm:px-3 py-1 transition-all shadow-xs ${
                  activeSection === 'profile'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-800 ring-1 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                }`}
                title="View My Profile and Synced Coding Stats"
              >
                <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-slate-900 to-blue-700 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left leading-none">
                  <span className="text-xs font-bold text-slate-900 max-w-[100px] lg:max-w-[130px] truncate">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 capitalize mt-0.5">
                    {currentUser.role}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 text-xs font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors shadow-xs"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                <span className="hidden md:inline whitespace-nowrap">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Layout: Independent dual-pane scrolling */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Desktop Sidebar: Grouped navigation with independent scroll */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4 h-full overflow-y-auto">
          <div className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.groupTitle} className="space-y-1">
                <div className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  {group.groupTitle}
                </div>

                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all whitespace-nowrap text-left ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : item.isLocked
                          ? 'text-slate-500 hover:bg-amber-50/60 hover:text-amber-900'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isActive
                              ? 'text-white'
                              : item.isLocked
                              ? 'text-amber-500'
                              : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>

                      {/* Locked Badge or Real Count */}
                      {item.isLocked ? (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-amber-100 text-amber-800 border border-amber-200/60'
                          }`}
                        >
                          Locked
                        </span>
                      ) : item.count !== undefined && item.count > 0 ? (
                        <span
                          className={`text-[11px] font-mono tabular-nums px-1.5 py-0.2 rounded font-semibold ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400 leading-relaxed">
            <div>{activeDeptShortLabel}</div>
            <div className="text-[10px] text-slate-400">
              {isOutsider ? 'Public Overview Mode' : 'All Modules Unlocked'}
            </div>
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="relative z-10 w-72 max-w-[85vw] bg-white border-r border-slate-200 p-4 pb-safe flex flex-col justify-between overflow-y-auto shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-extrabold text-sm text-slate-900">Portal Modules</span>
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close navigation drawer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {currentUser && (
                  <button
                    type="button"
                    onClick={() => handleNavigate('profile')}
                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left hover:border-blue-300 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-slate-900 to-blue-700 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {currentUser.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 capitalize truncate">
                        {currentUser.memberId} · {currentUser.role}
                      </div>
                    </div>
                  </button>
                )}

                {navGroups.map((group) => (
                  <div key={group.groupTitle} className="space-y-1">
                    <div className="px-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      {group.groupTitle}
                    </div>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSection === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavigate(item.id)}
                          className={`w-full min-h-[42px] flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors text-left ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-xs'
                              : item.isLocked
                              ? 'text-slate-500 hover:bg-amber-50/60 hover:text-amber-900'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                isActive
                                  ? 'text-white'
                                  : item.isLocked
                                  ? 'text-amber-500'
                                  : 'text-slate-400'
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.isLocked ? (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200/60'
                              }`}
                            >
                              Locked
                            </span>
                          ) : item.count !== undefined && item.count > 0 ? (
                            <span
                              className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.count}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 px-2 py-2 text-[11px] text-slate-400 leading-relaxed">
                <div>{activeDeptShortLabel}</div>
                <div className="text-[10px] text-slate-400">
                  {isOutsider ? 'Public Overview Mode' : 'All Modules Unlocked'}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Viewport: Independent scroll container for displaying matter */}
        <div ref={mainContentRef} className="flex-1 min-w-0 h-full overflow-y-auto">
          <main className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-safe">
          {loadingBootstrap ? (
            <div className="space-y-5">
              <div className="h-32 w-full rounded-2xl bg-slate-200/60 animate-pulse" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-28 rounded-2xl border border-slate-200 bg-white animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* If outsider and clicking any section other than dashboard: render LockedGateView */}
              {isOutsider && activeSection !== 'dashboard' ? (
                <LockedGateView
                  section={activeSection}
                  onRequireAuth={() => setAuthModalOpen(true)}
                  onNavigateHome={() => setActiveSection('dashboard')}
                />
              ) : (
                <Suspense
                  fallback={
                    <div className="space-y-4">
                      <div className="h-24 w-full rounded-2xl bg-slate-200/60 animate-pulse" />
                      <div className="h-48 w-full rounded-2xl bg-white border border-slate-200 animate-pulse" />
                    </div>
                  }
                >
                  {activeSection === 'dashboard' && (
                    <DashboardView
                      currentUser={currentUser}
                      spotlights={spotlights}
                      hackathons={hackathons}
                      projects={projects}
                      interviews={interviews}
                      problems={problems}
                      apps={apps}
                      placements={placements}
                      courses={courses}
                      facultyMembers={facultyMembers}
                      publicCounts={publicCounts}
                      selectedDepartment={dashboardDepartment}
                      onSelectedDepartmentChange={setDashboardDepartment}
                      onNavigate={handleNavigate}
                      onSpotlightsChange={setSpotlights}
                    />
                  )}

                  {activeSection === 'hackathons' && (
                    <HackathonsView
                      currentUser={currentUser}
                      hackathons={hackathons}
                      onHackathonsChange={setHackathons}
                      onRequireAuth={() => setAuthModalOpen(true)}
                      onInspectStudentId={handleInspectStudentId}
                      onRefreshProgress={refreshCurrentUser}
                    />
                  )}

                  {activeSection === 'projects' && (
                    <ProjectsView
                      currentUser={currentUser}
                      projects={projects}
                      onProjectsChange={setProjects}
                      onRequireAuth={() => setAuthModalOpen(true)}
                      onInspectStudentId={handleInspectStudentId}
                      onRefreshProgress={refreshCurrentUser}
                    />
                  )}

                  {activeSection === 'interview-experience' && (
                    <InterviewExperienceView
                      currentUser={currentUser}
                      interviews={interviews}
                      onInterviewsChange={setInterviews}
                      onRequireAuth={() => setAuthModalOpen(true)}
                      onInspectStudentId={handleInspectStudentId}
                      onRefreshProgress={refreshCurrentUser}
                    />
                  )}

                  {activeSection === 'problems' && (
                    <ProblemsView
                      currentUser={currentUser}
                      problems={problems}
                      onProblemsChange={setProblems}
                      onRequireAuth={() => setAuthModalOpen(true)}
                      onInspectStudentId={handleInspectStudentId}
                      onProgressUpdated={setUserProgress}
                      onRefreshBootstrap={fetchBootstrap}
                    />
                  )}

                  {activeSection === 'apps' && (
                    <AppsTechView
                      currentUser={currentUser}
                      apps={apps}
                      onAppsChange={setApps}
                      onRequireAuth={() => setAuthModalOpen(true)}
                      onInspectStudentId={handleInspectStudentId}
                      onRefreshProgress={refreshCurrentUser}
                    />
                  )}

                  {activeSection === 'placements' && (
                    <PlacementsView
                      currentUser={currentUser}
                      placements={placements}
                      onPlacementsChange={setPlacements}
                      onRequireAuth={() => setAuthModalOpen(true)}
                      onNavigate={handleNavigate}
                      onInspectStudentId={handleInspectStudentId}
                      onProgressUpdated={setUserProgress}
                      onProfileRefresh={refreshCurrentUser}
                    />
                  )}

                  {activeSection === 'courses' && (
                    <CoursesView
                      currentUser={currentUser}
                      courses={courses}
                      onCoursesChange={setCourses}
                      onRequireAuth={() => setAuthModalOpen(true)}
                      onInspectStudentId={handleInspectStudentId}
                      onProgressUpdated={setUserProgress}
                    />
                  )}

                  {activeSection === 'faculty' && (
                    <FacultyView
                      currentUser={currentUser}
                      facultyMembers={facultyMembers}
                      onFacultyChange={setFacultyMembers}
                      onRequireAuth={() => setAuthModalOpen(true)}
                      onProfileRefresh={refreshCurrentUser}
                    />
                  )}

                  {activeSection === 'resources' && (
                    <ResourcesView
                      currentUser={currentUser}
                      resources={resources}
                      onResourcesChange={setResources}
                    />
                  )}

                  {activeSection === 'student-search' && (
                    <StudentSearchView
                      initialQuery={studentSearchSeed}
                      currentUser={currentUser}
                      onStudentUpdated={() => {
                        fetchBootstrap();
                      }}
                    />
                  )}

                  {activeSection === 'profile' && currentUser && (
                    <MyProfileView
                      profile={currentUser}
                      progress={userProgress}
                      notifications={notifications}
                      onProfileSaved={(nextProfile, nextProgress) => {
                        setCurrentUser(nextProfile);
                        setUserProgress(nextProgress);
                        fetchBootstrap();
                      }}
                      onMarkNotificationsRead={handleMarkNotificationsRead}
                      onNavigate={handleNavigate}
                      onOpenReminders={() => setRemindersModalOpen(true)}
                    />
                  )}

                  {activeSection === 'admin-control' && currentUser?.role === 'admin' && (
                    <AdminDashboardView
                      currentUser={currentUser}
                      spotlights={spotlights}
                      onLogout={handleLogout}
                      onFacultyChanged={fetchBootstrap}
                      onProfileUpdated={(nextProfile, nextProgress) => {
                        setCurrentUser(nextProfile);
                        setUserProgress(nextProgress);
                        fetchBootstrap();
                      }}
                    />
                  )}
                </Suspense>
              )}
            </>
          )}
        </main>
      </div>
    </div>

      {/* Movable/Draggable Auth Modal (Dropdown for Academic Year, Designation selection, No Google Login) */}
      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            onAuthenticated={handleAuthenticated}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        </Suspense>
      )}

      {/* Reminders & Alerts Modal (Works for all users; Department broadcast reminders + Personal study tasks) */}
      {remindersModalOpen && (
        <Suspense fallback={null}>
          <RemindersModal
            isOpen={remindersModalOpen}
            onClose={() => setRemindersModalOpen(false)}
            currentUser={currentUser}
            notifications={notifications}
            personalReminders={personalReminders}
            onNotificationsChange={setNotifications}
            onPersonalRemindersChange={setPersonalReminders}
            onNavigateSection={handleNavigate}
            onRequireAuth={() => {
              setRemindersModalOpen(false);
              setAuthModalOpen(true);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;

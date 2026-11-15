import React, { useState } from 'react';
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
  Briefcase,
  FolderGit2,
  FileText,
  ShieldCheck,
  Building2,
  GraduationCap,
  Users,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { apiRequest } from '../api';
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
  onNavigate,
  onSpotlightsChange,
}) => {
  const isOutsider = !currentUser;
  const isStudent = currentUser?.role === 'student';
  const isStaff = currentUser?.role === 'faculty' || currentUser?.role === 'admin';
  const canManageSpotlights = Boolean(
    currentUser &&
      (currentUser.role === 'admin' ||
        (currentUser.role === 'faculty' && currentUser.canManageSpotlights))
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState('Highest Placement Package');
  const [headlineValue, setHeadlineValue] = useState('');
  const [title, setTitle] = useState('');
  const [recipients, setRecipients] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imgError, setImgError] = useState(false);

  const openCreateForm = () => {
    setEditingId(null);
    setCategory('First Prize — National Hackathon');
    setHeadlineValue('₹1,50,000 Cash Prize');
    setTitle('');
    setRecipients('');
    setDescription('');
    setError('');
    setIsFormOpen(true);
  };

  const openEditForm = (item: SpotlightBanner) => {
    setEditingId(item.id);
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
    try {
      if (editingId) {
        const updated = await apiRequest<SpotlightBanner>(`/api/spotlights/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ category, headlineValue, title, recipients, description }),
        });
        onSpotlightsChange(spotlights.map((s) => (s.id === editingId ? updated : s)));
      } else {
        const created = await apiRequest<SpotlightBanner>('/api/spotlights', {
          method: 'POST',
          body: JSON.stringify({ category, headlineValue, title, recipients, description }),
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
      count: hackathons.length,
      subtext: isOutsider ? 'Locked · Login to read' : 'Shared event & jury reflections',
      section: 'hackathons',
      isLocked: isOutsider,
      colorAccent: 'border-amber-500/20 text-amber-600',
    },
    {
      label: 'Our Projects',
      count: projects.length,
      subtext: isOutsider ? 'Locked · Login to inspect' : 'Department web & systems builds',
      section: 'projects',
      isLocked: isOutsider,
      colorAccent: 'border-blue-500/20 text-blue-600',
    },
    {
      label: 'Interview Experiences',
      count: interviews.length,
      subtext: isOutsider ? 'Locked · Login to view Qs' : 'Company rounds, questions & tips',
      section: 'interview-experience',
      isLocked: isOutsider,
      colorAccent: 'border-emerald-500/20 text-emerald-600',
    },
    {
      label: 'Problem Statements',
      count: problems.length,
      subtext: isOutsider ? 'Locked · Login to solve' : `${openProblemsCount} open · ${solvedProblemsCount} solved`,
      section: 'problems',
      isLocked: isOutsider,
      colorAccent: 'border-rose-500/20 text-rose-600',
    },
    {
      label: 'Apps & Technologies',
      count: apps.length,
      subtext: isOutsider ? 'Locked · Login to use' : 'Tools & utilities cataloged',
      section: 'apps',
      isLocked: isOutsider,
      colorAccent: 'border-indigo-500/20 text-indigo-600',
    },
    {
      label: 'Placement Drives',
      count: placements.length,
      subtext: isOutsider ? 'Locked · Login to apply' : 'Active campus recruitment drives',
      section: 'placements',
      isLocked: isOutsider,
      colorAccent: 'border-teal-500/20 text-teal-600',
    },
    {
      label: 'Department Courses',
      count: courses.length,
      subtext: isOutsider ? 'Locked · Login to enroll' : 'Core & elective offerings',
      section: 'courses',
      isLocked: isOutsider,
      colorAccent: 'border-sky-500/20 text-sky-600',
    },
    {
      label: 'Faculty Directory',
      count: facultyMembers.length,
      subtext: isOutsider ? 'Locked · Login to view' : 'HOD, Professors & Lecturers',
      section: 'faculty',
      isLocked: isOutsider,
      colorAccent: 'border-purple-500/20 text-purple-600',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Logged In Member Welcome Banner */}
      {currentUser && (
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-4 sm:p-5 text-white flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-mono font-bold text-sm">
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                Department Member Dashboard
              </div>
              <div className="text-base sm:text-lg font-bold">
                Welcome back, {currentUser.name}!
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-white/15 px-3 py-1 rounded-full font-mono font-medium">
              {currentUser.memberId} · {currentUser.role.toUpperCase()}
            </span>
            <span className="text-xs bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 px-3 py-1 rounded-full font-semibold">
              All Modules Unlocked
            </span>
          </div>
        </div>
      )}

      {/* Hero Banner: Designed to be attractive for both Outsiders and Students */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 sm:p-10 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/3 w-72 h-72 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wider uppercase text-blue-300">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-500/20 text-blue-200 border border-blue-400/30">
                <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                <span>Premier CSE Department</span>
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-300">NBA Tier-1 Accredited · NAAC A++</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Department of Computer Science & Engineering
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed text-balance">
              {isOutsider
                ? 'Welcome to the official CSE Department Portal. Explore our highest campus placement packages, national hackathon championships, faculty research, and student innovation.'
                : 'Centralized workspace for your technical hackathons, student repositories, verified company interview question archives, and academic registrations.'}
            </p>

            {/* Quick action buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              {isOutsider ? (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate('interview-experience')}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-3 px-5 text-xs font-bold text-white transition-all shadow-md active:scale-98"
                  >
                    <Lock className="w-3.5 h-3.5 text-blue-200" />
                    <span>Login to Unlock Full Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <a
                    href="#dept-spotlights-heading"
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 py-3 px-5 text-xs font-semibold text-white border border-white/20 transition-colors"
                  >
                    <span>View Top Placement Highlights</span>
                  </a>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate('interview-experience')}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 px-4 text-xs font-bold text-white transition-all shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Interview Question Vault</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('projects')}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 py-2.5 px-4 text-xs font-semibold text-white border border-white/15 transition-colors"
                  >
                    <FolderGit2 className="w-3.5 h-3.5 text-blue-300" />
                    <span>Explore Our Projects</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('hackathons')}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 py-2.5 px-4 text-xs font-semibold text-white border border-white/15 transition-colors"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-300" />
                    <span>Hackathon Wins</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Key Department Statistics Ribbon (Striking for Outsiders & Recruiters) */}
          <div className="grid grid-cols-2 gap-3 shrink-0 w-full lg:w-80">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm shadow-xs">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400">₹48.0 LPA</div>
              <div className="text-[11px] text-slate-300 mt-1">Highest CTC (Atlassian)</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm shadow-xs">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-300">₹1,50,000</div>
              <div className="text-[11px] text-slate-300 mt-1">1st Prize Hackathon</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm shadow-xs">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-blue-300">98.6%</div>
              <div className="text-[11px] text-slate-300 mt-1">Placement Rate</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm shadow-xs">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-indigo-300">Top 50</div>
              <div className="text-[11px] text-slate-300 mt-1">NIRF Engineering</div>
            </div>
          </div>
        </div>

        {/* Top Recruiters Ticker Ribbon */}
        <div className="mt-8 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-slate-300">
            Top Hiring Partners:
          </span>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-slate-300 font-medium">
            <span>Atlassian</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>Google</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>Microsoft</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>Zoho</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>Amazon</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>Goldman Sachs</span>
          </div>
        </div>
      </section>

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
                ? 'Department-wide live statistics. Sign in to inspect full repositories, reviews, and questions.'
                : 'Click any module to jump directly to its active workspace.'}
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 hidden sm:inline">
            {isOutsider ? 'Preview Mode' : 'All Modules Unlocked'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCounters.map((item) => (
            <button
              key={item.section}
              type="button"
              onClick={() => onNavigate(item.section)}
              className={`group text-left rounded-2xl border bg-white p-5 transition-all hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden ${
                item.isLocked
                  ? 'border-amber-200/80 bg-amber-50/15 hover:border-amber-300'
                  : 'border-slate-200 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                  {item.label}
                </span>
                {item.isLocked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
                    <Lock className="w-3 h-3 text-amber-600" />
                    <span>Locked</span>
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900">
                  {item.count}
                </span>
              </div>

              <div className="mt-2 text-xs text-slate-500 truncate">{item.subtext}</div>
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
            <button
              type="button"
              onClick={() => (isFormOpen ? setIsFormOpen(false) : openCreateForm())}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 shadow-sm"
              title="Add Highest Package or Prize Advertisement"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Add Prize / Package Highlight</span>
            </button>
          )}
        </div>

        {isFormOpen && canManageSpotlights && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="spotlight-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsFormOpen(false);
            }}
          >
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200">
              <form onSubmit={handleSaveSpotlight} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 id="spotlight-modal-title" className="text-base font-bold text-slate-900">
                    {editingId
                      ? 'Update Departmental Highlight / Advertisement'
                      : 'Publish Highest Amount or Prize Advertisement'}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <option value="First Prize — National Hackathon">
                        First Prize — National Hackathon
                      </option>
                      <option value="Departmental Award">Departmental Award</option>
                      <option value="Research & Innovation Milestone">
                        Research & Innovation Milestone
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Highest Amount / Prize Figure
                    </label>
                    <input
                      type="text"
                      required
                      value={headlineValue}
                      onChange={(e) => setHeadlineValue(e.target.value)}
                      placeholder="e.g. ₹48.0 LPA or 1st Prize · ₹1,50,000"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Main People / Recipients
                    </label>
                    <input
                      type="text"
                      required
                      value={recipients}
                      onChange={(e) => setRecipients(e.target.value)}
                      placeholder="Student or team names & IDs"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Announcement Headline
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. National Smart India Hackathon Grand Finale First Prize"
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
                    placeholder="Brief recognition context for the CSE department..."
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
          <div className="lg:col-span-5 relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 min-h-[280px] flex flex-col justify-end shadow-lg">
            {!imgError ? (
              <img
                src="/src/assets/images/cse_dept_showcase_banner_1793583760073.jpg"
                alt="Computer Science and Engineering Innovation Laboratory"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center">
                <Award className="h-14 w-14 text-slate-700" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-transparent" />
            <div className="relative p-6 text-white space-y-2">
              <div className="text-xs font-bold text-blue-300 tracking-wider uppercase">
                CSE Advanced Innovation Center
              </div>
              <h3 className="text-xl font-extrabold leading-snug text-balance text-white">
                Systems Engineering, Hackathon Champions & Elite Recruitment
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Celebrating achievements in algorithmic computing, distributed cloud platforms, and national engineering contests.
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col gap-4">
            {spotlights.length === 0 ? (
              <div className="flex-1 rounded-3xl border border-slate-200 bg-white p-8 flex flex-col items-center justify-center text-center shadow-xs">
                <p className="text-sm font-medium text-slate-700">
                  No featured prize or placement spotlights published yet.
                </p>
                {canManageSpotlights && (
                  <button
                    type="button"
                    onClick={openCreateForm}
                    className="mt-3 rounded-lg bg-blue-600 py-2 px-4 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    Publish First Highlight
                  </button>
                )}
              </div>
            ) : (
              spotlights.map((spot) => {
                const isPackage = spot.category.toLowerCase().includes('package') || spot.category.toLowerCase().includes('placement');
                const isPrize = spot.category.toLowerCase().includes('prize') || spot.category.toLowerCase().includes('hackathon');

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
                        <div className="text-xs text-slate-500 flex items-center gap-2">
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

                      {canManageSpotlights && (
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
      <section className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 space-y-6 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Academic Infrastructure & Specialized Computing Centers
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Industry-sponsored centers of excellence and high-performance computing facilities powering CSE student research.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 space-y-2">
            <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">
              Lab 01 · High-Performance Computing
            </div>
            <h3 className="text-sm font-bold text-slate-900">Distributed Systems & Cloud Hub</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Equipped with 64-node cluster servers for parallel processing, Linux namespace sandboxes, and distributed consensus research.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 space-y-2">
            <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
              Lab 02 · Artificial Intelligence
            </div>
            <h3 className="text-sm font-bold text-slate-900">AI, Vision & Language Models Lab</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              GPU-accelerated neural network training suites with dedicated workstations for deep learning and medical imaging research.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 space-y-2">
            <div className="text-xs font-bold text-teal-700 uppercase tracking-wider">
              Lab 03 · Network Security
            </div>
            <h3 className="text-sm font-bold text-slate-900">Cybersecurity & Cryptography Center</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Isolated sandboxed network testbed for intrusion detection simulation, cryptographic protocols, and secure routing experiments.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

import React from 'react';
import {
  Lock,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  UserCheck,
  CheckCircle2,
  FileText,
  FolderGit2,
  HelpCircle,
  Briefcase,
  BookOpen,
  GraduationCap,
  Cpu,
  Library,
  Search,
} from 'lucide-react';
import type { NavSection } from '../types';

interface LockedGateViewProps {
  section: NavSection;
  onRequireAuth: () => void;
  onNavigateHome: () => void;
}

interface SectionMeta {
  title: string;
  category: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  highlights: string[];
}

const SECTION_DESCRIPTIONS: Record<NavSection, SectionMeta> = {
  dashboard: {
    title: 'Department Overview',
    category: 'Public Portal',
    subtitle: 'Public showcase of CSE department achievements, highest package offers, and hackathon wins.',
    icon: Sparkles,
    highlights: ['Placement statistics', 'Prize highlights', 'Public metrics'],
  },
  hackathons: {
    title: 'Hackathon Experience Vault',
    category: 'Innovation & Competitions',
    subtitle: 'Detailed post-mortem reflections, jury feedback, winning architectures, and tech stacks from national hackathons.',
    icon: Sparkles,
    highlights: [
      'Smart India Hackathon 1st prize winning architectures',
      'Judge Q&A questions and pitch strategies',
      'Collaborative team compositions and code repositories',
    ],
  },
  projects: {
    title: 'Our Department Projects',
    category: 'Engineering & Systems',
    subtitle: 'Production web applications, distributed systems, compilers, and machine learning projects engineered by CSE undergraduates.',
    icon: FolderGit2,
    highlights: [
      'Live deployment links & GitHub source repositories',
      'Architecture breakdowns and technology stacks (React, Go, Python, Cloud)',
      'Peer mentorship and project contribution opportunities',
    ],
  },
  'interview-experience': {
    title: 'Company Interview Experiences',
    category: 'Placements & Careers',
    subtitle: 'First-hand interview rounds, exact technical coding questions, and system design challenges from top tech recruiters.',
    icon: FileText,
    highlights: [
      'Round-by-round breakdown: Online Assessment (OA), Technical DSA, and HR Fitment',
      'Questions asked by Atlassian, Google, Zoho, Microsoft, and more',
      'Preparation roadmaps, LeetCode patterns, and package/stipend breakdowns',
    ],
  },
  problems: {
    title: 'Problem Statements & Debugging Hub',
    category: 'Peer Engineering Help',
    subtitle: 'Active software bugs, algorithmic bottlenecks, and systems challenges posted by department members for collaborative resolution.',
    icon: HelpCircle,
    highlights: [
      'Peer-to-peer technical messaging and solution sharing',
      'Track open and solved problems across subjects and frameworks',
      'Earn departmental problem-solver credentials on your profile',
    ],
  },
  apps: {
    title: 'Apps & Technologies Directory',
    category: 'Software Utilities',
    subtitle: 'Department-developed utility software, lab evaluators, and developer tools built for campus use.',
    icon: Cpu,
    highlights: [
      'Direct links to deployed web applications and CLI tools',
      'Technology stack indexing and open-source contributions',
      'Tool evaluation and developer contact directories',
    ],
  },
  placements: {
    title: 'Campus Placement Drives',
    category: 'Career Management',
    subtitle: 'Active campus recruitment drives, company eligibility criteria, and candidate application pipelines.',
    icon: Briefcase,
    highlights: [
      'Automated eligibility screening based on CGPA and LeetCode solved count',
      'Direct 1-click resume submissions and application tracking',
      'Company profiles, CTC packages, job locations, and drive schedules',
    ],
  },
  courses: {
    title: 'Department Curriculum & Courses',
    category: 'Academics & Registration',
    subtitle: 'Core computer science curriculum, elective tracks, syllabus breakdowns, and semester course registration.',
    icon: BookOpen,
    highlights: [
      'Complete semester VI & VIII elective catalog and course syllabi',
      'Course prerequisite dependency trees and credit allocations',
      'Instructor office schedules and student enrollment rosters',
    ],
  },
  faculty: {
    title: 'Faculty Directory & Cabins',
    category: 'Department Staff',
    subtitle: 'Profiles of Department Professors, Head of Department (HOD), research mentors, qualifications, and cabin numbers.',
    icon: GraduationCap,
    highlights: [
      'Direct institutional emails, office hours, and cabin locations',
      'Research specializations: AI, Distributed Systems, Cloud, and Security',
      'Academic qualifications, patents, and Ph.D research guidance',
    ],
  },
  resources: {
    title: 'Lab Manuals & Academic Resources',
    category: 'Department Repositories',
    subtitle: 'Official laboratory experiment sheets, DSA preparation sheets, and curriculum handbooks.',
    icon: Library,
    highlights: [
      'Downloadable lab manuals for Networks, OS, and Compiler Design labs',
      'Curated DSA sheets (Striver SDE, NeetCode 150) and coding club guides',
      'Official syllabus regulations and credit distribution handbooks',
    ],
  },
  'student-search': {
    title: 'Student ID Directory Search',
    category: 'Member Directory',
    subtitle: 'Search CSE students by Roll Number / Member ID to inspect their verified LeetCode, GitHub, and hackathon portfolios.',
    icon: Search,
    highlights: [
      'Instant lookup by Student ID (e.g. 22CSE104, 23CSE056)',
      'Verified platform stats: LeetCode solved, HackerRank 5★, GitHub repos',
      'Published projects, problem responses, and hackathon wins',
    ],
  },
  profile: {
    title: 'My Profile & Synced Benchmarks',
    category: 'Individual Account',
    subtitle: 'Your personal academic record, synced coding platforms (LeetCode, HackerRank, GitHub), and reminder center.',
    icon: UserCheck,
    highlights: [
      'Automatic stats syncing for LeetCode problem breakdown (Easy/Med/Hard)',
      'HackerRank verified 5-Star badges and GitHub repository counts',
      'Personal study reminders, deadlines, and problem statement alerts',
    ],
  },
  'admin-control': {
    title: 'Admin Control Center',
    category: 'System Administration',
    subtitle: 'Manage faculty credentials, create faculty accounts, audit students, and configure security settings.',
    icon: ShieldAlert,
    highlights: [
      'Create verified faculty accounts with compulsory passwords',
      'Manage faculty details, reset passwords, and toggle active status',
      'Audit registered students and change administrator master password',
    ],
  },
};

export const LockedGateView: React.FC<LockedGateViewProps> = ({
  section,
  onRequireAuth,
  onNavigateHome,
}) => {
  const meta = SECTION_DESCRIPTIONS[section] || SECTION_DESCRIPTIONS.dashboard;
  const Icon = meta.icon;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-center space-y-7 animate-in fade-in duration-300">
      {/* Padlock Emblem with Glowing Outer Ring */}
      <div className="relative inline-flex items-center justify-center">
        <div className="absolute inset-0 rounded-3xl bg-blue-500/15 blur-xl pointer-events-none scale-125" />
        <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-800 to-blue-900 border border-slate-700/80 shadow-xl flex items-center justify-center text-amber-400">
          <Lock className="w-9 h-9 text-amber-400" />
        </div>
      </div>

      {/* Header and Context */}
      <div className="space-y-2.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 border border-amber-300/40">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          <span>Institutional Member Portal · Login Required</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          {meta.title} — Locked
        </h1>

        <p className="text-slate-600 max-w-lg mx-auto text-sm leading-relaxed">
          This module is reserved for verified CSE Department students, faculty, and administrative staff. Please log in with your institutional account to unlock all features.
        </p>
      </div>

      {/* Preview Card showing what is locked inside */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 text-left shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              {meta.category}
            </div>
            <div className="text-sm font-bold text-slate-900">{meta.title}</div>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">{meta.subtitle}</p>

        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Inside this Module:
          </div>
          <ul className="space-y-1.5">
            {meta.highlights.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onRequireAuth}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-3 px-6 text-sm font-bold text-white shadow-md transition-all active:scale-98"
        >
          <span>Login / Create Account to Unlock</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onNavigateHome}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 hover:bg-slate-100 py-3 px-5 text-sm font-medium text-slate-700 transition-colors"
        >
          <span>Back to Public Dashboard</span>
        </button>
      </div>

      {/* Helper text for visitors */}
      <div className="text-xs text-slate-400 pt-1">
        <span>Are you an outsider or recruiter? </span>
        <button
          type="button"
          onClick={onNavigateHome}
          className="text-blue-700 hover:underline font-medium"
        >
          Explore the Public Department Overview & Statistics
        </button>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Building2,
  ArrowLeft,
  Briefcase,
  Award,
  CheckCircle2,
  HelpCircle,
  Pencil,
  Trash2,
  X,
  Code2,
  BookOpen,
} from 'lucide-react';
import { apiRequest } from '../api';
import { hasAdminModulePermission } from '../utils/adminPermissions';
import type {
  InterviewExperience,
  InterviewRoundDetail,
  PublicUserProfile,
} from '../types';

interface InterviewExperienceViewProps {
  currentUser: PublicUserProfile | null;
  interviews: InterviewExperience[];
  onInterviewsChange: (next: InterviewExperience[]) => void;
  onRequireAuth: () => void;
  onInspectStudentId: (memberId: string) => void;
  onRefreshProgress: () => void;
}

export const InterviewExperienceView: React.FC<InterviewExperienceViewProps> = ({
  currentUser,
  interviews,
  onInterviewsChange,
  onRequireAuth,
  onInspectStudentId,
  onRefreshProgress,
}) => {
  // Navigation state: selected company to view all details of experienced students
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterResult, setFilterResult] = useState<string>('all');

  // Add / Edit Form Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [companyName, setCompanyName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
  const [skillsNeeded, setSkillsNeeded] = useState('');
  const [hiringType, setHiringType] = useState<
    'On-Campus' | 'Off-Campus' | 'Internship' | 'Full-Time'
  >('On-Campus');
  const [packageOrStipend, setPackageOrStipend] = useState('');
  const [interviewDate, setInterviewDate] = useState('2026');
  const [resultStatus, setResultStatus] = useState<
    'Selected / Offered' | 'Rejected' | 'In Progress / Final Round'
  >('Selected / Offered');
  const [overallDifficulty, setOverallDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [overallExperience, setOverallExperience] = useState('');
  const [keyPreparationTips, setKeyPreparationTips] = useState('');
  const [resourcesUsed, setResourcesUsed] = useState('');

  // Rounds editor
  const [rounds, setRounds] = useState<InterviewRoundDetail[]>([
    {
      roundNumber: 1,
      roundTitle: 'Round 1: Online Assessment (OA)',
      topicsCovered: 'Data Structures, Dynamic Programming',
      questionsAsked: '',
      difficulty: 'Medium',
    },
    {
      roundNumber: 2,
      roundTitle: 'Round 2: Technical Interview (DSA & Problem Solving)',
      topicsCovered: 'Trees, Graphs, System Design',
      questionsAsked: '',
      difficulty: 'Hard',
    },
  ]);

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Group interview experiences by company
  const companyGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        companyName: string;
        domain: string;
        roles: Set<string>;
        packages: Set<string>;
        skills: Set<string>;
        experiences: InterviewExperience[];
      }
    >();

    interviews.forEach((exp) => {
      const key = exp.companyName.trim();
      if (!map.has(key)) {
        map.set(key, {
          companyName: exp.companyName,
          domain: exp.companyDomain || 'Software & Cloud',
          roles: new Set(),
          packages: new Set(),
          skills: new Set(),
          experiences: [],
        });
      }
      const entry = map.get(key)!;
      entry.experiences.push(exp);
      if (exp.roleTitle) entry.roles.add(exp.roleTitle);
      if (exp.packageOrStipend) entry.packages.add(exp.packageOrStipend);
      if (exp.skillsNeeded) {
        exp.skillsNeeded
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((sk) => entry.skills.add(sk));
      }
    });

    return Array.from(map.values());
  }, [interviews]);

  // Filtered companies based on search
  const filteredCompanyGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return companyGroups.filter((group) => {
      if (!q) return true;
      const matchesCompany = group.companyName.toLowerCase().includes(q);
      const matchesDomain = group.domain.toLowerCase().includes(q);
      const matchesRole = Array.from(group.roles).some((r) => r.toLowerCase().includes(q));
      const matchesSkills = Array.from(group.skills).some((s) => s.toLowerCase().includes(q));
      const matchesStudent = group.experiences.some(
        (e) =>
          e.authorName.toLowerCase().includes(q) || e.authorMemberId.toLowerCase().includes(q)
      );
      return matchesCompany || matchesDomain || matchesRole || matchesSkills || matchesStudent;
    });
  }, [companyGroups, searchQuery]);

  // Experiences for currently selected company
  const selectedCompanyGroup = useMemo(() => {
    if (!selectedCompany) return null;
    return companyGroups.find(
      (g) => g.companyName.toLowerCase() === selectedCompany.toLowerCase()
    );
  }, [companyGroups, selectedCompany]);

  const filteredCompanyExperiences = useMemo(() => {
    if (!selectedCompanyGroup) return [];
    let list = selectedCompanyGroup.experiences;
    if (filterResult !== 'all') {
      list = list.filter((exp) => exp.resultStatus.toLowerCase().includes(filterResult.toLowerCase()));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (exp) =>
          exp.authorName.toLowerCase().includes(q) ||
          exp.authorMemberId.toLowerCase().includes(q) ||
          exp.roleTitle.toLowerCase().includes(q) ||
          exp.overallExperience.toLowerCase().includes(q)
      );
    }
    return list;
  }, [selectedCompanyGroup, filterResult, searchQuery]);

  const canModifyEntry = (entry: InterviewExperience) => {
    if (!currentUser) return false;
    if (
      hasAdminModulePermission(currentUser, 'placements') ||
      hasAdminModulePermission(currentUser, 'dashboard_analytics')
    ) {
      return true;
    }
    return entry.authorId === currentUser.id;
  };

  const handleOpenCreate = (prefilledCompany?: string) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setEditingId(null);
    setCompanyName(prefilledCompany || '');
    setRoleTitle('');
    setCompanyDomain('');
    setSkillsNeeded('');
    setHiringType('On-Campus');
    setPackageOrStipend('');
    setInterviewDate('2026');
    setResultStatus('Selected / Offered');
    setOverallDifficulty('Medium');
    setOverallExperience('');
    setKeyPreparationTips('');
    setResourcesUsed('');
    setRounds([
      {
        roundNumber: 1,
        roundTitle: 'Round 1: Online Coding Assessment (OA)',
        topicsCovered: 'Data Structures, Dynamic Programming, SQL',
        questionsAsked: '',
        difficulty: 'Medium',
      },
      {
        roundNumber: 2,
        roundTitle: 'Round 2: Technical Interview 1 (DSA)',
        topicsCovered: 'Graphs, Trees, HashMaps',
        questionsAsked: '',
        difficulty: 'Hard',
      },
      {
        roundNumber: 3,
        roundTitle: 'Round 3: System Design & Core CS',
        topicsCovered: 'OOPs, OS, DBMS, High-Level Architecture',
        questionsAsked: '',
        difficulty: 'Medium',
      },
    ]);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (entry: InterviewExperience) => {
    setEditingId(entry.id);
    setCompanyName(entry.companyName);
    setRoleTitle(entry.roleTitle);
    setCompanyDomain(entry.companyDomain || '');
    setSkillsNeeded(entry.skillsNeeded || '');
    setHiringType(entry.hiringType);
    setPackageOrStipend(entry.packageOrStipend);
    setInterviewDate(entry.interviewDate);
    setResultStatus(entry.resultStatus);
    setOverallDifficulty(entry.overallDifficulty);
    setOverallExperience(entry.overallExperience);
    setKeyPreparationTips(entry.keyPreparationTips);
    setResourcesUsed(entry.resourcesUsed || '');
    setRounds(entry.rounds.length > 0 ? entry.rounds : []);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleAddRound = () => {
    setRounds([
      ...rounds,
      {
        roundNumber: rounds.length + 1,
        roundTitle: `Round ${rounds.length + 1}: Technical / Managerial`,
        topicsCovered: '',
        questionsAsked: '',
        difficulty: 'Medium',
      },
    ]);
  };

  const handleRemoveRound = (idx: number) => {
    setRounds(rounds.filter((_, i) => i !== idx));
  };

  const handleRoundChange = (
    idx: number,
    field: keyof InterviewRoundDetail,
    val: string | number
  ) => {
    setRounds(
      rounds.map((r, i) => (i === idx ? { ...r, [field]: val } : r))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = {
        companyName,
        roleTitle,
        companyDomain,
        skillsNeeded,
        hiringType,
        packageOrStipend,
        interviewDate,
        resultStatus,
        overallDifficulty,
        overallExperience,
        rounds,
        keyPreparationTips,
        resourcesUsed,
      };

      if (editingId) {
        const updated = await apiRequest<InterviewExperience>(
          `/api/interviews/${editingId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        onInterviewsChange(interviews.map((i) => (i.id === editingId ? updated : i)));
      } else {
        const created = await apiRequest<InterviewExperience>('/api/interviews', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onInterviewsChange([created, ...interviews]);
        onRefreshProgress();
      }
      setIsFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save interview experience.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/interviews/${id}`, { method: 'DELETE' });
      onInterviewsChange(interviews.filter((i) => i.id !== id));
      onRefreshProgress();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to delete entry.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          {selectedCompany ? (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedCompany(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline py-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>All Companies</span>
              </button>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2 break-words">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-blue-600" />
                <span className="min-w-0">{selectedCompany} — Student Interview Experiences</span>
              </h1>
              <p className="text-xs text-slate-600">
                Detailed rounds, questions asked, role details, and required skills shared by experienced students.
              </p>
            </div>
          ) : (
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Interview Experiences
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Browse companies to see detailed student interview reports, questions asked, roles offered, and required skills.
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleOpenCreate(selectedCompany || '')}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 px-4 min-h-[40px] text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Share Interview Experience</span>
        </button>
      </div>

      {/* Form appears when "+" button is clicked in a modal dialog */}
      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="interview-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormOpen(false);
          }}
        >
          <div className="relative w-full max-w-3xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-7 shadow-2xl border border-slate-200">
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              {editingId ? 'Edit Interview Experience' : 'Share Interview Experience with Department'}
            </h2>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company Name
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Google, Microsoft, Atlassian, Zoho"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Role / Position Taken
              </label>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. SDE-1, MTS, Systems Engineer"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company Domain / Sector
              </label>
              <input
                type="text"
                value={companyDomain}
                onChange={(e) => setCompanyDomain(e.target.value)}
                placeholder="e.g. Cloud & Enterprise Software, FinTech"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hiring Type
              </label>
              <select
                value={hiringType}
                onChange={(e) =>
                  setHiringType(
                    e.target.value as 'On-Campus' | 'Off-Campus' | 'Internship' | 'Full-Time'
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="On-Campus">On-Campus Drive</option>
                <option value="Off-Campus">Off-Campus Referral / Contest</option>
                <option value="Internship">Summer Internship</option>
                <option value="Full-Time">Direct Full-Time</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Package (CTC) / Stipend
              </label>
              <input
                type="text"
                value={packageOrStipend}
                onChange={(e) => setPackageOrStipend(e.target.value)}
                placeholder="e.g. ₹38.0 LPA or ₹50,000/mo"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Interview Month & Year
              </label>
              <input
                type="text"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
                placeholder="e.g. October 2026"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Result Status
              </label>
              <select
                value={resultStatus}
                onChange={(e) =>
                  setResultStatus(
                    e.target.value as
                      | 'Selected / Offered'
                      | 'Rejected'
                      | 'In Progress / Final Round'
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="Selected / Offered">Selected / Offered</option>
                <option value="In Progress / Final Round">In Progress / Final Round</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Overall Difficulty
              </label>
              <select
                value={overallDifficulty}
                onChange={(e) => setOverallDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Key Skills Needed for this Company
              </label>
              <input
                type="text"
                value={skillsNeeded}
                onChange={(e) => setSkillsNeeded(e.target.value)}
                placeholder="e.g. DSA, Graph Algorithms, OOP, Java/C++"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Overall Interview Experience & Process Summary
            </label>
            <textarea
              rows={3}
              required
              value={overallExperience}
              onChange={(e) => setOverallExperience(e.target.value)}
              placeholder="Explain how the rounds were conducted, duration, interview tone, and general guidelines..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Interactive Rounds Breakdown */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  What Did They Ask? (Rounds & Questions Breakdown)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Detail what questions and problems were asked in each round
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddRound}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Round</span>
              </button>
            </div>

            <div className="space-y-3">
              {rounds.map((round, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5"
                >
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3">
                    <input
                      type="text"
                      value={round.roundTitle}
                      onChange={(e) => handleRoundChange(idx, 'roundTitle', e.target.value)}
                      placeholder={`Round ${idx + 1} Title`}
                      className="min-w-0 flex-1 font-semibold text-xs text-slate-900 bg-transparent border-b border-slate-300 pb-1 focus:border-blue-600 focus:outline-none"
                    />

                    <div className="flex items-center gap-2">
                      <select
                        value={round.difficulty}
                        onChange={(e) =>
                          handleRoundChange(
                            idx,
                            'difficulty',
                            e.target.value as 'Easy' | 'Medium' | 'Hard'
                          )
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-800"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>

                      {rounds.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRound(idx)}
                          className="rounded p-1 text-slate-400 hover:text-red-600"
                          title="Remove round"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Topics Covered
                      </label>
                      <input
                        type="text"
                        value={round.topicsCovered}
                        onChange={(e) => handleRoundChange(idx, 'topicsCovered', e.target.value)}
                        placeholder="e.g. Dynamic Programming, Trees, LRU Cache"
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Specific Questions Asked
                      </label>
                      <input
                        type="text"
                        value={round.questionsAsked}
                        onChange={(e) => handleRoundChange(idx, 'questionsAsked', e.target.value)}
                        placeholder="e.g. Design thread-safe TTL cache, Lowest common ancestor"
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Preparation Tips & Advice
              </label>
              <textarea
                rows={2}
                value={keyPreparationTips}
                onChange={(e) => setKeyPreparationTips(e.target.value)}
                placeholder="What should juniors focus on? (e.g. practice speaking while coding, OOP design)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Key Resources Used
              </label>
              <textarea
                rows={2}
                value={resourcesUsed}
                onChange={(e) => setResourcesUsed(e.target.value)}
                placeholder="e.g. NeetCode 150, Striver SDE Sheet, CSES Problem Set"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-xl border border-slate-300 bg-white py-2 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-blue-600 py-2 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Saving...' : editingId ? 'Update Experience' : 'Publish Experience'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

      {/* VIEW MODE 1: FIRST DISPLAY ALL COMPANIES ("first display alla companies") */}
      {!selectedCompany && (
        <div className="space-y-6">
          {/* Search bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search companies by name, required skills (e.g. Graph, System Design), or student name/ID..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none shadow-2xs"
            />
          </div>

          {filteredCompanyGroups.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 text-center">
              <Building2 className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-base font-semibold text-slate-800">
                No companies matched your query
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Click "+ Share Interview Experience" above to add the first interview record for this company.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
              {filteredCompanyGroups.map((group) => {
                const packageList = Array.from(group.packages).slice(0, 2);
                const roleList = Array.from(group.roles).slice(0, 3);
                const skillsList = Array.from(group.skills).slice(0, 4);

                return (
                  <div
                    key={group.companyName}
                    onClick={() => {
                      setSelectedCompany(group.companyName);
                      setSearchQuery('');
                    }}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col justify-between gap-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer min-w-0"
                  >
                    <div className="space-y-3 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 font-bold text-base font-display group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            {group.companyName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                              {group.companyName}
                            </h2>
                            <p className="text-[11px] text-slate-500 leading-tight break-words">
                              {group.domain}
                            </p>
                          </div>
                        </div>

                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 font-mono tabular-nums whitespace-nowrap shrink-0">
                          {group.experiences.length} {group.experiences.length === 1 ? 'student' : 'students'}
                        </span>
                      </div>

                      {/* Packages Offered */}
                      {packageList.length > 0 && (
                        <div className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">Package Range: </span>
                          <span className="font-mono tabular-nums font-bold text-blue-700">
                            {packageList.join(' · ')}
                          </span>
                        </div>
                      )}

                      {/* Roles Taken */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                          Roles Taken
                        </span>
                        <div className="flex flex-wrap gap-1.5 text-xs text-slate-700">
                          {roleList.map((r) => (
                            <span
                              key={r}
                              className="rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-[11px] font-medium"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Skills Needed */}
                      {skillsList.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                            Skills Needed
                          </span>
                          <div className="flex flex-wrap gap-1 text-[11px] text-slate-600">
                            {skillsList.map((sk) => (
                              <span key={sk} className="font-mono text-[10px] text-slate-700">
                                #{sk}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-blue-700 font-semibold group-hover:translate-x-0.5 transition-transform">
                      <span>View Student Experiences & Questions</span>
                      <span>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: WHEN CLICKING A COMPANY, DISPLAY ALL DETAILS OF EXPERIENCED STUDENTS */}
      {selectedCompany && selectedCompanyGroup && (
        <div className="space-y-6">
          {/* Company Summary Banner */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-4 sm:p-6 text-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
                  Company Interview Dossier
                </span>
                <h2 className="text-xl sm:text-2xl font-bold mt-1 text-white break-words">
                  {selectedCompanyGroup.companyName}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {selectedCompanyGroup.domain}
                </p>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <span className="text-xs text-slate-300">Total Student Experiences</span>
                <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
                  {selectedCompanyGroup.experiences.length}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-slate-700/60 text-xs">
              <div className="min-w-0">
                <span className="text-slate-400 block text-[11px]">Roles Taken</span>
                <span className="font-medium text-slate-100 break-words">
                  {Array.from(selectedCompanyGroup.roles).join(', ') || 'Software Engineer'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-slate-400 block text-[11px]">Packages Recorded</span>
                <span className="font-mono font-bold text-blue-300 break-words">
                  {Array.from(selectedCompanyGroup.packages).join(' · ') || 'Competitive CTC'}
                </span>
              </div>
              <div className="min-w-0 sm:col-span-2 md:col-span-1">
                <span className="text-slate-400 block text-[11px]">Required Core Skills</span>
                <span className="font-medium text-slate-100 break-words">
                  {Array.from(selectedCompanyGroup.skills).join(', ') || 'Data Structures & Algorithms'}
                </span>
              </div>
            </div>
          </div>

          {/* Filtering */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 w-full sm:w-auto">
              {[
                { id: 'all', label: 'All Results' },
                { id: 'selected', label: 'Selected / Offered' },
                { id: 'progress', label: 'In Progress' },
                { id: 'rejected', label: 'Rejected' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterResult(tab.id)}
                  className={`rounded-lg py-1.5 px-2.5 sm:px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                    filterResult === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-500 font-mono">
              Showing {filteredCompanyExperiences.length} student report(s)
            </span>
          </div>

          {/* List of Experienced Students for this Company */}
          {filteredCompanyExperiences.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                No interview experiences matched this filter for {selectedCompany}.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredCompanyExperiences.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4 shadow-2xs"
                >
                  {/* Student & Role Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-slate-800">{item.hiringType}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.interviewDate}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            item.resultStatus.includes('Selected')
                              ? 'text-emerald-700'
                              : item.resultStatus.includes('Progress')
                                ? 'text-amber-700'
                                : 'text-slate-700'
                          }`}
                        >
                          {item.resultStatus}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                        {item.roleTitle}
                      </h3>
                      {item.packageOrStipend && (
                        <div className="text-xs font-mono font-bold text-blue-700 mt-0.5">
                          Offered: {item.packageOrStipend}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-medium text-slate-500">Difficulty</div>
                        <span
                          className={`font-mono text-xs font-bold uppercase ${
                            item.overallDifficulty === 'Hard'
                              ? 'text-red-700'
                              : item.overallDifficulty === 'Medium'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          {item.overallDifficulty}
                        </span>
                      </div>

                      {canModifyEntry(item) && (
                        <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Edit experience"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete experience"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Overall Process Summary */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Overall Experience
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                      {item.overallExperience}
                    </p>
                  </div>

                  {/* What They Asked in each round */}
                  {item.rounds && item.rounds.length > 0 && (
                    <div className="space-y-2.5 pt-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Code2 className="h-3.5 w-3.5 text-blue-600" />
                        <span>What They Asked in Each Round</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                        {item.rounds.map((round) => (
                          <div
                            key={round.roundNumber}
                            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5 min-w-0"
                          >
                            <div className="flex items-start justify-between gap-2 text-xs">
                              <span className="font-bold text-slate-900 break-words min-w-0">{round.roundTitle}</span>
                              <span className="font-mono text-[11px] font-semibold text-slate-600 shrink-0">
                                {round.difficulty}
                              </span>
                            </div>

                            {round.topicsCovered && (
                              <div className="text-[11px] text-slate-600 break-words">
                                <span className="font-semibold text-slate-700">Topics: </span>
                                {round.topicsCovered}
                              </div>
                            )}

                            {round.questionsAsked && (
                              <div className="text-xs text-slate-800 bg-white rounded-lg p-2 border border-slate-200/80 leading-normal font-mono break-words">
                                {round.questionsAsked}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills Needed & Tips */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                    {item.skillsNeeded && (
                      <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-3 space-y-1">
                        <span className="font-bold text-blue-900 block">Skills Required:</span>
                        <p className="text-slate-700 leading-normal">{item.skillsNeeded}</p>
                      </div>
                    )}

                    {item.keyPreparationTips && (
                      <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-3 space-y-1">
                        <span className="font-bold text-amber-900 block">Preparation Tips:</span>
                        <p className="text-slate-700 leading-normal">{item.keyPreparationTips}</p>
                      </div>
                    )}
                  </div>

                  {/* Student Author Information */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div>
                      <span>Shared by experienced student: </span>
                      <span className="font-bold text-slate-900">{item.authorName}</span>
                      <span aria-hidden="true"> · </span>
                      <button
                        type="button"
                        onClick={() => onInspectStudentId(item.authorMemberId)}
                        className="font-mono text-blue-700 hover:underline font-semibold"
                      >
                        {item.authorMemberId}
                      </button>
                      <span aria-hidden="true"> · </span>
                      <span>{item.authorBatch}</span>
                    </div>

                    {item.resourcesUsed && (
                      <div className="text-slate-600">
                        Resources: <span className="font-medium text-slate-800">{item.resourcesUsed}</span>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

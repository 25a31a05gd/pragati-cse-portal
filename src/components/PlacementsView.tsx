import React, { useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
} from 'lucide-react';
import { apiRequest, safeExternalHref } from '../api';
import type {
  NavSection,
  PlacementDrive,
  PortalProgress,
  PublicUserProfile,
} from '../types';

interface PlacementsViewProps {
  currentUser: PublicUserProfile | null;
  placements: PlacementDrive[];
  onPlacementsChange: (next: PlacementDrive[]) => void;
  onRequireAuth: () => void;
  onNavigate: (section: NavSection) => void;
  onInspectStudentId: (memberId: string) => void;
  onProgressUpdated: (progress: PortalProgress) => void;
  onProfileRefresh?: () => Promise<void> | void;
}

export const PlacementsView: React.FC<PlacementsViewProps> = ({
  currentUser,
  placements,
  onPlacementsChange,
  onRequireAuth,
  onNavigate,
  onInspectStudentId,
  onProgressUpdated,
  onProfileRefresh,
}) => {
  const isStaff = Boolean(
    currentUser && (currentUser.role === 'faculty' || currentUser.role === 'admin')
  );

  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedApplicantsDriveId, setExpandedApplicantsDriveId] = useState<string | null>(
    null
  );

  const [companyName, setCompanyName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [packageCtc, setPackageCtc] = useState('');
  const [location, setLocation] = useState('');
  const [deadline, setDeadline] = useState('');
  const [applyLink, setApplyLink] = useState('');
  const [description, setDescription] = useState('');

  // Selectable Eligibility Criteria
  const [requireCgpa, setRequireCgpa] = useState(true);
  const [minCgpa, setMinCgpa] = useState('7.5');
  const [requireLeetcode, setRequireLeetcode] = useState(true);
  const [minLeetcodeProblems, setMinLeetcodeProblems] = useState('120');
  const [requireHackerrank, setRequireHackerrank] = useState(false);
  const [minHackerrankFiveStars, setMinHackerrankFiveStars] = useState('2');
  const [requireGithub, setRequireGithub] = useState(true);
  const [minGithubProjects, setMinGithubProjects] = useState('3');

  const [error, setError] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{
    driveId: string;
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canModifyDrive = (drive: PlacementDrive) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.role === 'faculty' && drive.authorId === currentUser.id;
  };

  const openCreateForm = () => {
    setEditingId(null);
    setCompanyName('');
    setRoleTitle('');
    setPackageCtc('');
    setLocation('');
    setDeadline('2026-12-10');
    setApplyLink('');
    setDescription('');
    setRequireCgpa(true);
    setMinCgpa('7.5');
    setRequireLeetcode(true);
    setMinLeetcodeProblems('120');
    setRequireHackerrank(false);
    setMinHackerrankFiveStars('2');
    setRequireGithub(true);
    setMinGithubProjects('3');
    setError('');
    setIsFormOpen(true);
  };

  const openEditForm = (drive: PlacementDrive) => {
    setEditingId(drive.id);
    setCompanyName(drive.companyName);
    setRoleTitle(drive.roleTitle);
    setPackageCtc(drive.packageCtc);
    setLocation(drive.location);
    setDeadline(drive.deadline);
    setApplyLink(drive.applyLink);
    setDescription(drive.description);
    setRequireCgpa(drive.criteria.requireCgpa);
    setMinCgpa(String(drive.criteria.minCgpa));
    setRequireLeetcode(drive.criteria.requireLeetcode);
    setMinLeetcodeProblems(String(drive.criteria.minLeetcodeProblems));
    setRequireHackerrank(drive.criteria.requireHackerrank);
    setMinHackerrankFiveStars(String(drive.criteria.minHackerrankFiveStars));
    setRequireGithub(drive.criteria.requireGithub);
    setMinGithubProjects(String(drive.criteria.minGithubProjects));
    setError('');
    setIsFormOpen(true);
  };

  const handleSaveDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const normalizedLink =
        applyLink.trim() && !/^https?:\/\//i.test(applyLink.trim())
          ? `https://${applyLink.trim()}`
          : applyLink.trim();
      const payload = {
        companyName,
        roleTitle,
        packageCtc,
        location,
        deadline,
        applyLink: normalizedLink,
        description,
        criteria: {
          requireCgpa,
          minCgpa: parseFloat(minCgpa) || 0,
          requireLeetcode,
          minLeetcodeProblems: parseInt(minLeetcodeProblems, 10) || 0,
          requireHackerrank,
          minHackerrankFiveStars: parseInt(minHackerrankFiveStars, 10) || 0,
          requireGithub,
          minGithubProjects: parseInt(minGithubProjects, 10) || 0,
        },
      };
      if (editingId) {
        const updated = await apiRequest<PlacementDrive>(
          `/api/placements/${editingId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        onPlacementsChange(placements.map((p) => (p.id === editingId ? updated : p)));
      } else {
        const created = await apiRequest<PlacementDrive>('/api/placements', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onPlacementsChange([created, ...placements]);
      }
      setIsFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save placement drive.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/placements/${id}`, { method: 'DELETE' });
      onPlacementsChange(placements.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete placement drive.');
    }
  };

  const handleApply = async (driveId: string) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setActionFeedback(null);
    try {
      const res = await apiRequest<{
        drive: PlacementDrive;
        progress: PortalProgress;
      }>(`/api/placements/${driveId}/apply`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      onPlacementsChange(placements.map((p) => (p.id === driveId ? res.drive : p)));
      onProgressUpdated(res.progress);
      await onProfileRefresh?.();
      setActionFeedback({
        driveId,
        type: 'success',
        message: 'Application recorded with your verified CGPA and coding profile metrics.',
      });
    } catch (err) {
      await onProfileRefresh?.();
      setActionFeedback({
        driveId,
        type: 'error',
        message: err instanceof Error ? err.message : 'Application failed.',
      });
    }
  };

  const evaluateStudentEligibility = (drive: PlacementDrive) => {
    if (!currentUser || currentUser.role !== 'student') return null;
    const c = drive.criteria;
    const checks: Array<{ label: string; met: boolean }> = [];
    if (c.requireCgpa) {
      checks.push({
        label: `CGPA ≥ ${c.minCgpa} (You: ${currentUser.cgpa})`,
        met: currentUser.cgpa >= c.minCgpa,
      });
    }
    if (c.requireLeetcode) {
      const statsVerified = Boolean(currentUser.codingStats.leetcodeVerified);
      const ownerVerified = Boolean(currentUser.codingStats.leetcodeOwnerVerified);
      const note = !currentUser.codingStats.leetcodeUrl
        ? 'No profile linked'
        : !statsVerified
        ? 'Unverified · Sync in My Profile'
        : !ownerVerified
        ? 'Ownership verification required'
        : `Verified: ${currentUser.codingStats.leetcodeSolved}`;
      checks.push({
        label: `LeetCode ≥ ${c.minLeetcodeProblems} (${note})`,
        met:
          statsVerified &&
          ownerVerified &&
          currentUser.codingStats.leetcodeSolved >= c.minLeetcodeProblems,
      });
    }
    if (c.requireHackerrank) {
      const statsVerified = Boolean(currentUser.codingStats.hackerrankVerified);
      const ownerVerified = Boolean(currentUser.codingStats.hackerrankOwnerVerified);
      const note = !currentUser.codingStats.hackerrankUrl
        ? 'No profile linked'
        : !statsVerified
        ? 'Unverified · Sync in My Profile'
        : !ownerVerified
        ? 'Ownership verification required'
        : `Verified: ${currentUser.codingStats.hackerrankFiveStars}`;
      checks.push({
        label: `HackerRank 5★ ≥ ${c.minHackerrankFiveStars} (${note})`,
        met:
          statsVerified &&
          ownerVerified &&
          currentUser.codingStats.hackerrankFiveStars >= c.minHackerrankFiveStars,
      });
    }
    if (c.requireGithub) {
      const statsVerified = Boolean(currentUser.codingStats.githubVerified);
      const ownerVerified = Boolean(currentUser.codingStats.githubOwnerVerified);
      const note = !currentUser.codingStats.githubUrl
        ? 'No profile linked'
        : !statsVerified
        ? 'Unverified · Sync in My Profile'
        : !ownerVerified
        ? 'Ownership verification required'
        : `Verified: ${currentUser.codingStats.githubProjects}`;
      checks.push({
        label: `GitHub Projects ≥ ${c.minGithubProjects} (${note})`,
        met:
          statsVerified &&
          ownerVerified &&
          currentUser.codingStats.githubProjects >= c.minGithubProjects,
      });
    }
    return {
      allMet: checks.every((ch) => ch.met),
      checks,
    };
  };

  const activeQuery = (appliedQuery || searchInput).trim().toLowerCase();
  const filtered = placements.filter((p) => {
    if (!activeQuery) return true;
    return (
      p.companyName.toLowerCase().includes(activeQuery) ||
      p.roleTitle.toLowerCase().includes(activeQuery) ||
      p.location.toLowerCase().includes(activeQuery) ||
      p.description.toLowerCase().includes(activeQuery)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Campus Placements
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Recruitment drives with transparent CGPA, LeetCode, HackerRank, and GitHub selection criteria.
          </p>
        </div>

        {/* "+" Symbol strictly ONLY for Faculty and Admin (Students cannot add placements) */}
        {isStaff && (
          <button
            type="button"
            onClick={() => (isFormOpen && !editingId ? setIsFormOpen(false) : openCreateForm())}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 min-h-[40px] text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            title="Add Placement Drive"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Add Placement Drive</span>
          </button>
        )}
      </div>

      {/* Add/Edit Placement Form (Faculty & Admin ONLY, opens when "+" is clicked in a modal dialog) */}
      {isFormOpen && isStaff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="placement-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-7 shadow-2xl border border-slate-200">
            <form
              onSubmit={handleSaveDrive}
              className="space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 id="placement-modal-title" className="text-base font-bold text-slate-900">
                  {editingId ? 'Edit Placement Drive & Criteria' : 'Publish Placement Drive & Criteria'}
                </h2>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Company Name
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Microsoft India"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Role Title
              </label>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Software Engineer I"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Package / CTC
              </label>
              <input
                type="text"
                required
                value={packageCtc}
                onChange={(e) => setPackageCtc(e.target.value)}
                placeholder="e.g. ₹28.0 LPA"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Job Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Hyderabad / Bengaluru"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Application Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Company Portal Link (Optional)
              </label>
              <input
                type="text"
                value={applyLink}
                onChange={(e) => setApplyLink(e.target.value)}
                placeholder="https://careers.company.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Selectable Eligibility Criteria */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <h3 className="text-xs font-semibold text-slate-900">
                Select Student Eligibility Criteria
              </h3>
              <p className="text-xs text-slate-500">
                Toggle which academic and coding benchmarks are enforced when students apply.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireCgpa}
                    onChange={(e) => setRequireCgpa(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>Minimum CGPA</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  disabled={!requireCgpa}
                  value={minCgpa}
                  onChange={(e) => setMinCgpa(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono tabular-nums disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireLeetcode}
                    onChange={(e) => setRequireLeetcode(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>LeetCode Problems</span>
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={!requireLeetcode}
                  value={minLeetcodeProblems}
                  onChange={(e) => setMinLeetcodeProblems(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono tabular-nums disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireHackerrank}
                    onChange={(e) => setRequireHackerrank(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>HackerRank 5★ Badges</span>
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={!requireHackerrank}
                  value={minHackerrankFiveStars}
                  onChange={(e) => setMinHackerrankFiveStars(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono tabular-nums disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireGithub}
                    onChange={(e) => setRequireGithub(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>GitHub Projects</span>
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={!requireGithub}
                  value={minGithubProjects}
                  onChange={(e) => setMinGithubProjects(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono tabular-nums disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Job Description & Selection Rounds
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline assessment format, interview rounds, and role expectations..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-lg border border-slate-300 bg-white py-2 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 py-2 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
            >
              {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Drive'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

      {/* Search Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedQuery(searchInput);
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (!e.target.value) setAppliedQuery('');
            }}
            placeholder="Search drives by company, role, or location..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 min-h-[40px] text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 py-2 px-3.5 sm:px-4 min-h-[40px] text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          Search
        </button>
      </form>

      {/* Drives List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 sm:p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No placement drives matched your search.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((drive) => {
            const hasApplied = Boolean(
              currentUser &&
                drive.applicants.some((a) => a.studentId === currentUser.id)
            );
            const eligibility = evaluateStudentEligibility(drive);
            const c = drive.criteria;
            const criteriaParts: string[] = [];
            if (c.requireCgpa) criteriaParts.push(`CGPA ≥ ${c.minCgpa}`);
            if (c.requireLeetcode)
              criteriaParts.push(`LeetCode ≥ ${c.minLeetcodeProblems} problems`);
            if (c.requireHackerrank)
              criteriaParts.push(`HackerRank ≥ ${c.minHackerrankFiveStars} 5★ badges`);
            if (c.requireGithub)
              criteriaParts.push(`GitHub ≥ ${c.minGithubProjects} projects`);

            return (
              <article
                key={drive.id}
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs text-slate-500 break-words">
                      <span className="font-semibold text-slate-800">{drive.companyName}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{drive.location}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono tabular-nums">Apply by {drive.deadline}</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-semibold text-slate-900 break-words">
                      {drive.roleTitle}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-blue-700">
                      {drive.packageCtc}
                    </span>

                    {canModifyDrive(drive) && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditForm(drive)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Edit drive"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(drive.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete drive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">{drive.description}</p>

                {/* Required Criteria Line (Zero-Pill Unboxed Metadata) */}
                <div className="rounded-lg bg-slate-50 px-4 py-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-800">
                    Selection Criteria:{' '}
                    <span className="font-mono font-normal text-slate-600">
                      {criteriaParts.length > 0
                        ? criteriaParts.join('  ·  ')
                        : 'Open to all CSE students'}
                    </span>
                  </div>

                  {eligibility && eligibility.checks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      {eligibility.checks.map((ch) => (
                        <span
                          key={ch.label}
                          className={`inline-flex items-center gap-1 font-mono tabular-nums ${
                            ch.met ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {ch.met ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{ch.label}</span>
                        </span>
                      ))}
                      {!eligibility.allMet && (
                        <button
                          type="button"
                          onClick={() => onNavigate('profile')}
                          className="text-blue-700 font-semibold hover:underline"
                        >
                          Sync links in My Profile →
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {actionFeedback && actionFeedback.driveId === drive.id && (
                  <div
                    className={`rounded-lg border px-3.5 py-2 text-xs ${
                      actionFeedback.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    {actionFeedback.message}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    <span>Coordinator: {drive.authorName}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono tabular-nums">
                      {drive.applicants.length} student(s) applied
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {safeExternalHref(drive.applyLink) && (
                      <a
                        href={safeExternalHref(drive.applyLink)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 px-3 min-h-[36px] text-xs font-medium text-slate-700 hover:border-slate-400 whitespace-nowrap"
                      >
                        <span>Company Notice</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    )}

                    {isStaff ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedApplicantsDriveId(
                            expandedApplicantsDriveId === drive.id ? null : drive.id
                          )
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2 px-3.5 min-h-[36px] text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                      >
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {expandedApplicantsDriveId === drive.id
                            ? 'Hide Applicants'
                            : `View Applicants (${drive.applicants.length})`}
                        </span>
                      </button>
                    ) : hasApplied ? (
                      <span className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 py-2 px-3.5 min-h-[36px] text-xs font-semibold text-emerald-800 whitespace-nowrap">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span>Applied</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApply(drive.id)}
                        className="rounded-lg bg-blue-600 py-2 px-4 min-h-[36px] text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                      >
                        Apply for Drive
                      </button>
                    )}
                  </div>
                </div>

                {/* Staff Applicant Inspection Table + Mobile Cards */}
                {isStaff && expandedApplicantsDriveId === drive.id && (
                  <div className="pt-3 border-t border-slate-200">
                    {drive.applicants.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No students have submitted applications for this drive yet.
                      </p>
                    ) : (
                      <>
                        {/* Mobile stacked applicant cards */}
                        <div className="sm:hidden space-y-2.5">
                          {drive.applicants.map((app) => (
                            <div
                              key={app.studentId}
                              className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => onInspectStudentId(app.studentMemberId)}
                                    className="font-mono font-semibold text-blue-700 hover:underline"
                                  >
                                    {app.studentMemberId}
                                  </button>
                                  <div className="font-semibold text-slate-900 truncate">
                                    {app.studentName}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[10px] uppercase text-slate-400">CGPA</div>
                                  <div className="font-mono font-bold text-slate-900 tabular-nums">
                                    {app.cgpa.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-[11px]">
                                <div>
                                  <div className="text-slate-400">LeetCode</div>
                                  <div className="font-mono font-semibold text-slate-800">
                                    {app.leetcodeSolved}
                                    {!app.leetcodeVerified && <span className="text-slate-400"> *</span>}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-slate-400">HR 5★</div>
                                  <div className="font-mono font-semibold text-slate-800">
                                    {app.hackerrankFiveStars}
                                    {!app.hackerrankVerified && <span className="text-slate-400"> *</span>}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-slate-400">GitHub</div>
                                  <div className="font-mono font-semibold text-slate-800">
                                    {app.githubProjects}
                                    {!app.githubVerified && <span className="text-slate-400"> *</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Tablet / Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500">
                                <th className="py-2 pr-4 font-medium">Student ID</th>
                                <th className="py-2 pr-4 font-medium">Name</th>
                                <th className="py-2 pr-4 font-medium text-right">CGPA</th>
                                <th className="py-2 pr-4 font-medium text-right">LeetCode</th>
                                <th className="py-2 pr-4 font-medium text-right">HackerRank 5★</th>
                                <th className="py-2 pl-4 font-medium text-right">GitHub Repos</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {drive.applicants.map((app) => (
                                <tr key={app.studentId} className="hover:bg-slate-50">
                                  <td className="py-2.5 pr-4 font-mono">
                                    <button
                                      type="button"
                                      onClick={() => onInspectStudentId(app.studentMemberId)}
                                      className="text-blue-700 hover:underline"
                                    >
                                      {app.studentMemberId}
                                    </button>
                                  </td>
                                  <td className="py-2.5 pr-4 font-medium text-slate-800">
                                    {app.studentName}
                                  </td>
                                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                                    {app.cgpa.toFixed(2)}
                                  </td>
                                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                                    {app.leetcodeSolved}
                                    {!app.leetcodeVerified && (
                                      <span className="ml-1 font-sans text-[10px] text-slate-400">
                                        (Unverified)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                                    {app.hackerrankFiveStars}
                                    {!app.hackerrankVerified && (
                                      <span className="ml-1 font-sans text-[10px] text-slate-400">
                                        (Unverified)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 pl-4 text-right font-mono tabular-nums">
                                    {app.githubProjects}
                                    {!app.githubVerified && (
                                      <span className="ml-1 font-sans text-[10px] text-slate-400">
                                        (Unverified)
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

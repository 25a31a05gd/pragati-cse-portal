import React, { useState } from 'react';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import { apiRequest } from '../api';
import { hasAdminModulePermission } from '../utils/adminPermissions';
import type { HackathonExperience, PublicUserProfile } from '../types';

interface HackathonsViewProps {
  currentUser: PublicUserProfile | null;
  hackathons: HackathonExperience[];
  onHackathonsChange: (next: HackathonExperience[]) => void;
  onRequireAuth: () => void;
  onInspectStudentId: (memberId: string) => void;
  onRefreshProgress: () => void;
}

export const HackathonsView: React.FC<HackathonsViewProps> = ({
  currentUser,
  hackathons,
  onHackathonsChange,
  onRequireAuth,
  onInspectStudentId,
  onRefreshProgress,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [hackathonName, setHackathonName] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [teamAndRole, setTeamAndRole] = useState('');
  const [outcome, setOutcome] = useState('');
  const [technologies, setTechnologies] = useState('');
  const [overallExperience, setOverallExperience] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canModifyEntry = (entry: HackathonExperience) => {
    if (!currentUser) return false;
    if (hasAdminModulePermission(currentUser, 'dashboard_analytics')) return true;
    return entry.authorId === currentUser.id;
  };

  const canSeeFullStudentDetails = Boolean(
    currentUser &&
      (currentUser.role === 'faculty' ||
        hasAdminModulePermission(currentUser, 'students') ||
        hasAdminModulePermission(currentUser, 'dashboard_analytics'))
  );

  const handlePlusClick = () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (isFormOpen && !editingId) {
      setIsFormOpen(false);
      return;
    }
    setEditingId(null);
    setHackathonName('');
    setOrganizer('');
    setEventDate('');
    setTeamAndRole('');
    setOutcome('');
    setTechnologies('');
    setOverallExperience('');
    setError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: HackathonExperience) => {
    setEditingId(item.id);
    setHackathonName(item.hackathonName);
    setOrganizer(item.organizer);
    setEventDate(item.eventDate);
    setTeamAndRole(item.teamAndRole);
    setOutcome(item.outcome);
    setTechnologies(item.technologies);
    setOverallExperience(item.overallExperience);
    setError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        hackathonName,
        organizer,
        eventDate,
        teamAndRole,
        outcome,
        technologies,
        overallExperience,
      };
      if (editingId) {
        const updated = await apiRequest<HackathonExperience>(
          `/api/hackathons/${editingId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        onHackathonsChange(hackathons.map((h) => (h.id === editingId ? updated : h)));
      } else {
        const created = await apiRequest<HackathonExperience>('/api/hackathons', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onHackathonsChange([created, ...hackathons]);
        onRefreshProgress();
      }
      setIsFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save hackathon experience.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/hackathons/${id}`, { method: 'DELETE' });
      onHackathonsChange(hackathons.filter((h) => h.id !== id));
      onRefreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete entry.');
    }
  };

  const activeQuery = (appliedQuery || searchInput).trim().toLowerCase();
  const filtered = hackathons.filter((h) => {
    if (!activeQuery) return true;
    return (
      h.hackathonName.toLowerCase().includes(activeQuery) ||
      h.organizer.toLowerCase().includes(activeQuery) ||
      h.technologies.toLowerCase().includes(activeQuery) ||
      h.overallExperience.toLowerCase().includes(activeQuery) ||
      h.authorName.toLowerCase().includes(activeQuery) ||
      h.authorMemberId.toLowerCase().includes(activeQuery)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header + "+" Symbol Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Hackathon Experience
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            End-to-end engineering reflections, architecture pivots, and jury learnings shared by CSE teams.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePlusClick}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 min-h-[40px] text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          title="Share Hackathon Experience"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Share Experience</span>
        </button>
      </div>

      {/* Form appears ONLY when "+" symbol button is clicked in a modal */}
      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hackathon-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-7 shadow-2xl border border-slate-200">
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 id="hackathon-modal-title" className="text-base font-bold text-slate-900">
                  {editingId ? 'Edit Hackathon Experience' : 'Add Hackathon Experience'}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Hackathon Name
              </label>
              <input
                type="text"
                required
                value={hackathonName}
                onChange={(e) => setHackathonName(e.target.value)}
                placeholder="e.g. Smart India Hackathon 2026"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Organizer & Venue
              </label>
              <input
                type="text"
                required
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder="e.g. IIT Hyderabad Nodal Center"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Event Month & Year
              </label>
              <input
                type="text"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                placeholder="e.g. October 2026"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Team Name & Your Role
              </label>
              <input
                type="text"
                value={teamAndRole}
                onChange={(e) => setTeamAndRole(e.target.value)}
                placeholder="e.g. Team ByteCraft · Systems Lead"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Prize / Outcome
              </label>
              <input
                type="text"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="e.g. 1st Runner-Up or Finalist"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Key Technologies Used
              </label>
              <input
                type="text"
                value={technologies}
                onChange={(e) => setTechnologies(e.target.value)}
                placeholder="e.g. React, Python, PostgreSQL, Docker"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Overall Experience (Architecture, Mentoring & Key Takeaways)
            </label>
            <textarea
              rows={4}
              required
              value={overallExperience}
              onChange={(e) => setOverallExperience(e.target.value)}
              placeholder="Describe the problem tackled, technical roadblocks during the sprint, jury feedback, and lessons for fellow CSE students..."
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
              {submitting ? 'Saving...' : editingId ? 'Update Experience' : 'Publish Experience'}
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
            placeholder="Search by hackathon, stack, student name, or ID..."
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

      {/* Entries List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 sm:p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No hackathon experiences matched your search.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Click the + Share Experience button above to contribute the first report.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-3"
            >
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="text-xs text-slate-500 break-words">
                    <span>{item.organizer || 'Hackathon Event'}</span>
                    {item.eventDate && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>{item.eventDate}</span>
                      </>
                    )}
                    {item.outcome && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="font-medium text-blue-700">{item.outcome}</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900 break-words">
                    {item.hackathonName}
                  </h2>
                  {item.teamAndRole && (
                    <div className="text-xs text-slate-600 break-words">{item.teamAndRole}</div>
                  )}
                </div>

                {canModifyEntry(item) && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      title="Edit your hackathon experience"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line break-words">
                {item.overallExperience}
              </p>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <div className="min-w-0 break-all sm:break-words">
                  <span>Shared by </span>
                  <span className="font-medium text-slate-800">{item.authorName}</span>
                  <span aria-hidden="true"> · </span>
                  <button
                    type="button"
                    onClick={() => onInspectStudentId(item.authorMemberId)}
                    className="font-mono text-blue-700 hover:underline"
                  >
                    {item.authorMemberId}
                  </button>
                  {canSeeFullStudentDetails && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>{item.authorBatch}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{item.authorEmail}</span>
                    </>
                  )}
                </div>
                {item.technologies && (
                  <div className="text-slate-600 break-words">Stack: {item.technologies}</div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Pencil,
  Trash2,
  X,
  Send,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../api';
import type { PortalProgress, ProblemStatement, PublicUserProfile } from '../types';

interface ProblemsViewProps {
  currentUser: PublicUserProfile | null;
  problems: ProblemStatement[];
  onProblemsChange: (next: ProblemStatement[]) => void;
  onRequireAuth: () => void;
  onInspectStudentId: (memberId: string) => void;
  onProgressUpdated: (progress: PortalProgress) => void;
  onRefreshBootstrap: () => void;
}

export const ProblemsView: React.FC<ProblemsViewProps> = ({
  currentUser,
  problems,
  onProblemsChange,
  onRequireAuth,
  onInspectStudentId,
  onProgressUpdated,
  onRefreshBootstrap,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'solved'>('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [applicationName, setApplicationName] = useState('');
  const [category, setCategory] = useState('Backend & API');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Active message drawer per problem ID
  const [activeMessageProblemId, setActiveMessageProblemId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [solutionLink, setSolutionLink] = useState('');
  const [marksSolved, setMarksSolved] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState('');

  const canModifyEntry = (entry: ProblemStatement) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return entry.authorId === currentUser.id;
  };

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
    setTitle('');
    setApplicationName('');
    setCategory('Backend & API');
    setDescription('');
    setContactInfo('');
    setContactEmail(currentUser.email);
    setError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: ProblemStatement) => {
    setEditingId(item.id);
    setTitle(item.title);
    setApplicationName(item.applicationName);
    setCategory(item.category);
    setDescription(item.description);
    setContactInfo(item.contactInfo);
    setContactEmail(item.contactEmail);
    setError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        title,
        applicationName,
        category,
        description,
        contactInfo,
        contactEmail,
      };
      if (editingId) {
        const updated = await apiRequest<ProblemStatement>(
          `/api/problems/${editingId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        onProblemsChange(problems.map((p) => (p.id === editingId ? updated : p)));
      } else {
        const created = await apiRequest<ProblemStatement>('/api/problems', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onProblemsChange([created, ...problems]);
        onRefreshBootstrap();
      }
      setIsFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save problem statement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/problems/${id}`, { method: 'DELETE' });
      onProblemsChange(problems.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete problem statement.');
    }
  };

  const handleToggleMessageThread = (problemId: string) => {
    if (activeMessageProblemId === problemId) {
      setActiveMessageProblemId(null);
      return;
    }
    setActiveMessageProblemId(problemId);
    setReplyText('');
    setSolutionLink('');
    setMarksSolved(false);
    setReplyError('');
  };

  const handleSendResponse = async (e: React.FormEvent, problemId: string) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setReplyError('');
    setReplySubmitting(true);
    try {
      const normalizedLink =
        solutionLink.trim() && !/^https?:\/\//i.test(solutionLink.trim())
          ? `https://${solutionLink.trim()}`
          : solutionLink.trim();
      const res = await apiRequest<{
        problem: ProblemStatement;
        progress: PortalProgress;
      }>(`/api/problems/${problemId}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          message: replyText,
          solutionLink: normalizedLink,
          marksSolved,
        }),
      });
      onProblemsChange(problems.map((p) => (p.id === problemId ? res.problem : p)));
      onProgressUpdated(res.progress);
      setReplyText('');
      setSolutionLink('');
      setMarksSolved(false);
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setReplySubmitting(false);
    }
  };

  const activeQuery = (appliedQuery || searchInput).trim().toLowerCase();
  const filtered = problems.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!activeQuery) return true;
    return (
      p.title.toLowerCase().includes(activeQuery) ||
      p.applicationName.toLowerCase().includes(activeQuery) ||
      p.category.toLowerCase().includes(activeQuery) ||
      p.description.toLowerCase().includes(activeQuery) ||
      p.authorName.toLowerCase().includes(activeQuery) ||
      p.authorMemberId.toLowerCase().includes(activeQuery)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Problem Statements
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Post technical issues with any application, collaborate via direct messages, or submit verified fixes.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePlusClick}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          title="Post Problem Statement"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Post Problem Statement</span>
        </button>
      </div>

      {/* Form appears ONLY when "+" button is clicked in a modal */}
      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="problem-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200">
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 id="problem-modal-title" className="text-base font-bold text-slate-900">
                  {editingId ? 'Edit Problem Statement' : 'Submit Application Problem Statement'}
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
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Problem Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Memory leak during concurrent WebSocket lab grading"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Affected Application
              </label>
              <input
                type="text"
                required
                value={applicationName}
                onChange={(e) => setApplicationName(e.target.value)}
                placeholder="e.g. Campus Hostel Portal"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Domain Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="Backend & API">Backend & API</option>
                <option value="Frontend & UI Bug">Frontend & UI Bug</option>
                <option value="Database & Sync">Database & Sync</option>
                <option value="Data & Document Processing">Data & Document Processing</option>
                <option value="Networking & DevOps">Networking & DevOps</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Contact Location / Phone / Desk
              </label>
              <input
                type="text"
                required
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="e.g. CSE Lab-2, Desk 14 · +91 98765 00000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="author@dept.edu"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Problem Statement & Reproduction Details
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what fails in the application and what kind of solution or assistance is needed..."
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
              {submitting
                ? 'Publishing...'
                : editingId
                  ? 'Save Changes'
                  : 'Publish & Notify Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

      {/* Search & Status Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedQuery(searchInput);
          }}
          className="flex flex-1 min-w-[260px] items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (!e.target.value) setAppliedQuery('');
              }}
              placeholder="Search problem statements by app name, issue, or author..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 py-2 px-4 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(['all', 'open', 'solved'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-md py-1.5 px-3 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {status === 'all' ? 'All Statements' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Problem Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No problem statements found for the current filter.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const isDrawerOpen = activeMessageProblemId === item.id;
            return (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{item.applicationName}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{item.category}</span>
                      <span aria-hidden="true"> · </span>
                      <span
                        className={
                          item.status === 'solved'
                            ? 'font-semibold text-emerald-700'
                            : 'font-semibold text-amber-700'
                        }
                      >
                        {item.status === 'solved' ? 'Status: Solved' : 'Status: Open'}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
                  </div>

                  {canModifyEntry(item) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit problem statement"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete problem statement"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">{item.description}</p>

                {/* Perspective Person Contact Info & Message Action */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <div>
                      <span>Perspective Contact: </span>
                      <span className="font-medium text-slate-900">{item.authorName}</span>
                      <span aria-hidden="true"> · </span>
                      <button
                        type="button"
                        onClick={() => onInspectStudentId(item.authorMemberId)}
                        className="font-mono text-blue-700 hover:underline"
                      >
                        {item.authorMemberId}
                      </button>
                    </div>
                    <div className="text-slate-500">
                      <span>{item.contactInfo}</span>
                      <span aria-hidden="true"> · </span>
                      <a
                        href={`mailto:${item.contactEmail}`}
                        className="text-blue-700 hover:underline"
                      >
                        {item.contactEmail}
                      </a>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleMessageThread(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 px-3.5 text-xs font-semibold text-slate-800 hover:border-blue-500 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Message / Propose Solution ({item.responses.length})
                    </span>
                  </button>
                </div>

                {/* Direct Message & Solution Thread */}
                {isDrawerOpen && (
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-semibold text-slate-800">
                        Messages & Proposed Solutions for {item.authorName}
                      </h3>

                      {item.responses.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No messages yet. Reach out directly below if you can resolve or collaborate on this issue.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {item.responses.map((resp) => (
                            <div
                              key={resp.id}
                              className="rounded-lg bg-slate-50 px-4 py-3 text-xs space-y-1.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">
                                <div>
                                  <span className="font-semibold text-slate-800">
                                    {resp.senderName}
                                  </span>
                                  <span aria-hidden="true"> · </span>
                                  <span className="font-mono">{resp.senderMemberId}</span>
                                  <span aria-hidden="true"> · </span>
                                  <span>{resp.senderEmail}</span>
                                </div>
                                {resp.marksSolved && (
                                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Submitted Solution
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-700 leading-relaxed">{resp.message}</p>
                              {resp.solutionLink && (
                                <a
                                  href={resp.solutionLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                                >
                                  <span>View Patch / Solution Link</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <form
                      onSubmit={(e) => handleSendResponse(e, item.id)}
                      className="space-y-3 pt-2"
                    >
                      {replyError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {replyError}
                        </div>
                      )}
                      <textarea
                        rows={2}
                        required
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={
                          currentUser
                            ? `Write a direct message or technical solution for ${item.authorName}...`
                            : 'Sign in at the top right to message this author or submit a fix...'
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-4 flex-1">
                          <input
                            type="text"
                            value={solutionLink}
                            onChange={(e) => setSolutionLink(e.target.value)}
                            placeholder="Optional PR / Repo / Fix URL"
                            className="min-w-[210px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={marksSolved}
                              onChange={(e) => setMarksSolved(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            />
                            <span>Mark as solved (counts toward my Profile Progress)</span>
                          </label>
                        </div>

                        <button
                          type="submit"
                          disabled={replySubmitting}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 py-2 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0"
                        >
                          <Send className="h-3.5 w-3.5 shrink-0" />
                          <span>{replySubmitting ? 'Sending...' : 'Send to Author'}</span>
                        </button>
                      </div>
                    </form>
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

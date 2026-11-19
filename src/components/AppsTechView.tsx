import React, { useState } from 'react';
import { Plus, Search, ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { apiRequest, safeExternalHref } from '../api';
import type { AppTechnology, PublicUserProfile } from '../types';

interface AppsTechViewProps {
  currentUser: PublicUserProfile | null;
  apps: AppTechnology[];
  onAppsChange: (next: AppTechnology[]) => void;
  onRequireAuth: () => void;
  onInspectStudentId: (memberId: string) => void;
  onRefreshProgress: () => void;
}

const APP_TYPES = [
  'All',
  'Educational Developer Tool',
  'Web Productivity App',
  'AI / Data Utility',
  'Mobile Utility',
  'Cloud / CLI Library',
];

export const AppsTechView: React.FC<AppsTechViewProps> = ({
  currentUser,
  apps,
  onAppsChange,
  onRequireAuth,
  onInspectStudentId,
  onRefreshProgress,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [appName, setAppName] = useState('');
  const [usedTechnologies, setUsedTechnologies] = useState('');
  const [description, setDescription] = useState('');
  const [appType, setAppType] = useState('Educational Developer Tool');
  const [appLink, setAppLink] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canModifyEntry = (entry: AppTechnology) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return entry.authorId === currentUser.id;
  };

  const canSeeFullStudentDetails = Boolean(
    currentUser && (currentUser.role === 'faculty' || currentUser.role === 'admin')
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
    setAppName('');
    setUsedTechnologies('');
    setDescription('');
    setAppType('Educational Developer Tool');
    setAppLink('');
    setError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: AppTechnology) => {
    setEditingId(item.id);
    setAppName(item.appName);
    setUsedTechnologies(item.usedTechnologies);
    setDescription(item.description);
    setAppType(item.appType);
    setAppLink(item.appLink);
    setError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const normalizedLink = /^https?:\/\//i.test(appLink.trim())
        ? appLink.trim()
        : `https://${appLink.trim()}`;
      const payload = {
        appName,
        usedTechnologies,
        description,
        appType,
        appLink: normalizedLink,
      };
      if (editingId) {
        const updated = await apiRequest<AppTechnology>(`/api/apps/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onAppsChange(apps.map((a) => (a.id === editingId ? updated : a)));
      } else {
        const created = await apiRequest<AppTechnology>('/api/apps', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onAppsChange([created, ...apps]);
        onRefreshProgress();
      }
      setIsFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save application entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/apps/${id}`, { method: 'DELETE' });
      onAppsChange(apps.filter((a) => a.id !== id));
      onRefreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete entry.');
    }
  };

  const activeQuery = (appliedQuery || searchInput).trim().toLowerCase();
  const filtered = apps.filter((a) => {
    if (typeFilter !== 'All' && a.appType !== typeFilter) return false;
    if (!activeQuery) return true;
    return (
      a.appName.toLowerCase().includes(activeQuery) ||
      a.usedTechnologies.toLowerCase().includes(activeQuery) ||
      a.description.toLowerCase().includes(activeQuery) ||
      a.appType.toLowerCase().includes(activeQuery) ||
      a.authorName.toLowerCase().includes(activeQuery) ||
      a.authorMemberId.toLowerCase().includes(activeQuery)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Apps & Technologies
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Directory of developer utilities, engineering tools, and technology stacks shared for CSE students to view and visit.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePlusClick}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          title="Add App & Technology"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Add App</span>
        </button>
      </div>

      {/* Form appears ONLY when "+" symbol is clicked in a modal */}
      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-modal-title"
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
                <h2 id="app-modal-title" className="text-base font-bold text-slate-900">
                  {editingId ? 'Edit App & Technology' : 'Register App & Technologies'}
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
                1. App Name
              </label>
              <input
                type="text"
                required
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g. PacketScope Visualizer"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                2. Used Technologies
              </label>
              <input
                type="text"
                required
                value={usedTechnologies}
                onChange={(e) => setUsedTechnologies(e.target.value)}
                placeholder="e.g. Rust, WebAssembly, React, Tailwind CSS"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                4. App Type
              </label>
              <select
                value={appType}
                onChange={(e) => setAppType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {APP_TYPES.filter((t) => t !== 'All').map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                5. App Link
              </label>
              <input
                type="text"
                required
                value={appLink}
                onChange={(e) => setAppLink(e.target.value)}
                placeholder="https://example-app.dev"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              3. Description
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what the application does and how CSE students or labs can use it..."
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
              {submitting ? 'Saving...' : editingId ? 'Save App' : 'Submit App'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

      {/* Search Input + Explicit Search Button + App Type Filter */}
      <div className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedQuery(searchInput);
          }}
          className="flex items-center gap-2"
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
              placeholder="Search apps by name, technology stack, app type, or contributor..."
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

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          {APP_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`rounded-md py-1.5 px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                typeFilter === type
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* App Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No applications matched your search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">
                      <span>{item.appType}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{item.usedTechnologies}</span>
                    </div>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">
                      {item.appName}
                    </h2>
                  </div>

                  {canModifyEntry(item) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit app"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete app"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
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
                      <span>{item.authorEmail}</span>
                    </>
                  )}
                </div>

                {safeExternalHref(item.appLink) && (
                  <a
                    href={safeExternalHref(item.appLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 py-1.5 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Visit App</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

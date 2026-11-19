import React, { useState } from 'react';
import { Plus, Search, ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { apiRequest, safeExternalHref } from '../api';
import type { DepartmentProject, PublicUserProfile } from '../types';

interface ProjectsViewProps {
  currentUser: PublicUserProfile | null;
  projects: DepartmentProject[];
  onProjectsChange: (next: DepartmentProject[]) => void;
  onRequireAuth: () => void;
  onInspectStudentId: (memberId: string) => void;
  onRefreshProgress: () => void;
}

const PROJECT_TYPES = [
  'All',
  'Full-Stack Web Application',
  'Systems & Cloud Platform',
  'AI / Machine Learning',
  'Mobile Application',
  'IoT & Embedded System',
];

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  currentUser,
  projects,
  onProjectsChange,
  onRequireAuth,
  onInspectStudentId,
  onRefreshProgress,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [projectName, setProjectName] = useState('');
  const [websiteType, setWebsiteType] = useState('Full-Stack Web Application');
  const [projectLink, setProjectLink] = useState('');
  const [technologies, setTechnologies] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canModifyEntry = (entry: DepartmentProject) => {
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
    setProjectName('');
    setWebsiteType('Full-Stack Web Application');
    setProjectLink('');
    setTechnologies('');
    setDescription('');
    setError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: DepartmentProject) => {
    setEditingId(item.id);
    setProjectName(item.projectName);
    setWebsiteType(item.websiteType);
    setProjectLink(item.projectLink);
    setTechnologies(item.technologies);
    setDescription(item.description);
    setError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const normalizedLink = /^https?:\/\//i.test(projectLink.trim())
        ? projectLink.trim()
        : `https://${projectLink.trim()}`;
      const payload = {
        projectName,
        websiteType,
        projectLink: normalizedLink,
        technologies,
        description,
      };
      if (editingId) {
        const updated = await apiRequest<DepartmentProject>(
          `/api/projects/${editingId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        onProjectsChange(projects.map((p) => (p.id === editingId ? updated : p)));
      } else {
        const created = await apiRequest<DepartmentProject>('/api/projects', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onProjectsChange([created, ...projects]);
        onRefreshProgress();
      }
      setIsFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/projects/${id}`, { method: 'DELETE' });
      onProjectsChange(projects.filter((p) => p.id !== id));
      onRefreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete project.');
    }
  };

  const activeQuery = (appliedQuery || searchInput).trim().toLowerCase();
  const filtered = projects.filter((p) => {
    const matchesType = typeFilter === 'All' || p.websiteType === typeFilter;
    if (!matchesType) return false;
    if (!activeQuery) return true;
    return (
      p.projectName.toLowerCase().includes(activeQuery) ||
      p.websiteType.toLowerCase().includes(activeQuery) ||
      p.technologies.toLowerCase().includes(activeQuery) ||
      p.description.toLowerCase().includes(activeQuery) ||
      p.authorName.toLowerCase().includes(activeQuery) ||
      p.authorMemberId.toLowerCase().includes(activeQuery)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Our Projects
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Completed software websites, engineering prototypes, and repositories built across the CSE department.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePlusClick}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 min-h-[40px] text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          title="Add Project"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Add Project</span>
        </button>
      </div>

      {/* Form appears ONLY when "+" button is clicked in a modal */}
      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-modal-title"
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
                <h2 id="project-modal-title" className="text-base font-bold text-slate-900">
                  {editingId ? 'Edit Project Details' : 'Publish Completed Project'}
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
                Project / Website Name
              </label>
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. LabGrid Auto-Grader"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Website / Project Type
              </label>
              <select
                value={websiteType}
                onChange={(e) => setWebsiteType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {PROJECT_TYPES.filter((t) => t !== 'All').map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Live Website / Repository Link
              </label>
              <input
                type="text"
                required
                value={projectLink}
                onChange={(e) => setProjectLink(e.target.value)}
                placeholder="https://github.com/username/project"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Technologies Built With
              </label>
              <input
                type="text"
                value={technologies}
                onChange={(e) => setTechnologies(e.target.value)}
                placeholder="e.g. TypeScript, React, Express, PostgreSQL"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              What Was Done (Implementation & Architecture Description)
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what the project solves, core engineering features implemented, and outcomes..."
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
              {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

      {/* Search + Interactive Type Filter */}
      <div className="space-y-3">
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
              placeholder="Search projects by title, type, stack, or student ID..."
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

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-full sm:w-fit">
          {PROJECT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`rounded-md py-1.5 px-2.5 sm:px-3 text-xs font-medium transition-colors whitespace-nowrap ${
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

      {/* Project Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 sm:p-10 text-center">
          <p className="text-sm font-medium text-slate-700">No projects matched your criteria.</p>
          <p className="mt-1 text-xs text-slate-500">
            Click + Add Project to showcase your website or system build.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 flex flex-col justify-between gap-4 min-w-0"
            >
              <div className="space-y-2.5 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500 break-words">
                      <span>{item.websiteType}</span>
                      {item.technologies && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>{item.technologies}</span>
                        </>
                      )}
                    </div>
                    <h2 className="mt-1 text-base sm:text-lg font-semibold text-slate-900 break-words">
                      {item.projectName}
                    </h2>
                  </div>

                  {canModifyEntry(item) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit project"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-sm text-slate-600 leading-relaxed break-words">
                  {item.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500 min-w-0 break-all sm:break-words">
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

                {safeExternalHref(item.projectLink) && (
                  <a
                    href={safeExternalHref(item.projectLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-3 min-h-[34px] text-xs font-semibold text-slate-800 hover:border-blue-400 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Visit Project</span>
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

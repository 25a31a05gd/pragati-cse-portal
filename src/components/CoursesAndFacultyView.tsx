import React, { useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  ExternalLink,
  Users,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { apiRequest } from '../api';
import type {
  AcademicResource,
  DepartmentCourse,
  PortalProgress,
  PublicUserProfile,
} from '../types';

/* ============================================================================
   1. COURSES VIEW (Faculty & Admin create/edit; Students LOCKED OUT)
============================================================================ */
interface CoursesViewProps {
  currentUser: PublicUserProfile | null;
  courses: DepartmentCourse[];
  onCoursesChange: (next: DepartmentCourse[]) => void;
  onRequireAuth: () => void;
  onInspectStudentId: (memberId: string) => void;
  onProgressUpdated: (progress: PortalProgress) => void;
}

export const CoursesView: React.FC<CoursesViewProps> = ({
  currentUser,
  courses,
  onCoursesChange,
  onRequireAuth,
  onInspectStudentId,
  onProgressUpdated,
}) => {
  const isStaff = Boolean(
    currentUser && (currentUser.role === 'faculty' || currentUser.role === 'admin')
  );

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 shadow-inner">
          <Lock className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
            <span>Institutional Login Required</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Department Courses — Login to Unlock
          </h1>
          <p className="text-slate-600 max-w-lg mx-auto text-sm leading-relaxed">
            Department curriculum schedules and elective registration require an active institutional account. Please sign in to view courses and enroll.
          </p>
        </div>

        <button
          type="button"
          onClick={onRequireAuth}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 px-5 text-sm font-bold text-white shadow-sm transition-all"
        >
          <span>Login / Create Account to Unlock</span>
        </button>
      </div>
    );
  }

  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedRosterCourseId, setExpandedRosterCourseId] = useState<string | null>(
    null
  );

  const [courseCode, setCourseCode] = useState('');
  const [title, setTitle] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [semester, setSemester] = useState('');
  const [credits, setCredits] = useState('4');
  const [schedule, setSchedule] = useState('');
  const [prerequisites, setPrerequisites] = useState('');
  const [description, setDescription] = useState('');
  const [resourceLink, setResourceLink] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canModifyCourse = (course: DepartmentCourse) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.role === 'faculty' && course.authorId === currentUser.id;
  };

  const openCreateForm = () => {
    setEditingId(null);
    setCourseCode('');
    setTitle('');
    setInstructorName(currentUser?.name || '');
    setSemester('Semester VI · Elective');
    setCredits('4');
    setSchedule('');
    setPrerequisites('');
    setDescription('');
    setResourceLink('');
    setError('');
    setIsFormOpen(true);
  };

  const openEditForm = (c: DepartmentCourse) => {
    setEditingId(c.id);
    setCourseCode(c.courseCode);
    setTitle(c.title);
    setInstructorName(c.instructorName);
    setSemester(c.semester);
    setCredits(String(c.credits));
    setSchedule(c.schedule);
    setPrerequisites(c.prerequisites);
    setDescription(c.description);
    setResourceLink(c.resourceLink);
    setError('');
    setIsFormOpen(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const normalizedLink =
        resourceLink.trim() && !/^https?:\/\//i.test(resourceLink.trim())
          ? `https://${resourceLink.trim()}`
          : resourceLink.trim();
      const payload = {
        courseCode,
        title,
        instructorName,
        semester,
        credits: parseInt(credits, 10) || 3,
        schedule,
        prerequisites,
        description,
        resourceLink: normalizedLink,
      };
      if (editingId) {
        const updated = await apiRequest<DepartmentCourse>(
          `/api/courses/${editingId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        onCoursesChange(courses.map((c) => (c.id === editingId ? updated : c)));
      } else {
        const created = await apiRequest<DepartmentCourse>('/api/courses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onCoursesChange([created, ...courses]);
      }
      setIsFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save course.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/courses/${id}`, { method: 'DELETE' });
      onCoursesChange(courses.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete course.');
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      const res = await apiRequest<{
        course: DepartmentCourse;
        progress: PortalProgress;
      }>(`/api/courses/${courseId}/enroll`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      onCoursesChange(courses.map((c) => (c.id === courseId ? res.course : c)));
      onProgressUpdated(res.progress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to enroll in course.');
    }
  };

  const activeQuery = (appliedQuery || searchInput).trim().toLowerCase();
  const filtered = courses.filter((c) => {
    if (!activeQuery) return true;
    return (
      c.courseCode.toLowerCase().includes(activeQuery) ||
      c.title.toLowerCase().includes(activeQuery) ||
      c.instructorName.toLowerCase().includes(activeQuery) ||
      c.semester.toLowerCase().includes(activeQuery) ||
      c.description.toLowerCase().includes(activeQuery)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Department Courses
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Core CSE curriculum, honours tracks, and department electives open for student registration.
          </p>
        </div>

        {/* "+" strictly for Faculty & Admin only */}
        {isStaff && (
          <button
            type="button"
            onClick={() => (isFormOpen && !editingId ? setIsFormOpen(false) : openCreateForm())}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Add Course</span>
          </button>
        )}
      </div>

      {error && !isFormOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {isFormOpen && isStaff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="course-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200">
            <form
              onSubmit={handleSaveCourse}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              {editingId ? 'Edit Course Offering' : 'Publish Department Course'}
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
                Course Code
              </label>
              <input
                type="text"
                required
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g. CS420"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Course Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Compiler Optimizations & Program Analysis"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Instructor Name
              </label>
              <input
                type="text"
                required
                value={instructorName}
                onChange={(e) => setInstructorName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Semester / Track
              </label>
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="e.g. Semester VII · Elective"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Credits
              </label>
              <input
                type="number"
                min="1"
                max="6"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Class Schedule & Hall
              </label>
              <input
                type="text"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="Mon, Wed · 11:00 AM (LH-104)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Prerequisites
              </label>
              <input
                type="text"
                value={prerequisites}
                onChange={(e) => setPrerequisites(e.target.value)}
                placeholder="Data Structures, Theory of Computation"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Syllabus / Course Page Link
              </label>
              <input
                type="text"
                value={resourceLink}
                onChange={(e) => setResourceLink(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Course Abstract & Learning Outcomes
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of syllabus topics, tools used, grading scheme..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-lg border border-slate-300 bg-white py-2 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 py-2 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingId ? 'Update Course' : 'Publish Course'}
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
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (!e.target.value) setAppliedQuery('');
            }}
            placeholder="Search courses by code, title, instructor, or topic..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 py-2 px-4 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          Search
        </button>
      </form>

      {/* Course Cards Grid */}
      <div className="space-y-4">
        {filtered.map((course) => {
          const isEnrolled = Boolean(
            currentUser && course.enrollments.some((en) => en.studentId === currentUser.id)
          );

          return (
            <article
              key={course.id}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500">
                    <span className="font-mono font-bold text-blue-700 uppercase">
                      {course.courseCode}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span>{course.semester}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono tabular-nums">{course.credits} Credits</span>
                    <span aria-hidden="true"> · </span>
                    <span>{course.schedule}</span>
                  </div>

                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{course.title}</h2>

                  <div className="text-xs text-slate-600 mt-0.5">
                    Instructor: <span className="font-semibold text-slate-800">{course.instructorName}</span>
                  </div>
                </div>

                {canModifyCourse(course) && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditForm(course)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(course.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">{course.description}</p>

              <div className="text-xs text-slate-500">
                Prerequisites: <span className="text-slate-700">{course.prerequisites}</span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-mono tabular-nums text-slate-500">
                  {course.enrollments.length} student(s) enrolled
                </div>

                <div className="flex items-center gap-2">
                  {course.resourceLink && (
                    <a
                      href={course.resourceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-medium text-slate-700 hover:border-slate-400 whitespace-nowrap"
                    >
                      <span>Syllabus</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  )}

                  {isStaff ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedRosterCourseId(
                          expandedRosterCourseId === course.id ? null : course.id
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 py-1.5 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {expandedRosterCourseId === course.id
                          ? 'Hide Roster'
                          : `Enrolled Students (${course.enrollments.length})`}
                      </span>
                    </button>
                  ) : isEnrolled ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 px-3.5 text-xs font-semibold text-emerald-800 whitespace-nowrap">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Applied / Enrolled</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEnroll(course.id)}
                      className="rounded-lg bg-blue-600 py-1.5 px-4 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      Apply / Enroll
                    </button>
                  )}
                </div>
              </div>

              {isStaff && expandedRosterCourseId === course.id && (
                <div className="pt-3 border-t border-slate-200">
                  {course.enrollments.length === 0 ? (
                    <p className="text-xs text-slate-500">No students enrolled yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2 pr-4 font-medium">Student ID</th>
                            <th className="py-2 pr-4 font-medium">Student Name</th>
                            <th className="py-2 font-medium">Email</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {course.enrollments.map((en) => (
                            <tr key={en.studentId}>
                              <td className="py-2 pr-4 font-mono">
                                <button
                                  type="button"
                                  onClick={() => onInspectStudentId(en.studentMemberId)}
                                  className="text-blue-700 hover:underline"
                                >
                                  {en.studentMemberId}
                                </button>
                              </td>
                              <td className="py-2 pr-4 font-medium text-slate-800">
                                {en.studentName}
                              </td>
                              <td className="py-2 text-slate-600">{en.studentEmail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
   2. LAB & DEPT ACADEMIC RESOURCES VIEW (Department-wide useful utility)
============================================================================ */
interface ResourcesViewProps {
  currentUser: PublicUserProfile | null;
  resources: AcademicResource[];
  onResourcesChange: (next: AcademicResource[]) => void;
}

export const ResourcesView: React.FC<ResourcesViewProps> = ({
  currentUser,
  resources,
  onResourcesChange,
}) => {
  const isStaff = Boolean(
    currentUser && (currentUser.role === 'faculty' || currentUser.role === 'admin')
  );
  const [searchInput, setSearchInput] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [resourceType, setResourceType] = useState('Lab Manual');
  const [subjectOrLab, setSubjectOrLab] = useState('');
  const [description, setDescription] = useState('');
  const [resourceLink, setResourceLink] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const normalizedLink = /^https?:\/\//i.test(resourceLink.trim())
        ? resourceLink.trim()
        : `https://${resourceLink.trim()}`;
      const created = await apiRequest<AcademicResource>('/api/resources', {
        method: 'POST',
        body: JSON.stringify({
          title,
          resourceType,
          subjectOrLab,
          description,
          resourceLink: normalizedLink,
        }),
      });
      onResourcesChange([created, ...resources]);
      setIsFormOpen(false);
      setTitle('');
      setSubjectOrLab('');
      setDescription('');
      setResourceLink('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish resource.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/resources/${id}`, { method: 'DELETE' });
      onResourcesChange(resources.filter((r) => r.id !== id));
    } catch {
      // ignore
    }
  };

  const filtered = resources.filter((r) => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      r.subjectOrLab.toLowerCase().includes(q) ||
      r.resourceType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Lab Manuals & Academic Resources
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Official CSE laboratory manuals, DSA preparation sheets, and curriculum handbooks.
          </p>
        </div>

        {isStaff && (
          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Add Resource</span>
          </button>
        )}
      </div>

      {isFormOpen && isStaff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="resource-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200">
            <form
              onSubmit={handleSave}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 id="resource-modal-title" className="text-base font-semibold text-slate-900">
              Publish Department Resource
            </h2>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
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
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Resource Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Resource Category
              </label>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="Lab Manual">Lab Manual</option>
                <option value="Coding Club Guide">Coding Club Guide</option>
                <option value="Curriculum & Syllabus">Curriculum & Syllabus</option>
                <option value="Research Group">Research Group</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Course / Laboratory
              </label>
              <input
                type="text"
                value={subjectOrLab}
                onChange={(e) => setSubjectOrLab(e.target.value)}
                placeholder="e.g. CS304 Networks Lab"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Resource Link
              </label>
              <input
                type="text"
                required
                value={resourceLink}
                onChange={(e) => setResourceLink(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-lg border border-slate-300 py-2 px-4 text-xs font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 py-2 px-4 text-xs font-semibold text-white"
            >
              Publish
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Filter lab manuals, syllabus guides, or coding roadmaps..."
          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((res) => (
          <article
            key={res.id}
            className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-slate-500">
                  <span>{res.resourceType}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{res.subjectOrLab}</span>
                </div>
                {currentUser &&
                  (currentUser.role === 'admin' || currentUser.id === res.authorId) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(res.id)}
                      className="rounded-md p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
              </div>
              <h2 className="text-base font-semibold text-slate-900">{res.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{res.description}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Curated by {res.authorName}</span>
              <a
                href={res.resourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:underline whitespace-nowrap"
              >
                <span>Open Resource</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

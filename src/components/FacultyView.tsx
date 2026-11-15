import React, { useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  GraduationCap,
  Mail,
  MapPin,
  Clock,
  BookOpen,
  Award,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../api';
import type { FacultyMember, PublicUserProfile } from '../types';

interface FacultyViewProps {
  currentUser: PublicUserProfile | null;
  facultyMembers: FacultyMember[];
  onFacultyChange: (next: FacultyMember[]) => void;
  onRequireAuth: () => void;
}

const DESIGNATION_OPTIONS = [
  'Professor & Head of Department (HOD)',
  'Professor',
  'Associate Professor',
  'Assistant Professor (Senior Grade)',
  'Assistant Professor',
  'Visiting Professor / Industry Fellow',
  'Adjunct Faculty',
];

export const FacultyView: React.FC<FacultyViewProps> = ({
  currentUser,
  facultyMembers,
  onFacultyChange,
  onRequireAuth,
}) => {
  const isStudent = currentUser?.role === 'student';
  const canCreate = Boolean(
    currentUser && (currentUser.role === 'faculty' || currentUser.role === 'admin')
  );

  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [designationFilter, setDesignationFilter] = useState<'all' | 'hod' | 'professor' | 'associate' | 'assistant'>('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');
  const [specialization, setSpecialization] = useState('');
  const [email, setEmail] = useState('');
  const [phoneOrCabin, setPhoneOrCabin] = useState('');
  const [qualification, setQualification] = useState('');
  const [experienceYears, setExperienceYears] = useState('5');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canModifyFaculty = (item: FacultyMember) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.role === 'faculty' && item.authorId === currentUser.id;
  };

  const openCreateForm = () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (currentUser.role === 'student') return;

    setEditingId(null);
    setName(currentUser.role === 'faculty' ? currentUser.name : '');
    setDesignation('Assistant Professor');
    setSpecialization('');
    setEmail(currentUser.email);
    setPhoneOrCabin('Cabin LH-302 · Ext 210');
    setQualification('M.Tech / Ph.D in Computer Science');
    setExperienceYears('6');
    setBio('');
    setError('');
    setIsFormOpen(true);
  };

  const openEditForm = (item: FacultyMember) => {
    setEditingId(item.id);
    setName(item.name);
    setDesignation(item.designation);
    setSpecialization(item.specialization);
    setEmail(item.email);
    setPhoneOrCabin(item.phoneOrCabin);
    setQualification(item.qualification);
    setExperienceYears(String(item.experienceYears));
    setBio(item.bio || '');
    setError('');
    setIsFormOpen(true);
  };

  const handleSaveFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        name,
        designation,
        specialization,
        email,
        phoneOrCabin,
        qualification,
        experienceYears: parseInt(experienceYears, 10) || 1,
        bio,
      };

      if (editingId) {
        const updated = await apiRequest<FacultyMember>(`/api/faculty/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onFacultyChange(facultyMembers.map((f) => (f.id === editingId ? updated : f)));
      } else {
        const created = await apiRequest<FacultyMember>('/api/faculty', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onFacultyChange([created, ...facultyMembers]);
      }
      setIsFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save faculty record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/faculty/${id}`, { method: 'DELETE' });
      onFacultyChange(facultyMembers.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove faculty member.');
    }
  };

  const activeQuery = (appliedQuery || searchInput).trim().toLowerCase();
  const filtered = facultyMembers.filter((item) => {
    if (designationFilter === 'hod' && !item.designation.toLowerCase().includes('hod')) return false;
    if (designationFilter === 'professor' && (!item.designation.toLowerCase().includes('professor') || item.designation.toLowerCase().includes('associate') || item.designation.toLowerCase().includes('assistant'))) return false;
    if (designationFilter === 'associate' && !item.designation.toLowerCase().includes('associate')) return false;
    if (designationFilter === 'assistant' && !item.designation.toLowerCase().includes('assistant')) return false;

    if (!activeQuery) return true;
    return (
      item.name.toLowerCase().includes(activeQuery) ||
      item.designation.toLowerCase().includes(activeQuery) ||
      item.specialization.toLowerCase().includes(activeQuery) ||
      item.qualification.toLowerCase().includes(activeQuery) ||
      item.email.toLowerCase().includes(activeQuery)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Faculty Directory
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            CSE Department faculty members, designations (HOD, Professors, Lecturers), specializations, and office hours.
          </p>
        </div>

        {/* "+" button opens form; visible for Faculty and Admin only */}
        {canCreate && (
          <button
            type="button"
            onClick={() => (isFormOpen && !editingId ? setIsFormOpen(false) : openCreateForm())}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 shadow-sm"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Add Faculty Member</span>
          </button>
        )}
      </div>

      {/* Role notice for students */}
      {isStudent && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 flex items-center justify-between gap-3">
          <span>
            <strong className="text-slate-800">Student Directory View:</strong> You have read-only access to browse department faculty names, designations, and contact info.
          </span>
          <span className="font-mono text-slate-400">View Only</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setAppliedQuery(searchInput)}
            placeholder="Search by faculty name, designation, specialization (e.g. HOD, Cloud, Networks)..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none bg-white"
          />
        </div>

        <button
          type="button"
          onClick={() => setAppliedQuery(searchInput)}
          className="rounded-lg bg-slate-900 py-2 px-4 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
        >
          Search
        </button>

        {(appliedQuery || searchInput) && (
          <button
            type="button"
            onClick={() => {
              setSearchInput('');
              setAppliedQuery('');
            }}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Designation Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
        <span className="text-xs font-medium text-slate-500 mr-1">Designation:</span>
        {[
          { id: 'all', label: 'All Faculty' },
          { id: 'hod', label: 'Head of Dept (HOD)' },
          { id: 'professor', label: 'Professors' },
          { id: 'associate', label: 'Associate Professors' },
          { id: 'assistant', label: 'Assistant Professors' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setDesignationFilter(f.id as any)}
            className={`rounded-lg py-1.5 px-3 text-xs font-medium transition-colors ${
              designationFilter === f.id
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Modal / Form on "+" click */}
      {isFormOpen && canCreate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="faculty-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200">
            <form onSubmit={handleSaveFaculty} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 id="faculty-modal-title" className="text-base font-bold text-slate-900">
                  {editingId ? 'Edit Faculty Profile' : 'Add New Faculty Member'}
                </h2>
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
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Faculty Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. K. Meenakshi Sundaram"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designation / Title *
                  </label>
                  <select
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none bg-white"
                  >
                    {DESIGNATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Research / Teaching Specialization <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Distributed Systems, High-Performance Computing, AI/ML"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Highest Qualification <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="e.g. Ph.D (IIT Bombay), M.Tech (IISc)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Email <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="faculty@dept.edu"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cabin / Office & Ext Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={phoneOrCabin}
                    onChange={(e) => setPhoneOrCabin(e.target.value)}
                    placeholder="e.g. Cabin LH-302 · Ext 210"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Years of Academic Experience <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Short Academic Bio / Current Focus
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Summary of courses taught, ongoing research projects, or office hours..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white py-2 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 py-2 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Faculty Profile' : 'Save Faculty Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Faculty Cards Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            No Faculty Members Found
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Try adjusting your search query or designation filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((faculty) => {
            const isHod = faculty.designation.toLowerCase().includes('hod') || faculty.designation.toLowerCase().includes('head of department');
            const canEdit = canModifyFaculty(faculty);

            return (
              <article
                key={faculty.id}
                className={`relative rounded-xl border bg-white p-5 flex flex-col justify-between transition-all hover:shadow-md ${
                  isHod
                    ? 'border-blue-300 ring-1 ring-blue-100 bg-gradient-to-b from-blue-50/30 to-white'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top Bar: Designation Badge & Edit/Delete actions */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide ${
                        isHod
                          ? 'bg-blue-100 text-blue-800'
                          : faculty.designation.toLowerCase().includes('associate')
                          ? 'bg-indigo-50 text-indigo-700'
                          : faculty.designation.toLowerCase().includes('assistant')
                          ? 'bg-teal-50 text-teal-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {isHod && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-blue-700" />}
                      <span>{faculty.designation}</span>
                    </span>

                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditForm(faculty)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Edit faculty member"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(faculty.id)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete faculty member"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Faculty Name */}
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
                    {faculty.name}
                  </h3>

                  {/* Qualification */}
                  {faculty.qualification && (
                    <div className="text-xs font-medium text-slate-500 mt-0.5">
                      {faculty.qualification}
                    </div>
                  )}

                  {/* Specialization */}
                  <div className="mt-3 text-xs leading-relaxed text-slate-700">
                    <span className="font-semibold text-slate-900">Area: </span>
                    {faculty.specialization}
                  </div>

                  {/* Bio */}
                  {faculty.bio && (
                    <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {faculty.bio}
                    </p>
                  )}
                </div>

                {/* Footer details: Cabin, Email, Experience */}
                <div className="mt-5 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{faculty.phoneOrCabin}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <a
                      href={`mailto:${faculty.email}`}
                      className="text-blue-700 hover:underline truncate"
                    >
                      {faculty.email}
                    </a>
                  </div>
                  {faculty.experienceYears > 0 && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{faculty.experienceYears}+ years experience</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

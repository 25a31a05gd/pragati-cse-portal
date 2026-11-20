import React, { useEffect, useState } from 'react';
import { Search, ExternalLink, Pencil, X, ShieldCheck } from 'lucide-react';
import { apiRequest, safeExternalHref } from '../api';
import { hasAdminModulePermission } from '../utils/adminPermissions';
import type { PublicUserProfile, StudentDirectoryDetail } from '../types';

interface StudentSearchViewProps {
  initialQuery?: string;
  currentUser?: PublicUserProfile | null;
  onStudentUpdated?: (updatedProfile: PublicUserProfile) => void;
}

const DEPARTMENTS = [
  'Computer Science & Engineering (CSE)',
  'CSE (Artificial Intelligence & Machine Learning)',
  'CSE (Data Science)',
  'Information Technology (IT)',
  'Electronics & Communication Engineering (ECE)',
  'Electrical & Electronics Engineering (EEE)',
  'Mechanical Engineering (MECH)',
  'Civil Engineering (CIVIL)',
];

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

export const StudentSearchView: React.FC<StudentSearchViewProps> = ({
  initialQuery = '',
  currentUser = null,
  onStudentUpdated,
}) => {
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [results, setResults] = useState<StudentDirectoryDetail[]>([]);
  const [selectedStudent, setSelectedStudent] =
    useState<StudentDirectoryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const canStaffEdit =
    currentUser?.role === 'faculty' ||
    hasAdminModulePermission(currentUser, 'students');
  const canVerifyCodingOwner =
    currentUser?.role === 'faculty' ||
    hasAdminModulePermission(currentUser, 'coding_verification');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [ownerBusyPlatform, setOwnerBusyPlatform] = useState<
    'leetcode' | 'hackerrank' | 'github' | null
  >(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    department: '',
    year: '',
    section: '',
    phone: '',
    cgpa: '',
    skills: '',
    bio: '',
  });

  const runSearch = async (q: string) => {
    setLoading(true);
    try {
      const res = await apiRequest<{ results: StudentDirectoryDetail[] }>(
        `/api/students/search?q=${encodeURIComponent(q.trim())}`
      );
      setResults(res.results);
      if (q.trim() && res.results.length > 0) {
        const exact = res.results.find(
          (r) => r.profile.memberId.toLowerCase() === q.trim().toLowerCase()
        );
        setSelectedStudent(exact || res.results[0]);
      } else if (res.results.length > 0 && !selectedStudent) {
        setSelectedStudent(res.results[0]);
      } else if (res.results.length === 0) {
        setSelectedStudent(null);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setQueryInput(initialQuery);
    runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(queryInput);
  };

  const openEditModal = (student: PublicUserProfile) => {
    setEditError(null);
    setEditForm({
      name: student.name,
      department: student.department || DEPARTMENTS[0],
      year: student.year || YEARS[0],
      section: student.section || SECTIONS[0],
      phone: student.phone || '',
      cgpa: student.cgpa ? String(student.cgpa) : '0',
      skills: student.skills || '',
      bio: student.bio || '',
    });
    setEditModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setEditSaving(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      const res = await apiRequest<{ ok: boolean; student: PublicUserProfile }>(
        `/api/students/${selectedStudent.profile.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: editForm.name,
            department: editForm.department,
            year: editForm.year,
            section: editForm.section,
            phone: editForm.phone,
            cgpa: parseFloat(editForm.cgpa) || 0,
            skills: editForm.skills,
            bio: editForm.bio,
          }),
        }
      );

      const updatedProfile = res.student;
      setSelectedStudent((prev) =>
        prev && prev.profile.id === updatedProfile.id
          ? { ...prev, profile: updatedProfile }
          : prev
      );
      setResults((prev) =>
        prev.map((entry) =>
          entry.profile.id === updatedProfile.id
            ? { ...entry, profile: updatedProfile }
            : entry
        )
      );
      onStudentUpdated?.(updatedProfile);
      setEditModalOpen(false);
      setEditSuccess(`Updated profile details and bio for ${updatedProfile.name}.`);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Unable to update student profile.'
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleOwnerVerification = async (
    platform: 'leetcode' | 'hackerrank' | 'github',
    verified: boolean
  ) => {
    if (!selectedStudent || !canStaffEdit) return;
    setOwnerBusyPlatform(platform);
    setOwnerError(null);
    setEditSuccess(null);
    try {
      const res = await apiRequest<{ ok: boolean; student: PublicUserProfile }>(
        `/api/students/${selectedStudent.profile.id}/verify-coding-owner`,
        {
          method: 'POST',
          body: JSON.stringify({ platform, verified }),
        }
      );
      const updatedProfile = res.student;
      setSelectedStudent((prev) =>
        prev && prev.profile.id === updatedProfile.id
          ? { ...prev, profile: updatedProfile }
          : prev
      );
      setResults((prev) =>
        prev.map((entry) =>
          entry.profile.id === updatedProfile.id
            ? { ...entry, profile: updatedProfile }
            : entry
        )
      );
      onStudentUpdated?.(updatedProfile);
      setEditSuccess(
        `${verified ? 'Verified' : 'Revoked'} ${platform} handle ownership for ${updatedProfile.name}.`
      );
    } catch (err) {
      setOwnerError(
        err instanceof Error ? err.message : 'Unable to update handle ownership status.'
      );
    } finally {
      setOwnerBusyPlatform(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Search Student by ID
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Look up any CSE student by Roll Number / Student ID (for example <span className="font-mono text-slate-800">22CSE104</span>, <span className="font-mono text-slate-800">22CSE118</span>, or newly registered IDs) to inspect their academic profile, coding stats, and portal contributions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Enter Student ID (e.g. 22CSE104) or Name..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 min-h-[42px] text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 py-2.5 px-3.5 sm:px-5 min-h-[42px] text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          Search ID
        </button>
      </form>

      {editSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800 flex items-center justify-between gap-2">
          <span>{editSuccess}</span>
          <button
            type="button"
            onClick={() => setEditSuccess(null)}
            className="text-emerald-700 hover:underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {ownerError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700 flex items-center justify-between gap-2">
          <span>{ownerError}</span>
          <button
            type="button"
            onClick={() => setOwnerError(null)}
            className="text-red-700 hover:underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 space-y-2">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-20 rounded-xl border border-slate-200 bg-white animate-pulse"
              />
            ))}
          </div>
          <div className="lg:col-span-8 h-80 rounded-xl border border-slate-200 bg-white animate-pulse" />
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No student matched ID or name "{queryInput}".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Student List */}
          <div className="lg:col-span-4 space-y-2 max-h-56 lg:max-h-[72vh] overflow-y-auto pr-1">
            {results.map((entry) => {
              const isSelected = selectedStudent?.profile.id === entry.profile.id;
              return (
                <button
                  key={entry.profile.id}
                  type="button"
                  onClick={() => setSelectedStudent(entry)}
                  className={`w-full text-left rounded-xl border p-3.5 sm:p-4 transition-colors ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-blue-700">
                      {entry.profile.memberId}
                    </span>
                    <span className="font-mono tabular-nums text-xs text-slate-600">
                      CGPA {entry.profile.cgpa.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 truncate">
                    {entry.profile.name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 truncate">
                    {entry.profile.batchOrDesignation}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Student Detailed Profile */}
          {selectedStudent && (
            <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-6 min-w-0">
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500 break-words">
                    <span className="font-mono font-semibold text-blue-700">
                      {selectedStudent.profile.memberId}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span>{selectedStudent.profile.batchOrDesignation}</span>
                  </div>
                  <h2 className="mt-1 text-lg sm:text-xl font-bold text-slate-900 break-words">
                    {selectedStudent.profile.name}
                  </h2>
                  {selectedStudent.profile.bio && (
                    <p className="mt-1.5 text-sm text-slate-600 break-words">
                      {selectedStudent.profile.bio}
                    </p>
                  )}
                  {selectedStudent.profile.skills && (
                    <div className="mt-2 text-xs text-slate-500 break-words">
                      Skills: <span className="text-slate-800">{selectedStudent.profile.skills}</span>
                    </div>
                  )}
                  {canStaffEdit && selectedStudent.profile.phone && (
                    <div className="mt-1 text-xs text-slate-500">
                      Phone: <span className="font-mono text-slate-800">{selectedStudent.profile.phone}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 w-full sm:w-auto">
                  <div className="text-left sm:text-right">
                    <div className="text-xs text-slate-500">Current CGPA</div>
                    <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {selectedStudent.profile.cgpa.toFixed(2)}
                    </div>
                  </div>

                  {canStaffEdit && (
                    <button
                      type="button"
                      onClick={() => openEditModal(selectedStudent.profile)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit Student Details</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Coding Profiles Summary */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-800">
                  Synced Coding Platform Progress
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
                  <div className="rounded-lg border border-slate-200 p-4 flex flex-col justify-between gap-2 h-full min-w-0">
                    <div>
                      <div className="text-xs text-slate-500">LeetCode Solved</div>
                      <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
                        {selectedStudent.profile.codingStats.leetcodeSolved}
                      </div>
                      <div className="mt-1 text-xs font-mono tabular-nums text-slate-500">
                        E:{selectedStudent.profile.codingStats.leetcodeEasy} · M:
                        {selectedStudent.profile.codingStats.leetcodeMedium} · H:
                        {selectedStudent.profile.codingStats.leetcodeHard}
                      </div>
                      {(selectedStudent.profile.codingStats.leetcodeUrl ||
                        selectedStudent.profile.codingStats.leetcodeSolved > 0) && (
                        <div
                          className={`mt-1 text-[11px] font-medium ${
                            selectedStudent.profile.codingStats.leetcodeVerified &&
                            selectedStudent.profile.codingStats.leetcodeOwnerVerified
                              ? 'text-emerald-700'
                              : selectedStudent.profile.codingStats.leetcodeVerified
                              ? 'text-slate-600'
                              : 'text-amber-700'
                          }`}
                        >
                          {selectedStudent.profile.codingStats.leetcodeVerified &&
                          selectedStudent.profile.codingStats.leetcodeOwnerVerified
                            ? 'Verified Stats & Owner'
                            : selectedStudent.profile.codingStats.leetcodeVerified
                            ? 'Public Stats Synced · Ownership Unverified'
                            : 'Unverified Stats'}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {selectedStudent.profile.codingStats.leetcodeUrl &&
                        safeExternalHref(selectedStudent.profile.codingStats.leetcodeUrl) && (
                          <a
                            href={safeExternalHref(selectedStudent.profile.codingStats.leetcodeUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                          >
                            <span>LeetCode Profile</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      {canVerifyCodingOwner && selectedStudent.profile.codingStats.leetcodeUsername && (
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleOwnerVerification(
                              'leetcode',
                              !selectedStudent.profile.codingStats.leetcodeOwnerVerified
                            )
                          }
                          disabled={ownerBusyPlatform === 'leetcode'}
                          className={`w-full inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                            selectedStudent.profile.codingStats.leetcodeOwnerVerified
                              ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          <span>
                            {ownerBusyPlatform === 'leetcode'
                              ? 'Updating...'
                              : selectedStudent.profile.codingStats.leetcodeOwnerVerified
                              ? 'Revoke Owner'
                              : 'Verify Owner'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4 flex flex-col justify-between gap-2 h-full min-w-0">
                    <div>
                      <div className="text-xs text-slate-500">HackerRank 5★ Badges</div>
                      <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
                        {selectedStudent.profile.codingStats.hackerrankFiveStars}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">5-Star Domain Badges</div>
                      {(selectedStudent.profile.codingStats.hackerrankUrl ||
                        selectedStudent.profile.codingStats.hackerrankFiveStars > 0) && (
                        <div
                          className={`mt-1 text-[11px] font-medium ${
                            selectedStudent.profile.codingStats.hackerrankVerified &&
                            selectedStudent.profile.codingStats.hackerrankOwnerVerified
                              ? 'text-emerald-700'
                              : selectedStudent.profile.codingStats.hackerrankVerified
                              ? 'text-slate-600'
                              : 'text-amber-700'
                          }`}
                        >
                          {selectedStudent.profile.codingStats.hackerrankVerified &&
                          selectedStudent.profile.codingStats.hackerrankOwnerVerified
                            ? 'Verified Stats & Owner'
                            : selectedStudent.profile.codingStats.hackerrankVerified
                            ? 'Public Stats Synced · Ownership Unverified'
                            : 'Unverified Stats'}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {selectedStudent.profile.codingStats.hackerrankUrl &&
                        safeExternalHref(selectedStudent.profile.codingStats.hackerrankUrl) && (
                          <a
                            href={safeExternalHref(selectedStudent.profile.codingStats.hackerrankUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                          >
                            <span>HackerRank Profile</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      {canVerifyCodingOwner && selectedStudent.profile.codingStats.hackerrankUsername && (
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleOwnerVerification(
                              'hackerrank',
                              !selectedStudent.profile.codingStats.hackerrankOwnerVerified
                            )
                          }
                          disabled={ownerBusyPlatform === 'hackerrank'}
                          className={`w-full inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                            selectedStudent.profile.codingStats.hackerrankOwnerVerified
                              ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          <span>
                            {ownerBusyPlatform === 'hackerrank'
                              ? 'Updating...'
                              : selectedStudent.profile.codingStats.hackerrankOwnerVerified
                              ? 'Revoke Owner'
                              : 'Verify Owner'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4 flex flex-col justify-between gap-2 h-full min-w-0">
                    <div>
                      <div className="text-xs text-slate-500">GitHub Projects</div>
                      <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
                        {selectedStudent.profile.codingStats.githubProjects}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Public Repositories</div>
                      {(selectedStudent.profile.codingStats.githubUrl ||
                        selectedStudent.profile.codingStats.githubProjects > 0) && (
                        <div
                          className={`mt-1 text-[11px] font-medium ${
                            selectedStudent.profile.codingStats.githubVerified &&
                            selectedStudent.profile.codingStats.githubOwnerVerified
                              ? 'text-emerald-700'
                              : selectedStudent.profile.codingStats.githubVerified
                              ? 'text-slate-600'
                              : 'text-amber-700'
                          }`}
                        >
                          {selectedStudent.profile.codingStats.githubVerified &&
                          selectedStudent.profile.codingStats.githubOwnerVerified
                            ? 'Verified Stats & Owner'
                            : selectedStudent.profile.codingStats.githubVerified
                            ? 'Public Stats Synced · Ownership Unverified'
                            : 'Unverified Stats'}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {selectedStudent.profile.codingStats.githubUrl &&
                        safeExternalHref(selectedStudent.profile.codingStats.githubUrl) && (
                          <a
                            href={safeExternalHref(selectedStudent.profile.codingStats.githubUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                          >
                            <span>GitHub Profile</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      {canVerifyCodingOwner && selectedStudent.profile.codingStats.githubUsername && (
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleOwnerVerification(
                              'github',
                              !selectedStudent.profile.codingStats.githubOwnerVerified
                            )
                          }
                          disabled={ownerBusyPlatform === 'github'}
                          className={`w-full inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                            selectedStudent.profile.codingStats.githubOwnerVerified
                              ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          <span>
                            {ownerBusyPlatform === 'github'
                              ? 'Updating...'
                              : selectedStudent.profile.codingStats.githubOwnerVerified
                              ? 'Revoke Owner'
                              : 'Verify Owner'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Portal Activity */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-semibold text-slate-800">
                  CSE Portal Contributions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-slate-500">Projects Published</div>
                    <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                      {selectedStudent.progress.projectsPublished}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-slate-500">Apps Uploaded</div>
                    <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                      {selectedStudent.progress.appsUploaded}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-slate-500">Problems Solved</div>
                    <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                      {selectedStudent.progress.problemsSolved}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-slate-500">Hackathons Shared</div>
                    <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                      {selectedStudent.progress.hackathonsShared}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Staff Edit Student Modal (Faculty & Admin) */}
      {editModalOpen && selectedStudent && canStaffEdit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-student-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 id="edit-student-modal-title" className="text-base font-bold text-slate-900">
                Edit Student Profile — {selectedStudent.profile.memberId}
              </h2>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {editError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {!DEPARTMENTS.includes(editForm.department) && editForm.department && (
                      <option value={editForm.department}>{editForm.department}</option>
                    )}
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Year
                  </label>
                  <select
                    value={editForm.year}
                    onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {!YEARS.includes(editForm.year) && editForm.year && (
                      <option value={editForm.year}>{editForm.year}</option>
                    )}
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Section
                  </label>
                  <select
                    value={editForm.section}
                    onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {!SECTIONS.includes(editForm.section) && editForm.section && (
                      <option value={editForm.section}>Section {editForm.section}</option>
                    )}
                    {SECTIONS.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CGPA
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={editForm.cgpa}
                    onChange={(e) => setEditForm({ ...editForm, cgpa: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Technical Skills
                </label>
                <input
                  type="text"
                  value={editForm.skills}
                  onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                  placeholder="e.g. C++, Java, TypeScript, React, SQL"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Personal Bio
                </label>
                <textarea
                  rows={3}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Student personal bio, academic focus, or achievements..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white py-2 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-lg bg-blue-600 py-2 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save Student Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

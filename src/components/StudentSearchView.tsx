import React, { useEffect, useState } from 'react';
import { Search, ExternalLink } from 'lucide-react';
import { apiRequest } from '../api';
import type { StudentDirectoryDetail } from '../types';

interface StudentSearchViewProps {
  initialQuery?: string;
}

export const StudentSearchView: React.FC<StudentSearchViewProps> = ({
  initialQuery = '',
}) => {
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [results, setResults] = useState<StudentDirectoryDetail[]>([]);
  const [selectedStudent, setSelectedStudent] =
    useState<StudentDirectoryDetail | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Search Student by ID
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Look up any CSE student by Roll Number / Student ID (for example <span className="font-mono text-slate-800">22CSE104</span>, <span className="font-mono text-slate-800">22CSE118</span>, or newly registered IDs) to inspect their academic profile, coding stats, and portal contributions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Enter Student ID (e.g. 22CSE104) or Student Name..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 py-2.5 px-5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          Search ID
        </button>
      </form>

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
          <div className="lg:col-span-4 space-y-2">
            {results.map((entry) => {
              const isSelected = selectedStudent?.profile.id === entry.profile.id;
              return (
                <button
                  key={entry.profile.id}
                  type="button"
                  onClick={() => setSelectedStudent(entry)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
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
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {entry.profile.name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {entry.profile.batchOrDesignation}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Student Detailed Profile */}
          {selectedStudent && (
            <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500">
                    <span className="font-mono font-semibold text-blue-700">
                      {selectedStudent.profile.memberId}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span>{selectedStudent.profile.batchOrDesignation}</span>
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {selectedStudent.profile.name}
                  </h2>
                  {selectedStudent.profile.bio && (
                    <p className="mt-1.5 text-sm text-slate-600">
                      {selectedStudent.profile.bio}
                    </p>
                  )}
                  {selectedStudent.profile.skills && (
                    <div className="mt-2 text-xs text-slate-500">
                      Skills: <span className="text-slate-800">{selectedStudent.profile.skills}</span>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Current CGPA</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {selectedStudent.profile.cgpa.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Coding Profiles Summary */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-800">
                  Synced Coding Platform Progress
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs text-slate-500">LeetCode Solved</div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {selectedStudent.profile.codingStats.leetcodeSolved}
                    </div>
                    <div className="mt-1 text-xs font-mono tabular-nums text-slate-500">
                      E:{selectedStudent.profile.codingStats.leetcodeEasy} · M:
                      {selectedStudent.profile.codingStats.leetcodeMedium} · H:
                      {selectedStudent.profile.codingStats.leetcodeHard}
                    </div>
                    {selectedStudent.profile.codingStats.leetcodeUrl && (
                      <a
                        href={selectedStudent.profile.codingStats.leetcodeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                      >
                        <span>LeetCode Profile</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs text-slate-500">HackerRank 5★ Badges</div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {selectedStudent.profile.codingStats.hackerrankFiveStars}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">5-Star Domain Badges</div>
                    {selectedStudent.profile.codingStats.hackerrankUrl && (
                      <a
                        href={selectedStudent.profile.codingStats.hackerrankUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                      >
                        <span>HackerRank Profile</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs text-slate-500">GitHub Projects</div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {selectedStudent.profile.codingStats.githubProjects}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Public Repositories</div>
                    {selectedStudent.profile.codingStats.githubUrl && (
                      <a
                        href={selectedStudent.profile.codingStats.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                      >
                        <span>GitHub Profile</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
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
    </div>
  );
};

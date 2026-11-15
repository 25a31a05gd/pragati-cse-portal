import React, { useEffect, useState } from 'react';
import { RefreshCw, ExternalLink, Bell, CheckCheck } from 'lucide-react';
import { apiRequest } from '../api';
import type {
  NavSection,
  PortalNotification,
  PortalProgress,
  PublicUserProfile,
} from '../types';

interface MyProfileViewProps {
  profile: PublicUserProfile;
  progress: PortalProgress;
  notifications: PortalNotification[];
  onProfileSaved: (nextProfile: PublicUserProfile, nextProgress: PortalProgress) => void;
  onMarkNotificationsRead: (notificationId?: string) => void;
  onNavigate: (section: NavSection) => void;
  onOpenReminders?: () => void;
}

export const MyProfileView: React.FC<MyProfileViewProps> = ({
  profile,
  progress,
  notifications,
  onProfileSaved,
  onMarkNotificationsRead,
  onNavigate,
  onOpenReminders,
}) => {
  const [name, setName] = useState(profile.name);
  const [batchOrDesignation, setBatchOrDesignation] = useState(
    profile.batchOrDesignation
  );
  const [cgpa, setCgpa] = useState(profile.cgpa ? String(profile.cgpa) : '');
  const [skills, setSkills] = useState(profile.skills);
  const [bio, setBio] = useState(profile.bio);

  const [leetcodeUrl, setLeetcodeUrl] = useState(profile.codingStats.leetcodeUrl);
  const [hackerrankUrl, setHackerrankUrl] = useState(
    profile.codingStats.hackerrankUrl
  );
  const [githubUrl, setGithubUrl] = useState(profile.codingStats.githubUrl);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    setName(profile.name);
    setBatchOrDesignation(profile.batchOrDesignation);
    setCgpa(profile.cgpa ? String(profile.cgpa) : '');
    setSkills(profile.skills);
    setBio(profile.bio);
    setLeetcodeUrl(profile.codingStats.leetcodeUrl);
    setHackerrankUrl(profile.codingStats.hackerrankUrl);
    setGithubUrl(profile.codingStats.githubUrl);
  }, [profile]);

  const handleSaveAndSync = async (e: React.FormEvent, forceSync = true) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiRequest<{
        profile: PublicUserProfile;
        progress: PortalProgress;
      }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          batchOrDesignation,
          cgpa: profile.role === 'student' ? parseFloat(cgpa) || 0 : 0,
          skills,
          bio,
          leetcodeUrl,
          hackerrankUrl,
          githubUrl,
          syncCodingLinks: forceSync,
        }),
      });
      onProfileSaved(res.profile, res.progress);
      setFeedback({
        type: 'success',
        message:
          'Your individual profile and coding platform metrics (LeetCode, HackerRank 5★, GitHub) have been updated.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to update profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  const unreadCount = notifications.filter(
    (n) => !n.readByUserIds.includes(profile.id)
  ).length;

  const totalPortalActions =
    progress.appsUploaded +
    progress.problemsSolved +
    progress.projectsPublished +
    progress.hackathonsShared +
    (progress.interviewsShared || 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="capitalize font-semibold text-blue-700">{profile.role} Account</span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono font-semibold text-slate-800">{profile.memberId}</span>
            <span aria-hidden="true"> · </span>
            <span>{profile.email}</span>
            {profile.role === 'faculty' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-[11px] font-semibold border border-blue-200">
                ✓ Verified Faculty Member · All Features Unlocked
              </span>
            )}
            {profile.role === 'admin' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 px-2.5 py-0.5 text-[11px] font-semibold border border-purple-200">
                ✓ Verified Administrator · Portal Changes Authorized
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            My Profile — {profile.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Personal academic record, synced coding platform statistics, portal contribution progress, and reminders.
          </p>
        </div>
      </div>

      {/* Section 1: Portal Contribution Progress & Coding Stats Overview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            My Progress & Synced Coding Benchmarks
          </h2>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            Total Portal Contributions: {totalPortalActions}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* LeetCode Problems */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1.5">
            <div className="text-xs font-medium text-slate-500">
              LeetCode Problems Done
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {profile.codingStats.leetcodeSolved}
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-500">
              Easy {profile.codingStats.leetcodeEasy} · Med {profile.codingStats.leetcodeMedium} · Hard{' '}
              {profile.codingStats.leetcodeHard}
            </div>
            {profile.codingStats.leetcodeUrl && (
              <a
                href={
                  /^https?:\/\//i.test(profile.codingStats.leetcodeUrl)
                    ? profile.codingStats.leetcodeUrl
                    : `https://${profile.codingStats.leetcodeUrl}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-blue-700 hover:underline"
              >
                <span>@{profile.codingStats.leetcodeUsername || 'leetcode'}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* HackerRank 5-Stars */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1.5">
            <div className="text-xs font-medium text-slate-500">
              HackerRank 5-Star Badges
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {profile.codingStats.hackerrankFiveStars}
            </div>
            <div className="text-xs text-slate-500">
              Verified 5★ skill badges earned
            </div>
            {profile.codingStats.hackerrankUrl && (
              <a
                href={
                  /^https?:\/\//i.test(profile.codingStats.hackerrankUrl)
                    ? profile.codingStats.hackerrankUrl
                    : `https://${profile.codingStats.hackerrankUrl}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-blue-700 hover:underline"
              >
                <span>@{profile.codingStats.hackerrankUsername || 'hackerrank'}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* GitHub Projects */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1.5">
            <div className="text-xs font-medium text-slate-500">
              GitHub Projects Done
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {profile.codingStats.githubProjects}
            </div>
            <div className="text-xs text-slate-500">
              Public repositories & builds
            </div>
            {profile.codingStats.githubUrl && (
              <a
                href={
                  /^https?:\/\//i.test(profile.codingStats.githubUrl)
                    ? profile.codingStats.githubUrl
                    : `https://${profile.codingStats.githubUrl}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-blue-700 hover:underline"
              >
                <span>@{profile.codingStats.githubUsername || 'github'}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Portal Activity Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
            <div className="text-xs font-medium text-slate-500">
              Portal Activity Progress
            </div>
            <div className="space-y-1 text-xs font-mono tabular-nums text-slate-700">
              <div className="flex justify-between">
                <span className="font-sans text-slate-600">Apps Uploaded</span>
                <span className="font-semibold text-slate-900">{progress.appsUploaded}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-600">Problems Solved</span>
                <span className="font-semibold text-slate-900">{progress.problemsSolved}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-600">Projects Published</span>
                <span className="font-semibold text-slate-900">{progress.projectsPublished}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-600">Hackathons Shared</span>
                <span className="font-semibold text-slate-900">{progress.hackathonsShared}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-600">Interviews Shared</span>
                <span className="font-semibold text-slate-900">{progress.interviewsShared || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Upload Coding Links & Update Individual Profile */}
      <form
        onSubmit={(e) => handleSaveAndSync(e, true)}
        className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold text-slate-900">
            Update My Profile & Upload Coding Platform Links
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter your LeetCode, HackerRank, and GitHub profile URLs below to automatically sync problems solved, 5-star badges, and project counts.
          </p>
        </div>

        {feedback && (
          <div
            className={`rounded-lg border px-4 py-2.5 text-xs ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              LeetCode Profile Link
            </label>
            <input
              type="text"
              value={leetcodeUrl}
              onChange={(e) => setLeetcodeUrl(e.target.value)}
              placeholder="https://leetcode.com/u/your_username"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              HackerRank Profile Link
            </label>
            <input
              type="text"
              value={hackerrankUrl}
              onChange={(e) => setHackerrankUrl(e.target.value)}
              placeholder="https://www.hackerrank.com/profile/your_username"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              GitHub Profile Link
            </label>
            <input
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/your_username"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {profile.role === 'student' ? 'Year & Section' : 'Designation'}
            </label>
            <input
              type="text"
              value={batchOrDesignation}
              onChange={(e) => setBatchOrDesignation(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {profile.role === 'student' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Current CGPA (Out of 10.0)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={cgpa}
                onChange={(e) => setCgpa(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Core Technical Skills
            </label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="e.g. C++, Java, TypeScript, React, SQL, Operating Systems"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Short Academic Bio
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Areas of interest, research labs, or capstone focus..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 py-2.5 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${saving ? 'animate-spin' : ''}`} />
            <span>{saving ? 'Syncing & Saving...' : 'Save Profile & Sync Coding Links'}</span>
          </button>
        </div>
      </form>

      {/* Section 3: Reminders & Notifications (New Problem Statements, Messages, Drives) */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Reminders & Problem Statement Notifications
            </h2>
            {unreadCount > 0 && (
              <span className="text-xs font-mono tabular-nums font-semibold text-blue-700">
                ({unreadCount} unread)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenReminders && (
              <button
                type="button"
                onClick={onOpenReminders}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 py-1.5 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Open Reminders & Tasks Center</span>
              </button>
            )}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => onMarkNotificationsRead()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark All Read</span>
              </button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <p className="text-xs text-slate-500">
            No notifications yet. Whenever anyone posts a Problem Statement or messages you, reminders appear here automatically.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => {
              const isUnread = !notif.readByUserIds.includes(profile.id);
              return (
                <div
                  key={notif.id}
                  className="py-3.5 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-0.5 max-w-2xl">
                    <div className="text-xs text-slate-500">
                      <span
                        className={
                          isUnread
                            ? 'font-semibold text-blue-700'
                            : 'font-normal text-slate-500'
                        }
                      >
                        {isUnread ? 'Unread Reminder' : 'Read'}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>From {notif.actorName}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {notif.title}
                    </div>
                    <p className="text-xs text-slate-600">{notif.message}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onMarkNotificationsRead(notif.id);
                      onNavigate(notif.targetSection);
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs font-semibold text-slate-800 hover:border-blue-400 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    Open Section →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  Bell,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  ExternalLink,
  Calendar,
  Check,
} from 'lucide-react';
import { apiRequest } from '../api';
import type {
  NavSection,
  PortalNotification,
  PortalReminderItem,
  PublicUserProfile,
} from '../types';

interface RemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: PublicUserProfile | null;
  notifications: PortalNotification[];
  personalReminders: PortalReminderItem[];
  onNotificationsChange: (next: PortalNotification[]) => void;
  onPersonalRemindersChange: (next: PortalReminderItem[]) => void;
  onNavigateSection: (section: NavSection) => void;
  onRequireAuth: () => void;
}

export const RemindersModal: React.FC<RemindersModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  notifications,
  personalReminders,
  onNotificationsChange,
  onPersonalRemindersChange,
  onNavigateSection,
  onRequireAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'department' | 'personal'>('department');

  // New personal reminder form state
  const [isAddingPersonal, setIsAddingPersonal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newCategory, setNewCategory] = useState<
    'problem_statement' | 'placement' | 'hackathon' | 'interview' | 'exam_lab' | 'general'
  >('general');
  const [newPriority, setNewPriority] = useState<'High' | 'Normal' | 'Low'>('Normal');
  const [submittingReminder, setSubmittingReminder] = useState(false);
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  const unreadNotifications = currentUser
    ? notifications.filter((n) => !n.readByUserIds.includes(currentUser.id))
    : notifications;

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    try {
      await apiRequest('/api/notifications/read', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      onNotificationsChange(
        notifications.map((n) => {
          if (!n.readByUserIds.includes(currentUser.id)) {
            return { ...n, readByUserIds: [...n.readByUserIds, currentUser.id] };
          }
          return n;
        })
      );
    } catch {
      // ignore
    }
  };

  const handleOpenNotification = async (notif: PortalNotification) => {
    if (currentUser && !notif.readByUserIds.includes(currentUser.id)) {
      try {
        await apiRequest('/api/notifications/read', {
          method: 'POST',
          body: JSON.stringify({ notificationId: notif.id }),
        });
        onNotificationsChange(
          notifications.map((n) =>
            n.id === notif.id ? { ...n, readByUserIds: [...n.readByUserIds, currentUser.id] } : n
          )
        );
      } catch {
        // ignore
      }
    }
    onClose();
    onNavigateSection(notif.targetSection);
  };

  const handleCreatePersonalReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setFormError('');
    setSubmittingReminder(true);
    try {
      const created = await apiRequest<PortalReminderItem>('/api/reminders', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          note: newNote,
          dueDate: newDueDate,
          category: newCategory,
          priority: newPriority,
        }),
      });
      onPersonalRemindersChange([created, ...personalReminders]);
      setNewTitle('');
      setNewNote('');
      setNewDueDate('');
      setNewCategory('general');
      setNewPriority('Normal');
      setIsAddingPersonal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create reminder.');
    } finally {
      setSubmittingReminder(false);
    }
  };

  const handleToggleReminder = async (id: string) => {
    if (!currentUser) return;
    try {
      const updated = await apiRequest<PortalReminderItem>(`/api/reminders/${id}/toggle`, {
        method: 'PATCH',
      });
      onPersonalRemindersChange(
        personalReminders.map((r) => (r.id === id ? updated : r))
      );
    } catch {
      // ignore
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!currentUser) return;
    try {
      await apiRequest(`/api/reminders/${id}`, { method: 'DELETE' });
      onPersonalRemindersChange(personalReminders.filter((r) => r.id !== id));
    } catch {
      // ignore
    }
  };

  const pendingPersonalCount = personalReminders.filter((r) => !r.completed).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminders-modal-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3 border-b border-slate-200 px-4 sm:px-5 py-3.5 sm:py-4 bg-slate-50/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center h-8 w-8 shrink-0 rounded-lg bg-blue-100 text-blue-700">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 id="reminders-modal-title" className="text-sm sm:text-base font-bold text-slate-900">
                Department Reminders & Alerts
              </h2>
              <p className="text-xs text-slate-500 leading-snug">
                Live notifications for problem statements, placement drives, and personal study tasks
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 px-4 sm:px-5 pt-2.5 bg-white gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('department')}
            className={`pb-2.5 px-3 min-h-[40px] text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'department'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Department Alerts</span>
            {unreadNotifications.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.2 text-[10px] font-bold text-blue-800 font-mono">
                {unreadNotifications.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`pb-2.5 px-3 min-h-[40px] text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'personal'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>My Personal Reminders</span>
            {pendingPersonalCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.2 text-[10px] font-bold text-amber-800 font-mono">
                {pendingPersonalCount}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 pb-safe overflow-y-auto flex-1 space-y-4">
          {activeTab === 'department' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>
                  Showing {notifications.length} announcement(s) & problem statement alerts
                </span>
                {currentUser && unreadNotifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Mark All as Read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                  <Bell className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-700">No active alerts</p>
                  <p className="text-xs text-slate-500">
                    Whenever anyone posts a Problem Statement, Placement Drive, or Interview, you'll receive a reminder here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notifications.map((notif) => {
                    const isUnread =
                      currentUser && !notif.readByUserIds.includes(currentUser.id);

                    return (
                      <div
                        key={notif.id}
                        className={`rounded-xl border p-3.5 sm:p-4 transition-all flex flex-col gap-2 ${
                          isUnread
                            ? 'border-blue-300 bg-blue-50/40'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium text-slate-500 flex flex-wrap items-center gap-1.5">
                              <span className="capitalize font-semibold text-blue-700">
                                {notif.type.replace('_', ' ')}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="break-words">By {notif.actorName}</span>
                              {isUnread && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                                  NEW
                                </span>
                              )}
                            </div>
                            <h3 className="mt-0.5 text-sm font-bold text-slate-900 break-words">
                              {notif.title}
                            </h3>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenNotification(notif)}
                            className="self-start inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 min-h-[34px] text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
                          >
                            <span>Open</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed break-words">
                          {notif.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Personal Study / Task Reminders */
            <div className="space-y-4">
              {!currentUser ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center space-y-2">
                  <p className="text-xs text-slate-600 font-medium">
                    Please sign in at the top right to track your personal tasks, assignment deadlines, and interview prep reminders.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequireAuth();
                    }}
                    className="rounded-lg bg-blue-600 py-2 px-4 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Login to Portal
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-800">
                        Tasks & Study Deadlines
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {pendingPersonalCount} pending, {personalReminders.length - pendingPersonalCount} completed
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAddingPersonal(!isAddingPersonal)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-slate-800 hover:bg-slate-100 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{isAddingPersonal ? 'Cancel' : 'New Reminder'}</span>
                    </button>
                  </div>

                  {isAddingPersonal && (
                    <form
                      onSubmit={handleCreatePersonalReminder}
                      className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3"
                    >
                      <h4 className="text-xs font-bold text-blue-900">
                        Add New Task / Study Reminder
                      </h4>

                      {formError && (
                        <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
                          {formError}
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-0.5">
                          Reminder Title
                        </label>
                        <input
                          type="text"
                          required
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="e.g. Solve 5 LeetCode DP questions or Submit OS Lab Report"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-0.5">
                            Category
                          </label>
                          <select
                            value={newCategory}
                            onChange={(e) =>
                              setNewCategory(
                                e.target.value as
                                  | 'problem_statement'
                                  | 'placement'
                                  | 'hackathon'
                                  | 'interview'
                                  | 'exam_lab'
                                  | 'general'
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                          >
                            <option value="general">General</option>
                            <option value="placement">Placement Prep</option>
                            <option value="interview">Interview Prep</option>
                            <option value="problem_statement">Problem Statement</option>
                            <option value="hackathon">Hackathon</option>
                            <option value="exam_lab">Lab / Exam</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-0.5">
                            Due Date
                          </label>
                          <input
                            type="date"
                            value={newDueDate}
                            onChange={(e) => setNewDueDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-0.5">
                            Priority
                          </label>
                          <select
                            value={newPriority}
                            onChange={(e) => setNewPriority(e.target.value as 'High' | 'Normal' | 'Low')}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                          >
                            <option value="Normal">Normal</option>
                            <option value="High">High</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-0.5">
                          Notes / Description (Optional)
                        </label>
                        <input
                          type="text"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="e.g. Focus on graph cycles and time complexity"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingPersonal(false)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingReminder}
                          className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {submittingReminder ? 'Adding...' : 'Save Reminder'}
                        </button>
                      </div>
                    </form>
                  )}

                  {personalReminders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                      <Clock className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        No personal reminders added
                      </p>
                      <p className="text-xs text-slate-500">
                        Click "+ New Reminder" above to set a deadline for placements, problem solving, or lab coursework.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {personalReminders.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-3.5 flex items-start justify-between gap-2.5 sm:gap-3 transition-colors ${
                            item.completed
                              ? 'border-slate-200 bg-slate-50/70 text-slate-400 opacity-75'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => handleToggleReminder(item.id)}
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                item.completed
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-slate-300 bg-white hover:border-blue-600'
                              }`}
                              title={item.completed ? 'Mark pending' : 'Mark completed'}
                            >
                              {item.completed && <Check className="h-3 w-3 stroke-[3]" />}
                            </button>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-xs font-semibold break-words ${
                                    item.completed ? 'line-through text-slate-400' : 'text-slate-900'
                                  }`}
                                >
                                  {item.title}
                                </span>

                                <span
                                  className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase shrink-0 ${
                                    item.priority === 'High'
                                      ? 'bg-red-100 text-red-700'
                                      : item.priority === 'Low'
                                        ? 'bg-slate-100 text-slate-600'
                                        : 'bg-blue-50 text-blue-700'
                                  }`}
                                >
                                  {item.priority}
                                </span>
                              </div>

                              {item.note && (
                                <p className="text-[11px] text-slate-500 leading-normal break-words">
                                  {item.note}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                                <span className="capitalize">{item.category.replace('_', ' ')}</span>
                                {item.dueDate && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono text-slate-600">
                                      Due: {item.dueDate}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteReminder(item.id)}
                            className="rounded-lg p-1.5 min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                            title="Delete reminder"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

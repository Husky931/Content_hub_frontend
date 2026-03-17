"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { ButtonSpinner } from "@/components/ui/Spinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getSocket, onSocketReady, WS_EVENTS } from "@/lib/realtime";
import { FilePreviewList, type UploadedFile } from "@/components/ui/FileUpload";

interface ChecklistItem {
  label: string;
}

interface TaskWithAttempts {
  id: string;
  title: string;
  titleCn?: string | null;
  channelName: string;
  channelSlug: string;
  createdById: string;
  reviewClaimedById: string | null;
  reviewClaimedBy: string | null;
  checklist?: ChecklistItem[] | null;
  attachments?: { name: string; url: string; type: string; size: number }[] | null;
  status: string;
  lockedById?: string | null;
  lockExpiresAt?: string | null;
  attempts: AttemptItem[];
}

interface AttemptItem {
  id: string;
  taskId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  deliverables: any;
  createdAt: string;
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full bg-discord-bg text-discord-text-muted">Loading...</div>}>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskFilter = searchParams.get("task");

  const [tasksWithAttempts, setTasksWithAttempts] = useState<TaskWithAttempts[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskWithAttempts | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<AttemptItem | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [reviewError, setReviewError] = useState("");
  // Checklist state: tracks which items pass (true = pass, false = fail)
  const [checklistState, setChecklistState] = useState<Record<number, boolean>>({});
  // Lock for revision
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  // Unlock
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  // Track whether we've auto-selected the task from the notification link
  const autoSelectedRef = useRef(false);

  const fetchReviewItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tasks?includeSubmittedAttempts=true");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();

      const allTasks = data.tasks || [];
      const submittedAttempts = data.submittedAttempts || [];

      // Group attempts by task
      const taskMap = new Map<string, TaskWithAttempts>();
      for (const task of allTasks) {
        taskMap.set(task.id, {
          id: task.id,
          title: task.title,
          titleCn: task.titleCn,
          channelName: task.channelName,
          channelSlug: task.channelSlug,
          createdById: task.createdById,
          reviewClaimedById: task.reviewClaimedById,
          reviewClaimedBy: task.reviewClaimedBy,
          checklist: task.checklist || null,
          attachments: task.attachments || null,
          status: task.status,
          lockedById: task.lockedById || null,
          lockExpiresAt: task.lockExpiresAt || null,
          attempts: [],
        });
      }

      for (const attempt of submittedAttempts) {
        const task = taskMap.get(attempt.taskId);
        if (!task) continue;
        task.attempts.push({
          id: attempt.id,
          taskId: attempt.taskId,
          userId: attempt.userId,
          username: attempt.username,
          displayName: attempt.displayName,
          avatarUrl: attempt.avatarUrl,
          status: attempt.status,
          deliverables: attempt.deliverables,
          createdAt: attempt.createdAt,
        });
      }

      // Show tasks with submitted attempts OR locked tasks (so mods can unlock them)
      const result = Array.from(taskMap.values()).filter((t) => t.attempts.length > 0 || t.status === "locked");
      // If coming from a notification, pin that task to the top
      if (taskFilter) {
        result.sort((a, b) => (a.id === taskFilter ? -1 : b.id === taskFilter ? 1 : 0));
      }
      setTasksWithAttempts(result);
    } catch (err) {
      console.error("Failed to fetch review items:", err);
      setTasksWithAttempts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!["admin", "supermod", "mod"].includes(user?.role ?? "")) {
      router.push("/channels");
      return;
    }
    fetchReviewItems();
  }, [user, fetchReviewItems]);

  // Real-time: auto-refresh review queue when new submissions arrive
  useEffect(() => {
    const handleUpdate = () => fetchReviewItems();
    const unsub = onSocketReady((socket) => {
      socket.on(WS_EVENTS.NOTIFICATION_NEW, handleUpdate);
    });
    return () => {
      unsub();
      getSocket()?.off(WS_EVENTS.NOTIFICATION_NEW, handleUpdate);
    };
  }, [fetchReviewItems]);

  const claimTask = async (task: TaskWithAttempts) => {
    setClaiming(true);
    setReviewError("");
    try {
      const res = await fetch(`/api/tasks/${task.id}/claim-review`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setReviewError(data.error || "Failed to claim task for review");
        return false;
      }
      return true;
    } catch {
      setReviewError("Network error while claiming");
      return false;
    } finally {
      setClaiming(false);
    }
  };

  const releaseTask = async (task: TaskWithAttempts) => {
    try {
      await fetch(`/api/tasks/${task.id}/claim-review`, {
        method: "DELETE",
      });
    } catch {
      // Silent fail on release
    }
  };

  const handleSelectTask = async (task: TaskWithAttempts) => {
    // Release previous task claim if switching
    if (selectedTask && selectedTask.id !== task.id && selectedTask.reviewClaimedById === user?.id) {
      await releaseTask(selectedTask);
    }

    setReviewNote("");
    setRejectionReason("");
    setReviewError("");
    setSelectedAttempt(null);
    // Initialize checklist: all items checked (pass) by default
    if (task.checklist && task.checklist.length > 0) {
      const initial: Record<number, boolean> = {};
      task.checklist.forEach((_, i) => { initial[i] = true; });
      setChecklistState(initial);
    } else {
      setChecklistState({});
    }

    // Locked tasks with no attempts — just show the locked info (no claim needed)
    if (task.status === "locked" && task.attempts.length === 0) {
      setSelectedTask(task);
      return;
    }

    const claimedByOther = task.reviewClaimedById && task.reviewClaimedById !== user?.id;

    // If already claimed by someone else, just view it
    if (claimedByOther) {
      setSelectedTask(task);
      return;
    }

    // If already claimed by us, just select
    if (task.reviewClaimedById === user?.id) {
      setSelectedTask(task);
      if (task.attempts.length > 0) setSelectedAttempt(task.attempts[0]);
      return;
    }

    // Attempt to claim
    const claimed = await claimTask(task);
    if (claimed) {
      const updatedTask = {
        ...task,
        reviewClaimedById: user?.id ?? null,
        reviewClaimedBy: user?.displayName || user?.username || null,
      };
      setSelectedTask(updatedTask);
      setTasksWithAttempts((prev) =>
        prev.map((t) => (t.id === task.id ? updatedTask : t))
      );
      if (updatedTask.attempts.length > 0) setSelectedAttempt(updatedTask.attempts[0]);
    } else {
      await fetchReviewItems();
    }
  };

  // Auto-select the task from notification link (only once, on first load)
  useEffect(() => {
    if (!taskFilter || loading || autoSelectedRef.current || tasksWithAttempts.length === 0) return;
    const target = tasksWithAttempts.find((t) => t.id === taskFilter);
    if (target) {
      autoSelectedRef.current = true;
      handleSelectTask(target);
    }
  }, [taskFilter, loading, tasksWithAttempts]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeselectTask = async () => {
    if (selectedTask && selectedTask.reviewClaimedById === user?.id) {
      await releaseTask(selectedTask);
      setTasksWithAttempts((prev) =>
        prev.map((t) =>
          t.id === selectedTask.id ? { ...t, reviewClaimedById: null, reviewClaimedBy: null } : t
        )
      );
    }
    setSelectedTask(null);
    setSelectedAttempt(null);
    setReviewNote("");
    setRejectionReason("");
    setReviewError("");
  };

  const handleReview = async (status: "approved" | "rejected") => {
    if (!selectedTask || !selectedAttempt) return;
    setSubmitting(true);
    setReviewError("");

    try {
      const res = await fetch(
        `/api/tasks/${selectedTask.id}/attempts/${selectedAttempt.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            reviewNote,
            rejectionReason: status === "rejected" ? rejectionReason : undefined,
          }),
        }
      );

      if (res.ok) {
        // Remove this attempt from the list
        const remainingAttempts = selectedTask.attempts.filter(
          (a) => a.id !== selectedAttempt.id
        );

        if (remainingAttempts.length > 0 && status === "rejected") {
          // More attempts to review — select the next one
          const updatedTask = { ...selectedTask, attempts: remainingAttempts };
          setSelectedTask(updatedTask);
          setSelectedAttempt(remainingAttempts[0]);
          setTasksWithAttempts((prev) =>
            prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
          );
        } else {
          // Task approved or no more attempts — go back to queue
          setSelectedTask(null);
          setSelectedAttempt(null);
          fetchReviewItems();
        }
        setReviewNote("");
        setRejectionReason("");
        setReviewError("");
      } else {
        const data = await res.json();
        setReviewError(data.error || "Failed to submit review");
      }
    } catch {
      setReviewError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlock = async () => {
    if (!selectedTask) return;
    setUnlocking(true);
    setReviewError("");
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/unlock`, {
        method: "POST",
      });
      if (res.ok) {
        setUnlockConfirmOpen(false);
        setSelectedTask(null);
        setSelectedAttempt(null);
        fetchReviewItems();
      } else {
        const data = await res.json();
        setReviewError(data.error || "Failed to unlock task");
        setUnlockConfirmOpen(false);
      }
    } catch {
      setReviewError("Network error");
      setUnlockConfirmOpen(false);
    } finally {
      setUnlocking(false);
    }
  };

  const handleLockForRevision = async () => {
    if (!selectedTask || !selectedAttempt) return;
    setLocking(true);
    setReviewError("");
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: selectedAttempt.userId }),
      });
      if (res.ok) {
        setLockConfirmOpen(false);
        setSelectedTask(null);
        setSelectedAttempt(null);
        fetchReviewItems();
      } else {
        const data = await res.json();
        setReviewError(data.error || "Failed to lock task");
        setLockConfirmOpen(false);
      }
    } catch {
      setReviewError("Network error");
      setLockConfirmOpen(false);
    } finally {
      setLocking(false);
    }
  };

  const isClaimedByMe = selectedTask?.reviewClaimedById === user?.id;
  const claimedByOther = selectedTask?.reviewClaimedById && selectedTask.reviewClaimedById !== user?.id;
  const canReview = isClaimedByMe && selectedAttempt && selectedAttempt.userId !== user?.id;
  const hasFailedChecklist = Object.values(checklistState).some((v) => !v);
  const canApprove = canReview && !hasFailedChecklist;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-discord-bg">
      <div className="flex-1 overflow-hidden flex">
        {/* Task Queue */}
        <div className="w-96 border-r border-discord-border overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-discord-text-muted mb-3 uppercase tracking-wide">
            Tasks with Pending Reviews
          </h3>
          {loading ? (
            <p className="text-sm text-discord-text-muted">Loading...</p>
          ) : tasksWithAttempts.length === 0 ? (
            <div className="text-center text-discord-text-muted py-8">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasksWithAttempts.map((task) => {
                const isClaimed = !!task.reviewClaimedById;
                const isMyTask = task.reviewClaimedById === user?.id;
                const isOthersClaim = isClaimed && !isMyTask;

                return (
                  <button
                    key={task.id}
                    onClick={() => handleSelectTask(task)}
                    disabled={claiming}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      selectedTask?.id === task.id
                        ? "bg-discord-accent/10 border-discord-accent"
                        : isOthersClaim
                        ? "bg-amber-500/5 border-amber-500/30 opacity-70"
                        : "bg-discord-sidebar border-discord-border hover:bg-discord-bg-hover/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-discord-text truncate">
                        {task.title}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {task.status === "locked" && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-semibold">
                            LOCKED
                          </span>
                        )}
                        <span className="text-xs px-1.5 py-0.5 rounded bg-discord-accent/20 text-discord-accent">
                          {task.channelName}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-discord-text-muted">
                      {task.status === "locked" && task.attempts.length === 0
                        ? "Locked for revision"
                        : `${task.attempts.length} submission${task.attempts.length !== 1 ? "s" : ""} pending`}
                    </div>
                    {isClaimed && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="text-xs text-amber-400 font-medium">
                          {isMyTask ? "You are reviewing" : `Being reviewed by ${task.reviewClaimedBy}`}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Review Detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedTask ? (
            <div className="flex flex-col items-center justify-center h-full text-discord-text-muted">
              <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <p>Select a task to review its submissions</p>
            </div>
          ) : (
            <div className="max-w-2xl">
              {/* Back / Release button */}
              <button
                onClick={handleDeselectTask}
                className="mb-4 text-xs text-discord-text-muted hover:text-discord-text transition flex items-center gap-1 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to queue
              </button>

              {/* Task info */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-discord-text">
                    {selectedTask.title}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-discord-accent/20 text-discord-accent">
                    {selectedTask.channelName}
                  </span>
                </div>
                <p className="text-sm text-discord-text-muted">
                  {selectedTask.attempts.length} submission{selectedTask.attempts.length !== 1 ? "s" : ""} to review
                </p>
              </div>

              {/* Locked task info — no attempts to review, show unlock option */}
              {selectedTask.status === "locked" && selectedTask.attempts.length === 0 && (
                <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-sm font-semibold text-orange-300">Task is locked for exclusive revision</span>
                  </div>
                  {selectedTask.lockExpiresAt && (
                    <p className="text-xs text-orange-300/80 mb-3">
                      Lock expires: {new Date(selectedTask.lockExpiresAt).toLocaleString()}
                    </p>
                  )}
                  <p className="text-sm text-discord-text-secondary mb-4">
                    The creator has been asked to revise their submission. No new submissions can be reviewed until the lock expires or is manually released.
                  </p>

                  {reviewError && (
                    <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded">
                      <p className="text-xs text-red-400">{reviewError}</p>
                    </div>
                  )}

                  <button
                    onClick={() => setUnlockConfirmOpen(true)}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    Unlock Task
                  </button>
                </div>
              )}

              {/* Claimed by other warning */}
              {claimedByOther && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-sm text-amber-400">
                    This task is being reviewed by {selectedTask.reviewClaimedBy}. You cannot review it at this time.
                  </p>
                </div>
              )}

              {/* === LOCKED TASK: Split view — locked user's revision vs other attempts === */}
              {selectedTask.status === "locked" && isClaimedByMe && (() => {
                const lockedAttempts = selectedTask.attempts.filter((a) => a.userId === selectedTask.lockedById);
                const otherAttempts = selectedTask.attempts.filter((a) => a.userId !== selectedTask.lockedById);
                const lockedAttempt = lockedAttempts.length > 0 ? lockedAttempts[lockedAttempts.length - 1] : null;
                const isViewingLocked = selectedAttempt && selectedAttempt.userId === selectedTask.lockedById;

                return (
                  <>
                    {/* Locked user's revision section */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <h4 className="text-sm font-semibold text-orange-300">
                          Locked: {lockedAttempt?.displayName || lockedAttempt?.username || "Awaiting revision"}
                        </h4>
                      </div>

                      {lockedAttempt ? (
                        <button
                          onClick={() => {
                            setSelectedAttempt(lockedAttempt);
                            setReviewNote("");
                            setRejectionReason("");
                            setReviewError("");
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer border ${
                            isViewingLocked
                              ? "bg-orange-500/15 border-orange-500/40 text-orange-200"
                              : "bg-discord-sidebar border-discord-border text-discord-text-muted hover:text-discord-text"
                          }`}
                        >
                          {lockedAttempt.displayName || lockedAttempt.username} — revision submitted {formatTime(lockedAttempt.createdAt)}
                        </button>
                      ) : (
                        <div className="px-3 py-2 rounded-lg bg-discord-sidebar border border-discord-border">
                          <p className="text-xs text-discord-text-muted italic">No revision submitted yet</p>
                        </div>
                      )}
                    </div>

                    {/* Other attempts section (read-only) */}
                    {otherAttempts.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-discord-text-muted mb-3">
                          Other submissions
                        </h4>
                        <div className="flex gap-1 overflow-x-auto">
                          {otherAttempts.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => {
                                setSelectedAttempt(a);
                                setReviewNote("");
                                setRejectionReason("");
                                setReviewError("");
                              }}
                              className={`px-3 py-1.5 text-xs rounded font-medium transition whitespace-nowrap cursor-pointer ${
                                selectedAttempt?.id === a.id
                                  ? "bg-discord-accent text-white"
                                  : "bg-discord-sidebar text-discord-text-muted hover:text-discord-text"
                              }`}
                            >
                              {a.displayName || a.username}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Attempt detail — shown for whichever attempt is selected */}
                    {selectedAttempt && (
                      <>
                        <div className="mb-4">
                          <p className="text-sm text-discord-text-muted">
                            Submitted by{" "}
                            <span className="text-discord-text font-medium">
                              {selectedAttempt.displayName || selectedAttempt.username}
                            </span>{" "}
                            — {formatTime(selectedAttempt.createdAt)}
                            {!isViewingLocked && (
                              <span className="ml-2 text-xs text-discord-text-muted italic">(read-only — task is locked)</span>
                            )}
                          </p>
                        </div>

                        {/* Task reference attachments */}
                        {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                          <div className="mb-4 p-3 bg-discord-bg-dark rounded-lg border border-discord-border">
                            <FilePreviewList files={selectedTask.attachments} label="Task Reference Files" />
                          </div>
                        )}

                        {/* Deliverables */}
                        <div className="mb-6 p-4 bg-discord-bg-dark rounded-lg border border-discord-border">
                          <h4 className="text-xs font-semibold text-discord-text-muted mb-3 uppercase">
                            Deliverables
                          </h4>
                          {selectedAttempt.deliverables?.text && (
                            <div className="text-sm text-discord-text whitespace-pre-wrap bg-discord-sidebar p-3 rounded mb-3">
                              {selectedAttempt.deliverables.text}
                            </div>
                          )}
                          {selectedAttempt.deliverables?.files && selectedAttempt.deliverables.files.length > 0 && (
                            <FilePreviewList files={selectedAttempt.deliverables.files} label="Submitted Files" />
                          )}
                          {!selectedAttempt.deliverables?.text && (!selectedAttempt.deliverables?.files || selectedAttempt.deliverables.files.length === 0) && (
                            <p className="text-sm text-discord-text-muted italic">
                              {JSON.stringify(selectedAttempt.deliverables)}
                            </p>
                          )}
                        </div>

                        {/* Review controls — ONLY for locked user's revision */}
                        {isViewingLocked && (
                          <>
                            {/* Review Checklist */}
                            {selectedTask.checklist && selectedTask.checklist.length > 0 && (
                              <div className="mb-6 p-4 bg-discord-bg-dark rounded-lg border border-discord-border">
                                <h4 className="text-xs font-semibold text-discord-text-muted mb-1 uppercase">
                                  Review Checklist
                                </h4>
                                <p className="text-[10px] text-discord-text-muted mb-3">
                                  All items start checked. Uncheck any item that fails — unchecked items block approval.
                                </p>
                                <div className="space-y-2">
                                  {selectedTask.checklist.map((item, i) => {
                                    const checked = checklistState[i] !== false;
                                    return (
                                      <label key={i} className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(e) => {
                                            setChecklistState((prev) => ({ ...prev, [i]: e.target.checked }));
                                          }}
                                          className="rounded"
                                        />
                                        <span className={`text-sm transition ${checked ? "text-discord-text" : "text-red-400 line-through"}`}>
                                          {item.label}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                                {Object.values(checklistState).some((v) => !v) && (
                                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <p className="text-xs font-semibold text-red-400 mb-1">FAILED ITEMS:</p>
                                    <ul className="text-xs text-red-300 space-y-0.5">
                                      {selectedTask.checklist.map((item, i) =>
                                        checklistState[i] === false ? <li key={i}>• {item.label}</li> : null
                                      )}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Self-review warning */}
                            {selectedAttempt.userId === user?.id && (
                              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                <p className="text-sm text-amber-400">
                                  You submitted this attempt — you cannot review your own submission.
                                </p>
                              </div>
                            )}

                            {/* Feedback */}
                            {canReview && (
                              <>
                                <div className="mb-4">
                                  <label className="block text-sm font-medium text-discord-text-secondary mb-1">
                                    Review Note (optional)
                                  </label>
                                  <textarea
                                    value={reviewNote}
                                    onChange={(e) => setReviewNote(e.target.value)}
                                    placeholder="Provide feedback to the creator..."
                                    className="w-full p-3 bg-discord-bg-dark border border-discord-border rounded-lg text-sm text-discord-text placeholder-discord-text-muted focus:outline-none focus:border-discord-accent resize-none"
                                    rows={3}
                                  />
                                </div>

                                <div className="mb-6">
                                  <label className="block text-sm font-medium text-discord-text-secondary mb-1">
                                    Rejection Reason (required if rejecting)
                                  </label>
                                  <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Why is this submission being rejected..."
                                    className="w-full p-3 bg-discord-bg-dark border border-discord-border rounded-lg text-sm text-discord-text placeholder-discord-text-muted focus:outline-none focus:border-red-500/50 resize-none"
                                    rows={2}
                                  />
                                </div>
                              </>
                            )}

                            {/* Error message */}
                            {reviewError && (
                              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <p className="text-sm text-red-400">{reviewError}</p>
                              </div>
                            )}

                            {/* Action buttons — Approve / Reject only (no Lock button since already locked) */}
                            {canReview && (
                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleReview("approved")}
                                  disabled={submitting || !canApprove}
                                  title={hasFailedChecklist ? "Cannot approve — checklist items are unchecked" : undefined}
                                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <ButtonSpinner loading={submitting}>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </ButtonSpinner>
                                  {hasFailedChecklist ? "Approve (blocked)" : "Approve"}
                                </button>
                                <button
                                  onClick={() => handleReview("rejected")}
                                  disabled={submitting || !rejectionReason.trim()}
                                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <ButtonSpinner loading={submitting}>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </ButtonSpinner>
                                  Reject
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </>
                );
              })()}

              {/* === NORMAL (non-locked) TASK: Standard attempt selector + review === */}
              {selectedTask.status !== "locked" && (
                <>
                  {/* Attempt selector tabs */}
                  {isClaimedByMe && selectedTask.attempts.length > 1 && (
                    <div className="flex gap-1 mb-4 overflow-x-auto">
                      {selectedTask.attempts.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            setSelectedAttempt(a);
                            setReviewNote("");
                            setRejectionReason("");
                            setReviewError("");
                          }}
                          className={`px-3 py-1.5 text-xs rounded font-medium transition whitespace-nowrap cursor-pointer ${
                            selectedAttempt?.id === a.id
                              ? "bg-discord-accent text-white"
                              : "bg-discord-sidebar text-discord-text-muted hover:text-discord-text"
                          }`}
                        >
                          {a.displayName || a.username}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected attempt detail */}
                  {selectedAttempt && isClaimedByMe && (
                    <>
                      <div className="mb-4">
                        <p className="text-sm text-discord-text-muted">
                          Submitted by{" "}
                          <span className="text-discord-text font-medium">
                            {selectedAttempt.displayName || selectedAttempt.username}
                          </span>{" "}
                          — {formatTime(selectedAttempt.createdAt)}
                        </p>
                      </div>

                      {/* Task reference attachments */}
                      {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                        <div className="mb-4 p-3 bg-discord-bg-dark rounded-lg border border-discord-border">
                          <FilePreviewList files={selectedTask.attachments} label="Task Reference Files" />
                        </div>
                      )}

                      {/* Deliverables */}
                      <div className="mb-6 p-4 bg-discord-bg-dark rounded-lg border border-discord-border">
                        <h4 className="text-xs font-semibold text-discord-text-muted mb-3 uppercase">
                          Deliverables
                        </h4>
                        {selectedAttempt.deliverables?.text && (
                          <div className="text-sm text-discord-text whitespace-pre-wrap bg-discord-sidebar p-3 rounded mb-3">
                            {selectedAttempt.deliverables.text}
                          </div>
                        )}
                        {selectedAttempt.deliverables?.files && selectedAttempt.deliverables.files.length > 0 && (
                          <FilePreviewList files={selectedAttempt.deliverables.files} label="Submitted Files" />
                        )}
                        {!selectedAttempt.deliverables?.text && (!selectedAttempt.deliverables?.files || selectedAttempt.deliverables.files.length === 0) && (
                          <p className="text-sm text-discord-text-muted italic">
                            {JSON.stringify(selectedAttempt.deliverables)}
                          </p>
                        )}
                      </div>

                      {/* Review Checklist */}
                      {selectedTask.checklist && selectedTask.checklist.length > 0 && isClaimedByMe && (
                        <div className="mb-6 p-4 bg-discord-bg-dark rounded-lg border border-discord-border">
                          <h4 className="text-xs font-semibold text-discord-text-muted mb-1 uppercase">
                            Review Checklist
                          </h4>
                          <p className="text-[10px] text-discord-text-muted mb-3">
                            All items start checked. Uncheck any item that fails — unchecked items block approval.
                          </p>
                          <div className="space-y-2">
                            {selectedTask.checklist.map((item, i) => {
                              const checked = checklistState[i] !== false;
                              return (
                                <label key={i} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setChecklistState((prev) => ({ ...prev, [i]: e.target.checked }));
                                    }}
                                    className="rounded"
                                  />
                                  <span className={`text-sm transition ${checked ? "text-discord-text" : "text-red-400 line-through"}`}>
                                    {item.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          {Object.values(checklistState).some((v) => !v) && (
                            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                              <p className="text-xs font-semibold text-red-400 mb-1">FAILED ITEMS:</p>
                              <ul className="text-xs text-red-300 space-y-0.5">
                                {selectedTask.checklist.map((item, i) =>
                                  checklistState[i] === false ? <li key={i}>• {item.label}</li> : null
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Self-review warning */}
                      {selectedAttempt.userId === user?.id && (
                        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                          <p className="text-sm text-amber-400">
                            You submitted this attempt — you cannot review your own submission.
                          </p>
                        </div>
                      )}

                      {/* Feedback — only show if can review */}
                      {canReview && (
                        <>
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-discord-text-secondary mb-1">
                              Review Note (optional)
                            </label>
                            <textarea
                              value={reviewNote}
                              onChange={(e) => setReviewNote(e.target.value)}
                              placeholder="Provide feedback to the creator..."
                              className="w-full p-3 bg-discord-bg-dark border border-discord-border rounded-lg text-sm text-discord-text placeholder-discord-text-muted focus:outline-none focus:border-discord-accent resize-none"
                              rows={3}
                            />
                          </div>

                          <div className="mb-6">
                            <label className="block text-sm font-medium text-discord-text-secondary mb-1">
                              Rejection Reason (required if rejecting)
                            </label>
                            <textarea
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="Why is this submission being rejected..."
                              className="w-full p-3 bg-discord-bg-dark border border-discord-border rounded-lg text-sm text-discord-text placeholder-discord-text-muted focus:outline-none focus:border-red-500/50 resize-none"
                              rows={2}
                            />
                          </div>
                        </>
                      )}

                      {/* Error message */}
                      {reviewError && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <p className="text-sm text-red-400">{reviewError}</p>
                        </div>
                      )}

                      {/* Actions — only show if can review */}
                      {canReview && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleReview("approved")}
                            disabled={submitting || !canApprove}
                            title={hasFailedChecklist ? "Cannot approve — checklist items are unchecked" : undefined}
                            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ButtonSpinner loading={submitting}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </ButtonSpinner>
                            {hasFailedChecklist ? "Approve (blocked)" : "Approve"}
                          </button>
                          {selectedTask.status === "active" && (
                            <button
                              onClick={() => setLockConfirmOpen(true)}
                              disabled={submitting}
                              className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Lock for Revision
                            </button>
                          )}
                          <button
                            onClick={() => handleReview("rejected")}
                            disabled={submitting || !rejectionReason.trim()}
                            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ButtonSpinner loading={submitting}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </ButtonSpinner>
                            Reject
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lock for Revision confirmation */}
      <ConfirmDialog
        open={lockConfirmOpen}
        onClose={() => setLockConfirmOpen(false)}
        onConfirm={handleLockForRevision}
        title="Lock for Revision"
        confirmText="Lock Task"
        variant="warning"
        loading={locking}
      >
        Lock task for <strong>{selectedAttempt?.displayName || selectedAttempt?.username}</strong> for
        48h exclusive revision? Their current submission will be sent back for revision and other creators will not be able to submit.
      </ConfirmDialog>

      {/* Unlock confirmation */}
      <ConfirmDialog
        open={unlockConfirmOpen}
        onClose={() => setUnlockConfirmOpen(false)}
        onConfirm={handleUnlock}
        title="Unlock Task"
        confirmText="Unlock"
        variant="warning"
        loading={unlocking}
      >
        Unlock this task and reopen it for all creators? The exclusive revision period will end early.
      </ConfirmDialog>
    </div>
  );
}

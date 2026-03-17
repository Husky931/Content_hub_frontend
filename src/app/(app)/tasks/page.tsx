"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { ButtonSpinner } from "@/components/ui/Spinner";

interface Task {
  id: string;
  title: string;
  titleCn?: string | null;
  description: string;
  status: string;
  bountyUsd: string | null;
  bountyRmb: string | null;
  bonusBountyUsd?: string | null;
  bonusBountyRmb?: string | null;
  maxAttempts: number;
  deadline: string | null;
  attemptCount: number;
  channelName: string;
  channelSlug: string;
  createdByUsername: string;
  createdAt: string;
  submittedCount?: number;
  reviewClaimedBy?: string | null;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Draft" },
  active: { bg: "bg-green-500/20", text: "text-green-400", label: "Active" },
  locked: { bg: "bg-amber-500/20", text: "text-amber-300", label: "Locked" },
  approved: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Approved" },
  paid: { bg: "bg-discord-text-muted/20", text: "text-discord-text-muted", label: "Paid" },
  archived: { bg: "bg-gray-500/20", text: "text-gray-500", label: "Archived" },
};

const CHANNEL_COLORS: Record<string, string> = {
  voiceover: "bg-blue-500/20 text-blue-400",
  video: "bg-purple-500/20 text-purple-400",
  translation: "bg-amber-500/20 text-amber-400",
  illustration: "bg-pink-500/20 text-pink-400",
};

function getChannelColor(slug: string) {
  for (const [key, cls] of Object.entries(CHANNEL_COLORS)) {
    if (slug.includes(key)) return cls;
  }
  return "bg-discord-accent/20 text-discord-accent";
}

export default function TaskListPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-discord-bg text-discord-text-muted">Loading...</div>}>
      <TaskListContent />
    </Suspense>
  );
}

function TaskListContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openSettings } = useSettingsModal();
  const isMod = ["admin", "supermod", "mod"].includes(user?.role ?? "");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState(searchParams.get("channel") || "");
  const [sortBy, setSortBy] = useState("newest");
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handlePublish = async (taskId: string) => {
    setPublishingId(taskId);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "active" } : t));
    } catch {}
    setPublishingId(null);
  };

  const handleArchive = async (taskId: string) => {
    setArchivingId(taskId);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "archived" } : t));
    } catch {}
    setArchivingId(null);
  };

  useEffect(() => {
    const params = new URLSearchParams();
    if (channelFilter) params.set("channel", channelFilter);
    fetch(`/api/tasks?${params}`)
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channelFilter]);

  // Filter and sort
  let filtered = tasks;
  if (showOnlyAvailable) {
    filtered = filtered.filter((t) => t.status === "active");
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }

  if (sortBy === "pay") {
    filtered = [...filtered].sort(
      (a, b) => parseFloat(b.bountyUsd || "0") - parseFloat(a.bountyUsd || "0")
    );
  } else if (sortBy === "deadline") {
    filtered = [...filtered].sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }

  const stats = {
    draft: tasks.filter((t) => t.status === "draft").length,
    active: tasks.filter((t) => t.status === "active").length,
    locked: tasks.filter((t) => t.status === "locked").length,
    underReview: tasks.filter((t) => !!t.reviewClaimedBy).length,
    approved: tasks.filter((t) => t.status === "approved").length,
    paid: tasks.filter((t) => t.status === "paid").length,
    archived: tasks.filter((t) => t.status === "archived").length,
  };

  // Get unique channels for filter
  const channelSlugs = [...new Set(tasks.map((t) => t.channelSlug))];

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    const d = new Date(deadline);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff < 0) return "Expired";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Due today";
    return `${days} day${days !== 1 ? "s" : ""} left`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-discord-bg">
      <div className="flex-1 overflow-y-auto p-4">
        {/* Controls */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {isMod && (
            <button
              onClick={() => openSettings("admin-tasks")}
              className="px-3 py-2 bg-discord-accent hover:bg-discord-accent/80 text-white rounded-md text-xs font-semibold transition flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Task
            </button>
          )}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-10 pr-3 py-2 bg-discord-bg-dark border border-discord-border rounded-md text-sm text-discord-text placeholder-discord-text-muted focus:outline-none focus:border-discord-accent"
            />
          </div>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-3 py-2 bg-discord-bg-dark border border-discord-border rounded-md text-sm text-discord-text focus:outline-none"
          >
            <option value="">All Channels</option>
            {channelSlugs.map((s) => (
              <option key={s} value={s}>
                #{s}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-discord-bg-dark border border-discord-border rounded-md text-sm text-discord-text focus:outline-none"
          >
            <option value="newest">Sort: Newest</option>
            <option value="pay">Sort: Highest Pay</option>
            <option value="deadline">Sort: Deadline</option>
          </select>
          <div className="flex bg-discord-bg-dark border border-discord-border rounded-md overflow-hidden">
            <button
              onClick={() => setShowOnlyAvailable(true)}
              className={`px-3 py-2 text-xs font-semibold transition ${
                showOnlyAvailable
                  ? "bg-discord-accent text-white"
                  : "text-discord-text-muted hover:text-discord-text"
              }`}
            >
              Available
            </button>
            <button
              onClick={() => setShowOnlyAvailable(false)}
              className={`px-3 py-2 text-xs font-semibold transition ${
                !showOnlyAvailable
                  ? "bg-discord-accent text-white"
                  : "text-discord-text-muted hover:text-discord-text"
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mb-3 px-3 py-2 bg-discord-bg-dark rounded-md text-xs">
          <span className="flex items-center gap-1 text-gray-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            {stats.draft} draft
          </span>
          <span className="flex items-center gap-1 text-green-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            {stats.active} active
          </span>
          <span className="flex items-center gap-1 text-amber-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            {stats.locked} locked
          </span>
          <span className="flex items-center gap-1 text-orange-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            {stats.underReview} under review
          </span>
          <span className="flex items-center gap-1 text-blue-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            {stats.approved} approved
          </span>
          <span className="flex items-center gap-1 text-discord-text-muted font-medium">
            <span className="w-2 h-2 rounded-full bg-discord-text-muted" />
            {stats.paid} paid
          </span>
          <span className="flex items-center gap-1 text-gray-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            {stats.archived} archived
          </span>
        </div>

        {/* Task list */}
        {loading ? (
          <div className="text-center text-discord-text-muted py-8">
            Loading tasks...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-discord-text-muted">
            <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <span className="text-sm">No tasks match your filters</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((task) => {
              const statusStyle = STATUS_STYLES[task.status] || STATUS_STYLES.draft;
              const deadline = formatDeadline(task.deadline);
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between px-3 py-2.5 bg-discord-sidebar rounded-md hover:bg-discord-bg-hover/50 transition cursor-pointer"
                  onClick={() => router.push(`/channels/${task.channelSlug}`)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        task.status === "active"
                          ? "bg-green-400"
                          : task.status === "locked"
                          ? "bg-amber-400"
                          : task.status === "approved"
                          ? "bg-blue-400"
                          : "bg-discord-text-muted"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-discord-text truncate">
                          {task.title}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${getChannelColor(
                            task.channelSlug
                          )}`}
                        >
                          {task.channelName}
                        </span>
                        {task.bonusBountyUsd &&
                          parseFloat(task.bonusBountyUsd) > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 shrink-0">
                              TIERED
                            </span>
                          )}
                      </div>
                      <div className="text-xs text-discord-text-muted truncate">
                        <span className="text-discord-text-muted/70">by {task.createdByUsername}</span>
                        <span className="mx-1.5">·</span>
                        {task.description}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {deadline && (
                      <span className="text-xs text-discord-text-muted">
                        {deadline}
                      </span>
                    )}
                    {(task.submittedCount ?? 0) > 0 && (
                      <span className="text-xs text-discord-text-muted">
                        {task.submittedCount} submitted
                      </span>
                    )}
                    {task.reviewClaimedBy && (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Being reviewed by {task.reviewClaimedBy}
                      </span>
                    )}
                    {isMod && task.status === "draft" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePublish(task.id);
                        }}
                        disabled={publishingId === task.id}
                        className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        <ButtonSpinner loading={publishingId === task.id}>Publish</ButtonSpinner>
                      </button>
                    )}
                    {isMod && (task.submittedCount ?? 0) > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/review?task=${task.id}`);
                        }}
                        disabled={!!task.reviewClaimedBy}
                        className="text-xs px-3 py-1 bg-discord-accent hover:bg-discord-accent/80 text-white rounded font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        Review
                      </button>
                    )}
                    {(user?.username === task.createdByUsername || user?.role === "admin") && task.status === "active" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchive(task.id);
                        }}
                        disabled={archivingId === task.id}
                        className="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        <ButtonSpinner loading={archivingId === task.id}>Archive</ButtonSpinner>
                      </button>
                    )}
                    <div className="text-right">
                      <span className="text-sm font-bold text-green-400">
                        ${task.bountyUsd || "0"}
                      </span>
                      {task.bountyRmb && (
                        <div className="text-[10px] text-discord-text-muted">
                          ¥{task.bountyRmb}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${statusStyle.bg} ${statusStyle.text}`}
                    >
                      {statusStyle.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

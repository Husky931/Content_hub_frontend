"use client";

import { useState, useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/Spinner";

interface LessonSummary {
  id: string;
  title: string;
  titleCn?: string | null;
  description?: string | null;
  order: number;
  status: "draft" | "published";
  tagId?: string | null;
  prerequisiteTagId?: string | null;
  passingScore: number;
  retryAfterHours: number;
  promptCount: number;
  questionCount: number;
  uploadQuestionCount: number;
  passRate: number | null;
  totalAttempts: number;
  pendingReviews: number;
  tag: { name: string; nameCn?: string | null; color: string } | null;
  prerequisiteTag: { name: string; nameCn?: string | null } | null;
}

interface Tag {
  id: string;
  name: string;
  nameCn?: string | null;
  color: string;
}

export function AdminTrainingSection({
  onOpenEditor,
}: {
  onOpenEditor?: (lessonId: string) => void;
}) {
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTitleCn, setNewTitleCn] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    loadLessons();
  }, []);

  async function loadLessons() {
    setLoading(true);
    try {
      const res = await fetch("/api/training/lessons");
      if (res.ok) {
        setLessons(await res.json());
      }
    } catch (err) {
      console.error("Failed to load lessons:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createLesson() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/training/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          titleCn: newTitleCn.trim() || null,
          description: newDescription.trim() || null,
        }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewTitleCn("");
        setNewDescription("");
        setShowCreateForm(false);
        await loadLessons();
      }
    } catch (err) {
      console.error("Failed to create lesson:", err);
    } finally {
      setCreating(false);
    }
  }

  async function togglePublish(lesson: LessonSummary) {
    setPublishingId(lesson.id);
    try {
      const action = lesson.status === "published" ? "unpublish" : "publish";
      const res = await fetch(`/api/training/lessons/${lesson.id}/publish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await loadLessons();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update status");
      }
    } catch (err) {
      console.error("Failed to publish/unpublish:", err);
    } finally {
      setPublishingId(null);
    }
  }

  async function deleteLesson(id: string) {
    if (!confirm("Delete this lesson? If learners have progress on it, it will be archived (set to draft) instead.")) return;
    try {
      const res = await fetch(`/api/training/lessons/${id}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data.archived) {
          alert("This lesson has learner progress and cannot be fully deleted. It has been unpublished (set to draft) instead.");
        }
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        alert(data.error || "Failed to delete lesson");
      }
      await loadLessons();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  // Filters
  const filtered = lessons.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search && !l.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  // Stats
  const totalLessons = lessons.length;
  const publishedCount = lessons.filter((l) => l.status === "published").length;
  const draftCount = lessons.filter((l) => l.status === "draft").length;
  const totalPendingReviews = lessons.reduce(
    (s, l) => s + l.pendingReviews,
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-discord-text mb-2">
        Training Management
      </h2>
      <p className="text-sm text-discord-text-muted mb-6">
        All lessons with their tag bindings, content stats, learner progress, and
        pending upload reviews.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total Lessons", value: totalLessons, color: "text-discord-text" },
          { label: "Published", value: publishedCount, color: "text-green-400" },
          { label: "Draft", value: draftCount, color: "text-yellow-400" },
          { label: "Pending Reviews", value: totalPendingReviews, color: "text-orange-400" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-discord-bg-dark rounded-lg p-4 border border-discord-bg-darker/60"
          >
            <div className="text-[10px] text-discord-text-muted uppercase mb-1">
              {label}
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-discord-accent text-white rounded-lg text-sm font-medium hover:bg-discord-accent/80 transition cursor-pointer"
        >
          + Create New Lesson
        </button>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-discord-bg-dark border border-discord-bg-darker/60 rounded-lg px-3 py-2 text-xs text-discord-text cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-discord-bg-dark border border-discord-bg-darker/60 rounded-lg px-3 py-2 text-xs text-discord-text placeholder-discord-text-muted w-48"
            placeholder="Search lessons..."
          />
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-discord-bg-dark rounded-lg p-5 border border-discord-accent/30 mb-6">
          <h3 className="text-sm font-semibold text-discord-text mb-4">
            Create New Lesson
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-discord-text-muted block mb-1">
                Title (EN) *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text"
                placeholder="e.g. Viral Video Hooks"
              />
            </div>
            <div>
              <label className="text-xs text-discord-text-muted block mb-1">
                Title (CN)
              </label>
              <input
                type="text"
                value={newTitleCn}
                onChange={(e) => setNewTitleCn(e.target.value)}
                className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text"
                placeholder="Optional Chinese title"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-discord-text-muted block mb-1">
              Description
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text h-20 resize-none"
              placeholder="Brief description of this lesson"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createLesson}
              disabled={creating || !newTitle.trim()}
              className="px-4 py-2 bg-discord-accent text-white rounded text-sm font-medium hover:bg-discord-accent/80 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              {creating && <Spinner className="w-3 h-3" />}
              Create Lesson
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-discord-bg text-discord-text-muted rounded text-sm hover:bg-discord-bg-hover cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Lesson Table */}
      {filtered.length === 0 ? (
        <div className="bg-discord-bg-dark rounded-lg p-12 text-center border border-discord-bg-darker/60">
          <p className="text-discord-text-muted">
            {lessons.length === 0
              ? "No lessons created yet. Create your first lesson to get started."
              : "No lessons match your filters."}
          </p>
        </div>
      ) : (
        <div className="bg-discord-bg-dark rounded-lg border border-discord-bg-darker/60 overflow-hidden">
          {/* Table header */}
          <div className="px-5 py-3 bg-discord-bg-darker border-b border-discord-bg-darker/60 grid grid-cols-12 gap-4 text-[10px] text-discord-text-muted uppercase font-semibold items-center">
            <div className="col-span-1">#</div>
            <div className="col-span-3">Lesson</div>
            <div className="col-span-2">Bound Tag</div>
            <div className="col-span-1">Prompts</div>
            <div className="col-span-1">Test Qs</div>
            <div className="col-span-1">Pass Rate</div>
            <div className="col-span-1">Reviews</div>
            <div className="col-span-2">Actions</div>
          </div>

          {/* Rows */}
          {filtered.map((lesson) => (
            <div
              key={lesson.id}
              className="px-5 py-4 border-b border-discord-bg-darker/30 grid grid-cols-12 gap-4 items-center hover:bg-discord-bg-hover/20 transition"
            >
              <div className="col-span-1 text-xs text-discord-text-muted font-mono">
                {lesson.order}
              </div>
              <div className="col-span-3">
                <div className="text-sm font-medium text-discord-text">
                  {lesson.title}
                </div>
                {lesson.description && (
                  <div className="text-[10px] text-discord-text-muted line-clamp-1">
                    {lesson.description}
                  </div>
                )}
                <span
                  className={`mt-1 inline-block px-2 py-0.5 rounded text-[9px] font-semibold ${
                    lesson.status === "published"
                      ? "bg-green-500/20 text-green-300"
                      : "bg-yellow-500/20 text-yellow-300"
                  }`}
                >
                  {lesson.status.toUpperCase()}
                </span>
              </div>
              <div className="col-span-2">
                {lesson.tag ? (
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: lesson.tag.color }}
                    />
                    <span className="text-xs text-yellow-300 font-mono">
                      {lesson.tag.name}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-discord-text-muted italic">
                    No tag set
                  </div>
                )}
                {lesson.prerequisiteTag && (
                  <div className="text-[9px] text-discord-text-muted mt-0.5">
                    🔒 Requires: {lesson.prerequisiteTag.name}
                  </div>
                )}
              </div>
              <div className="col-span-1 text-xs text-discord-text">
                {lesson.promptCount}
              </div>
              <div className="col-span-1 text-xs text-discord-text">
                {lesson.questionCount}
                {lesson.uploadQuestionCount > 0 && (
                  <span className="text-[9px] text-orange-400 block">
                    ({lesson.uploadQuestionCount} upload)
                  </span>
                )}
              </div>
              <div className="col-span-1">
                <span
                  className={`text-xs font-medium ${
                    lesson.passRate !== null
                      ? "text-green-400"
                      : "text-discord-text-muted"
                  }`}
                >
                  {lesson.passRate !== null ? `${lesson.passRate}%` : "—"}
                </span>
                {lesson.totalAttempts > 0 && (
                  <div className="text-[9px] text-discord-text-muted">
                    {lesson.totalAttempts} attempts
                  </div>
                )}
              </div>
              <div className="col-span-1">
                {lesson.pendingReviews > 0 ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-500/20 text-orange-300">
                    {lesson.pendingReviews} pending
                  </span>
                ) : (
                  <span className="text-[10px] text-discord-text-muted">
                    —
                  </span>
                )}
              </div>
              <div className="col-span-2 flex justify-end">
                <LessonActionMenu
                  lesson={lesson}
                  publishingId={publishingId}
                  onEdit={() => onOpenEditor?.(lesson.id)}
                  onTogglePublish={() => togglePublish(lesson)}
                  onDelete={() => deleteLesson(lesson.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 3-dot Action Menu ──────────────────────────────────────────────────────

function LessonActionMenu({
  lesson,
  publishingId,
  onEdit,
  onTogglePublish,
  onDelete,
}: {
  lesson: LessonSummary;
  publishingId: string | null;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-discord-text-muted hover:text-discord-text hover:bg-discord-bg-hover transition cursor-pointer"
        title="Actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-discord-bg-darker rounded-lg border border-discord-bg-darker/60 shadow-xl z-50 overflow-hidden">
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="w-full px-4 py-2.5 text-left text-sm text-discord-text hover:bg-discord-bg-hover flex items-center gap-2.5 transition cursor-pointer"
          >
            <svg className="w-4 h-4 text-discord-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            onClick={() => { onTogglePublish(); setOpen(false); }}
            disabled={publishingId === lesson.id}
            className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition cursor-pointer disabled:opacity-50 ${
              lesson.status === "published"
                ? "text-red-300 hover:bg-red-500/10"
                : "text-green-300 hover:bg-green-500/10"
            }`}
          >
            {publishingId === lesson.id ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {lesson.status === "published" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
            )}
            {lesson.status === "published" ? "Unpublish" : "Publish"}
          </button>
          <div className="border-t border-discord-bg-darker/40" />
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

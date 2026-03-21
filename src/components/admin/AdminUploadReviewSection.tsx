"use client";

import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui/Spinner";

interface Submission {
  id: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  questionPrompt: string;
  questionSortOrder: number;
  lessonTitle: string;
  lessonId: string;
  userName: string;
  userDisplayName?: string | null;
  userAvatarUrl?: string | null;
  userId: string;
  cheatingWarnings: number;
  lessonAttempts: number;
  autoScore: number;
  reviewerName?: string | null;
  tagOnPass?: string | null;
}

export function AdminUploadReviewSection() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState({ pending: 0, approvedToday: 0, rejectedToday: 0 });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("pending");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    loadReviews();
  }, [activeFilter]);

  async function loadReviews() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter !== "all") params.set("status", activeFilter);
      const res = await fetch(`/api/training/reviews?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions);
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  }

  async function reviewSubmission(id: string, action: "approve" | "reject") {
    setActioningId(id);
    try {
      const res = await fetch(`/api/training/reviews/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: action === "reject" ? rejectionReasons[id] || undefined : undefined,
        }),
      });
      if (res.ok) {
        await loadReviews();
      }
    } catch (err) {
      console.error("Review action failed:", err);
    } finally {
      setActioningId(null);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  const filters = [
    { id: "pending", label: "Pending", count: stats.pending },
    { id: "approved", label: "Approved", count: stats.approvedToday },
    { id: "rejected", label: "Rejected", count: stats.rejectedToday },
    { id: "all", label: "All", count: submissions.length },
  ];

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-discord-text mb-2">
        Upload Review Queue
      </h2>
      <p className="text-sm text-discord-text-muted mb-6">
        Review upload-type test submissions. Tests with upload questions are held
        as "pending" until every upload is approved or rejected.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-discord-bg-dark rounded-lg p-4 border border-discord-bg-darker/60">
          <div className="text-[10px] text-discord-text-muted uppercase mb-1">Pending</div>
          <div className="text-2xl font-bold text-orange-400">{stats.pending}</div>
        </div>
        <div className="bg-discord-bg-dark rounded-lg p-4 border border-discord-bg-darker/60">
          <div className="text-[10px] text-discord-text-muted uppercase mb-1">Approved Today</div>
          <div className="text-2xl font-bold text-green-400">{stats.approvedToday}</div>
        </div>
        <div className="bg-discord-bg-dark rounded-lg p-4 border border-discord-bg-darker/60">
          <div className="text-[10px] text-discord-text-muted uppercase mb-1">Rejected Today</div>
          <div className="text-2xl font-bold text-red-400">{stats.rejectedToday}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeFilter === f.id
                ? "bg-discord-accent text-white"
                : "bg-discord-bg-dark text-discord-text-muted hover:bg-discord-bg-hover"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Submissions */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : submissions.length === 0 ? (
        <div className="bg-discord-bg-dark rounded-lg p-12 text-center border border-discord-bg-darker/60">
          <p className="text-discord-text-muted">No uploads pending review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className={`bg-discord-bg-dark rounded-lg border overflow-hidden ${
                sub.status === "pending"
                  ? "border-orange-500/20"
                  : sub.status === "approved"
                  ? "border-green-500/20"
                  : "border-red-500/20"
              }`}
            >
              {/* Header */}
              <div className="px-5 py-3 bg-discord-bg-darker border-b border-discord-bg-darker/60 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white text-xs font-bold">
                  {(sub.userDisplayName || sub.userName).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-discord-text">
                    {sub.userDisplayName || sub.userName}
                  </div>
                  <div className="text-[10px] text-discord-text-muted">
                    {sub.lessonTitle} · Q{sub.questionSortOrder + 1}: {sub.questionPrompt}
                  </div>
                </div>
                <div className="text-[10px] text-discord-text-muted">
                  {new Date(sub.createdAt).toLocaleDateString()}
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    sub.status === "pending"
                      ? "bg-orange-500/20 text-orange-300"
                      : sub.status === "approved"
                      ? "bg-green-500/20 text-green-300"
                      : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {sub.status.toUpperCase()}
                </span>
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="grid md:grid-cols-3 gap-4">
                  {/* File preview */}
                  <div className="md:col-span-2">
                    <div className="text-[10px] text-discord-text-muted uppercase mb-2">
                      Uploaded File
                    </div>
                    <div className="bg-discord-bg rounded-lg border border-discord-bg-darker/60 overflow-hidden">
                      <div className="bg-discord-bg-darker h-32 flex items-center justify-center relative">
                        {sub.fileType.startsWith("video") ? (
                          <span className="text-3xl">🎥</span>
                        ) : sub.fileType.startsWith("image") ? (
                          <span className="text-3xl">🖼️</span>
                        ) : sub.fileType.startsWith("audio") ? (
                          <span className="text-3xl">🎵</span>
                        ) : (
                          <span className="text-3xl">📄</span>
                        )}
                        <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] text-white">
                          {sub.fileName}
                        </div>
                      </div>
                      <div className="px-3 py-2 flex items-center justify-between text-xs">
                        <span className="text-discord-text-muted">
                          {sub.fileType} · {formatSize(sub.fileSize)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Context */}
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-discord-text-muted uppercase mb-1">
                        User Stats
                      </div>
                      <div className="bg-discord-bg rounded-lg p-3 border border-discord-bg-darker/60 space-y-1">
                        <div className="text-xs text-discord-text">
                          Auto score:{" "}
                          <strong className="text-green-400">
                            {sub.autoScore}%
                          </strong>
                        </div>
                        <div className="text-xs text-discord-text">
                          Cheating warnings:{" "}
                          <strong
                            className={
                              sub.cheatingWarnings > 0
                                ? "text-red-400"
                                : "text-green-400"
                            }
                          >
                            {sub.cheatingWarnings}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {sub.status === "pending" ? (
                  <div className="mt-4 flex items-center gap-3 pt-4 border-t border-discord-bg-darker/60">
                    <button
                      onClick={() => reviewSubmission(sub.id, "approve")}
                      disabled={actioningId === sub.id}
                      className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                    >
                      {actioningId === sub.id && <Spinner className="w-3 h-3" />}
                      Approve
                    </button>
                    <button
                      onClick={() => reviewSubmission(sub.id, "reject")}
                      disabled={actioningId === sub.id}
                      className="px-6 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                    >
                      {actioningId === sub.id && <Spinner className="w-3 h-3" />}
                      Reject
                    </button>
                    <input
                      type="text"
                      placeholder="Rejection reason (optional)..."
                      value={rejectionReasons[sub.id] || ""}
                      onChange={(e) =>
                        setRejectionReasons({
                          ...rejectionReasons,
                          [sub.id]: e.target.value,
                        })
                      }
                      className="flex-1 bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-3 py-2 text-xs text-discord-text placeholder-discord-text-muted"
                    />
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t border-discord-bg-darker/60">
                    <div className="flex items-center gap-3 text-xs">
                      <span
                        className={
                          sub.status === "approved"
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {sub.status === "approved" ? "✓" : "✕"}
                      </span>
                      <span className="text-discord-text">
                        {sub.status === "approved" ? "Approved" : "Rejected"}{" "}
                        {sub.reviewerName && (
                          <>
                            by <strong>{sub.reviewerName}</strong>
                          </>
                        )}
                      </span>
                      {sub.reviewedAt && (
                        <span className="text-discord-text-muted">
                          {new Date(sub.reviewedAt).toLocaleString()}
                        </span>
                      )}
                      {sub.rejectionReason && (
                        <span className="text-red-300">
                          — {sub.rejectionReason}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

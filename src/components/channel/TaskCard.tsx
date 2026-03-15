"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { FileUpload, FilePreviewList, type UploadedFile } from "@/components/ui/FileUpload";
import { useRouter } from "next/navigation";

interface MyAttempt {
  id: string;
  status: string;
  deliverables: { text?: string; files?: UploadedFile[] } | null;
}

interface TaskCardProps {
  task: {
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
    channelSlug: string;
    createdByUsername: string;
    createdByDisplayName?: string | null;
    createdAt?: string;
    myAttempt?: MyAttempt | null;
    submittedCount?: number;
    reviewClaimedBy?: string | null;
    checklist?: { label: string }[] | null;
    attachments?: { name: string; url: string; type: string; size: number }[] | null;
  };
  onAttemptSubmitted?: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Draft" },
  active: { bg: "bg-green-500/20", text: "text-green-400", label: "Active" },
  locked: { bg: "bg-amber-500/20", text: "text-amber-300", label: "Locked" },
  approved: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Approved" },
  paid: { bg: "bg-discord-text-muted/20", text: "text-discord-text-muted", label: "Paid" },
  archived: { bg: "bg-gray-500/20", text: "text-gray-500", label: "Archived" },
};

function formatRelativeDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function TaskCard({ task, onAttemptSubmitted }: TaskCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deliverableText, setDeliverableText] = useState("");
  const [deliverableFiles, setDeliverableFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState("");

  const statusStyle = STATUS_STYLES[task.status] || STATUS_STYLES.draft;
  const isReviewer = ["admin", "supermod", "mod"].includes(user?.role ?? "");

  const submittedCount = task.submittedCount || 0;
  const reviewClaimedBy = task.reviewClaimedBy || null;

  const myAttempt = task.myAttempt;
  const hasSubmittedAttempt = myAttempt?.status === "submitted";
  const hasRejectedAttempt = myAttempt?.status === "rejected";
  const hasApprovedAttempt = myAttempt?.status === "approved";

  const canSubmit =
    task.status === "active" &&
    !hasSubmittedAttempt &&
    !hasApprovedAttempt;

  const creatorName = task.createdByDisplayName || task.createdByUsername;

  const deadlineStr = task.deadline
    ? (() => {
        const d = new Date(task.deadline);
        const now = new Date();
        const diff = d.getTime() - now.getTime();
        if (diff < 0) return "Expired";
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return "Due today";
        return `${days} day${days !== 1 ? "s" : ""} left`;
      })()
    : null;

  const handleSubmit = async () => {
    if (!deliverableText.trim() && deliverableFiles.length === 0) {
      setError("Please enter text or upload files");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const deliverables: { text?: string; files?: UploadedFile[] } = {};
      if (deliverableText.trim()) deliverables.text = deliverableText.trim();
      if (deliverableFiles.length > 0) deliverables.files = deliverableFiles.map((f) => ({ name: f.name, url: f.url, type: f.type, size: f.size }));
      const res = await fetch(`/api/tasks/${task.id}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverables }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit");
        return;
      }
      setDeliverableText("");
      setDeliverableFiles([]);
      setExpanded(false);
      onAttemptSubmitted?.();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if ((!deliverableText.trim() && deliverableFiles.length === 0) || !myAttempt) {
      setError("Please enter text or upload files");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const deliverables: { text?: string; files?: UploadedFile[] } = {};
      if (deliverableText.trim()) deliverables.text = deliverableText.trim();
      if (deliverableFiles.length > 0) deliverables.files = deliverableFiles.map((f) => ({ name: f.name, url: f.url, type: f.type, size: f.size }));
      const res = await fetch(
        `/api/tasks/${task.id}/attempts/${myAttempt.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliverables }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update");
        return;
      }
      setEditing(false);
      onAttemptSubmitted?.();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!myAttempt) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/tasks/${task.id}/attempts/${myAttempt.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete");
        return;
      }
      onAttemptSubmitted?.();
    } catch {
      setError("Network error");
    } finally {
      setDeleting(false);
    }
  };

  const handleReviewClick = () => {
    router.push(`/review?task=${task.id}`);
  };

  return (
    <div className="mx-2 my-2 rounded-lg border border-discord-accent/30 bg-discord-accent/5 overflow-hidden">
      {/* Task header row 1: badges + title */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
        <span className="text-xs font-bold px-1.5 py-0.5 bg-discord-accent/20 text-discord-accent rounded uppercase">
          Task
        </span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${statusStyle.bg} ${statusStyle.text}`}>
          {statusStyle.label}
        </span>
        {task.bonusBountyUsd && parseFloat(task.bonusBountyUsd) > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
            TIERED
          </span>
        )}
        <h4 className="font-semibold text-sm text-discord-text flex-1 truncate ml-1">
          {task.title}
        </h4>
      </div>

      {/* Task header row 2: creator + metadata */}
      <div className="px-4 pb-2 flex items-center gap-4 text-xs text-discord-text-muted">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Posted by <span className="text-discord-text-secondary font-medium">{creatorName}</span>
        </span>
        {task.createdAt && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatRelativeDate(task.createdAt)}
          </span>
        )}
        {deadlineStr && (
          <span className={`flex items-center gap-1 ${deadlineStr === "Expired" ? "text-red-400" : deadlineStr === "Due today" ? "text-amber-400" : ""}`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {deadlineStr}
          </span>
        )}
      </div>

      {/* Description */}
      <div className="px-4 pb-2">
        <p className="text-xs text-discord-text-secondary line-clamp-2">
          {task.description}
        </p>
      </div>

      {/* Compact attachments indicator */}
      {task.attachments && task.attachments.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-1.5 text-[11px] text-discord-text-muted">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span>
              {task.attachments.length} reference file{task.attachments.length !== 1 ? "s" : ""}
              <span className="ml-1 text-discord-text-muted/70">
                ({task.attachments.map((a) => {
                  const ext = a.name.split(".").pop()?.toUpperCase();
                  return ext;
                }).filter((v, i, arr) => arr.indexOf(v) === i).join(", ")})
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Footer: bounty, attempts, actions */}
      <div className="px-4 py-2 bg-discord-bg-dark/30 flex items-center gap-3 border-t border-discord-border/50">
        {/* Bounty display */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-green-400">
            ${task.bountyUsd || "0"}
          </span>
          {task.bountyRmb && (
            <span className="text-xs text-discord-text-muted">
              / ¥{task.bountyRmb}
            </span>
          )}
        </div>

        {task.bonusBountyUsd && parseFloat(task.bonusBountyUsd) > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
            +${task.bonusBountyUsd} bonus
          </span>
        )}

        <span className="text-xs text-discord-text-muted">
          {task.attemptCount}/{task.maxAttempts} attempts
        </span>

        <div className="ml-auto flex items-center gap-2">
          {canSubmit && !hasSubmittedAttempt && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition cursor-pointer"
            >
              Submit Attempt
            </button>
          )}
          {submittedCount > 0 && (
            <span className="text-xs text-discord-text-muted">
              {submittedCount} submitted
            </span>
          )}
          {reviewClaimedBy && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Being reviewed by {reviewClaimedBy}
            </span>
          )}
          {isReviewer && submittedCount > 0 && (
            <button
              onClick={handleReviewClick}
              disabled={!!reviewClaimedBy}
              className="text-xs px-3 py-1 bg-discord-accent hover:bg-discord-accent/80 text-white rounded font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Review
            </button>
          )}
        </div>
      </div>

      {/* User's submitted attempt — show with Edit/Delete */}
      {hasSubmittedAttempt && !editing && (
        <div className="px-4 py-3 bg-discord-bg-dark/50 border-t border-discord-border/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
              Submitted
            </span>
            <span className="text-xs text-discord-text-muted">Your submission is pending review</span>
          </div>
          <div className="mb-2 px-2.5 py-1.5 rounded border border-emerald-500/30 bg-emerald-500/10">
            <span className="text-xs text-emerald-400">This submission is only visible to you and reviewers</span>
          </div>
          {myAttempt?.deliverables?.text && (
            <div className="p-2 bg-discord-bg-dark border border-discord-border rounded text-sm text-discord-text-secondary whitespace-pre-wrap mb-2">
              {myAttempt.deliverables.text}
            </div>
          )}
          {myAttempt?.deliverables?.files && myAttempt.deliverables.files.length > 0 && (
            <FilePreviewList files={myAttempt.deliverables.files} label="Uploaded Files" />
          )}
          {error && (
            <p className="text-xs text-discord-red mt-1">{error}</p>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setDeliverableText(myAttempt?.deliverables?.text || "");
                setDeliverableFiles(myAttempt?.deliverables?.files || []);
                setEditing(true);
                setError("");
              }}
              className="text-xs px-3 py-1 bg-discord-accent hover:bg-discord-accent/80 text-white rounded font-semibold transition cursor-pointer"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
            >
              {deleting ? <Spinner /> : "Delete"}
            </button>
          </div>
        </div>
      )}

      {/* Edit form for existing submission */}
      {hasSubmittedAttempt && editing && (
        <div className="px-4 py-3 bg-discord-bg-dark/50 border-t border-discord-border/50 space-y-3">
          <FileUpload
            files={deliverableFiles}
            onFilesChange={setDeliverableFiles}
            context="attempt-deliverable"
            maxFiles={10}
            maxSizeMb={100}
            label="Upload files"
            compact
          />
          <textarea
            value={deliverableText}
            onChange={(e) => setDeliverableText(e.target.value)}
            placeholder="Notes for reviewer (optional if files uploaded)..."
            className="w-full p-2 bg-discord-bg-dark border border-discord-border rounded text-sm text-discord-text placeholder-discord-text-muted focus:outline-none focus:border-discord-accent resize-none"
            rows={3}
          />
          {error && (
            <p className="text-xs text-discord-red mt-1">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setEditing(false);
                setError("");
              }}
              className="text-xs px-3 py-1 text-discord-text-muted hover:text-discord-text transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={submitting}
              className="text-xs px-4 py-1.5 bg-discord-accent hover:bg-discord-accent/80 text-white rounded font-semibold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
            >
              {submitting ? <Spinner /> : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Expanded: new submit form */}
      {expanded && canSubmit && !hasSubmittedAttempt && (
        <div className="px-4 py-3 bg-discord-bg-dark/50 border-t border-discord-border/50 space-y-3">
          {/* Task attachments (reference files from task creator) */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="p-2 bg-discord-bg-dark rounded border border-discord-border">
              <FilePreviewList files={task.attachments} label="Reference Files" />
            </div>
          )}

          {/* Checklist guidance */}
          {task.checklist && task.checklist.length > 0 && (
            <div className="p-2 bg-discord-bg-dark rounded border border-discord-border">
              <p className="text-[10px] font-semibold text-discord-text-muted uppercase mb-1">Requirements Checklist</p>
              <ul className="space-y-0.5">
                {task.checklist.map((item, i) => (
                  <li key={i} className="text-xs text-discord-text-secondary flex items-center gap-1.5">
                    <span className="text-green-400 text-[10px]">✓</span> {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <FileUpload
            files={deliverableFiles}
            onFilesChange={setDeliverableFiles}
            context="attempt-deliverable"
            maxFiles={10}
            maxSizeMb={100}
            label="Upload your deliverables"
            compact
          />
          <textarea
            value={deliverableText}
            onChange={(e) => setDeliverableText(e.target.value)}
            placeholder="Notes for reviewer (optional if files uploaded)..."
            className="w-full p-2 bg-discord-bg-dark border border-discord-border rounded text-sm text-discord-text placeholder-discord-text-muted focus:outline-none focus:border-discord-accent resize-none"
            rows={3}
          />
          {error && (
            <p className="text-xs text-discord-red mt-1">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setExpanded(false);
                setDeliverableFiles([]);
                setError("");
              }}
              className="text-xs px-3 py-1 text-discord-text-muted hover:text-discord-text transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="text-xs px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
            >
              {submitting ? <Spinner /> : "Submit"}
            </button>
          </div>
        </div>
      )}

      {/* Rejected attempt info — user can submit again */}
      {hasRejectedAttempt && task.status === "active" && (
        <div className="px-4 py-2 bg-red-500/5 border-t border-discord-border/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
              Rejected
            </span>
            <span className="text-xs text-discord-text-muted">Your previous submission was rejected — you can submit again</span>
          </div>
        </div>
      )}
    </div>
  );
}

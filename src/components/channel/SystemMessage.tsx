"use client";

import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  System-message event detection & themed rendering                  */
/* ------------------------------------------------------------------ */

type EventKind =
  | "task_posted"
  | "submission"
  | "approved"
  | "rejected"
  | "locked"
  | "unlocked"
  | "appeal_filed"
  | "appeal_upheld"
  | "appeal_denied"
  | "audit"
  | "automod"
  | "generic";

interface EventTheme {
  label: string;
  icon: ReactNode;
  /** Tailwind classes: border color, bg tint, label text color */
  border: string;
  bg: string;
  labelColor: string;
  iconColor: string;
}

/* ---------- icons (16×16 inline SVGs) ---------- */

const icons: Record<string, ReactNode> = {
  megaphone: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  ),
  upload: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  checkCircle: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  xCircle: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  lock: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  unlock: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  ),
  flag: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  ),
  shield: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  bot: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

/* ---------- theme map ---------- */

const themes: Record<EventKind, EventTheme> = {
  task_posted: {
    label: "Task Posted",
    icon: icons.megaphone,
    border: "border-blue-500",
    bg: "bg-blue-500/8",
    labelColor: "text-blue-400",
    iconColor: "text-blue-400",
  },
  submission: {
    label: "Submission",
    icon: icons.upload,
    border: "border-violet-500",
    bg: "bg-violet-500/8",
    labelColor: "text-violet-400",
    iconColor: "text-violet-400",
  },
  approved: {
    label: "Approved",
    icon: icons.checkCircle,
    border: "border-emerald-500",
    bg: "bg-emerald-500/8",
    labelColor: "text-emerald-400",
    iconColor: "text-emerald-400",
  },
  rejected: {
    label: "Rejected",
    icon: icons.xCircle,
    border: "border-red-500",
    bg: "bg-red-500/8",
    labelColor: "text-red-400",
    iconColor: "text-red-400",
  },
  locked: {
    label: "Locked",
    icon: icons.lock,
    border: "border-amber-500",
    bg: "bg-amber-500/8",
    labelColor: "text-amber-400",
    iconColor: "text-amber-400",
  },
  unlocked: {
    label: "Unlocked",
    icon: icons.unlock,
    border: "border-teal-500",
    bg: "bg-teal-500/8",
    labelColor: "text-teal-400",
    iconColor: "text-teal-400",
  },
  appeal_filed: {
    label: "Appeal Filed",
    icon: icons.flag,
    border: "border-orange-500",
    bg: "bg-orange-500/8",
    labelColor: "text-orange-400",
    iconColor: "text-orange-400",
  },
  appeal_upheld: {
    label: "Appeal Upheld",
    icon: icons.checkCircle,
    border: "border-emerald-500",
    bg: "bg-emerald-500/8",
    labelColor: "text-emerald-400",
    iconColor: "text-emerald-400",
  },
  appeal_denied: {
    label: "Appeal Denied",
    icon: icons.xCircle,
    border: "border-red-500",
    bg: "bg-red-500/8",
    labelColor: "text-red-400",
    iconColor: "text-red-400",
  },
  audit: {
    label: "Audit",
    icon: icons.shield,
    border: "border-rose-500",
    bg: "bg-rose-500/8",
    labelColor: "text-rose-400",
    iconColor: "text-rose-400",
  },
  automod: {
    label: "Auto-Check",
    icon: icons.bot,
    border: "border-cyan-500",
    bg: "bg-cyan-500/8",
    labelColor: "text-cyan-400",
    iconColor: "text-cyan-400",
  },
  generic: {
    label: "System",
    icon: icons.info,
    border: "border-gray-500",
    bg: "bg-gray-500/8",
    labelColor: "text-gray-400",
    iconColor: "text-gray-400",
  },
};

/* ---------- content → event kind ---------- */

function detectEvent(content: string): EventKind {
  const c = content.toLowerCase();

  // Auto-mod (check before generic approve/reject)
  if (c.includes("auto-check")) return "automod";

  // Approval / rejection
  if (c.includes("was approved")) return "approved";
  if (c.includes("was rejected")) return "rejected";

  // Task posted / synced
  if (c.includes("posted a new task") || c.includes("new task synced")) return "task_posted";

  // Submission
  if (c.includes("submitted an attempt")) return "submission";

  // Lock / unlock
  if (c.includes("lock expired") || c.includes("unlocked by") || c.includes("reopened for all creators")) return "unlocked";
  if (c.includes("locked for")) return "locked";

  // Appeals
  if (c.includes("appeal") && (c.includes("upheld") || c.includes("✅"))) return "appeal_upheld";
  if (c.includes("appeal") && (c.includes("denied") || c.includes("❌"))) return "appeal_denied";
  if (c.includes("appeal filed") || c.includes("new appeal")) return "appeal_filed";

  // Audit
  if (c.includes("audit reversal") || c.includes("audit")) return "audit";

  return "generic";
}

/* ---------- highlight quoted task titles in message text ---------- */

function renderContent(content: string): ReactNode {
  // Strip leading emoji + space (we show icons instead)
  const cleaned = content.replace(/^[📋✅❌🔒🔓]\s*/, "");

  // Highlight text in "double quotes" as task-title accents
  const parts = cleaned.split(/(".*?")/g);
  return parts.map((part, i) =>
    part.startsWith('"') && part.endsWith('"') ? (
      <span key={i} className="font-semibold text-discord-text">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/* ---------- format timestamp ---------- */

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ================================================================== */
/*  SystemMessage component                                            */
/* ================================================================== */

interface SystemMessageProps {
  id: string;
  content: string;
  createdAt: string;
}

export function SystemMessage({ content, createdAt }: SystemMessageProps) {
  const kind = detectEvent(content);
  const theme = themes[kind];

  return (
    <div
      className={`flex items-start gap-3 px-3 py-2 my-0.5 rounded-md border-l-[3px] ${theme.border} ${theme.bg}`}
    >
      {/* Icon */}
      <div className={`mt-0.5 flex-shrink-0 ${theme.iconColor}`}>
        {theme.icon}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs font-semibold uppercase tracking-wide ${theme.labelColor}`}>
            {theme.label}
          </span>
          <span className="text-xs text-discord-text-muted">
            {formatTime(createdAt)}
          </span>
        </div>
        <p className="text-sm text-discord-text-secondary break-words leading-relaxed">
          {renderContent(content)}
        </p>
      </div>
    </div>
  );
}

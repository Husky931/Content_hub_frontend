"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSocket, onSocketReady, WS_EVENTS } from "@/lib/realtime";
import { useTranslations } from "next-intl";

interface TaskSummaryBarProps {
  channelSlug: string;
}

interface TaskCounts {
  total: number;
  active: number;
  locked: number;
  approved: number;
}

export function TaskSummaryBar({ channelSlug }: TaskSummaryBarProps) {
  const router = useRouter();
  const t = useTranslations("taskSummary");
  const [counts, setCounts] = useState<TaskCounts | null>(null);

  const fetchCounts = useCallback(() => {
    fetch(`/api/tasks?channel=${channelSlug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tasks) {
          const tasks = data.tasks as Array<{ status: string }>;
          const nonArchived = tasks.filter((t) => t.status !== "archived");
          setCounts({
            total: nonArchived.length,
            active: tasks.filter((t) => t.status === "active").length,
            locked: tasks.filter((t) => t.status === "locked").length,
            approved: tasks.filter(
              (t) => t.status === "approved" || t.status === "paid"
            ).length,
          });
        }
      })
      .catch(() => {});
  }, [channelSlug]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Real-time: update counts when tasks change
  useEffect(() => {
    const unsub = onSocketReady((socket) => {
      socket.on(WS_EVENTS.TASK_UPDATED, fetchCounts);
    });
    return () => {
      unsub();
      getSocket()?.off(WS_EVENTS.TASK_UPDATED, fetchCounts);
    };
  }, [fetchCounts]);

  if (!counts || counts.total === 0) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-1.5 bg-discord-bg-dark/50 border-b border-discord-border cursor-pointer hover:bg-discord-bg-dark/80 transition"
      onClick={() => router.push(`/tasks?channel=${channelSlug}`)}
    >
      <svg
        className="w-4 h-4 text-discord-text-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 10h16M4 14h16M4 18h16"
        />
      </svg>
      <span className="text-sm font-medium text-discord-text-secondary">
        {t("taskCount", { count: counts.total })}
      </span>
      <span className="text-xs text-discord-text-muted">
        {t("clickToExpand")}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {counts.locked > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
            {t("locked", { count: counts.locked })}
          </span>
        )}
        {counts.approved > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-discord-text-muted/20 text-discord-text-muted font-semibold">
            {t("done", { count: counts.approved })}
          </span>
        )}
        {counts.active > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold">
            {t("available", { count: counts.active })}
          </span>
        )}
      </div>
    </div>
  );
}

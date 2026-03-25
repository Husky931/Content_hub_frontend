"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getSocket, onSocketReady, WS_EVENTS } from "@/lib/realtime";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: any;
  readAt: string | null;
  createdAt: string;
}

const TYPE_ICONS: Record<string, { icon: string; bg: string }> = {
  new_task: { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", bg: "bg-blue-500" },
  task_approved: { icon: "M5 13l4 4L19 7", bg: "bg-green-500" },
  task_rejected: { icon: "M6 18L18 6M6 6l12 12", bg: "bg-red-500" },
  attempt_submitted: { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", bg: "bg-blue-500" },
  payout: { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", bg: "bg-green-500" },
  bonus: { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", bg: "bg-amber-500" },
  audit_reversal: { icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z", bg: "bg-red-500" },
};

export default function NotificationsPage() {
  const router = useRouter();
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Real-time: auto-refresh notification list when new notifications arrive
  useEffect(() => {
    const handleUpdate = () => fetchNotifications();
    const unsub = onSocketReady((socket) => {
      socket.on(WS_EVENTS.NOTIFICATION_NEW, handleUpdate);
    });
    return () => {
      unsub();
      getSocket()?.off(WS_EVENTS.NOTIFICATION_NEW, handleUpdate);
    };
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    fetchNotifications();
  };

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds: [id] }),
    });
    fetchNotifications();
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t("minutesAgo", { mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("hoursAgo", { hours });
    return t("daysAgo", { days: Math.floor(hours / 24) });
  };

  const handleNotificationClick = async (notif: Notification) => {
    // Mark as read if unread
    if (!notif.readAt) {
      await markRead(notif.id);
    }

    // Navigate based on notification type
    const data = notif.data || {};
    switch (notif.type) {
      case "attempt_submitted":
        // Mod should go to review page
        if (data.taskId) {
          router.push(`/review?task=${data.taskId}`);
        }
        break;
      case "task_approved":
      case "task_rejected":
      case "new_task":
        // Creator should go to the channel where the task is
        if (data.channelSlug) {
          router.push(`/channels/${data.channelSlug}`);
        } else if (data.channelId) {
          router.push(`/channels`);
        }
        break;
      case "payout":
      case "bonus":
      case "adjustment":
        router.push("/financials");
        break;
      case "audit_reversal":
        if (data.channelSlug) {
          router.push(`/channels/${data.channelSlug}`);
        }
        break;
    }
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-discord-bg">
      <div className="h-12 px-4 flex items-center bg-discord-bg shrink-0">
        {unreadCount > 0 && (
          <span className="text-sm px-2.5 py-1 bg-discord-red/20 text-discord-red font-semibold rounded">
            {t("unread", { count: unreadCount })}
          </span>
        )}
        <div className="ml-auto">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm px-3 py-1 text-discord-accent hover:text-discord-accent/80 hover:bg-discord-accent/10 rounded transition"
            >
              {t("markAllRead")}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-center text-discord-text-muted py-8">{tc("loading")}</p>
        ) : notifications.length === 0 ? (
          <div className="text-center text-discord-text-muted py-12">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-sm">{t("noNotifications")}</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl mx-auto">
            {notifications.map((notif) => {
              const typeInfo = TYPE_ICONS[notif.type] || TYPE_ICONS.new_task;
              const isUnread = !notif.readAt;
              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    isUnread
                      ? "bg-discord-sidebar border-l-4 border-l-discord-accent border-discord-border"
                      : "bg-discord-sidebar/50 border-discord-border/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${typeInfo.bg}`}
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeInfo.icon} />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          isUnread
                            ? "text-discord-text font-medium"
                            : "text-discord-text-muted"
                        }`}
                      >
                        {notif.body || notif.title}
                      </p>
                      <span className="text-xs text-discord-text-muted">
                        {formatTime(notif.createdAt)}
                      </span>
                    </div>
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

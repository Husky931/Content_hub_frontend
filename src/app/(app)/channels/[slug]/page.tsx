"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter } from "next/navigation";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { TaskSummaryBar } from "@/components/channel/TaskSummaryBar";
import { TaskCard } from "@/components/channel/TaskCard";
import { AppealCard } from "@/components/channel/AppealCard";
import { getSocket, joinChannel, leaveChannel, onSocketReady, WS_EVENTS } from "@/lib/realtime";

interface Message {
  id: string;
  content: string;
  type: "text" | "mod" | "system";
  replyToId?: string | null;
  replyCount?: number;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
  };
}

interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

interface TaskInfo {
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
  myAttempt?: { id: string; status: string; deliverables: { text?: string } | null } | null;
  submittedCount?: number;
  reviewClaimedBy?: string | null;
}

// Role icon SVGs overlaid on bottom-right of avatar
function RoleIcon({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 border-2 border-discord-bg flex items-center justify-center" title="Admin">
        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
        </svg>
      </div>
    );
  }
  if (role === "supermod") {
    return (
      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-500 border-2 border-discord-bg flex items-center justify-center" title="Supermod">
        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
        </svg>
      </div>
    );
  }
  if (role === "mod") {
    return (
      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-discord-bg flex items-center justify-center" title="Mod">
        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622C17.176 19.29 21 14.591 21 9c0-1.055-.15-2.079-.434-3.044z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-discord-accent border-2 border-discord-bg" title="Creator" />
  );
}

const ROLE_AVATAR_COLOR: Record<string, string> = {
  admin: "bg-red-500",
  supermod: "bg-indigo-500",
  mod: "bg-green-500",
  creator: "bg-discord-accent",
};

const ROLE_NAME_COLOR: Record<string, string> = {
  admin: "text-red-400",
  supermod: "text-indigo-400",
  mod: "text-green-400",
  creator: "text-discord-text",
};

export default function ChannelPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { openSettings } = useSettingsModal();
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tasksFetchRef = useRef<AbortController | null>(null);
  const fetchTasksRef = useRef<() => void>(() => {});
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [appeals, setAppeals] = useState<any[]>([]);

  const isAppealsChannel = slug === "appeals";

  const fetchAppeals = useCallback(() => {
    if (!isAppealsChannel) return;
    fetch("/api/appeals")
      .then((res) => res.json())
      .then((data) => setAppeals(data.appeals || []))
      .catch(() => {});
  }, [isAppealsChannel]);

  const fetchData = () => {
    if (!slug) return;
    fetch(`/api/channels/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        setChannel(data.channel);
        setMessages(data.messages || []);
      })
      .catch(() => {});
  };

  const fetchTasks = () => {
    if (!slug) return;
    tasksFetchRef.current?.abort();
    const controller = new AbortController();
    tasksFetchRef.current = controller;
    fetch(`/api/tasks?channel=${slug}`, { signal: controller.signal, cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTasks(data.tasks || []))
      .catch((err) => {
        if (err.name !== "AbortError") console.warn("[tasks] fetch failed:", err);
      });
  };
  fetchTasksRef.current = fetchTasks;

  useEffect(() => {
    fetchData();
    fetchTasks();
    fetchAppeals();
  }, [slug, fetchAppeals]);

  // Real-time: subscribe to channel messages via WebSocket
  useEffect(() => {
    if (!slug) return;

    let activeSocket: ReturnType<typeof getSocket> = null;

    const handleNewMessage = (msg: Message) => {
      const normalized: Message = {
        ...msg,
        id: msg.id || `ws-${Date.now()}`,
        createdAt: msg.createdAt || new Date().toISOString(),
        replyToId: msg.replyToId || null,
        replyCount: msg.replyCount || 0,
        user: msg.user || {
          id: "system",
          username: "System",
          displayName: "System",
          avatarUrl: null,
          role: "system",
        },
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === normalized.id)) return prev;

        // If this is a reply, increment replyCount on the parent
        if (normalized.replyToId) {
          const updated = prev.map((m) =>
            m.id === normalized.replyToId
              ? { ...m, replyCount: (m.replyCount || 0) + 1 }
              : m
          );
          return [...updated, normalized];
        }

        return [...prev, normalized];
      });
    };

    const handleTaskUpdate = () => {
      fetchTasksRef.current();
    };

    const setup = (socket: NonNullable<ReturnType<typeof getSocket>>) => {
      activeSocket = socket;
      joinChannel(slug);
      socket.on(WS_EVENTS.MESSAGE_NEW, handleNewMessage);
      socket.on(WS_EVENTS.MESSAGE_SYSTEM, handleNewMessage);
      socket.on(WS_EVENTS.TASK_UPDATED, handleTaskUpdate);
    };

    const unsub = onSocketReady(setup);

    return () => {
      unsub();
      leaveChannel(slug);
      if (activeSocket) {
        activeSocket.off(WS_EVENTS.MESSAGE_NEW, handleNewMessage);
        activeSocket.off(WS_EVENTS.MESSAGE_SYSTEM, handleNewMessage);
        activeSocket.off(WS_EVENTS.TASK_UPDATED, handleTaskUpdate);
      }
    };
  }, [slug]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/channels/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage.trim(),
          replyToId: replyingTo?.id || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;

          // If replying, increment parent's replyCount
          if (data.message.replyToId) {
            const updated = prev.map((m) =>
              m.id === data.message.replyToId
                ? { ...m, replyCount: (m.replyCount || 0) + 1 }
                : m
            );
            return [...updated, data.message];
          }

          return [...prev, data.message];
        });
        setNewMessage("");
        setReplyingTo(null);
      }
    } catch {
      // silent fail
    } finally {
      setSending(false);
    }
  };

  const handleReply = useCallback((msg: Message) => {
    setReplyingTo(msg);
    inputRef.current?.focus();
  }, []);

  const toggleThread = useCallback((msgId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  const canPost =
    channel?.name !== "announcements" ||
    ["mod", "supermod", "admin"].includes(user?.role ?? "");

  const isTaskChannel = channel?.type === "task";
  const isMod = ["admin", "supermod", "mod"].includes(user?.role ?? "");
  const activeTasks = tasks.filter(
    (t) => t.status === "active" || t.status === "locked"
  );

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  // Separate top-level messages and replies
  const topLevelMessages = messages.filter((m) => !m.replyToId);
  const repliesByParent: Record<string, Message[]> = {};
  for (const msg of messages) {
    if (msg.replyToId) {
      if (!repliesByParent[msg.replyToId]) repliesByParent[msg.replyToId] = [];
      repliesByParent[msg.replyToId].push(msg);
    }
  }

  // Group top-level messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = "";
  for (const msg of topLevelMessages) {
    const date = formatDate(msg.createdAt);
    if (date !== currentDate) {
      currentDate = date;
      groupedMessages.push({ date, messages: [] });
    }
    groupedMessages[groupedMessages.length - 1].messages.push(msg);
  }

  // Render a single message row
  const renderMessage = (msg: Message, isReply = false) => (
    <div
      key={msg.id}
      className={`flex gap-3 py-1 px-2 hover:bg-discord-bg-hover/30 rounded group ${
        msg.type === "system"
          ? "opacity-70"
          : msg.type === "mod"
          ? "border-l-2 border-discord-accent pl-4"
          : ""
      } ${isReply ? "ml-6" : ""}`}
    >
      {/* Avatar with role icon */}
      <div className="relative flex-shrink-0 mt-0.5">
        {msg.user?.avatarUrl ? (
          <>
            <img
              src={msg.user.avatarUrl}
              alt=""
              className={`rounded-full ${isReply ? "w-7 h-7" : "w-10 h-10"}`}
            />
            {!isReply && <RoleIcon role={msg.user.role} />}
          </>
        ) : (
          <>
            <div
              className={`rounded-full flex items-center justify-center text-white font-bold ${
                isReply ? "w-7 h-7 text-xs" : "w-10 h-10 text-sm"
              } ${
                msg.type === "system"
                  ? "bg-discord-text-muted"
                  : (ROLE_AVATAR_COLOR[msg.user?.role] ?? "bg-discord-accent")
              }`}
            >
              {(msg.user?.displayName || msg.user?.username || "S")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            {!isReply && msg.type !== "system" && msg.user && <RoleIcon role={msg.user.role} />}
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-medium ${isReply ? "text-xs" : "text-sm"} ${
              ROLE_NAME_COLOR[msg.user?.role] ?? "text-discord-text"
            }`}
          >
            {msg.user?.displayName || msg.user?.username || "System"}
          </span>
          {msg.type === "mod" && (
            <span className="text-xs px-1.5 py-0.5 bg-discord-accent/20 text-discord-accent rounded">
              MOD
            </span>
          )}
          {msg.type === "system" && (
            <span className="text-xs px-1.5 py-0.5 bg-discord-text-muted/20 text-discord-text-muted rounded">
              SYSTEM
            </span>
          )}
          <span className="text-xs text-discord-text-muted">
            {formatTime(msg.createdAt)}
          </span>

          {/* Reply button — visible on hover */}
          {canPost && msg.type !== "system" && (
            <button
              onClick={() => handleReply(msg)}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-xs text-discord-text-muted hover:text-discord-accent flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v4M3 10l6 6M3 10l6-6" />
              </svg>
              Reply
            </button>
          )}
        </div>
        <p className={`text-discord-text-secondary break-words ${isReply ? "text-xs" : "text-sm"}`}>
          {msg.content}
        </p>
      </div>
    </div>
  );

  // Render thread toggle + inline replies for a parent message
  const renderThread = (parentMsg: Message) => {
    const replyCount = parentMsg.replyCount || repliesByParent[parentMsg.id]?.length || 0;
    if (replyCount === 0) return null;

    const isExpanded = expandedThreads.has(parentMsg.id);
    const replies = repliesByParent[parentMsg.id] || [];

    return (
      <div className="ml-6 mt-0.5">
        <button
          onClick={() => toggleThread(parentMsg.id)}
          className="flex items-center gap-1.5 text-xs text-discord-accent hover:text-discord-accent/80 transition-colors py-0.5 px-1 -ml-1 rounded hover:bg-discord-accent/10"
        >
          <span className="font-mono font-bold text-xs w-3 text-center">
            {isExpanded ? "−" : "+"}
          </span>
          <span>
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </span>
        </button>

        {isExpanded && replies.length > 0 && (
          <div className="border-l-2 border-discord-border/50 pl-2 mt-1 space-y-0.5">
            {replies.map((reply) => renderMessage(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Task summary bar (task channels only) */}
      {isTaskChannel && <TaskSummaryBar channelSlug={slug} />}

      {/* Create task button for mods in task channels */}
      {isTaskChannel && isMod && (
        <div className="px-4 py-2 bg-discord-bg border-b border-discord-border/50 flex items-center">
          <button
            onClick={() => openSettings("admin-tasks")}
            className="text-xs px-3 py-1.5 bg-discord-accent hover:bg-discord-accent/80 text-white rounded font-semibold transition flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Task
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-discord-bg">
        {messages.length === 0 && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-discord-text-muted">
            <div className="text-4xl mb-4">#</div>
            <h3 className="text-xl font-bold text-discord-text mb-2">
              Welcome to #{channel?.name || slug}
            </h3>
            <p className="text-sm">
              {channel?.description || "This is the start of the channel."}
            </p>
          </div>
        )}

        {/* Active task cards at the top of the feed */}
        {isTaskChannel && activeTasks.length > 0 && (
          <div className="mb-4">
            {activeTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onAttemptSubmitted={() => {
                  fetchTasks();
                  fetchData();
                }}
              />
            ))}
          </div>
        )}

        {/* Appeal cards in #appeals channel */}
        {isAppealsChannel && appeals.length > 0 && (
          <div className="mb-4">
            {appeals.map((appeal) => (
              <AppealCard
                key={appeal.id}
                appeal={appeal}
                onResolved={() => {
                  fetchAppeals();
                  fetchData();
                }}
              />
            ))}
          </div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.date}>
            {/* Date divider */}
            <div className="flex items-center my-4">
              <div className="flex-1 h-px bg-discord-border" />
              <span className="px-3 text-xs text-discord-text-muted font-medium">
                {group.date}
              </span>
              <div className="flex-1 h-px bg-discord-border" />
            </div>

            {group.messages.map((msg) => (
              <div key={msg.id}>
                {renderMessage(msg)}
                {renderThread(msg)}
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview bar */}
      {replyingTo && canPost && (
        <div className="px-4 pt-2 bg-discord-bg flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 bg-discord-bg-dark rounded-t-lg border-l-2 border-discord-accent text-xs text-discord-text-muted">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v4M3 10l6 6M3 10l6-6" />
            </svg>
            <span>
              Replying to{" "}
              <span className="font-medium text-discord-accent">
                {replyingTo.user?.displayName || replyingTo.user?.username}
              </span>
              <span className="ml-1.5 text-discord-text-muted/70">
                {replyingTo.content.length > 60
                  ? replyingTo.content.slice(0, 60) + "…"
                  : replyingTo.content}
              </span>
            </span>
            <button
              onClick={() => setReplyingTo(null)}
              className="ml-auto text-discord-text-muted hover:text-discord-text flex-shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Message input */}
      <div className={`px-4 pb-4 ${replyingTo && canPost ? "pt-0" : "pt-2"} bg-discord-bg flex-shrink-0`}>
        {!canPost ? (
          <div className="p-3 bg-discord-bg-dark rounded-lg text-center text-sm text-discord-text-muted border border-discord-border">
            <span className="mr-1.5">🔒</span>
            You do not have permission to send messages in this channel
          </div>
        ) : (
          <form onSubmit={handleSend} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value.slice(0, 2000))}
              maxLength={2000}
              placeholder={
                replyingTo
                  ? `Reply to ${replyingTo.user?.displayName || replyingTo.user?.username}…`
                  : `Message #${channel?.name || slug}`
              }
              className={`w-full p-3 bg-discord-bg-hover text-sm text-discord-text placeholder-discord-text-muted focus:outline-none pr-16 ${
                replyingTo ? "rounded-b-lg rounded-t-none" : "rounded-lg"
              }`}
            />
            {newMessage.length > 1800 && (
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono ${newMessage.length >= 2000 ? "text-discord-red" : "text-discord-text-muted"}`}>
                {newMessage.length}/2000
              </span>
            )}
          </form>
        )}
      </div>
    </>
  );
}

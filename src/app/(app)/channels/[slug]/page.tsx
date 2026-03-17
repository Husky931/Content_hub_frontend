"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter } from "next/navigation";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { TaskSummaryBar } from "@/components/channel/TaskSummaryBar";
import { TaskCard } from "@/components/channel/TaskCard";
import { AppealCard } from "@/components/channel/AppealCard";
import { getSocket, joinChannel, leaveChannel, onSocketReady, WS_EVENTS } from "@/lib/realtime";
import { Spinner } from "@/components/ui/Spinner";

interface Message {
  id: string;
  content: string;
  type: "text" | "mod" | "system";
  replyToId?: string | null;
  replyCount?: number;
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
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
  myAttemptCount?: number;
  channelSlug: string;
  createdByUsername: string;
  createdByDisplayName?: string | null;
  createdAt?: string;
  myAttempt?: { id: string; status: string; deliverables: { text?: string } | null; appealStatus?: string | null } | null;
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
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

    const handleMessageEdit = (data: { id: string; content: string; updatedAt: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.id ? { ...m, content: data.content, updatedAt: data.updatedAt } : m
        )
      );
    };

    const handleMessageDelete = (data: { id: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.id ? { ...m, deletedAt: new Date().toISOString(), content: "" } : m
        )
      );
    };

    const setup = (socket: NonNullable<ReturnType<typeof getSocket>>) => {
      activeSocket = socket;
      joinChannel(slug);
      socket.on(WS_EVENTS.MESSAGE_NEW, handleNewMessage);
      socket.on(WS_EVENTS.MESSAGE_SYSTEM, handleNewMessage);
      socket.on(WS_EVENTS.MESSAGE_EDIT, handleMessageEdit);
      socket.on(WS_EVENTS.MESSAGE_DELETE, handleMessageDelete);
      socket.on(WS_EVENTS.TASK_UPDATED, handleTaskUpdate);
    };

    const unsub = onSocketReady(setup);

    return () => {
      unsub();
      leaveChannel(slug);
      if (activeSocket) {
        activeSocket.off(WS_EVENTS.MESSAGE_NEW, handleNewMessage);
        activeSocket.off(WS_EVENTS.MESSAGE_SYSTEM, handleNewMessage);
        activeSocket.off(WS_EVENTS.MESSAGE_EDIT, handleMessageEdit);
        activeSocket.off(WS_EVENTS.MESSAGE_DELETE, handleMessageDelete);
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
    setCollapsedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  const handleEditStart = useCallback((msg: Message) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingId || !editContent.trim() || editSaving) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/channels/${slug}/messages/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === editingId
              ? { ...m, content: data.message.content, updatedAt: data.message.updatedAt }
              : m
          )
        );
        setEditingId(null);
        setEditContent("");
      }
    } catch {
      // silent fail
    } finally {
      setEditSaving(false);
    }
  }, [editingId, editContent, editSaving, slug]);

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
    setEditContent("");
  }, []);

  const handleDelete = useCallback(async (msgId: string) => {
    if (deletingId) return;
    setDeletingId(msgId);
    try {
      const res = await fetch(`/api/channels/${slug}/messages/${msgId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, deletedAt: new Date().toISOString(), content: "" } : m
          )
        );
      }
    } catch {
      // silent fail
    } finally {
      setDeletingId(null);
    }
  }, [deletingId, slug]);

  // Delete permission: own message, mod can delete creator, admin can delete anyone
  const canDeleteMsg = useCallback((msg: Message) => {
    if (!user) return false;
    if (msg.user?.id === user.id) return true;
    if (user.role === "admin") return true;
    if (["mod", "supermod"].includes(user.role ?? "") && msg.user?.role === "creator") return true;
    return false;
  }, [user]);

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
  const renderMessage = (msg: Message, isReply = false) => {
    const isDeleted = !!msg.deletedAt;
    const isEditing = editingId === msg.id;
    const isOwnMessage = msg.user?.id === user?.id;

    // Deleted message placeholder
    if (isDeleted) {
      return (
        <div
          key={msg.id}
          className={`flex gap-3 py-1 px-2 rounded opacity-50 ${isReply ? "ml-6" : ""}`}
        >
          <div className={`rounded-full flex items-center justify-center bg-discord-text-muted/30 ${isReply ? "w-7 h-7" : "w-10 h-10"}`}>
            <svg className={`text-discord-text-muted ${isReply ? "w-3 h-3" : "w-4 h-4"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`italic text-discord-text-muted ${isReply ? "text-xs" : "text-sm"}`}>
              This message was deleted
            </p>
          </div>
        </div>
      );
    }

    return (
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
            {msg.updatedAt && (
              <span className="text-xs text-discord-text-muted/60 italic">(edited)</span>
            )}

            {/* Action buttons — visible on hover */}
            {msg.type !== "system" && (
              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Reply */}
                {canPost && (
                  <button
                    onClick={() => handleReply(msg)}
                    className="text-xs text-discord-text-muted hover:text-discord-accent flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-discord-accent/10"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v4M3 10l6 6M3 10l6-6" />
                    </svg>
                    Reply
                  </button>
                )}
                {/* Edit — own messages only */}
                {isOwnMessage && (
                  <button
                    onClick={() => handleEditStart(msg)}
                    className="text-xs text-discord-text-muted hover:text-yellow-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-yellow-400/10"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                )}
                {/* Delete */}
                {canDeleteMsg(msg) && (
                  <button
                    onClick={() => handleDelete(msg.id)}
                    disabled={deletingId === msg.id}
                    className="text-xs text-discord-text-muted hover:text-red-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-red-400/10 disabled:opacity-50"
                  >
                    {deletingId === msg.id ? (
                      <Spinner />
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Message content or inline edit */}
          {isEditing ? (
            <div className="mt-1">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value.slice(0, 2000))}
                maxLength={2000}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEditSave();
                  if (e.key === "Escape") handleEditCancel();
                }}
                autoFocus
                className="w-full p-1.5 bg-discord-bg-hover text-sm text-discord-text rounded border border-discord-accent focus:outline-none"
              />
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={handleEditSave}
                  disabled={editSaving || !editContent.trim()}
                  className="text-xs px-2 py-0.5 bg-discord-accent hover:bg-discord-accent/80 text-white rounded disabled:opacity-50 flex items-center gap-1"
                >
                  {editSaving && <Spinner />}
                  Save
                </button>
                <button
                  onClick={handleEditCancel}
                  className="text-xs px-2 py-0.5 text-discord-text-muted hover:text-discord-text"
                >
                  Cancel
                </button>
                <span className="text-xs text-discord-text-muted/50">
                  Esc to cancel · Enter to save
                </span>
              </div>
            </div>
          ) : (
            <p className={`text-discord-text-secondary break-words ${isReply ? "text-xs" : "text-sm"}`}>
              {msg.content}
            </p>
          )}
        </div>
      </div>
    );
  };

  // Count all descendants recursively
  const countAllReplies = (parentId: string): number => {
    const directReplies = repliesByParent[parentId] || [];
    let total = directReplies.length;
    for (const reply of directReplies) {
      total += countAllReplies(reply.id);
    }
    return total;
  };

  // Render nested replies recursively (Reddit-style tree)
  const renderReplies = (parentId: string, depth: number = 0) => {
    const replies = repliesByParent[parentId] || [];
    if (replies.length === 0) return null;

    return (
      <div className={`border-l-2 border-discord-border/40 hover:border-discord-accent/40 ${depth === 0 ? "ml-6" : "ml-4"} pl-2 mt-0.5 space-y-0.5`}>
        {replies.map((reply) => (
          <div key={reply.id}>
            {renderMessage(reply, true)}
            {renderReplies(reply.id, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  // Render thread for a top-level message — expanded by default, collapsible
  const renderThread = (parentMsg: Message) => {
    const totalReplies = countAllReplies(parentMsg.id);
    if (totalReplies === 0) return null;

    const isCollapsed = collapsedThreads.has(parentMsg.id);

    return (
      <div className="ml-6 mt-0.5">
        <button
          onClick={() => toggleThread(parentMsg.id)}
          className="flex items-center gap-1.5 text-xs text-discord-accent hover:text-discord-accent/80 transition-colors py-0.5 px-1 -ml-1 rounded hover:bg-discord-accent/10"
        >
          <span className="font-mono font-bold text-xs w-3 text-center">
            {isCollapsed ? "+" : "−"}
          </span>
          <span>
            {totalReplies} {totalReplies === 1 ? "reply" : "replies"}
          </span>
        </button>

        {!isCollapsed && renderReplies(parentMsg.id)}
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

"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserPanel } from "./UserPanel";
import { onSocketReady, WS_EVENTS } from "@/lib/realtime";

interface Channel {
  id: string;
  name: string;
  slug: string;
  type: "special" | "task" | "discussion";
  description: string | null;
  isFixed: boolean;
  requiredTagId: string | null;
  unreadCount: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const fetchChannels = useCallback(() => {
    fetch("/api/channels")
      .then((res) => res.json())
      .then((data) => setChannels(data.channels || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Mark channel as read when navigating to it
  useEffect(() => {
    const match = pathname.match(/^\/channels\/(.+)$/);
    if (!match) return;
    const activeSlug = match[1];

    // Mark as read
    fetch(`/api/channels/${activeSlug}/read`, { method: "POST" }).catch(
      () => {}
    );

    // Clear the unread count locally immediately
    setChannels((prev) =>
      prev.map((ch) =>
        ch.slug === activeSlug ? { ...ch, unreadCount: 0 } : ch
      )
    );
  }, [pathname]);

  // Listen for real-time messages to increment unread counts
  useEffect(() => {
    let activeSocket: ReturnType<typeof import("@/lib/realtime").getSocket> =
      null;

    const handleNewMessage = (msg: { channelSlug?: string }) => {
      // The WS event is broadcast to the channel room, but the sidebar
      // listens globally. We get the channelSlug from the room context.
      // Instead, we'll refetch channel unread counts periodically.
    };

    // Refetch unread counts when any message event fires (debounced)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchChannels();
      }, 2000);
    };

    const setup = (
      socket: NonNullable<
        ReturnType<typeof import("@/lib/realtime").getSocket>
      >
    ) => {
      activeSocket = socket;
      // Listen for any message events to trigger refetch
      socket.on(WS_EVENTS.MESSAGE_NEW, debouncedRefetch);
      socket.on(WS_EVENTS.MESSAGE_SYSTEM, debouncedRefetch);
    };

    const unsub = onSocketReady(setup);

    return () => {
      unsub();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (activeSocket) {
        activeSocket.off(WS_EVENTS.MESSAGE_NEW, debouncedRefetch);
        activeSocket.off(WS_EVENTS.MESSAGE_SYSTEM, debouncedRefetch);
      }
    };
  }, [fetchChannels]);

  const specialChannels = channels.filter((c) => c.type === "special");
  const taskChannels = channels.filter((c) => c.type === "task");
  const discussionChannels = channels.filter((c) => c.type === "discussion");

  const isActive = (slug: string) => pathname === `/channels/${slug}`;

  const channelIcon = (type: string) => {
    if (type === "special") return "#";
    if (type === "task") return "#";
    return "#";
  };

  const toggleCollapsed = (title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const renderChannelGroup = (title: string, items: Channel[]) => {
    if (items.length === 0) return null;
    const isCollapsed = collapsed[title];
    return (
      <div className="mb-4">
        <button
          onClick={() => toggleCollapsed(title)}
          className="w-full flex items-center gap-1 px-3 mb-1 group"
        >
          <svg
            className={`w-3 h-3 text-discord-text-muted transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-discord-text-muted group-hover:text-discord-text-secondary transition-colors">
            {title}
          </h3>
        </button>
        {!isCollapsed &&
          items.map((ch) => {
            const active = isActive(ch.slug);
            const hasUnread = !active && ch.unreadCount > 0;
            return (
              <Link
                key={ch.id}
                href={`/channels/${ch.slug}`}
                className={`flex items-center gap-2 px-3 py-1.5 mx-2 rounded text-sm transition-colors ${
                  active
                    ? "bg-discord-bg-hover text-discord-text font-medium"
                    : hasUnread
                    ? "text-discord-text font-semibold hover:bg-discord-bg-hover/50"
                    : "text-discord-text-muted hover:text-discord-text-secondary hover:bg-discord-bg-hover/50"
                }`}
              >
                <span className="text-discord-text-muted font-medium">
                  {channelIcon(ch.type)}
                </span>
                <span className="truncate">{ch.name}</span>

                {/* Unread badge */}
                {hasUnread && (
                  <span className="ml-auto min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 text-xs font-bold bg-red-500 text-white rounded-full">
                    {ch.unreadCount > 99 ? "99+" : ch.unreadCount}
                  </span>
                )}

                {/* Tag indicator (only show if no unread badge) */}
                {!hasUnread &&
                  ch.type === "task" &&
                  ch.requiredTagId && (
                    <span className="ml-auto text-xs px-1.5 py-0.5 bg-discord-accent/20 text-discord-accent rounded">
                      tag
                    </span>
                  )}
              </Link>
            );
          })}
      </div>
    );
  };

  return (
    <div className="w-60 bg-discord-sidebar flex flex-col h-full">
      {/* Server header */}
      <div className="h-12 px-4 flex items-center border-b border-discord-bg-darker shadow-sm">
        <h2 className="font-semibold text-discord-text truncate">
          Creator Hub
        </h2>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto pt-3">
        {renderChannelGroup("Special", specialChannels)}
        {renderChannelGroup("Task Channels", taskChannels)}
        {renderChannelGroup("Discussion", discussionChannels)}
      </div>

      {/* User panel */}
      <UserPanel />
    </div>
  );
}

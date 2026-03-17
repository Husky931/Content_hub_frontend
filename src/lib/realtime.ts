"use client";

import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

let socket: Socket | null = null;

// Track current channel so we can re-join after reconnect
let currentChannel: string | null = null;

// Listeners waiting for socket to become available
const readyListeners = new Set<(s: Socket) => void>();

/**
 * Connect to the WebSocket server with JWT authentication.
 * Call this once after login / on app mount.
 */
export function connectRealtime(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(WS_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.on("connect", () => {
    console.log("[ws] Connected to real-time server");
    // Re-join channel room after reconnect (server loses room state on disconnect)
    if (currentChannel) {
      socket?.emit("channel:join", currentChannel);
      console.log(`[ws] Re-joined channel:${currentChannel} after reconnect`);
    }
    // Notify any components waiting for the socket to be ready
    for (const cb of readyListeners) {
      cb(socket!);
    }
  });

  socket.on("connect_error", (err) => {
    console.warn("[ws] Connection error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("[ws] Disconnected:", reason);
  });

  return socket;
}

/**
 * Disconnect from the WebSocket server.
 */
export function disconnectRealtime() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get the current socket instance (may be null if not connected).
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Call `cb` immediately if socket is already connected, otherwise
 * queue it until the next "connect" event fires.
 * Returns an unsubscribe function.
 */
export function onSocketReady(cb: (s: Socket) => void): () => void {
  if (socket?.connected) {
    cb(socket);
  }
  readyListeners.add(cb);
  return () => {
    readyListeners.delete(cb);
  };
}

/**
 * Join a channel room to receive real-time messages.
 */
export function joinChannel(channelSlug: string) {
  currentChannel = channelSlug;
  socket?.emit("channel:join", channelSlug);
}

/**
 * Leave a channel room.
 */
export function leaveChannel(channelSlug: string) {
  if (currentChannel === channelSlug) {
    currentChannel = null;
  }
  socket?.emit("channel:leave", channelSlug);
}

// ── Event types ──

export interface RealtimeMessage {
  id: string;
  content: string;
  type: string;
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

export interface RealtimeNotification {
  type: string;
  title: string;
  unreadCount: number;
}

export interface RealtimeWalletUpdate {
  changed: boolean;
}

// ── Event names (constants) ──

export const WS_EVENTS = {
  MESSAGE_NEW: "message:new",
  MESSAGE_SYSTEM: "message:system",
  MESSAGE_EDIT: "message:edit",
  MESSAGE_DELETE: "message:delete",
  TASK_UPDATED: "task:updated",
  NOTIFICATION_NEW: "notification:new",
  WALLET_UPDATED: "wallet:updated",
} as const;

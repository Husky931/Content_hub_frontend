/**
 * Server-side utility to publish events to the WebSocket server.
 * Called from Next.js API routes to broadcast real-time events.
 *
 * The WS server exposes an internal HTTP POST /emit endpoint
 * that this utility calls to broadcast to connected clients.
 */

const WS_SERVER_URL = process.env.WS_SERVER_URL || "http://localhost:3001";
const WS_INTERNAL_API_KEY = process.env.WS_INTERNAL_API_KEY || "ws-internal-dev-key";

interface PublishParams {
  /** Room to broadcast to (e.g. "channel:general", "user:uuid") */
  room: string;
  /** Event name (e.g. "message:new", "notification:new") */
  event: string;
  /** Event payload */
  data: unknown;
}

/**
 * Publish an event to the WebSocket server for broadcasting.
 * Fails silently if WS server is unavailable (non-blocking).
 */
export async function wsPublish({room, event, data}: PublishParams): Promise<void> {
  try {
    const res = await fetch(`${WS_SERVER_URL}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": WS_INTERNAL_API_KEY
      },
      body: JSON.stringify({room, event, data}),
      signal: AbortSignal.timeout(3000) // 3s timeout — don't block API response
    });

    if (!res.ok) {
      console.warn(`[ws-publish] Failed to emit ${event} to ${room}: ${res.status}`);
    }
  } catch {
    // Fail silently — WS server might be down, don't break API routes
    console.warn(`[ws-publish] WS server unreachable for ${event} to ${room}`);
  }
}

// ── Convenience helpers ──

/** Broadcast a new message to a channel */
export function publishMessage(channelSlug: string, message: unknown) {
  return wsPublish({
    room: `channel:${channelSlug}`,
    event: "message:new",
    data: message
  });
}

/** Broadcast a system message to a channel */
export function publishSystemMessage(channelSlug: string, message: unknown) {
  return wsPublish({
    room: `channel:${channelSlug}`,
    event: "message:system",
    data: message
  });
}

/** Broadcast a task update to a channel */
export function publishTaskUpdate(channelSlug: string, task: unknown) {
  return wsPublish({
    room: `channel:${channelSlug}`,
    event: "task:updated",
    data: task
  });
}

/** Send a notification to a specific user */
export function publishNotification(userId: string, notification: unknown) {
  return wsPublish({
    room: `user:${userId}`,
    event: "notification:new",
    data: notification
  });
}

/** Send wallet update to a specific user */
export function publishWalletUpdate(userId: string, wallet: unknown) {
  return wsPublish({
    room: `user:${userId}`,
    event: "wallet:updated",
    data: wallet
  });
}

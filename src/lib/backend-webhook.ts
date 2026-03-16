/**
 * Outgoing webhook utility — sends events to the Edtech backend.
 *
 * Events:
 *   task.completed — when a task is approved and bounty awarded
 *   attempt.submitted — when a creator submits an attempt
 *
 * Fails silently if BACKEND_WEBHOOK_URL is not configured.
 */

const BACKEND_WEBHOOK_URL = process.env.BACKEND_WEBHOOK_URL;
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || "";

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

async function sendWebhook(payload: WebhookPayload): Promise<void> {
  if (!BACKEND_WEBHOOK_URL) return; // Not configured — skip silently

  try {
    const res = await fetch(BACKEND_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": BACKEND_API_KEY,
        "X-Webhook-Event": payload.event,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(`[webhook] ${payload.event} failed: ${res.status}`);
    }
  } catch {
    console.warn(`[webhook] ${payload.event} failed: backend unreachable`);
  }
}

/** Notify backend that a new attempt was submitted */
export function webhookAttemptSubmitted(data: {
  taskId: string;
  attemptId: string;
  userId: string;
  deliverables: unknown;
  // Enriched fields
  username: string;
  displayName: string | null;
  email: string;
  externalId: string | null;
  taskTitle: string;
  channelSlug: string | null;
  bountyUsd: string | null;
  bountyRmb: string | null;
  attemptNumber: number;
  maxAttempts: number;
}) {
  return sendWebhook({
    event: "attempt.submitted",
    data: {
      // Core IDs
      task_id: data.taskId,
      attempt_id: data.attemptId,
      user_id: data.userId,
      external_id: data.externalId,

      // Human-readable context
      task_title: data.taskTitle,
      channel_slug: data.channelSlug,
      username: data.username,
      display_name: data.displayName,
      email: data.email,

      // Task info
      bounty_usd: data.bountyUsd,
      bounty_rmb: data.bountyRmb,
      attempt_number: data.attemptNumber,
      max_attempts: data.maxAttempts,

      // Submission content
      deliverables: data.deliverables,
    },
    timestamp: new Date().toISOString(),
  });
}

/** Notify backend that a task was completed (approved + bounty awarded) */
export function webhookTaskCompleted(data: {
  taskId: string;
  attemptId: string;
  userId: string;
  bountyUsd: string | null;
  bountyRmb: string | null;
  // Enriched fields
  username: string;
  displayName: string | null;
  email: string;
  externalId: string | null;
  taskTitle: string;
  channelSlug: string | null;
  bonusBountyUsd: string | null;
  bonusBountyRmb: string | null;
  reviewerUsername: string;
  deliverables: unknown;
}) {
  return sendWebhook({
    event: "task.completed",
    data: {
      // Core IDs
      task_id: data.taskId,
      attempt_id: data.attemptId,
      user_id: data.userId,
      external_id: data.externalId,

      // Human-readable context
      task_title: data.taskTitle,
      channel_slug: data.channelSlug,
      username: data.username,
      display_name: data.displayName,
      email: data.email,

      // Financial
      bounty_usd: data.bountyUsd,
      bounty_rmb: data.bountyRmb,
      bonus_bounty_usd: data.bonusBountyUsd,
      bonus_bounty_rmb: data.bonusBountyRmb,

      // Review info
      reviewer_username: data.reviewerUsername,
      deliverables: data.deliverables,
    },
    timestamp: new Date().toISOString(),
  });
}

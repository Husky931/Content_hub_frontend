/**
 * Test harness for backend integration endpoints.
 *
 * Usage:
 *   pnpm tsx src/scripts/test-sync.ts [command]
 *
 * Commands:
 *   sync-task   — Push a test task via POST /api/tasks/sync
 *   automod     — Send an auto-mod review via POST /api/automod/review
 *   all         — Run all tests sequentially
 *
 * Requires:
 *   BACKEND_API_KEY set in .env (or defaults to "test-api-key")
 *   App running on localhost:3000
 */

import "dotenv/config";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const API_KEY = process.env.BACKEND_API_KEY || "test-api-key";

async function post(path: string, body: Record<string, unknown>) {
  const url = `${BASE_URL}${path}`;
  console.log(`\n→ POST ${url}`);
  console.log("  Body:", JSON.stringify(body, null, 2));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  console.log(`  Status: ${res.status}`);
  console.log("  Response:", JSON.stringify(data, null, 2));

  return {status: res.status, data};
}

// ── Test: Sync a task from backend ──
async function testSyncTask() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST: Sync Task (POST /api/tasks/sync)");
  console.log("=".repeat(60));

  // 1. Valid task sync — includes all fields matching admin UI task creation
  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + 3); // 3 days from now

  const {status, data} = await post("/api/tasks/sync", {
    channelSlug: "translate-hebrew",
    title: `[Synced] Translate Hebrew Test ${Date.now()}`,
    titleCn: `[同步] 希伯来语翻译测试 ${Date.now()}`,
    description: "Record a 30-second voice sample reading the provided script in a quiet environment.",
    descriptionCn: "在安静的环境中录制一段30秒的语音样本，朗读所提供的脚本。",
    bountyUsd: "25.00",
    bountyRmb: "180.00",
    bonusBountyUsd: "10.00",
    bonusBountyRmb: "72.00",
    maxAttempts: 3,
    deadline: deadlineDate.toISOString(),
    externalId: `ext-${Date.now()}`
  });

  if (status === 201) {
    console.log("  ✓ Task synced successfully");
    return data.task?.id;
  } else {
    console.log("  ✗ Task sync failed");
    return null;
  }
}

// ── Test: Invalid API key ──
async function testInvalidApiKey() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST: Invalid API Key");
  console.log("=".repeat(60));

  const url = `${BASE_URL}/api/tasks/sync`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "wrong-key"
    },
    body: JSON.stringify({
      channelSlug: "voice-recording",
      title: "Should fail",
      description: "Should fail"
    })
  });

  console.log(`  Status: ${res.status}`);
  if (res.status === 401) {
    console.log("  ✓ Correctly rejected with 401");
  } else {
    console.log("  ✗ Expected 401");
  }
}

// ── Test: Missing required fields ──
async function testMissingFields() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST: Missing Required Fields");
  console.log("=".repeat(60));

  const {status} = await post("/api/tasks/sync", {
    channelSlug: "voice-recording"
    // missing title and description
  });

  if (status === 400) {
    console.log("  ✓ Correctly rejected with 400");
  } else {
    console.log("  ✗ Expected 400");
  }
}

// ── Test: Invalid channel slug ──
async function testInvalidChannel() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST: Invalid Channel Slug");
  console.log("=".repeat(60));

  const {status} = await post("/api/tasks/sync", {
    channelSlug: "nonexistent-channel",
    title: "Test",
    description: "Test"
  });

  if (status === 404) {
    console.log("  ✓ Correctly rejected with 404");
  } else {
    console.log("  ✗ Expected 404");
  }
}

// ── Test: Auto-mod review ──
async function testAutomodReview(taskId?: string | null) {
  console.log("\n" + "=".repeat(60));
  console.log("TEST: Auto-Mod Review (POST /api/automod/review)");
  console.log("=".repeat(60));

  if (!taskId) {
    console.log("  ⚠ No taskId provided — skipping (need a synced task with a submitted attempt)");
    console.log("  To test: submit an attempt on a synced task, then run:");
    console.log(`    pnpm tsx src/scripts/test-sync.ts automod <taskId> <attemptId>`);
    return;
  }

  // This needs a real attemptId — placeholder
  console.log("  ⚠ Auto-mod test requires an existing attemptId.");
  console.log("  Use: pnpm tsx src/scripts/test-sync.ts automod <taskId> <attemptId>");
}

async function testAutomodWithIds(taskId: string, attemptId: string) {
  console.log("\n" + "=".repeat(60));
  console.log("TEST: Auto-Mod Reject");
  console.log("=".repeat(60));

  const {status} = await post("/api/automod/review", {
    taskId,
    attemptId,
    status: "rejected",
    reason: "Audio quality below threshold",
    confidence: 0.92
  });

  if (status === 200) {
    console.log("  ✓ Auto-mod review accepted");
  } else {
    console.log(`  ✗ Expected 200, got ${status}`);
  }
}

// ── Main ──
async function main() {
  const command = process.argv[2] || "all";

  console.log(`\nBackend Integration Test Harness`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY.slice(0, 4)}...`);
  console.log(`Command: ${command}`);

  switch (command) {
    case "sync-task": {
      await testSyncTask();
      break;
    }
    case "automod": {
      const taskId = process.argv[3];
      const attemptId = process.argv[4];
      if (taskId && attemptId) {
        await testAutomodWithIds(taskId, attemptId);
      } else {
        console.log("Usage: pnpm tsx src/scripts/test-sync.ts automod <taskId> <attemptId>");
      }
      break;
    }
    case "all": {
      const taskId = await testSyncTask();
      await testInvalidApiKey();
      await testMissingFields();
      await testInvalidChannel();
      await testAutomodReview(taskId);

      console.log("\n" + "=".repeat(60));
      console.log("DONE — All tests completed");
      console.log("=".repeat(60));
      break;
    }
    default:
      console.log(`Unknown command: ${command}`);
      console.log("Available: sync-task, automod, all");
  }
}

main().catch(console.error);

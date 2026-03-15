# P2 Manual Testing Plan — Production Integration & Real Features

## P2 Strategy

**Build order:** Channel Management → File Uploads (OSS) → WebSocket (Fly.io) → Resend Email → Backend Integration (last)

**Why backend integration last?** We build and self-test everything first using simulated webhooks. Once file uploads and real-time are working, we hand the backend team a complete, tested API spec. No back-and-forth, no spec changes mid-build.

**Self-testing approach:** Use webhook.site (or local test endpoint) as `BACKEND_WEBHOOK_URL` to capture and inspect all outgoing payloads. Use `test-sync.ts` to simulate all incoming backend calls. Full round-trip testing without the backend team.

---

## Prerequisites

### Already Set Up (from P0/P1)

- App running on localhost:3000
- Default admin: `admin@creatorhub.local` / `admin123`
- Test accounts: creator1, mod1, supermod1 (promoted via Settings > Admin > Users)
- Task and discussion channels exist from seed

### New Setup Required for P2

#### 1. Resend Email (Section 5a)

- [x] Create a free Resend account at https://resend.com
- [x] Generate an API key from Resend dashboard
- [x] Add to `.env`:

```
  RESEND_API_KEY=re_xxxxxxxxxxxx
  NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] (Optional) Verify a custom sending domain in Resend for production

#### 2. Aliyun OSS (Section 3 — File Uploads)

- [x] Create an Aliyun account and enable OSS service
- [x] Create an OSS bucket (e.g. `contenthub-uploads`)
- [x] Configure CORS on the bucket:
  - Allowed Origins: `http://localhost:3000`, `https://your-production-domain.com`
  - Allowed Methods: `GET`, `PUT`, `POST`, `HEAD`
  - Allowed Headers: `*`
  - Expose Headers: `ETag`
  - Max Age: `3600`
- [x] Create a RAM user with `AliyunOSSFullAccess` policy
- [x] Generate AccessKey ID and AccessKey Secret
- [x] Add to `.env`:

```
  OSS_REGION=oss-cn-beijing
  OSS_BUCKET=contenthub-uploads
  OSS_ACCESS_KEY_ID=your-access-key-id
  OSS_ACCESS_KEY_SECRET=your-access-key-secret
  OSS_ENDPOINT=https://oss-cn-beijing.aliyuncs.com
```

#### 3. Backend Integration (Section 4) — Self-Test First, Real Integration Last

- [x] Go to https://webhook.site — copy your unique URL
- [x] Add to `.env`:

#### 4. WebSocket / Real-Time (Section 5) — Socket.io on Fly.io

- [x] Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
- [x] Create Fly.io account at https://fly.io
- [x] From `ws-server/` directory: `fly launch` (choose "Launch from your machine", Singapore)
- [x] Set secrets on Fly.io:

```
  fly secrets set JWT_SECRET=<same-jwt-secret-as-frontend>
  fly secrets set WS_INTERNAL_API_KEY=<generate-random-key>
  fly secrets set ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app
```

- [x] Deploy: `fly deploy`
- [x] Add to frontend `.env`:

```
  NEXT_PUBLIC_WS_URL=wss://contenthub-ws.fly.dev
  WS_SERVER_URL=https://contenthub-ws.fly.dev
  WS_INTERNAL_API_KEY=<same-key-as-fly-secret>
```

- [x] For local dev, run `pnpm dev` in `ws-server/` (uses localhost:3001)

**Note:** The WS server is a separate deployment from the Next.js app. It stays on Fly.io even when the frontend moves to Vercel/Aliyun. They communicate via HTTP (server-to-server) and WebSocket (browser-to-server).

---

## 1. Channel Management

### 1.1 View Existing Channels

- [x] 1.1.1 Open Settings Modal > Admin > Channels
- [x] 1.1.2 All channels displayed in a list grouped by type (special, task, discussion)
- [x] 1.1.3 Each channel shows: name, type badge, description, required tag (if task), mod count
- [x] 1.1.4 Fixed/seeded channels show a lock icon
- [x] 1.1.5 Non-fixed channels show edit and delete buttons

### 1.2 Edit Channel

- [x] 1.2.1 Click edit on a non-fixed channel → inline edit form expands
- [x] 1.2.2 Can edit: name, nameCn, description, descriptionCn
- [x] 1.2.3 Task channels: can change required tag
- [x] 1.2.4 Save → channel updates, success message shown
- [x] 1.2.5 Cancel → form collapses, no changes saved
- [x] 1.2.6 Fixed channels: edit button disabled or not shown
- [x] 1.2.7 After edit, sidebar reflects the updated channel name immediately (on refresh)

### 1.3 Delete Channel

- [x] 1.3.1 Click delete on a non-fixed channel → confirmation dialog appears
- [x] 1.3.2 Confirm → channel deleted, removed from list
- [x] 1.3.3 Cancel → no action
- [x] 1.3.4 Fixed channels: delete button disabled or not shown
- [x] 1.3.5 Deleting a channel with messages/tasks — confirm it cascades or shows warning
- [x] 1.3.6 After delete, sidebar no longer shows the channel (on refresh)

### 1.4 Manage Mods & Supermods

- [x] 1.4.1 Each channel in the list shows current assigned mods/supermods
- [x] 1.4.2 Click to expand mod management → shows checkboxes for all mod/supermod/admin users
- [x] 1.4.3 Check/uncheck users → save → mod assignments updated
- [x] 1.4.4 Newly assigned mod can now see the channel in their sidebar
- [x] 1.4.5 Removed mod loses access to the channel (if task channel they don't have the tag for)

### 1.5 Remove Users from Channel

- [x] 1.5.1 Channel detail shows list of users who have access
- [x] 1.5.2 Admin can click remove next to a user → user removed from channel
- [x] 1.5.3 Removed user no longer sees the channel in sidebar (on refresh)

---

## 2. Focused UI Improvements

### 2.1 Task Creation — Attachments, Checklist, Markdown

- [x] 2.1.1 Settings > Admin > Tasks > Create Task — form opens
- [x] 2.1.2 Description (EN) has "Preview" toggle — click shows rendered text, click "Edit" returns to textarea
- [x] 2.1.3 Description (CN) also has "Preview" toggle
- [x] 2.1.4 **Attachments** drag-and-drop zone appears below descriptions — labeled "reference files, scripts, examples"
- [x] 2.1.5 Can drag a file into the zone or click to browse — file uploads to OSS (or local fallback)
- [x] 2.1.6 Upload progress bar shows during upload
- [x] 2.1.7 Uploaded file appears in list with name, size, and remove (✕) button
- [x] 2.1.8 Can upload multiple attachments (up to 10)
- [x] 2.1.9 **Review Checklist** section appears — text input + "+ Add" button
- [x] 2.1.10 Type a checklist item and press Enter or click Add — item appears in list with ✓ icon
- [x] 2.1.11 Can remove checklist items with ✕ button
- [x] 2.1.12 Create a task with attachments + checklist items → task saves successfully
- [x] 2.1.13 Verify in DB: task record has `checklist` and `attachments` JSONB fields populated

### 2.2 Task Submission — File Uploads + Checklist Guidance

- [x] 2.2.1 Open a task channel → click "Submit Attempt" on an active task
- [ ] 2.2.2 If task has **reference attachments**, they appear as download links at top of submit form
- [x] 2.2.3 If task has a **checklist**, it appears as read-only guidance with ✓ icons
- [x] 2.2.4 File upload zone (drag-and-drop + click) appears labeled "Upload your deliverables"
- [x] 2.2.5 Can upload image files (jpg, png) — shows thumbnail preview in file list
- [x] 2.2.6 Can upload audio files (mp3, wav) — shows inline audio player
- [x] 2.2.7 Can upload video files (mp4) — shows inline video player
- [x] 2.2.8 Can upload multiple files at once
- [x] 2.2.9 Upload progress bar shows per file
- [x] 2.2.10 Can remove a file before submission using ✕ button
- [x] 2.2.11 Text notes field remains available alongside file uploads ("Notes for reviewer")
- [x] 2.2.12 Can submit with **only files** (no text) — works
- [x] 2.2.13 Can submit with **only text** (no files) — works
- [x] 2.2.14 Can submit with **both files and text** — works
- [x] 2.2.15 After submission, the "Submitted" view shows uploaded files with FilePreviewList
- [x] 2.2.16 Click "Edit" on submitted attempt — file upload zone + text field pre-populated with existing data
- [x] 2.2.17 Can add/remove files during edit, then "Save Changes"

### 2.3 Review Page — Checklist + File Previews

- [x] 2.3.1 Open Review page → select a task with submitted attempts
- [x] 2.3.2 If task has **reference attachments**, they appear as download links above deliverables
- [x] 2.3.3 **Deliverables** section shows submitted text (if any) in a formatted block
- [x] 2.3.4 Submitted **image files** show inline image preview + download button
- [x] 2.3.5 Submitted **audio files** show inline audio player + download button
- [x] 2.3.6 Submitted **video files** show inline video player + download button
- [x] 2.3.7 If task has a **checklist**, "Review Checklist" section appears with interactive checkboxes
- [x] 2.3.8 All checklist items start **checked** (passing)
- [x] 2.3.9 Uncheck a checklist item → it shows as red strikethrough text
- [x] 2.3.10 A red "FAILED ITEMS" warning box appears listing all unchecked items
- [x] 2.3.11 With any checklist item unchecked → **Approve button is blocked** (disabled, shows "Approve (blocked)")
- [x] 2.3.12 Re-check all items → Approve button becomes enabled again
- [x] 2.3.13 Reject still works normally regardless of checklist state
- [x] 2.3.14 Tasks without a checklist — Approve works normally (no checklist section shown)

## 3. File Upload Deliverables (Aliyun OSS)

### 3.1 OSS Integration

- [x] 3.1.1 `POST /api/upload/presign` with valid fileName/contentType/fileSize → returns `{ presignedUrl, objectKey, publicUrl }`
- [x] 3.1.2 PUT to presignedUrl with file body succeeds (file appears in OSS bucket under `task-attachments/` or `deliverables/`)
- [x] 3.1.3 File metadata stored in task/attempt JSONB fields (url, type, size, name)
- [x] 3.1.4 Invalid file type → 400 error "File type not allowed"
- [x] 3.1.5 Oversized file → 400 error "File exceeds maximum size"
- [x] 3.1.6 Unauthenticated request → 401
- [x] 3.1.7 If OSS env vars are missing → `POST /api/upload/presign` returns 503 "File storage is not configured"
- [x] 3.1.8 **Local fallback**: when OSS not configured, `POST /api/upload/local` accepts FormData upload → stores in `public/uploads/`
- [x] 3.1.9 FileUpload component automatically tries OSS first, falls back to local

### 3.2 Multi-File Upload UI (already covered in 2.2, cross-check)

- [x] 3.2.1 Drag-and-drop works in both task creation (attachments) and attempt submission (deliverables)
- [x] 3.2.2 Progress bars appear during OSS upload (XHR-based, percentage shown)
- [x] 3.2.3 Multiple files queued simultaneously — all upload in parallel
- [x] 3.2.4 File size validation client-side (before upload attempt)
- [x] 3.2.5 Slots remaining counter updates as files are added ("X slots remaining")

### 3.3 Asset Privacy / IDOR Protection

- [x] 3.3.1 Creator who submitted can view their own files (signed URL works)
- [x] 3.3.2 Mod/supermod/admin can view any attempt's files
- [x] 3.3.3 Other creators CANNOT view someone else's files → 403
- [x] 3.3.4 Direct OSS URL does NOT work (must go through signed URL endpoint)
- [x] 3.3.5 Signed URL expires after 1 hour — old links stop working

---

## 4. WebSocket Real-Time Updates

### 4.0 Setup & Startup (Local)

1. Start WS server (Terminal 1):
2. Start frontend (Terminal 2):
3. Verify WS server is running:

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","connections":0}
```

4. Open browser console on localhost:3000 — after login you should see:

```
[ws] Connected to real-time server
```

- [x] 4.0.1 WS server starts on port 3001 with `pnpm dev` — console shows `[ws] WebSocket server running on port 3001`
- [x] 4.0.2 `GET http://localhost:3001/health` returns `{"status":"ok","connections":0}`
- [x] 4.0.3 After logging in to the app, browser console shows `[ws] Connected to real-time server`
- [x] 4.0.4 WS server console shows `[ws] Connected: <userId> (<role>)`
- [x] 4.0.5 Navigate to a channel → WS server console shows `[ws] <userId> joined channel:<slug>`

### 4.1 Real-Time Channel Messages (Local)

**Setup:** Open the same channel in two browser tabs logged in as different users (e.g. Tab A = admin, Tab B = creator1).

- [x] 4.1.1 Tab A: send a message → appears instantly in Tab B without refresh
- [x] 4.1.2 Tab B: send a reply → appears instantly in Tab A without refresh
- [x] 4.1.3 Messages are deduplicated — sender sees their own message only once (optimistic append + WS dedup)
- [x] 4.1.4 Open WS server console (local) — confirm `[ws] <userId> joined channel:<slug>` logs for both users

### 4.2 Real-Time System Messages (Local)

**Setup:** Tab A = admin/mod (will perform actions), Tab B = creator (watching channel feed). Open 3-4 browser tabs with different users in the same channel.

- [x] 4.2.1 Admin creates a new task in the channel → system message "New task: [Title]" appears in ALL other tabs in real-time
- [x] 4.2.2 Creator submits an attempt → system message appears in ALL other tabs in real-time
- [x] 4.2.3 Mod approves an attempt → approval system message appears in ALL tabs in that channel in real-time
- [⭕] 4.2.4 Mod rejects an attempt → rejection system message appears only to the submitter in real-time (notification only) - NOT WORKING, NEEDS TO BE FIXED

### 4.3 Real-Time Task Card Updates (Local)

**Setup:** Same multi-tab setup. Watch the task cards in the channel feed.

- [x] 4.3.1 Admin creates a task → task card appears in all other tabs without refresh
- [x] 4.3.2 Creator submits an attempt → attempt count on task card updates in all tabs without refresh (e.g. "1/5 attempts" → "2/5 attempts")
- [x] 4.3.3 Mod approves an attempt → task card status updates to "approved" in all tabs without refresh
- [x] 4.3.4 Mod rejects an attempt → task card refreshes in all tabs (attempt status updated)
- [x] 4.3.5 Create a second task → task card appears in all tabs without refresh (verify consistency after first task)

### 4.4 Real-Time Notifications — Bell Badge (Local)

**Setup:** Tab A = mod (performing review), Tab B = creator (watching their bell icon in navbar), Tab C = another mod (watching their bell icon).

- [x] 4.4.1 Creator submits an attempt → mod's bell badge count increments in Tab A and Tab C without refresh
- [x] 4.4.2 Mod approves creator's attempt → creator's bell badge count increments in Tab B without refresh
- [x] 4.4.3 Mod rejects creator's attempt → creator's bell badge count increments in Tab B without refresh
- [x] 4.4.4 Bell icon turns red/shows count badge when new notification arrives

### 4.5 Real-Time Page Updates (Local)

- [x] 4.5.1 Open Review page in mod's tab → creator submits attempt → review queue updates without refresh
- [x] 4.5.2 Open Notifications page → trigger an action (e.g. approve/reject) → new notification appears without refresh
- [x] 4.5.3 TaskSummaryBar (top of channel) updates counts when task is created/approved
- [x] 4.5.4 System messages show correct timestamps (not "Invalid Date")

### 4.6 Real-Time Wallet Balance (Local)

- [x] 4.6.1 Mod approves an attempt with bounty → creator's wallet balance in navbar updates without refresh
- [x] 4.6.2 Verify the updated balance matches the expected bounty amount

### 4.7 Reconnection & Resilience (Local)

- [x] 4.7.1 Stop the WS server → app still works normally (messages save to DB, just no real-time push)
- [x] 4.7.2 Next.js API logs show no errors (publishes fail silently)
- [x] 4.7.3 Restart the WS server → client auto-reconnects (browser console: `[ws] Connected to real-time server` again)
- [x] 4.7.4 After reconnect, send a message in another tab → first tab receives it (channel room re-joined automatically)
- [x] 4.7.5 Refresh the page → WS reconnects, rejoins channel room
- [x] 4.7.6 Log out → WS disconnects (WS server console: `[ws] Disconnected: <userId>`)
- [x] 4.7.7 Log back in → WS reconnects with new token

### 4.8 Deployed Verification (Fly.io)

Switch to deployed WS server and repeat key tests.

1. Set in `frontend/.env`:

```
NEXT_PUBLIC_WS_URL=wss://contenthub-ws.fly.dev
WS_SERVER_URL=https://contenthub-ws.fly.dev
WS_INTERNAL_API_KEY=<same key set in Fly.io secrets>
```

2. Ensure Fly.io secrets match (`fly secrets list -a contenthub-ws`).
3. Restart frontend.

- [ ] 4.8.1 `GET https://contenthub-ws.fly.dev/health` returns `{"status":"ok",...}`
- [ ] 4.8.2 After logging in, browser console shows `[ws] Connected to real-time server` (connecting to Fly.io)
- [ ] 4.8.3 If JWT_SECRET mismatch → browser console shows `[ws] Connection error: Invalid token`
- [ ] 4.8.4 Repeat 4.1–4.3 key tests — messages, system messages, task card updates via Fly.io
- [ ] 4.8.5 Repeat 4.4–4.6 — notifications, page updates, wallet via Fly.io
- [ ] 4.8.6 Repeat 4.7.3–4.7.4 — reconnection + auto-rejoin works via Fly.io

---

## 5. Edtech Backend Integration (Self-Test with Simulated Webhooks)

> **Strategy:** Test everything yourself first using webhook.site + test-sync.ts. No backend team needed until you're ready to hand off the spec.

### 5.0 Self-Test Setup

- [x] 5.0.1 Go to https://webhook.site — copy your unique URL
- [x] 5.0.2 Set `BACKEND_WEBHOOK_URL=https://webhook.site/your-id` in `.env`
- [x] 5.0.3 Set `BACKEND_API_KEY=test-api-key-for-self-testing` in `.env`
- [x] 5.0.4 Restart the dev server

### 4.1 Task Sync — Simulate Backend Pushing Tasks (Incoming)

- [ ] 5.1.1 Run: `pnpm tsx src/scripts/test-sync.ts sync-task` — task appears in target channel
- [ ] 5.1.2 Task card shows in channel feed with correct title, description, bounty
- [ ] 5.1.3 System message posted: "New task synced: [Title]"
- [ ] 5.1.4 Task has `source: 'backend'` flag
- [ ] 5.1.5 Run with invalid API key → 401 rejected
- [ ] 5.1.6 Run with missing required fields → 400 with error message
- [ ] 5.1.7 Run with invalid channelSlug → 404

### 5.2 Full Round-Trip Test (the key scenario)

- [ ] 5.2.1 Sync a task via test-sync.ts (simulates backend pushing a voiceover job)
- [ ] 5.2.2 Log in as creator → submit an attempt on the synced task
- [ ] 5.2.3 Check webhook.site → `attempt.submitted` event received with correct payload
- [ ] 5.2.4 Run: `pnpm tsx src/scripts/test-sync.ts automod [taskId] [attemptId]` with `status: "rejected"` → attempt rejected, creator notified
- [ ] 5.2.5 Creator submits new attempt → second `attempt.submitted` on webhook.site
- [ ] 5.2.6 Run automod with `status: "approved"` → system message "Auto-check: approved" but attempt stays "submitted" (pending human review)
- [ ] 5.2.7 Log in as mod → approve the attempt
- [ ] 5.2.8 Check webhook.site → `task.completed` event received with taskId, userId, bounty
- [ ] 5.2.9 Creator's wallet updated, all other attempts auto-rejected

### 5.3 Outgoing Webhook Payload Verification (on webhook.site)

- [ ] 5.3.1 `attempt.submitted` payload contains: task_id, attempt_id, user_id, deliverables, timestamp
- [ ] 5.3.2 `attempt.submitted` headers contain: `X-Webhook-Event: attempt.submitted`, `X-API-Key`
- [ ] 5.3.3 `task.completed` payload contains: task_id, user_id, bounty_usd, bounty_rmb, attempt_id, timestamp
- [ ] 5.3.4 `task.completed` headers contain: `X-Webhook-Event: task.completed`, `X-API-Key`
- [ ] 5.3.5 Unset `BACKEND_WEBHOOK_URL` → webhooks skipped silently (no errors in logs)

### 5.4 Auto-Mod Review — Simulate Backend QA (Incoming)

- [ ] 5.4.1 Auto-reject: system message "Auto-check: rejected — [reason]"
- [ ] 5.4.2 Auto-approve: system message "Auto-check: approved (confidence: X%)" — attempt stays "submitted"
- [ ] 5.4.3 Invalid task/attempt ID → 404
- [ ] 5.4.4 Invalid API key → 401

### 5.5 Tag/Label Sync

- [ ] 5.5.1 Backend calls `POST /api/users/tags` → tag assigned, channel access granted
- [ ] 5.5.2 Admin assigns tag in hub → outgoing webhook notifies backend (check webhook.site)
- [ ] 5.5.3 Invalid user/tag → appropriate error response

### 5.6 Handoff to Backend Team (after all self-tests pass)

- [ ] 5.6.1 Prepare API spec doc with exact endpoints, payloads, headers, auth
- [ ] 5.6.2 Include webhook.site screenshots as payload examples
- [ ] 5.6.3 Share with backend team — ask for: (1) their webhook receiver URL, (2) agreed API key, (3) auto-QA plans
- [ ] 5.6.4 Replace webhook.site URL with real backend URL
- [ ] 5.6.5 Re-run round-trip test with real backend

---

## 6. Auth & Deployment

### 6a. Production Email (Resend)

- [ ] 6a.1 Sign up with a new account → verification email arrives in inbox (not console)
- [ ] 6a.2 Email contains correct verify link with `NEXT_PUBLIC_APP_URL` as base
- [ ] 6a.3 Click verify link → account verified, redirected to onboarding
- [ ] 6a.4 If `RESEND_API_KEY` not set → clear error in logs (not silent failure)

### 6b. Deployment

- [ ] 6b.1 `.env.example` exists with all variables documented
- [ ] 6b.2 `pnpm build` succeeds without errors
- [ ] 6b.3 Favicon shows "Content Creator Hub" branding (not Next.js default)
- [ ] 6b.4 Browser tab title shows "Content Creator Hub"
- [ ] 6b.5 Deploy to Vercel
- [ ] Update Aliyun OSS CORS to include your Vercel URL
- [ ] 6b.6 All features work on deployed version (not just localhost)

### 6c. Seed Script

- [ ] 6c.1 `pnpm db:seed` runs successfully
- [ ] 6c.2 Running seed twice → no errors (idempotent)
- [ ] 6c.3 `pnpm db:push` pushes schema changes

---

#### Post Testing:

- [ ] Self-test the full round-trip (see Section 4)
- [ ] After all self-tests pass: prepare API spec doc for backend team
- [ ] Backend team call: share spec, get their real webhook URL, agree on shared API key
- [ ] Replace `BACKEND_WEBHOOK_URL` with real backend URL

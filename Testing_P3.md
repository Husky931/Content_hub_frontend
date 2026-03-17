# P3 Manual Testing Plan

#### 1. Schema Migration (Sections 1–4)

After implementing each feature, run:

```bash
pnpm drizzle-kit push
```

New tables/columns added:

- `messages.reply_to_id` — nullable FK to messages (Section 1)
- `channel_reads` table — userId + channelId + lastReadMessageId (Section 2)
- `users.language` — 'en' or 'zh' preference (Section 3)

#### 2. i18n Library (Section 3)

```bash
pnpm add next-intl
```

---

## 1. Reply Messages (Inline Threads)

### 1.2 Reply UI — Initiating a Reply

- [x] 1.2.1 Hover over any message → "Reply" button appears in message action bar
- [x] 1.2.2 Click Reply → reply preview bar appears above the message input (shows author name + first ~60 chars of original)
- [x] 1.2.3 Reply preview bar has ✕ button to cancel reply
- [x] 1.2.4 Can reply to own messages
- [x] 1.2.5 Can not reply to system messages
- [x] 1.2.6 Reply preview bar persists while typing (doesn't disappear on focus change)

### 1.3 Reply UI — Display in Feed (Reddit-Style +/−)

- [x] 1.3.1 Reply messages are **not shown** in the main feed by default — only top-level messages appear
- [x] 1.3.2 Messages that have replies show **[+] X replies** below the message (collapsed state)
- [x] 1.3.3 Click [+] → replies expand inline below the parent, indented slightly with a left border
- [x] 1.3.4 Toggle changes to **[−]** when expanded
- [x] 1.3.5 Click [−] → replies collapse back, main feed is clean again
- [x] 1.3.6 Expanded replies show in chronological order
- [x] 1.3.7 Each reply shows author name + avatar + content (same style as regular messages, just indented)
- [ ] 1.3.8 If original parent message was deleted → replies still accessible (orphaned replies show "Original message was deleted")

### 1.4 Reply Messages — Real-Time

- [x] 1.4.1 Tab A sends a reply → Tab B sees the reply count increment on the parent's badge in real-time
- [x] 1.4.2 If Tab B has replies expanded → new reply appears inline in real-time
- [x] 1.4.3 If Tab B has replies collapsed → count updates without expanding

---

## 2. Channel Unread Indicator (Bold Text)

### 2.1 Sidebar Bold Display

- [x] 2.1.1 Channels with unread messages appear **bold + white text** in the sidebar
- [x] 2.1.2 Channels with no unread messages appear in muted/grey text (normal weight)
- [x] 2.1.3 Currently active channel never shows as unread (you're reading it)
- [x] 2.1.4 No badge/count shown — bold text only (Discord-style)

### 2.2 Mark-Read Behavior

- [x] 2.2.1 Navigate to a channel → bold clears immediately (channel goes muted)
- [x] 2.2.2 Navigate away → new messages in that channel make it bold again
- [x] 2.2.3 First time visiting a channel (no read record) → not bold (don't show unread on first visit)
- [x] 2.2.4 Multiple channels with unread → each shows bold independently

### 2.3 Unread Updates

- [x] 2.3.1 Log out, other users send messages, log back in → channel shows bold
- [x] 2.3.2 Tab back into the app (window focus) → unread states refresh automatically
- [x] 2.3.3 System messages (task published, attempt submitted) also mark channel as unread

---

## 4. Appeals System

### 4.1 Filing an Appeal (Creator)

- [x] 4.1.1 When a creator's attempt is **rejected**, an "Appeal" button appears on the attempt
- [x] 4.1.2 Click Appeal → modal/form opens asking for appeal reason (text, required, min 20 chars)
- [x] 4.1.3 Submit appeal → `POST /api/appeals` creates record with status "pending"
- [x] 4.1.4 Success message: "Appeal filed. A moderator will review it."
- [x] 4.1.5 Appeal button replaced with "Appeal Pending" badge (disabled) after filing
- [x] 4.1.6 Creator can file **only one appeal** per rejected attempt
- [x] 4.1.7 If attempt is not rejected → Appeal button not shown

### 4.2 Appeal Queue — #appeals Channel (Mod/Supermod/Admin)

- [x] 4.2.1 #appeals channel shows appeal cards (not regular messages) — each card is a pending appeal
- [x] 4.2.2 Filing an appeal posts an appeal card to #appeals: task title, creator name, filed date, reason preview
- [x] 4.2.3 Filing an appeal triggers an **unread badge** on #appeals for all mods/supermods/admins
- [x] 4.2.4 Click "Review" on an appeal card → expands inline to show: original task details, rejection reason, creator's appeal reason
- [x] 4.2.5 Expanded review shows: the submission (deliverables with file previews — images, audio, video)
- [x] 4.2.6 Arbitration notes textarea for the reviewer
- [x] 4.2.7 Two action buttons: "Uphold Appeal" (green) and "Deny Appeal" (red)
- [x] 4.2.8 Creators can see their own appeals in #appeals (read-only, no action buttons) — cannot see other creators' appeals

### 4.3 Resolving an Appeal

- [x] 4.3.1 **Uphold Appeal** → attempt status changes from "rejected" back to "submitted" (re-enters review queue)
- [x] 4.3.2 Upheld appeal → task status returns to "active" if it was moved past active
- [x] 4.3.3 Upheld appeal → system message in the **task's original channel**: "Appeal upheld for [creator] on [task] — re-submitted for review"
- [x] 4.3.4 Upheld appeal → notification sent to creator: "Your appeal was upheld"
- [x] 4.3.5 **Deny Appeal** → appeal status set to "denied", attempt stays rejected
- [x] 4.3.6 Denied appeal → notification sent to creator: "Your appeal was denied"

---

## 5. 48-Hour Lock Mechanism

### 5.1 Locking a Task (Mod Action)

- [x] 5.1.1 In review, mod sees a near-perfect attempt → "Lock for Revision" button appears alongside Approve/Reject
- [x] 5.1.2 Click Lock → confirmation dialog: "Lock task for [creator] for 48h exclusive revision?"
- [x] 5.1.3 Confirm → task status changes from ACTIVE → LOCKED
- [x] 5.1.4 `lockedById` set to the creator's userId, `lockExpiresAt` set to now + 48 hours
- [x] 5.1.5 System message in channel: "Task locked for [creator] — 48h exclusive revision"
- [x] 5.1.6 Notification sent to locked creator: "You have 48h to revise your submission for [task]"
- [x] 5.1.7 Other creators see task card as "LOCKED" with orange lock icon

### 5.2 Locked Task Behavior

- [x] 5.2.1 Locked creator can submit revision attempts (new deliverables)
- [x] 5.2.2 Revision attempts do NOT count against maxAttempts
- [x] 5.2.3 Other creators CANNOT submit attempts → shows "Task locked for revision" message
- [x] 5.2.4 Task card shows orange "LOCKED" badge + countdown timer (hours:minutes remaining)
- [x] 5.2.5 Timer updates in real-time (every minute refresh or JS countdown)

### 5.3 Lock Resolution

- [x] 5.3.1 Creator submits revision → mod reviews → can Approve (LOCKED → APPROVED) or Reject
- [x] 5.3.2 If mod rejects during lock → task stays LOCKED, creator can try again (within 48h)
- [x] 5.3.3 Lock expires (48h passes) → next task query auto-transitions LOCKED → ACTIVE
- [x] 5.3.4 After auto-unlock: task open for everyone again, system message: "Lock expired — task reopened"
- [x] 5.3.5 Mod can manually unlock early → LOCKED → ACTIVE, system message: "Task unlocked by [mod]"

### 5.4 Lock Expiry Check (Lazy Evaluation)

- [x] 5.4.1 `GET /api/tasks` checks any LOCKED tasks where `lockExpiresAt < now()` → auto-updates to ACTIVE
- [x] 5.4.2 Channel page load also triggers the lazy check
- [x] 5.4.3 No cron job needed — expiry resolved on next read
- [x] 5.4.4 After auto-unlock, lockedById and lockExpiresAt are cleared

---

## 6. Task Templates

### 6.1 Template Management (Admin/Supermod/Mod)

- [x] 6.1.1 Settings Modal > Admin > "Task Templates" section (separate menu item below Tasks)
- [x] 6.1.2 List view shows all templates with name, nameCn, category icon, bounty badges, checklist count
- [x] 6.1.3 "+" Create Template" button opens template builder form
- [x] 6.1.4 Template fields: name, nameCn, category (audio/video/image), description (EN), description (CN)
- [x] 6.1.5 Bounty fields: bountyUsd, bountyRmb, bonusBountyUsd, bonusBountyRmb
- [x] 6.1.6 Max attempts field (default 5)
- [x] 6.1.7 Review checklist builder (add/remove items, same UX as task creation)
- [x] 6.1.8 Save template → stored in `task_templates` table
- [x] 6.1.9 Edit existing template (inline edit form with all fields)
- [x] 6.1.10 Delete template with confirmation spinner
- [x] 6.1.11 3 default templates auto-seeded on first load (Audio, Video, Image) with predefined values

### 6.2 Using Templates in Task Creation

- [x] 6.2.1 Each template card has "Use Template" button
- [x] 6.2.2 Click "Use Template" → navigates to Tasks section, opens Create Task form pre-filled with: description (EN/CN), bounties (USD/RMB), bonus (USD/RMB), max attempts, review checklist
- [x] 6.2.3 Admin can still edit all pre-filled fields before publishing (title, channel, deadline, attachments still need to be set)
- [x] 6.2.4 "Use Template" works reliably on repeated clicks (navTick mechanism)
- [x] 6.2.5 Creating a task without a template still works as before

### 6.3 Template API

- [x] 6.3.1 `GET /api/templates` — list all templates (admin/supermod/mod)
- [x] 6.3.2 `POST /api/templates` — create template (admin/supermod only)
- [x] 6.3.3 `PATCH /api/templates/[id]` — update template (admin/supermod only)
- [x] 6.3.4 `DELETE /api/templates/[id]` — delete template (admin/supermod only)
- [x] 6.3.5 `POST /api/templates/seed` — auto-seed 3 default templates (admin only)
- [x] 6.3.6 Non-admin/supermod → 403 on create/update/delete

---

## 3. Internationalization (i18n)

### 3.1 Language Toggle & Preference

- [ ] 3.1.1 User dropdown (top-right) shows language toggle: EN / 中文
- [ ] 3.1.2 Clicking toggles the entire UI language immediately
- [ ] 3.1.3 Language preference saved to user record (`users.language` field, default 'en')
- [ ] 3.1.4 On login, UI loads in user's saved language
- [ ] 3.1.5 New users default to English

### 3.2 UI String Translation

- [ ] 3.2.1 Sidebar labels translated (Channels, Task Channels, Discussion, Settings, etc.)
- [ ] 3.2.2 Navbar elements translated (Notifications, Financials, Wallet, etc.)
- [ ] 3.2.3 Settings modal tabs and labels translated
- [ ] 3.2.4 Task-related UI translated (Submit Attempt, Approve, Reject, Review, etc.)
- [ ] 3.2.5 Onboarding flow translated (Welcome, Currency Selection, Profile Setup)
- [ ] 3.2.6 Error messages translated ("Invalid credentials", "File too large", etc.)
- [ ] 3.2.7 Empty states translated ("No messages yet", "No tasks available", etc.)
- [ ] 3.2.8 System messages translated ("New task published", "Attempt approved", etc.)

### 3.3 Content Localization (Existing CN Fields)

- [ ] 3.3.1 When language = 中文: channel names show `nameCn` (fallback to `name` if CN empty)
- [ ] 3.3.2 When language = 中文: channel descriptions show `descriptionCn`
- [ ] 3.3.3 When language = 中文: task titles show `titleCn` (fallback to `title`)
- [ ] 3.3.4 When language = 中文: task descriptions show `descriptionCn`
- [ ] 3.3.5 When language = 中文: tag names show `nameCn`
- [ ] 3.3.6 When language = EN: all fields show English versions (current behavior)

### 3.4 Currency Display

- [ ] 3.4.1 Creator sees bounty in their selected currency (already works from P1)
- [ ] 3.4.2 Currency symbol matches: $ for USD, ¥ for RMB
- [ ] 3.4.3 Financials page shows amounts in user's currency

---

## 7. Training Modules (last)

### 7.1 Training Module Management

- [ ] 7.1.1 Settings Modal > Admin > Training section
- [ ] 7.1.2 Create training module: name, nameCn, description, target tag (tag earned on completion)
- [ ] 7.1.3 Add sections to module: content sections (markdown text) + quiz sections (multiple choice)
- [ ] 7.1.4 Quiz sections: question, options (2-4), correct answer, explanation
- [ ] 7.1.5 Set passing score (e.g., 80%)
- [ ] 7.1.6 Save module → stored in `training_modules` + `training_sections` tables
- [ ] 7.1.7 Publish module → visible to creators who don't have the target tag

### 7.2 Taking Training (Creator)

- [ ] 7.2.1 #beginner-training channel shows available training modules
- [ ] 7.2.2 Creator clicks "Start Training" → enters training flow
- [ ] 7.2.3 Content sections render markdown (read-only learning material)
- [ ] 7.2.4 Quiz sections show questions with radio button options
- [ ] 7.2.5 Submit quiz → scored immediately → pass/fail shown
- [ ] 7.2.6 Pass → proficiency tag automatically granted to user
- [ ] 7.2.7 Pass → new channels unlocked (channels gated by that tag now visible in sidebar)
- [ ] 7.2.8 Fail → "Training failed" message, module locked (no retry)
- [ ] 7.2.9 System message in #beginner-training: "[creator] completed [module] training"

### 7.3 Training API

- [ ] 7.3.1 `GET /api/training` — list available modules (creator: unfinished only, admin: all)
- [ ] 7.3.2 `GET /api/training/[id]` — get module with sections
- [ ] 7.3.3 `POST /api/training/[id]/submit` — submit quiz answers, returns score + pass/fail
- [ ] 7.3.4 `POST /api/training` — create module (admin/supermod)
- [ ] 7.3.5 `PATCH /api/training/[id]` — update module
- [ ] 7.3.6 `DELETE /api/training/[id]` — delete module

### 7.4 Training Schema

- [ ] 7.4.1 `training_modules` table: id, name, nameCn, description, descriptionCn, targetTagId, passingScore, status (draft/published), createdById, createdAt
- [ ] 7.4.2 `training_sections` table: id, moduleId, type (content/quiz), title, body (markdown or question json), sortOrder
- [ ] 7.4.3 `training_results` table: id, moduleId, userId, score, passed, completedAt

---

## 8. Final P3 Polish

- [ ] 8.1 App initial load shows branded loading screen (not white flash)
- [ ] 8.2 All forms show consistent error messages on failure
- [ ] 8.3 All action buttons use Spinner during loading (per UI rules)
- [ ] 8.4 Browser tab title shows "Content Creator Hub"
- [ ] 8.5 No console errors in normal usage flow

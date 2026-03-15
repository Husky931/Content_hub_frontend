# Content Creator Hub — Project Memory

> This file is the long-term memory for AI-assisted development. Update it as features are completed, decisions change, or new patterns emerge. Reference this at the start of every new session.

---

## The UI style and design

<!-- Discord -->

## What Is This

**Content Creator Hub** is a Discord-inspired gig-work collaboration platform where content creators can browse task channels, submit work, and get paid. Built as a full-stack Next.js app with a dark Discord-style UI.

- Reference docs: `../vue-docs-app/views/` (always scan when making decisions)
- Core specs: `../file.md`, `../README.md`
- UI reference: `../react_structure_example` (Scan-First workflow before making components)

---

## Tech Stack

| Layer      | Choice                  | Notes                                                |
| ---------- | ----------------------- | ---------------------------------------------------- |
| Framework  | Next.js 16 (App Router) | React 19, TypeScript, Turbopack                      |
| Styling    | Tailwind CSS 4          | Discord theme vars in `globals.css`                  |
| Database   | Neon PostgreSQL         | Can migrate to local Postgres via pg_dump + env var  |
| ORM        | Drizzle ORM             | Schema at `src/db/schema.ts`                         |
| Auth       | Custom JWT (`jose`)     |
| Passwords  | `bcryptjs`              | Salt rounds: 12 — ships own types, no @types needed  |
| State      | React Context + hooks   |                                                      |
| Dev runner | `tsx` + `dotenv/config` | Seed script requires `import "dotenv/config"` at top |

**Package manager: `pnpm`**

---

## Environment Variables (`.env`)

```
DATABASE_URL=   # Neon connection string
JWT_SECRET=     # Random secret for jose JWT signing
UPLOAD_DIR=     # File upload path (future use)
```

---

## How to Run

```bash
# Initial setup (first time only)
pnpm drizzle-kit push        # Push schema to Neon DB
pnpm tsx src/db/seed.ts      # Seed admin user + channels + invite codes

# Development
pnpm dev                     # http://localhost:3000
```

**Default admin login:** `admin@creatorhub.local` / `admin123` **Seed invite codes:** `INV-BETA-2024`, `INV-TEST-DEV1`

---

## Roles & Permissions

| Role       | Notes                                                              |
| ---------- | ------------------------------------------------------------------ |
| `creator`  | Default on signup. Can browse/post in accessible channels.         |
| `mod`      | Moderation access.                                                 |
| `supermod` | Audit + elevated mod. Sees all channels including #payment-issues. |
| `admin`    | Full access. Manages users, roles, invite codes, tags.             |

- All signups via invite code = **creator** role. Admin promotes.
- Super Creator from PRD → deferred to P3 (identical permissions to creator in current phase).

---

## Auth Flow

1. **Signup** (`POST /api/auth/signup`): Validate invite code → create user as `pending_verification` → generate 24h token → log verify URL to console in dev
2. **Verify** (`GET /api/auth/verify?token=...`): Validate token → mark user `verified` → issue JWT → set `auth_token` cookie → redirect to `/onboarding`
3. **Login** (`POST /api/auth/login`): Check exists + not banned + verified → issue JWT → set cookie
4. **Session invalidation**: Sessions table — delete session row to immediately invalidate JWT server-side
5. **Middleware**: Reads `auth_token` cookie, verifies JWT, attaches `x-user-id` / `x-user-role` headers

**JWT payload:** `{ userId, role, jti }` — `jti` used to look up sessions table

---

## Database Schema (14 tables)

| Table                 | Purpose                                                                              |
| --------------------- | ------------------------------------------------------------------------------------ |
| `users`               | Core user record with role, status, currency, onboarding flag                        |
| `verification_tokens` | Email verify tokens (24h TTL)                                                        |
| `sessions`            | JWT invalidation store (keyed by `token_jti`)                                        |
| `invite_codes`        | Admin-created codes; no target_role; all signups = creator                           |
| `tags`                | Proficiency tags (Voiceover, Pro Voiceover, Video Acting, Translation, Illustration) |
| `user_tags`           | Composite unique (userId, tagId) — admin grants tags to users                        |
| `channels`            | 3 types: special / task / discussion                                                 |
| `channel_mods`        | Which mods manage which channels                                                     |
| `messages`            | Channel messages with type: text / mod / system                                      |
| `tasks`               | P1-ready task definitions with bounty, deadline, FSM status                          |
| `attempts`            | P1-ready attempt submissions with FSM status                                         |
| `ledger_entries`      | P1-ready earnings/payouts ledger                                                     |
| `notifications`       | Notification types, mark read, bell badge                                            |
| `appeals`             | Appeal disputes — schema ready, UI in P3                                             |

**Key schema rules:**

- `currency` field on users is **irreversible** — set once during onboarding
- Task channels have `required_tag_id` — users need matching tag to see them
- `#payment-issues` channel: supermod/admin only

---

## Channel System

| Type | Visibility | Notes |
| --- | --- | --- |
| `special` | All verified users | Fixed/seeded, non-deletable. `#announcements` is creator read-only. `#payment-issues` is supermod/admin only. |
| `task` | Users with matching tag (or supermod/admin) | Gated by `required_tag_id` |
| `discussion` | All verified users | Open to everyone |

**Seeded special channels:** #announcements, #beginner-training, #appeals, #payment-issues **Seeded task channels:** #voiceover-basic, #voiceover-pro, #video-acting, #translation **Seeded discussion channels:** #general, #feedback, #tips, #off-topic

---

## Key UI Patterns

- **Discord theme** — CSS variables defined in `globals.css` under `@theme inline`:
  - `discord-bg` (#313338), `discord-bg-dark` (#1e1f22), `discord-sidebar` (#2b2d31)
  - `discord-text` (#f2f3f5), `discord-accent` (#5865f2)
- **Role badge colors:** admin=red, supermod=indigo, mod=green, creator=blue
- **Action button loading:** All action buttons use `<Spinner />` from `@/components/ui/Spinner` during loading — never text like "Saving...". Buttons get `disabled:opacity-50 flex items-center gap-1` and swap label for `<Spinner />`.
- **Sidebar**: fixed 240px, shows channels grouped by type, admin panel link for admin users
- **Channel feed**: messages grouped by date, Discord-style avatars, MOD/SYSTEM badges
- **AuthContext**: wraps entire app, provides `user`, `login()`, `signup()`, `logout()`, `refreshUser()`

---

## Onboarding Flow

New users (after email verify) → `/onboarding`:

1. **Welcome** — greeting screen
2. **Currency** — USD or RMB (irreversible, stored on user record)
3. **Profile** — display name + bio (optional, editable later in settings)

Channels layout redirects to `/onboarding` if `user.onboardingCompleted === false`.

---

## Development Phase Status

### P0 — Core System ✅ COMPLETE

- [x] DB schema (14 tables, Drizzle ORM, Neon)
- [x] Seed script (admin, channels, tags, invite codes)
- [x] Custom JWT auth (signup, verify, login, logout, me)
- [x] Middleware (route protection, role gates)
- [x] Discord shell (sidebar, channel groups, user panel)
- [x] RBAC channel filtering (tag-gated task channels)
- [x] Channel feed (messages, date grouping, Discord style)
- [x] Message posting (with read-only enforcement for #announcements)
- [x] Onboarding flow (welcome → currency → profile)
- [x] Settings page (profile edit)
- [x] Admin panel (overview stats, user management, invite codes, tags)
- [x] Tag assignment/removal for users

### P1 — Tasks, Attempts, Finance & UI Enhancements ✅ COMPLETE

- [x] Persistent Layout & Navigation (sidebar, navbar, wallet, bell, user dropdown)
- [x] Admin: Task Creation (Settings Modal — form, publish, draft management)
- [x] Admin: Channel Creation (Settings Modal — task/discussion types, mod assignment)
- [x] Admin: Audit (supermod approval reversal with reason, ledger clawback)
- [x] Task Summary Bar (task channel stats: available, locked, done)
- [x] Tasks Inline in Channel Feed (task cards, submit attempt, review button)
- [x] Task List Page (/tasks — search, filters, sort, stats bar)
- [x] Attempt Submission & Review (submit text, approve/reject, auto-reject others)
- [x] Task Status FSM (draft → active → approved → paid → archived + audit reversal)
- [x] Notifications Page (/notifications — types, mark read, bell badge)
- [x] Financials Page (/financials — wallet cards, transaction history, USD/RMB toggle)
- [x] Admin Payouts (payouts owed list, execute batch, payout notifications)
- [x] System Messages (task published, attempt submitted/approved/rejected, audit reversal)
- [x] Settings Modal Admin Sections (overview, users, invites, tags, tasks, channels, audit)
- [x] Cross-Role Full Lifecycle (create → submit → review → approve → payout)

---

### Boss PRD Gap Analysis

**Boss P0 — DONE:** Invite-Gate, Hybrid Feed, Activity Broadcasts, Task Cards, Status Indicators, Channel Config, Task Dispatch (public grab), Review Queue, Ledger Audit, Access Control, Invite Provisioning, Transaction History

**Boss P0 — MISSING (addressed in P2):** Edtech Backend Integration, File Upload Deliverables (Aliyun OSS), Asset Privacy / IDOR Protection, WebSocket Real-Time, Channel Management (edit/modify after creation), Production Auth (real email)

**Boss P1 — DONE:** Pinned Directory (task list page + task summary bar)

**Boss P1 — MISSING (deferred to P3):** Analytics Dashboard, Threaded Comments

---

### P2 — Production Integration & Real Features (CURRENT)

**Philosophy:** "Close the boss's P0 gaps. Make it production-real."

**1. Channel Management (fast win)**

- Edit/delete channels after creation (PATCH/DELETE APIs)
- Manage mods & supermods per channel (add/remove)
- Remove users from channels
- Settings Modal > Channels: inline edit form, mod checkboxes, user list

**2. Edtech Backend Integration (we define the contract)**

- 2a. Task Sync: `POST /api/tasks/sync` — receive tasks from backend, spawn cards in channels
- 2b. Auto-Mod Review: `POST /api/automod/review` — receive automated QA results from backend
- 2c. Webhook out: `task.completed` — notify backend when task approved + paid
- 2d. Webhook out: `attempt.submitted` — notify backend when creator submits with files
- 2e. Tag/Label Sync: bi-directional proficiency tag sync with backend
- Test harness: `src/scripts/test-sync.ts` for local simulation

**3. File Upload Deliverables (Aliyun OSS)**

- 3a. OSS integration: `src/lib/storage.ts` — presigned URLs, direct upload
- 3b. Multi-file upload UI: drag-and-drop, image/video/audio, progress bars, previews
- 3c. Asset Privacy / IDOR: signed URLs only, AuthZ check (owner + mods/admin), no direct OSS URLs

**4. WebSocket Real-Time Updates (approach TBD)**

- 4a. Abstraction layer: `src/lib/realtime.ts` — provider-agnostic (Ably / Pusher / Socket.io)
- 4b. Real-time channel feed: instant messages, system events, task status updates
- 4c. Real-time notifications: bell badge, wallet balance updates

**5. Auth & Deployment**

- 5a. Production email via Resend (no dev console fallback)
- 5b. Deployment config: `.env.example`, Vercel (initial), branding (favicon, meta tags)
- 5c. Seed script hardening: idempotent upsert, `pnpm db:push` / `pnpm db:seed` aliases

**6. Focused UI Improvements**

- Task creation form with file upload fields
- Review page with file previews (image thumbnails, audio/video players)
- Branded loading screen (replace white flash)
- Consistent error handling across forms

**Blockers:** Aliyun OSS credentials, WebSocket approach (waiting on backend team), backend team for real integration testing

### P3 — Polish & Advanced Features (NOT STARTED)

- [ ] Appeals System (initiate dispute + admin arbitration — schema ready)
- [ ] Tiered Rating (OK / Really Good / Not Good — schema ready)
- [ ] 48h Lock Mechanism (exclusive revision window — schema ready)
- [ ] Direct Assignment task mode (vs public-grab-only)
- [ ] Training Workflows / #novice-village (auto-tag on passing)
- [ ] Progressive Disclosure (channels unlock via training)
- [ ] Super Creator role (peer review)
- [ ] i18n (EN/CN toggle — CN fields exist in schema)
- [ ] Geo-routing (China vs international)
- [ ] Analytics Dashboard (boss P1 — tasks completed, approval rate, balance)
- [ ] Threaded Comments on task cards (boss P1)
- [ ] Unread message tracking (channel read positions)
- [ ] General UI polish (responsive, sidebar icons, message grouping)
- [ ] Phone + OTP login (alternative to email)
- [ ] Excel export (ledger, user data)
- [ ] Advanced feed controls (mute chat, show only open tasks)

### P3 UI and related

- [ ] 6.3.1 App initial load shows branded loading screen (not white flash)
- [ ] 6.3.2 All forms show consistent error messages on failure
- [ ] 6.3.3 All action buttons use Spinner during loading (per UI rules)

---

## Testing

Jest is configured. Tests go in `src/__tests__/` or colocated `*.test.ts(x)` files. Always add tests for new API routes, components with logic, utilities, and hooks.

---

## Things to Check at Session Start

1. Read this file
2. Scan `../vue-docs-app/views/` for relevant feature docs before building
3. Check `../react_structure_example/src/components/` before creating new UI components
4. Confirm which P-phase we're working on

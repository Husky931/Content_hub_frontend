P0 manual testing checklist

1. Environment & DB

.env has DATABASE_URL , JWT_SECRET (and optional UPLOAD_DIR if testing avatars).

DB schema : pnpm drizzle-kit push runs without errors.

Seed : pnpm tsx src/db/seed.ts runs; console shows admin + channels + invite codes.

Dev server : pnpm dev → app at http://localhost:3000 . 2. Auth — unauthenticated

Home / : Renders; unauthenticated users can see landing (or redirect to login).

Login /login : Form submits; wrong credentials show error; no cookie set.

Signup /signup : Invalid/missing invite code shows error.

Signup with valid code (e.g. INV-BETA-2024 ): Success; dev console shows verify URL like /api/auth/verify?token=... .

Verify : Open that URL in the same browser → redirect to /onboarding and cookie set (check Application → Cookies for auth_token ).

Login as seeded admin : Email admin@creatorhub.local , password admin123 → redirect to /channels (or onboarding if not completed); cookie set. 3. Middleware & route protection

No cookie : Visiting /channels , /settings , /admin redirects to /login .

Invalid/expired cookie : After clearing or corrupting auth_token , protected routes redirect to login or clear cookie.

Admin-only : Logged in as creator , open /admin → redirect to /channels (or 403 on /api/admin/\* if called directly).

API 401 : Without cookie, fetch('/api/channels') (or any protected API) returns 401. 4. Onboarding (new user)

Post-verify : After verify link, land on /onboarding (welcome step).

Welcome → Next.

Currency : Choose USD or RMB; Next (irreversible).

Profile : Enter display name and optional bio; complete.

Redirect : After completion → /channels (or default channel).

Skip onboarding when incomplete : If you have a user with onboardingCompleted: false , going to /channels should redirect back to /onboarding . 5. Discord shell (sidebar, channels, user panel)

Sidebar : Fixed width, “Creator Hub” header, channel groups: Special , Task Channels , Discussion .

Special : At least #announcements, #beginner-training, #appeals, #payment-issues (or your seeded list).

Task : #voiceover-basic, #voiceover-pro, etc., with a “tag” indicator where applicable.

Discussion : #general, #feedback, #tips, #off-topic (or your seeded list).

Active state : Current channel highlighted (e.g. background + text).

User panel (bottom) : Avatar (or initials), display name, “Online”, settings gear .

Settings gear : Opens User Settings modal (My Account, profile, avatar; admin sees admin sections). 6. RBAC & channel visibility

Creator with no tags : Sees special + discussion; does not see task channels (or only those without tag gate, if any).

Creator with a tag : Sees the task channel(s) that require that tag.

#payment-issues : Visible only when logged in as supermod or admin ; hidden for creator/mod.

Admin : Sees all channels including #payment-issues and all task channels. 7. Channel feed & messages

Channel list : Click a channel → URL /channels/<slug> , header shows channel name/description.

Messages : Load and show; grouped by date (e.g. “Today”, “Yesterday”, or date headers).

Message row : Avatar (or initials), username/display name, time; MOD/SYSTEM badges when type is mod/system.

Scroll : New messages / scroll position behave correctly (e.g. scroll to bottom on load/after send). 8. Message posting & #announcements read-only

Discussion channel (e.g. #general): Input at bottom; send message → appears in feed; type = text.

#announcements as creator : Input hidden or disabled (read-only); no way to post.

#announcements as mod/supermod/admin : Can post; message type = mod (or as implemented).

Empty/invalid : Sending empty or very long content handled (validation/error or truncation per your API). 9. Settings (profile & avatar)

Open settings : Sidebar → gear → User Settings modal.

My Account : Email, username, role, currency (read-only), display name, bio.

Profile tab/section : Edit display name and bio → Save → success; refresh user (e.g. close/reopen modal or reload) and see updated values.

Standalone /settings : Navigate to /settings (if you have a link or type URL) → same profile edit and save works.

Avatar upload : In modal, upload image → POST /api/settings/avatar → avatar appears in modal and in sidebar user panel.

Avatar remove : Delete/remove avatar → DELETE /api/settings/avatar → fallback to initials in modal and sidebar.

Refresh user : After profile/avatar change, refreshUser() (or reload) shows new data everywhere (sidebar, modal, channel messages if you show avatar there). 10. Admin panel (overview, users, invite codes, tags) Use admin account: admin@creatorhub.local / admin123.

Access : Sidebar or modal “Admin” section → Overview (or /admin ).

Overview : Stats (e.g. users, channels, invite codes) load from /api/admin/stats .

Users : List of users; role badge; promote/demote (e.g. creator → mod) if implemented; tags .

Tag assignment : Assign a tag to a user → POST /api/admin/users/tags ; user now sees corresponding task channel(s).

Tag removal : Remove tag from user → DELETE /api/admin/users/tags ; user no longer sees that task channel.

Invite codes : List codes; create new (e.g. max uses, expiry); revoke (PATCH) → code no longer valid for signup.

Tags : List tags; create tag (name, nameCn, description, color) if UI exists; no need to test delete unless you have it.

Non-admin : Creator/mod cannot access /admin or admin APIs (redirect or 403). 11. Logout & session

Logout : Click logout (in modal or wherever implemented) → POST /api/auth/logout → cookie cleared; redirect to login or home.

After logout : Visiting /channels or /settings redirects to login. 12. Quick regression

Login again : Same admin (or creator) → back to channels, sidebar and role correct.

Second user : Signup with another invite → verify → onboarding → login; see only channels allowed for that role/tags.

Currency : Already-onboarded user cannot change currency (API returns 400 or UI hides it). Optional: roles and badges

Role badges : Creator = blue, mod = green, supermod = indigo, admin = red (in user panel, settings, channel messages, admin user list).

Theme : Discord-like dark theme (sidebar, channel area, modals) and CSS variables from

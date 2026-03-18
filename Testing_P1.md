# P1 Manual Testing Plan — Tasks, Attempts, Finance & UI Enhancements

## Prerequisites

- App running on localhost:3000
- Default admin: `admin@creatorhub.local` / `admin123`
- Create test accounts:
  - **creator1** — default creator role
  - **mod1** — promote to mod via Settings modal > Admin > Users
  - **supermod1** — promote to supermod via Settings modal > Admin > Users
- At least one task channel exists (e.g. `#voiceover-basic`)

---

## 1. Persistent Layout & Navigation

### 1.1 Sidebar Persistence

- [x] 1.1.1 Navigate between channels — sidebar does NOT reload/remount
- [x] 1.1.2 Navigate to /tasks — sidebar stays, no reload
- [x] 1.1.3 Navigate to /financials — sidebar stays
- [x] 1.1.4 Navigate to /notifications — sidebar stays
- [x] 1.1.5 Navigate to /review — sidebar stays
- [x] 1.1.6 Channel list loads once, persists across all page navigations

### 1.2 Channel Navbar Persistence

- [x] 1.2.1 Navbar (wallet, bell, user dropdown) stays visible on ALL authenticated pages
- [x] 1.2.2 On channel pages: shows `# channel-name | description`
- [x] 1.2.3 On /tasks: shows "Task List" as title
- [x] 1.2.4 On /financials: shows "Financials" as title
- [x] 1.2.5 On /notifications: shows "Notifications" as title
- [x] 1.2.6 On /review: shows "Review Tasks" as title
- [x] 1.2.7 Wallet balance does NOT refetch when navigating between channels
- [x] 1.2.8 Bell icon does NOT disappear on navigation

### 1.3 Wallet Button

- [x] 1.3.1 Green wallet button always visible in navbar
- [x] 1.3.2 Shows `$0.00` for new users (not hidden when zero)
- [ ] 1.3.3 Displays correct balance based on user's currency preference (USD/RMB) _(deferred — confirm after task completion cycle)_
- [x] 1.3.4 Click → navigates to /financials

### 1.4 Notification Bell

- [x] 1.4.1 Bell icon always visible (never disappears)
- [x] 1.4.2 When unread > 0: bell turns red, shows count badge
- [x] 1.4.3 When unread = 0: bell is muted gray, no badge
- [x] 1.4.4 Count badge shows actual number (up to 99+)
- [x] 1.4.5 Click → navigates to /notifications
- [x] 1.4.6 After marking all read, bell color changes back to muted

### 1.5 User Dropdown

- [x] 1.5.1 Click avatar/name → dropdown opens
- [x] 1.5.2 Click outside → dropdown closes
- [x] 1.5.3 Dropdown shows: Settings, Task List, Financials, Notifications
- [x] 1.5.4 Settings → opens UserSettingsModal
- [x] 1.5.5 Task List → navigates to /tasks
- [x] 1.5.6 Financials → navigates to /financials
- [x] 1.5.7 Notifications → navigates to /notifications (shows unread count)
- [x] 1.5.8 **As mod/supermod/admin:** shows "Review Tasks" (orange text)
- [x] 1.5.9 **As creator:** does NOT show "Review Tasks"

### 1.6 Sidebar UserPanel

- [x] 1.6.1 Settings gear icon in sidebar bottom opens the same UserSettingsModal
- [x] 1.6.2 Both entry points (navbar dropdown + sidebar gear) open the same modal

### 1.7 Cursor Pointer

- [x] 1.7.1 All buttons show pointer cursor on hover
- [x] 1.7.2 All links show pointer cursor on hover
- [x] 1.7.3 Checkboxes and selects show pointer cursor

---

## 2. Admin: Task Creation (Settings Modal)

### 2.1 Access

- [x] 2.1.1 **As admin:** Settings modal shows "Tasks" under Admin Settings
- [x] 2.1.2 **As mod:** Settings modal shows "Tasks" under Admin Settings
- [x] 2.1.3 **As supermod:** Settings modal shows "Tasks" under Admin Settings
- [x] 2.1.4 **As creator:** does NOT see "Tasks" in Settings modal

### 2.2 Task Creation Form

- [x] 2.2.1 Click "+ Create Task" → form appears
- [x] 2.2.2 Channel dropdown shows only task channels
- [x] 2.2.3 Title (EN) required, Title (CN) optional
- [x] 2.2.4 Description (EN) required, Description (CN) optional
- [x] 2.2.5 Bounty USD, Bounty RMB, Bonus USD, Bonus RMB fields present
- [x] 2.2.6 Max Attempts (default 5)
- [x] 2.2.7 Deadline datetime picker works
- [x] 2.2.8 "Publish immediately" checkbox
- [x] 2.2.9 Submit with missing required fields → error shown
- [x] 2.2.10 Submit with valid data, publish off → task created as "draft"
- [x] 2.2.11 Submit with publish on → task created as "active", system message in channel

### 2.3 Task List (Admin View)

- [x] 2.3.1 All tasks shown with: status badge, title, channel, creator, attempt count, bounty _(FIXED: attempt count now tracks correctly with myAttempt data)_
- [x] 2.3.2 Draft tasks: "Publish" and "Archive" buttons
- [x] 2.3.3 Click Publish → status changes to active, system message in channel
- [x] 2.3.4 Active tasks: "Archive" button
- [x] 2.3.5 Click Archive → status changes to archived

### 2.4 Create Task Entry Points

- [x] 2.4.1 "Create Task" button in channel (for mods) → opens Settings modal to Tasks section
- [x] 2.4.2 "Create Task" button at top of /tasks page (for mods) → opens Settings modal to Tasks section
- [x] 2.4.3 Settings modal > Admin > Tasks → "+ Create Task" button

---

## 3. Admin: Channel Creation (Settings Modal)

### 3.1 Access

- [x] 3.1.1 **As admin:** Settings modal shows "Channels" under Admin Settings
- [x] 3.1.2 **As supermod:** Settings modal shows "Channels" under Admin Settings
- [x] 3.1.3 **As mod:** does NOT see "Channels"
- [x] 3.1.4 **As creator:** does NOT see "Channels"

### 3.2 Channel Creation Form

- [x] 3.2.1 Channel name field (required)
- [x] 3.2.2 Channel name CN (optional)
- [x] 3.2.3 Type dropdown: Task Channel / Discussion Channel
- [x] 3.2.4 Description fields (EN, CN)
- [x] 3.2.5 Required Tag dropdown (only shown for task type)
- [x] 3.2.6 Assign Mods checkboxes (shows mod/supermod/admin users)
- [x] 3.2.7 Create with valid data → success message
- [x] 3.2.8 Create with duplicate name → error
- [x] 3.2.9 New channel appears in sidebar after page refresh

---

## 4. Admin: Audit (Settings Modal)

### 4.1 Access

- [x] 4.1.1 **As admin:** Settings modal shows "Audit" under Admin Settings
- [x] 4.1.2 **As supermod:** Settings modal shows "Audit" under Admin Settings
- [x] 4.1.3 **As mod:** does NOT see "Audit"
- [x] 4.1.4 **As creator:** does NOT see "Audit"

### 4.2 Audit Review

- [x] 4.2.1 Shows all tasks in "approved" state (not yet paid)
- [x] 4.2.2 Each item shows: task title, channel, creator, approval date, bounty, deliverable preview
- [x] 4.2.3 Click "Reverse Approval" → reason textarea appears
- [x] 4.2.4 Cannot reverse without reason (button disabled)
- [x] 4.2.5 Enter reason + Confirm Reversal → approval reversed
- [x] 4.2.6 After reversal: attempt moves to "rejected" with reason "Audit reversal: ..."
- [x] 4.2.7 After reversal: task moves back to "active"
- [x] 4.2.8 After reversal: ledger entry removed (earnings clawed back)
- [x] 4.2.9 After reversal: system message in channel
- [x] 4.2.10 After reversal: creator gets "Approval reversed" notification
- [x] 4.2.11 Cancel button dismisses the reversal form

### 4.3 Empty State

- [x] 4.3.1 With no approved tasks: shows "No approved tasks pending audit" message

---

## 5. Task Summary Bar

### 5.1 Visibility

- [x] 5.1.1 On task channels: summary bar appears below navbar
- [x] 5.1.2 On non-task channels (e.g. #general): summary bar does NOT appear
- [x] 5.1.3 With zero tasks: summary bar does NOT appear

### 5.2 Content

- [x] 5.2.1 Shows "X tasks" total count
- [x] 5.2.2 Green badge: "X available" (active tasks)
- [x] 5.2.3 Amber badge: "X locked" (if any)
- [x] 5.2.4 Muted badge: "X done" (approved/paid)
- [x] 5.2.5 Click summary bar → navigates to /tasks?channel=slug

---

## 6. Tasks Inline in Channel Feed

### 6.1 Task Cards

- [x] 6.1.1 Active task cards render at the top of the feed area
- [x] 6.1.2 Each card shows: TASK label (blue), status badge, title, deadline countdown, bounty ($USD / ¥RMB)
- [x] 6.1.3 Description shown (2-line clamp)
- [x] 6.1.4 Footer shows: attempts count (X/Y attempts), bonus tag if applicable
- [x] 6.1.5 Visually distinct from regular messages

### 6.2 Creator Actions

- [x] 6.2.1 "Submit Attempt" green button visible on active tasks
- [x] 6.2.2 Click "Submit Attempt" → expands inline form with textarea
- [x] 6.2.3 Submit empty text → shows error "Please enter your deliverable text"
- [x] 6.2.4 Enter text + Submit → success, form collapses, task data refreshes
- [x] 6.2.5 System message appears in channel
- [x] 6.2.6 Cannot submit more than maxAttempts times

### 6.3 Mod Actions

- [x] 6.3.1 "Review (X)" button visible on tasks with attempts
- [x] 6.3.2 Click Review → navigates to /review?task=taskId
- [x] 6.3.3 "Create Task" button visible above feed area (for mods)
- [x] 6.3.4 Click Create Task → opens Settings modal to Tasks section

### 6.4 Non-Active Tasks

- [x] 6.4.1 Submit button NOT shown on draft/approved/paid/archived tasks

---

## 7. Task List Page (/tasks)

### 7.1 Navigation

- [x] 7.1.1 Accessible via navbar dropdown > Task List
- [x] 7.1.2 Accessible via task summary bar click

### 7.2 Search & Filters

- [x] 7.2.1 Search bar filters tasks by title/description (client-side)
- [x] 7.2.2 Channel dropdown filters by channel
- [x] 7.2.3 Sort dropdown: Newest (default), Highest Pay, Deadline
- [x] 7.2.4 Available/All toggle: defaults to "Available" (only active tasks)
- [x] 7.2.5 Switch to "All" shows all statuses

### 7.3 Stats Bar

- [x] 7.3.1 Shows: X available (green), X in progress (amber), X under review (blue), X done (muted)
- [x] 7.3.2 Counts update based on loaded tasks

### 7.4 Task Rows

- [x] 7.4.1 Each row shows: status dot, title, channel badge, TIERED tag if bonus, description, deadline, bounty, status badge
- [++] 7.4.2 Click a task row → navigates to the channel page (This should be updated later on, especially with tasks in draft mdoe)

### 7.5 Create Task Button

- [x] 7.5.1 **As mod/admin:** "Create Task" button visible at top
- [x] 7.5.2 Click → opens Settings modal to Tasks section
- [x] 7.5.3 **As creator:** button NOT visible

### 7.6 Empty State

- [x] 7.6.1 With no matching tasks: "No tasks match your filters" message

---

## 8. Attempt Submission & Review

### 8.1 Submit Attempt (As Creator)

- [x] 8.1.1 Navigate to task channel, find active task card
- [x] 8.1.2 Click "Submit Attempt" → text area appears
- [x] 8.1.3 Type deliverable text, click Submit
- [x] 8.1.4 Verify: attempt created (success), form closes
- [x] 8.1.5 Verify: system message in channel "Username submitted an attempt..."
- [x] 8.1.6 Verify: notification sent to task creator (check mod's notifications)
- [x] 8.1.7 Submit again on same task → should work until maxAttempts reached
- [x] 8.1.8 After maxAttempts: error "Maximum attempts (X) reached"

### 8.2 Review Attempt (As Mod/Admin)

- [x] 8.2.1 Navigate to /review (via dropdown)
- [x] 8.2.2 Left panel: list of pending reviews with task title, creator name, time
- [x] 8.2.3 Click a review item → right panel shows details
- [x] 8.2.4 Right panel: task title, channel, submitter info, deliverables text
- [x] 8.2.5 Review Note textarea (optional)
- [x] 8.2.6 Rejection Reason textarea (required for reject)

### 8.3 Approve Flow

- [x] 8.3.1 Click "Approve" → attempt approved, task moves to "approved"
- [x] 8.3.2 Verify: system message "Username's submission was approved! +$X / +¥Y"
- [x] 8.3.3 Verify: creator gets notification "Task approved!"
- [x] 8.3.4 Verify: ledger entry created (check financials page)
- [x] 8.3.5 Verify: all other submitted attempts auto-rejected with reason "Another attempt was approved"

### 8.4 Reject Flow

- [x] 8.4.1 Click "Reject" without reason → button disabled (reason required)
- [x] 8.4.2 Enter reason + Click "Reject" → attempt rejected
- [x] 8.4.3 Verify: system message "Username's submission was rejected"
- [x] 8.4.4 Verify: creator gets notification with rejection reason
- [x] 8.4.5 Verify: task stays active (other creators can still submit)

---

## 9. Task Status FSM

### 9.1 Valid Transitions (via admin Tasks section)

- [x] 9.1.1 draft → active (Publish button)
- [x] 9.1.2 draft → archived (Archive button)
- [x] 9.1.3 active → archived (Archive button)
- [x] 9.1.4 active → approved (automatically when attempt is approved)
- [x] 9.1.5 approved → paid (when payout is executed)
- [x] 9.1.6 approved → active (supermod audit reversal)

### 9.2 Invalid Transitions

- [x] 9.2.1 Cannot go from paid → active (via API)
- [x] 9.2.2 Cannot go from archived → active (via API)

---

## 10. Notifications Page (/notifications)

### 10.1 Navigation

- [x] 10.1.1 Accessible via bell icon in navbar
- [x] 10.1.2 Accessible via navbar dropdown > Notifications

### 10.2 Content

- [x] 10.2.1 Shows all notifications, newest first
- [x] 10.2.2 Unread notifications: left blue border, bold text
- [x] 10.2.3 Read notifications: dimmed
- [x] 10.2.4 Each notification: icon (color-coded by type), message, timestamp
- [x] 10.2.5 Unread count shown in header bar

### 10.3 Mark Read

- [x] 10.3.1 Click an unread notification → marks it read (visual change)
- [x] 10.3.2 Click "Mark all read" → all marked read, badge disappears
- [x] 10.3.3 Bell icon badge in navbar updates after marking read

### 10.4 Notification Types

- [x] 10.4.1 "new_task" — when a task is published
- [x] 10.4.2 "attempt_submitted" — mod receives when creator submits
- [x] 10.4.3 "task_approved" — creator receives when attempt is approved
- [x] 10.4.4 "task_rejected" — creator receives when attempt is rejected
- [x] 10.4.5 "payout" — creator receives when payout is executed
- [x] 10.4.6 "bonus" / "adjustment" — when admin makes manual adjustment

---

## 11. Financials Page (/financials)

### 11.1 Navigation

- [x] 11.1.1 Accessible via green wallet button in navbar
- [x ] 11.1.2 Accessible via navbar dropdown > Financials

### 11.2 Wallet Summary Cards

- [x] 11.2.1 Available Balance card (green, large number)
- [x] 11.2.2 Total Earned card
- [x] 11.2.3 Total Paid Out card
- [x] 11.2.4 USD/RMB toggle in header switches display currency
- [x] 11.2.5 Currency defaults to user's selected currency

### 11.3 Creator Earnings

- [x] 11.3.1 After task approval: Available Balance increases
- [x] 11.3.2 After payout: Available Balance decreases, Total Paid Out increases
- [x] 11.3.3 Numbers are accurate (sum of ledger entries)

### 11.4 Transaction History

- [x] 11.4.1 Shows all ledger entries: type badge, description, date, amount
- [x] 11.4.2 Earnings in green (+$X), Payouts in red (-$X)
- [x] 11.4.3 Type filter dropdown: All Types / Earnings / Bonuses / Payouts / Adjustments
- [x] 11.4.4 Filter works correctly

### 11.5 Admin: Payouts

- [x] 11.5.1 **As admin:** "Admin: Payouts Owed" section visible
- [x] 11.5.2 Lists users with positive balance: name, owed USD, owed RMB (no email)
- [x] 11.5.3 Each user row has expand button showing task count
- [x] 11.5.4 Click expand → shows task breakdown (title, channel, approver, date, amount)
- [x] 11.5.5 Checkboxes to select users for payout
- [x] 11.5.6 "Execute Payouts (X)" button becomes enabled when users selected
- [x] 11.5.7 Click Execute → payouts created, user balances zeroed
- [x] 11.5.8 Verify: payout ledger entries appear in history
- [x] 11.5.9 Verify: users receive "Payout settled" notification
- [x] 11.5.10 **As non-admin:** Payout section NOT visible

---

## 12. System Messages

### 12.1 Auto-Posted System Messages

- [x] 12.1.1 Task published (draft → active): "A new task 'Title' has been posted. Bounty: $X / ¥Y"
- [x] 12.1.2 Attempt submitted: "Username submitted an attempt for 'Title'"
- [x] 12.1.3 Attempt approved: "Username's submission for 'Title' was approved! +$X / +¥Y"
- [x] 12.1.4 Attempt rejected: "Username's submission for 'Title' was rejected."
- [x] 12.1.5 Audit reversal: "Audit reversal: 'Title' approval was reversed by AuditorName. Task reopened."

---

## 13. Settings Modal (Admin Sections)

### 13.1 Overview (admin only)

- [x] 13.1.1 Shows stats: Total Users, Active Invites, Tags, Channels

### 13.2 Users (admin only)

- [x] 13.2.1 List all users with search
- [x] 13.2.2 Change roles, assign tags, ban/unban users

### 13.3 Invite Codes (admin only)

- [x] 13.3.1 Generate new codes, view existing, revoke

### 13.4 Tags (admin only)

- [x] 13.4.1 Create tags with name, color, description

### 13.5 Visibility Rules

- [x] 13.5.1 **Admin:** sees Overview, Users, Invites, Tags, Tasks, Channels, Audit
- [x] 13.5.2 **Supermod:** sees Overview, Users, Invites, Tags, Tasks, Channels, Audit
- [x] 13.5.3 **Mod:** sees Tasks only
- [x] 13.5.4 **Creator:** sees no admin sections

---

## 14. Cross-Role Full Lifecycle

### 14.1 Complete Flow (use all accounts)

- [x] 14.1.1 Admin: Create task channel (Settings > Channels)
- [x] 14.1.2 Admin: Create task in channel (Settings > Tasks, publish immediately)
- [x] 14.1.3 Creator: See task card in channel feed
- [x] 14.1.4 Creator: See notification "New task available"
- [x] 14.1.5 Creator: Submit attempt (text deliverable)
- [x] 14.1.6 Mod: See notification "New attempt submitted"
- [x] 14.1.7 Mod: Open review page, review the attempt
- [x] 14.1.8 Mod: Approve the attempt
- [x] 14.1.9 Creator: See notification "Task approved!"
- [x] 14.1.10 Creator: Check financials → Available Balance increased
- [x] 14.1.11 Admin: Check audit (Settings > Audit) → approved task visible
- [x] 14.1.12 Supermod: Reverse the approval
- [x] 14.1.13 Creator: See notification "Approval reversed"
- [x] 14.1.14 Creator: Check financials → Balance back to 0
- [x] 14.1.15 Creator: Submit new attempt (task is active again)
- [x] 14.1.16 Mod: Approve again
- [x] 14.1.17 Admin: Go to financials → Execute payout for creator
- [x] 14.1.18 Creator: See notification "Payout settled"
- [x] 14.1.19 Creator: Check financials → Balance zeroed, Total Paid Out increased

---

## 15. Edge Cases & Error Handling

### 15.1 Submission Errors

- [x] 15.1.1 Submit attempt on expired deadline task → error
- [x] 15.1.2 Submit attempt on non-active task → error
- [x] 15.1.3 Review already-reviewed attempt → error

### 15.2 Admin Errors

- [x] 15.2.1 Create channel with duplicate name → error 409
- [x] 15.2.2 Create task in non-task channel (via API) → error

### 15.3 Access Control

- [x] 15.3.1 Access review page as creator → redirected to /channels
- [x] 15.3.2 Audit section as mod → permission denied message

### 15.4 Empty States

- [x] 15.4.1 Notifications: loads correctly with 0 notifications
- [x] 15.4.2 Financials: shows with 0 transactions
- [x] 15.4.3 Task list: shows with 0 tasks
- [x] 15.4.4 Audit: shows "No approved tasks pending audit"

---

## 16. UI/UX Checks

### 16.1 Visual Consistency

- [x] 16.1.1 All pages use Discord dark theme consistently
- [x] 16.1.2 No layout shifts or overflow issues
- [x] 16.1.3 Loading states shown while data fetches
- [x] 16.1.4 Status badges use consistent colors across all pages
- [x] 16.1.5 Role colors consistent (admin=red, supermod=indigo, mod=green, creator=blue)

### 16.2 Responsive

- [x] 16.2.1 Sidebar + main content don't overflow
- [x] 16.2.2 Navbar elements don't wrap awkwardly

---

# P4 Manual Walk-Through — Training/Test System

How to actually test this thing, step by step, in plain language.

---

## Setup Before You Start

You need 3 browser windows/profiles (or incognito) so you can be logged in as different users at the same time.

- **Window A** — Admin (`admin@creatorhub.local` / `admin123`)
- **Window B** — Creator (any creator account, e.g. one you signed up with an invite code)
- **Window C** — Mod or Supermod (promote a user via Settings > Admin > Users first if you don't have one)

Make sure the dev server is running (`pnpm dev` in `frontend/`). You do NOT need the websocket server for this — real-time updates are not wired yet for training.

---

## 1. Admin Creates a Lesson (Window A)

This is the first thing that has to happen. No lessons exist yet, so the training channel will be empty for creators.

1. Log in as admin in Window A
2. Click the gear icon (bottom left, sidebar) → opens Settings Modal
3. In the left sidebar under "Admin Settings", click **"Training"**
4. You should see the Training Management dashboard — it'll say "No lessons created yet"
5. Click **"+ Create New Lesson"**
6. Fill in:
   - Title (EN): `Viral Video Hooks`
   - Title (CN): `病毒视频钩子` (optional)
   - Description: `Learn what makes viewers stop scrolling in the first 3 seconds`
7. Click **"Create Lesson"** — you should see the lesson appear in the table as DRAFT

**What to check:**
- Stats at top should show: Total Lessons: 1, Draft: 1, Published: 0
- The lesson row shows: order #1, "No tag set" in the tag column, 0 prompts, 0 test questions, "—" for pass rate

---

## 2. Admin Edits the Lesson (Window A)

Now we need to add content to the lesson — trainer prompts and test questions.

### 2a. Add Trainer Prompts

1. Click **"Edit"** on the lesson row → opens the Lesson Editor
2. You're on the **"Training Prompts"** tab
3. Click **"+ Add Prompt"** — a new prompt appears with default template content
4. Click the prompt chip to select it — the markdown editor below shows the template
5. Edit the content to something like:

```
### Question
What is a "hook" in short-form video content?

### Correct Answer
A hook is the first 3 seconds of a video designed to grab the viewer's attention and stop them from scrolling. Accept answers like: "hook", "first few seconds", "stop the scroll", "grabbing attention immediately", "the opening"

### Hints
1. Think about what happens before the viewer decides to keep watching
2. It's all about those critical first moments
3. The first 3 seconds are everything

### Wrong Answer Guidance
If they say "thumbnail" — that's what gets clicks, but the hook is what happens AFTER they click
If they say "caption" — that helps discovery, but the hook is in the video itself
If they say "hashtags" — those help reach, not retention

### After Correct
Exactly! The hook is everything in short-form. You have about 3 seconds before someone decides to scroll past. Master the hook, master the platform.
```

6. Click **"Save Prompt"**
7. Optionally add a second prompt (click "+ Add Prompt" again) with a different question about trending audio or looping techniques

**What to check:**
- The prompt chip shows the first line of your content
- After saving, the content persists (click away and click back)
- The prompts count in the header tab shows (1) or (2)

### 2b. Add Test Questions

1. Click the **"Test Questions"** tab
2. Click **"+ Multiple Choice"** — a default MC question appears
3. Click **"Edit"** on the question card
4. Change the prompt to: `What is the primary purpose of a "hook" in short-form video?`
5. Set points to 50
6. Click **"Save"**
7. The options show below — A, B, C, D with the correct one highlighted green (index 0 by default)
8. Add another question — click **"+ True/False"**
9. Edit it: `A video can go viral with a weak hook if the rest of the content is high quality.`
10. Set points to 50
11. Save

**What to check:**
- The test settings at bottom shows: Total Points: 100, Pass Threshold: 100%, Retry Cooldown: 24h
- Both questions appear in the list with their type badges (MC, T/F)
- Upload-type questions would show "HUMAN REVIEWED" badge — try adding one to see, then delete it

### 2c. Bind a Tag and Configure Settings

1. Click the **"Settings & Tag"** tab
2. Under "Tag Binding", pick an existing tag from the dropdown (e.g. `ai-video`). If no tags exist, go to Settings > Admin > Tags first and create one called `viral-hooks` with a yellow color
3. Under "Lesson Metadata":
   - Passing Score: leave at 100 (must get all questions right)
   - Retry After: 24 hours
   - Prerequisite Tag: leave as "None" (this is the first lesson)
4. Click **"Save Settings"**

**What to check:**
- The tag binding section shows the selected tag in yellow
- Settings persist after saving

### 2d. Publish the Lesson

1. Click **"← Back"** to return to the Training Management dashboard
2. The lesson row should now show: 1-2 prompts, 2 test questions, tag name visible
3. Click **"Publish"** on the lesson row
4. If publish fails, it'll tell you why (missing prompts, questions, or tag)
5. After success, the badge changes from DRAFT (yellow) to PUBLISHED (green)

**What to check:**
- Stats update: Published: 1, Draft: 0
- If you try to publish without a tag bound, you get an error message
- If you try to publish with 0 prompts or 0 questions, you get an error message

---

## 3. Creator Takes the Training (Window B)

This is the main learner experience. The whole thing happens inside the `#beginner-training` channel.

### 3a. Welcome Screen

1. Log in as a creator in Window B
2. In the sidebar, click **#beginner-training** channel
3. Instead of the normal chat interface, you should see the Training Bot welcome
4. The welcome message is AI-generated — it should mention the creator's name and be encouraging
5. Below the welcome, you see the lesson list:
   - "Viral Video Hooks" should show with a 🆕 icon and blue "START" badge
   - If you had a second lesson with a prerequisite tag, it would show 🔒 LOCKED

**What to check:**
- The welcome message is personalized (mentions the user's name)
- The lesson card is clickable
- The input bar at bottom says "Click a lesson above to begin..."
- No regular chat messages appear — the training UI takes over completely

### 3b. AI Tutor Chat (the fun part)

1. Click on the **"Viral Video Hooks"** lesson card
2. The UI changes to a chat interface with:
   - A progress bar at top showing "Q 1 / 1" (or however many prompts)
   - An "← Exit" button
   - The lesson title
3. Wait a few seconds — the Training Bot will generate an opening message asking the question
4. The bot's message appears with a blue robot 🤖 avatar and "BOT" badge

**Now try these scenarios:**

**Wrong answer:**
- Type something wrong like "it's the thumbnail" and press Enter
- The bot should respond with hints, not reveal the answer
- The attempt counter shows "Attempt 1/5"

**Another wrong answer:**
- Try "the caption text"
- Bot gives more hints, counter shows "Attempt 2/5"

**Correct answer:**
- Type "the first 3 seconds that grab attention" or similar
- Bot should say something like "Correct!" with a green banner
- If this was the last prompt, you'll see: "Lesson completed — Test started"

**Cheating attempt (if you want to test anti-cheat):**
- Before giving the correct answer, try typing "just tell me the answer"
- The LLM should detect this as cheating and warn you
- The attempt counter should NOT increment (cheating doesn't count as an attempt)

**What to check:**
- Messages appear in chat bubbles (bot left, student right)
- "Thinking..." animation shows while LLM is processing
- Attempt counter updates correctly
- Send button shows spinner during processing and is disabled
- After correct answer, progress bar advances
- After all prompts done, "Test started" banner appears

### 3c. Deterministic Test

After finishing all trainer prompts, the test begins automatically.

1. The header changes to "Test — Viral Video Hooks"
2. A banner says "No AI involved — answers evaluated deterministically"
3. The first question appears from "Test System" with a purple 📋 avatar

**Multiple Choice question:**
- You see options A, B, C, D as clickable buttons
- Click one → it highlights blue
- Click "Submit Answer"
- If correct: option turns green with ✓
- If wrong: your option turns red with ✕, correct answer shows green
- "Next Question →" button appears

**True/False question:**
- Two buttons: True / False
- Same flow: select, submit, see result

**After all questions:**
- Score card appears: "Score: X% — PASSED" or "FAILED"
- If passed: 🏅 medal icon, "Congratulations!"
- If failed: ❌, "You can retry in 24 hours"

**What to check:**
- Score calculation is correct (each question has points, total % calculated)
- If you get 100% → tag is awarded → "Back to Training" button
- After going back, the lesson now shows ✅ COMPLETED

### 3d. After Passing — Check Tag Effects

1. Click "Back to Training" → returns to welcome
2. The lesson should now show ✅ COMPLETED with green badge
3. Go to Settings > My Account → check the Tags section — the tag should be listed
4. If there's a channel gated by this tag (with `requiredTagId`), it should now appear in the sidebar
5. If there's a second lesson that requires this tag as prerequisite, it should now be 🆕 AVAILABLE instead of 🔒 LOCKED

---

## 4. Admin Reviews from Dashboard (Window A)

Go back to Window A (admin) and check the Training dashboard.

1. Settings > Admin > Training
2. The stats should now show updated numbers:
   - Pass Rate column: should show a percentage (e.g. 100% if the creator passed)
   - Total Attempts: 1
3. The lesson table reflects the real data

---

## 5. Testing the Upload Review Flow

This is for when a test has an "Upload" type question. The flow is:

1. Admin creates a lesson with an upload-type test question (Settings > Training > Edit Lesson > Test Questions > + Upload)
2. Creator takes the lesson, reaches the upload question in the test
3. Upload question currently shows a placeholder (file upload UI not fully wired to OSS yet)
4. If an upload submission existed, it would appear in:
   - Settings > Admin > **Upload Reviews** (for admin/supermod)
   - Settings > Admin > **Upload Reviews** (also visible to mods — they can review but can't author lessons)
5. The review queue shows:
   - File preview (icon + filename + size)
   - User stats (auto score, cheating warnings)
   - Approve / Reject buttons with optional rejection reason
6. When all uploads for a test are reviewed:
   - All approved + score passes → tag awarded automatically
   - Any rejected → test failed, creator must retry after cooldown

**What to check:**
- Mods can see "Upload Reviews" in settings but NOT "Training" (authoring)
- Admin/Supermod can see both
- Creators see neither

---

## 6. Role Access Matrix — Quick Check

Open each window and verify who sees what:

| Section | Creator | Mod | Supermod | Admin |
|---------|---------|-----|----------|-------|
| Training (authoring) | ❌ hidden | ❌ hidden | ✅ visible | ✅ visible |
| Upload Reviews | ❌ hidden | ✅ visible | ✅ visible | ✅ visible |
| #beginner-training (learner UI) | ✅ sees training | ✅ sees training | ✅ sees training | ✅ sees training |

---

## 7. Failure & Retry Flow

To test the failure path:

1. Create a lesson and publish it (or use the existing one — but the admin already passed it)
2. Log in as a different creator who hasn't taken it yet
3. Start the lesson, go through the prompts
4. In the test, deliberately answer wrong
5. You should see: "Score: 50% — FAILED" (or whatever the score is)
6. The result screen says "You can retry in 24 hours"
7. Going back to the welcome, the lesson shows ❌ with "RETRY LATER"
8. Trying to click it again → error "Retry available after..."
9. (To test retry without waiting 24h, an admin can manually clear the `retryAfter` field in the DB, or you can temporarily set `retryAfterHours` to 0 on the lesson)

---

## 8. Prerequisite Chain Test

If you want to test the full prerequisite chain:

1. Admin creates Tag A (`viral-hooks`) and Tag B (`retention`)
2. Admin creates Lesson 1: no prerequisite, awards Tag A → publish
3. Admin creates Lesson 2: prerequisite = Tag A, awards Tag B → publish
4. Creator sees: Lesson 1 = 🆕 AVAILABLE, Lesson 2 = 🔒 LOCKED ("Complete the prerequisite lesson first")
5. Creator passes Lesson 1 → earns Tag A
6. Creator goes back to welcome → Lesson 1 = ✅ COMPLETED, Lesson 2 = 🆕 AVAILABLE (unlocked!)
7. Creator passes Lesson 2 → earns Tag B → both completed

---

## Known Limitations (Not Built Yet)

These features are in Testing_P4.md but not implemented yet:

- **Embedded Resources in prompts** — the OSS upload zone for images/videos/audio in trainer prompts (the `oss://` embedding). The markdown editor works, but there's no drag-and-drop upload zone for media yet.
- **Preview as Student** — the button in the editor that lets admins test a prompt with the real LLM without affecting any learner progress. Not built yet.
- **Anti-Cheat Simulator** — the 4 simulation buttons (cheating, random guessing, 5 failures, prompt injection) in the editor. The anti-cheat works on the actual LLM responses, but the admin testing tool isn't built.
- **Upload question file upload in test** — the learner UI shows a placeholder for upload questions. The API endpoint exists (`test-upload` action) but the drag-and-drop file upload in the test chat is not wired.
- **WebSocket real-time** — no real-time push for training events yet (deferred). You need to refresh to see changes across tabs.
- **Drag-and-drop reorder** — prompts and questions can be reordered via API but the drag handles in the UI aren't functional yet (you'd need to delete and re-add in order).

---

## Quick Smoke Test (5 minutes)

If you just want to verify everything works end to end:

1. Admin: Settings > Training > Create Lesson > add 1 prompt + 1 MC question > bind tag > Publish
2. Creator: Go to #beginner-training > click lesson > answer the AI tutor's question correctly > answer the test question correctly
3. Verify: creator got the tag (Settings > My Account > Tags section shows it)
4. Done. The whole pipeline works.

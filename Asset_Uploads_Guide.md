# Asset Uploads & Display — How It Works

This document explains how file uploads, storage, and display work across the entire app.

---

## The Big Picture

All file uploads in the app follow the same pattern:

1. User picks a file (drag-and-drop or click to browse)
2. App tries to upload to **Aliyun OSS** (cloud storage) via a presigned URL
3. If OSS isn't configured, falls back to **local storage** (`public/uploads/`)
4. The file URL is stored in the database (in a JSONB field on the relevant record)
5. When displaying the file, the app generates a **signed URL** (time-limited, 1 hour) because the OSS bucket is private
6. The signed URL is used in `<audio>`, `<video>`, `<img>` tags or as a download link

```
User selects file
  │
  ├─ OSS configured? ──► POST /api/upload/presign
  │                       → gets signed PUT URL (10 min expiry)
  │                       → browser uploads directly to OSS
  │                       → returns public URL (stored in DB)
  │
  └─ OSS not configured? ──► POST /api/upload/local
                              → uploads via FormData to server
                              → saved to public/uploads/
                              → returns local URL (stored in DB)

When displaying:
  GET /api/upload/signed-url?url=<stored-url>
    → returns time-limited signed URL (1 hour)
    → browser renders audio/video/image with signed URL
```

---

## Where Files Are Uploaded

### 1. Task Attachments (Admin/Mod creates a task)

**Who:** Admin, Supermod, or Mod creating a task in Settings > Admin > Tasks
**What:** Reference files for creators — scripts, example videos, guidelines
**Where in UI:** Task creation form → "Attachments" drag-and-drop zone
**Stored in DB:** `tasks.attachments` JSONB field → `[{ name, url, type, size }]`
**OSS path:** `task-attachments/{userId}/{randomId}.{ext}`
**Displayed to:** Creators see them in the task card (compact badge showing file count, expandable to full preview with players + download)

### 2. Attempt Deliverables (Creator submits work)

**Who:** Creator submitting an attempt on a task
**What:** The actual deliverable — voiceover audio, edited video, etc.
**Where in UI:** Task card → "Submit Attempt" → file upload zone + text notes
**Stored in DB:** `attempts.deliverables` JSONB field → `{ text?: string, files?: [{ name, url, type, size }] }`
**OSS path:** `deliverables/{userId}/{randomId}.{ext}`
**Displayed to:**
- Creator sees their own submission in the task card
- Mods/Admins see it on the Review page (`/review`) with full preview (image viewer, audio player, video player, download button)
- Appeals show the original deliverables

### 3. User Avatar

**Who:** Any user updating their profile
**What:** Profile picture
**Where in UI:** Settings > Profile → avatar upload
**Stored in DB:** `users.avatarUrl` text field
**Storage:** Local only (no OSS) — saved to `public/uploads/avatars/{userId}.{ext}`
**Limits:** 2 MB max, PNG/JPG only
**Displayed to:** Everywhere — sidebar user panel, channel messages, settings, admin user list

### 4. Training — Rating Question Sample Content

**Who:** Admin/Supermod creating a Rating test question
**What:** A sample video/audio/image that the learner rates (Good/OK/Bad)
**Where in UI:** Lesson Editor → Test Questions tab → Rating question → "Upload sample content"
**Stored in DB:** `test_questions.options` JSONB field → `{ sampleFile: { name, url, type }, ratingOptions, reasonOptions }`
**OSS path:** `training-samples/{userId}/{randomId}.{ext}` (or `deliverables/` prefix depending on presign context)
**Displayed to:** Learners in `#beginner-training` during the test phase — rendered via `SignedMedia` component with audio/video player + download + open in new tab

### 5. Training — Upload Question Submissions

**Who:** Creator taking a training test with an Upload question
**What:** Their deliverable file (e.g. "Upload a 15-second video with an effective hook")
**Where in UI:** `#beginner-training` → test phase → Upload question → drag-and-drop zone
**Stored in DB:** `upload_submissions` table → `{ fileUrl, fileName, fileType, fileSize, status }`
**OSS path:** `deliverables/{userId}/{randomId}.{ext}`
**Displayed to:** Mods/Admins in the Upload Review queue (Settings > Admin > Upload Reviews) — shown with file preview, user stats, approve/reject buttons

### 6. Training — Trainer Prompt Resources (not yet fully built)

**Who:** Admin/Supermod adding media to trainer prompts
**What:** Images, videos, audio embedded in the AI tutor's lesson content
**Where in UI:** Lesson Editor → Training Prompts tab → Embedded Resources section
**Stored in DB:** `trainer_prompts.resources` JSONB field → `[{ name, url, type, size }]`
**Status:** DB field exists, but the upload UI in the editor isn't fully wired yet

---

## The Upload Component

**File:** `src/components/ui/FileUpload.tsx`

This is the reusable drag-and-drop upload component used everywhere (except avatars which use a simple file input).

**Features:**
- Drag-and-drop zone with click-to-browse fallback
- Real-time upload progress bar per file
- Automatic OSS → local fallback
- File type validation (images, audio, video, PDF, text)
- File size validation (configurable per usage)
- Inline preview (images show thumbnail, audio shows player)
- Remove button (x) per file
- "Slots remaining" counter
- Compact mode for inline forms

**Props:**
```
files          — current uploaded files array
onFilesChange  — callback when files change
context        — "task-attachment" or "attempt-deliverable" (determines OSS prefix)
maxFiles       — max number of files (default 10)
maxSizeMb      — max file size in MB (default 100)
accept         — HTML accept string (e.g. ".mp4,.mov,.avi")
label          — custom label text
compact        — smaller layout for inline use
```

**Accepted file types:** JPEG, PNG, GIF, WebP, MP3, WAV, AAC, M4A, MP4, WebM, MOV, PDF, TXT, Markdown, Word docs

---

## How Private Files Are Served

The OSS bucket is **private** — direct URLs don't work in the browser. Every time a file needs to be displayed:

1. Frontend calls `GET /api/upload/signed-url?url={stored-url}`
2. Server extracts the OSS object key from the URL
3. Server generates a signed GET URL with 1-hour expiry using HMAC-SHA1 signature
4. Frontend uses the signed URL in `<audio src>`, `<video src>`, `<img src>`, or `<a href>`

**Why not make the bucket public?**
- Access control — only authenticated users can view files
- IDOR protection — you can't just guess URLs and access someone else's files
- The signed URL endpoint checks auth cookies before generating URLs

**Local files** (`/uploads/...`) don't need signing — they're served directly by Next.js static file serving.

---

## API Endpoints

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/upload/presign` | POST | Get signed PUT URL for direct OSS upload | Yes |
| `/api/upload/local` | POST | Fallback: upload file to server local storage | Yes |
| `/api/upload/signed-url` | GET | Get signed GET URL for viewing a private OSS file | Yes |
| `/api/settings/avatar` | POST | Upload profile avatar (local only) | Yes |
| `/api/settings/avatar` | DELETE | Remove profile avatar | Yes |

### Presign Request/Response

```
POST /api/upload/presign
{
  "fileName": "my-video.mp4",
  "contentType": "video/mp4",
  "fileSize": 15728640,
  "context": "attempt-deliverable"
}

Response:
{
  "presignedUrl": "https://bucket.oss-cn-beijing.aliyuncs.com/deliverables/userId/abc123.mp4?OSSAccessKeyId=...&Expires=...&Signature=...",
  "objectKey": "deliverables/userId/abc123.mp4",
  "publicUrl": "https://bucket.oss-cn-beijing.aliyuncs.com/deliverables/userId/abc123.mp4"
}
```

The browser then PUTs the file directly to the `presignedUrl`. No file data goes through our server.

### Signed URL Request/Response

```
GET /api/upload/signed-url?url=https://bucket.oss-cn-beijing.aliyuncs.com/deliverables/userId/abc123.mp4

Response:
{
  "signedUrl": "https://bucket.oss-cn-beijing.aliyuncs.com/deliverables/userId/abc123.mp4?OSSAccessKeyId=...&Expires=1711234567&Signature=..."
}
```

---

## OSS Bucket Structure

```
{bucket-name}/
├── task-attachments/
│   └── {userId}/
│       ├── a1b2c3d4.pdf          ← task reference files
│       └── e5f6g7h8.mp4
├── deliverables/
│   └── {userId}/
│       ├── i9j0k1l2.mp4          ← creator submissions
│       └── m3n4o5p6.wav
└── training-samples/
    └── {userId}/
        └── q7r8s9t0.m4a          ← rating question samples
```

Local fallback structure (when OSS not configured):
```
public/uploads/
├── task-attachments/
│   └── a1b2c3d4.pdf
├── deliverables/
│   └── i9j0k1l2.mp4
└── avatars/
    └── {userId}.png
```

---

## Environment Variables

```env
# Required for OSS uploads (if not set, local fallback is used)
OSS_REGION=oss-cn-beijing
OSS_BUCKET=your-bucket-name
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_ENDPOINT=https://oss-cn-beijing.aliyuncs.com
OSS_BUCKET_DOMAIN=your-bucket-name.oss-cn-beijing.aliyuncs.com

# Local uploads directory (optional, defaults to public/uploads)
UPLOAD_DIR=public/uploads
```

**CORS on the OSS bucket must allow:**
- Origins: `http://localhost:3000`, your production domain
- Methods: `GET`, `PUT`, `POST`, `HEAD`
- Headers: `*`
- Expose Headers: `ETag`

---

## Display Components

### FilePreviewList (for task attachments + attempt deliverables)

Shows uploaded files as a list with:
- Image thumbnails (clickable → open in new tab)
- Inline audio player with controls
- Inline video player with controls
- Download button for all file types
- File name + size display
- Auto-resolves signed URLs for OSS files

Used in: Task cards, Review page, Appeal cards

### SignedMedia (for training sample content)

Shows a single media file with:
- Audio player / Video player / Image viewer
- "Open in new tab" link
- "Download" link
- Loading spinner while signed URL resolves
- Error state if file fails to load

Used in: `#beginner-training` test phase (Rating questions)

---

## File Size Limits

| Context | Max Size | Where Enforced |
|---------|----------|----------------|
| Task attachments | 500 MB | Server (presign endpoint) |
| Attempt deliverables | 500 MB | Server (presign endpoint) |
| Local upload fallback | 100 MB | Server (local endpoint) |
| Avatar | 2 MB | Server (avatar endpoint) |
| Training upload questions | Configurable per question | Client + Server |

---

## Summary Flow Diagram

```
ADMIN CREATES CONTENT                    CREATOR CONSUMES CONTENT
─────────────────────                    ────────────────────────

Task with attachments ──► OSS ──► Stored URL in DB
                                    │
                                    ├──► Creator views task
                                    │    └── signed-url → FilePreviewList
                                    │
                                    ├──► Creator submits attempt
                                    │    └── FileUpload → OSS → stored in attempts.deliverables
                                    │
                                    └──► Mod reviews on /review
                                         └── signed-url → FilePreviewList

Lesson with rating sample ──► OSS ──► Stored in test_questions.options
                                       │
                                       └──► Creator takes test
                                            └── signed-url → SignedMedia (audio/video/image player)

Lesson with upload question ──► Config stored in test_questions.options
                                 │
                                 └──► Creator takes test
                                      └── FileUpload → OSS → stored in upload_submissions
                                           │
                                           └──► Mod reviews in Upload Reviews
                                                └── approve/reject → test finalized
```

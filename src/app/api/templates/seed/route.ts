import { NextResponse } from "next/server";
import { db } from "@/db";
import { taskTemplates } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { sql } from "drizzle-orm";
import type { SlotType } from "@/types/deliverable-slot";

const DEFAULT_TEMPLATES = [
  {
    name: "Audio Recording",
    nameCn: "音频录制",
    category: "audio",
    description:
      "Record a clear audio clip following the provided script.\n\n**Requirements:**\n- Format: MP3 or WAV\n- Sample rate: 44.1 kHz or higher\n- Duration: as specified per task\n- No background noise or distortion\n- Clear pronunciation and natural pacing",
    descriptionCn:
      "按照提供的脚本录制清晰的音频片段。\n\n**要求：**\n- 格式：MP3 或 WAV\n- 采样率：44.1 kHz 或更高\n- 时长：按任务要求\n- 无背景噪音或失真\n- 发音清晰，节奏自然",
    bountyUsd: "15.00",
    bountyRmb: "100.00",
    bonusBountyUsd: "5.00",
    bonusBountyRmb: "35.00",
    maxAttempts: 3,
    checklist: [
      { label: "Audio is clear with no background noise" },
      { label: "Sample rate is 44.1 kHz or higher" },
      { label: "Duration matches task requirements" },
      { label: "Pronunciation is clear and natural" },
      { label: "Correct file format (MP3/WAV)" },
      { label: "File size within limits" },
    ],
    selfChecklist: [
      { label: "Record in a quiet environment (closet or treated room)" },
      { label: "Check input levels — peaks below -6dB" },
      { label: "Read the script exactly as provided" },
      { label: "Listen back for background noise before submitting" },
    ],
    deliverableSlots: [
      {
        id: "seed-audio-1", type: "upload-audio" as SlotType, title: "Audio File", description: "Upload your voice recording in MP3 or WAV format",
        checks: [{ label: "Min size: 1 KB" }], required: true,
        minFileSize: 1, minFileSizeUnit: "KB", audioDurationMin: 1, audioDurationOp: "gte",
      },
    ],
  },
  {
    name: "Video Recording",
    nameCn: "视频录制",
    category: "video",
    description:
      "Record a video clip following the provided instructions.\n\n**Requirements:**\n- Format: MP4\n- Resolution: 1080p (1920×1080) minimum\n- Frame rate: 30fps or higher\n- Stable footage (use tripod or stabilizer)\n- Good lighting, no harsh shadows\n- Audio synced if applicable",
    descriptionCn:
      "按照提供的说明录制视频片段。\n\n**要求：**\n- 格式：MP4\n- 分辨率：1080p（1920×1080）最低\n- 帧率：30fps 或更高\n- 稳定画面（使用三脚架或稳定器）\n- 光线良好，无刺眼阴影\n- 音频同步（如适用）",
    bountyUsd: "50.00",
    bountyRmb: "350.00",
    bonusBountyUsd: "15.00",
    bonusBountyRmb: "100.00",
    maxAttempts: 3,
    checklist: [
      { label: "Resolution is 1080p or higher" },
      { label: "Video is stable with no excessive shaking" },
      { label: "Lighting is adequate and consistent" },
      { label: "Correct aspect ratio (16:9)" },
      { label: "Audio is synced and clear (if applicable)" },
      { label: "File format is MP4" },
      { label: "Duration matches task requirements" },
    ],
    selfChecklist: [
      { label: "Use a tripod or stabilizer for steady footage" },
      { label: "Ensure good, even lighting" },
      { label: "Check framing and composition before recording" },
      { label: "Review footage for audio sync issues" },
    ],
    deliverableSlots: [
      {
        id: "seed-video-1", type: "upload-video" as SlotType, title: "Final Video", description: "Upload your edited video in MP4 format",
        checks: [{ label: "Min size: 1 KB" }, { label: "Resolution ≥ 1920x1080" }], required: true,
        minFileSize: 1, minFileSizeUnit: "KB", videoResolution: "1920x1080", videoDurationMin: 1, videoDurationOp: "gte",
      },
      {
        id: "seed-video-2", type: "upload-image" as SlotType, title: "Thumbnail", description: "Upload a thumbnail image (PNG/JPG)",
        checks: [], required: false,
        minFileSize: 1, minFileSizeUnit: "KB",
      },
    ],
  },
  {
    name: "Image Capture",
    nameCn: "图片拍摄",
    category: "image",
    description:
      "Capture or edit images following the provided guidelines.\n\n**Requirements:**\n- Format: PNG or JPG\n- Resolution: 1920×1080 minimum\n- Good composition and framing\n- Proper lighting, no overexposure\n- No watermarks or logos\n- Color-accurate, no heavy filters",
    descriptionCn:
      "按照提供的指南拍摄或编辑图片。\n\n**要求：**\n- 格式：PNG 或 JPG\n- 分辨率：1920×1080 最低\n- 构图合理，画面完整\n- 光线适当，无过曝\n- 无水印或标志\n- 色彩准确，无过度滤镜",
    bountyUsd: "10.00",
    bountyRmb: "70.00",
    bonusBountyUsd: "3.00",
    bonusBountyRmb: "20.00",
    maxAttempts: 5,
    checklist: [
      { label: "Resolution meets minimum requirements" },
      { label: "Image is properly framed and composed" },
      { label: "Lighting is good with no overexposure" },
      { label: "No watermarks or unwanted logos" },
      { label: "Correct file format (PNG/JPG)" },
      { label: "Colors are accurate and natural" },
    ],
    selfChecklist: [
      { label: "Check image resolution before submitting" },
      { label: "Ensure no watermarks or logos are visible" },
      { label: "Verify colors look natural on your screen" },
    ],
    deliverableSlots: [
      {
        id: "seed-image-1", type: "upload-image" as SlotType, title: "Image File", description: "Upload your image in PNG or JPG format",
        checks: [{ label: "Min size: 1 KB" }, { label: "Resolution ≥ 1920x1080" }], required: true,
        minFileSize: 1, minFileSizeUnit: "KB", imageResolution: "1920x1080",
      },
    ],
  },
];

// DELETE /api/templates/seed — wipe all templates and re-seed (admin only)
export async function DELETE() {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.delete(taskTemplates);

    const created = await db
      .insert(taskTemplates)
      .values(
        DEFAULT_TEMPLATES.map((t) => ({
          ...t,
          createdById: auth.userId,
        }))
      )
      .returning();

    return NextResponse.json({ templates: created, reseeded: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/templates/seed — seed default templates (admin only)
export async function POST() {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if templates already exist
    const existing = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(taskTemplates);

    if (existing[0].count > 0) {
      return NextResponse.json({ message: "Templates already exist", seeded: false });
    }

    const created = await db
      .insert(taskTemplates)
      .values(
        DEFAULT_TEMPLATES.map((t) => ({
          ...t,
          createdById: auth.userId,
        }))
      )
      .returning();

    return NextResponse.json({ templates: created, seeded: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

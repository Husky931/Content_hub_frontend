import { NextResponse } from "next/server";
import { db } from "@/db";
import { taskTemplates } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { sql } from "drizzle-orm";

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
  },
];

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

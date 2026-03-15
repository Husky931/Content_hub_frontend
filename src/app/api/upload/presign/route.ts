import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { isOssConfigured, generatePresignedPutUrl } from "@/lib/oss";
import crypto from "crypto";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "audio/mpeg",
  "audio/wav",
  "audio/mp3",
  "audio/x-wav",
  "audio/ogg",
  "audio/aac",
  "audio/x-m4a",
  "audio/mp4",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

/**
 * POST /api/upload/presign
 * Returns a presigned PUT URL for direct browser-to-OSS upload.
 * Body: { fileName: string, contentType: string, fileSize: number, context: "task-attachment" | "attempt-deliverable" }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!isOssConfigured()) {
      return NextResponse.json(
        { error: "File storage is not configured" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { fileName, contentType, fileSize, context } = body;

    if (!fileName || !contentType || !fileSize) {
      return NextResponse.json(
        { error: "fileName, contentType, and fileSize are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: `File type "${contentType}" is not allowed` },
        { status: 400 }
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)} MB` },
        { status: 400 }
      );
    }

    // Generate a unique object key
    const ext = fileName.split(".").pop() || "bin";
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const folder =
      context === "task-attachment" ? "task-attachments" : "deliverables";
    const objectKey = `${folder}/${auth.userId}/${uniqueId}.${ext}`;

    const presignedUrl = generatePresignedPutUrl(objectKey, contentType);

    return NextResponse.json({
      presignedUrl,
      objectKey,
      publicUrl: `https://${process.env.OSS_BUCKET_DOMAIN || ""}/${objectKey}`,
    });
  } catch (error) {
    console.error("Presign error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}

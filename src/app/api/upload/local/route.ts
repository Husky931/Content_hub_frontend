import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB for local fallback

/**
 * POST /api/upload/local
 * Fallback file upload when OSS is not configured.
 * Stores files in public/uploads/files/
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const context = (formData.get("context") as string) || "deliverables";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)} MB` },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "bin";
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const folder =
      context === "task-attachment" ? "task-attachments" : "deliverables";
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      folder
    );
    await mkdir(uploadDir, { recursive: true });

    const filename = `${uniqueId}.${ext}`;
    const filePath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const url = `/uploads/${folder}/${filename}`;

    return NextResponse.json({
      url,
      name: file.name,
      type: file.type,
      size: file.size,
    });
  } catch (error) {
    console.error("Local upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

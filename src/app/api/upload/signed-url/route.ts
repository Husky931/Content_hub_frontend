import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import {
  isOssConfigured,
  getObjectKeyFromUrl,
  generatePresignedGetUrl,
} from "@/lib/oss";

/**
 * GET /api/upload/signed-url?url=<raw-oss-url>
 * Returns a time-limited signed URL for reading a private OSS file.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const rawUrl = req.nextUrl.searchParams.get("url");
    if (!rawUrl) {
      return NextResponse.json(
        { error: "url parameter is required" },
        { status: 400 }
      );
    }

    // Local files don't need signing — return as-is
    if (rawUrl.startsWith("/uploads/") || rawUrl.startsWith("/")) {
      return NextResponse.json({ signedUrl: rawUrl });
    }

    if (!isOssConfigured()) {
      return NextResponse.json(
        { error: "OSS is not configured" },
        { status: 503 }
      );
    }

    const objectKey = getObjectKeyFromUrl(rawUrl);
    if (!objectKey) {
      return NextResponse.json(
        { error: "Invalid OSS URL" },
        { status: 400 }
      );
    }

    const signedUrl = generatePresignedGetUrl(objectKey, 3600); // 1 hour
    return NextResponse.json({ signedUrl });
  } catch (error) {
    console.error("Signed URL error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inviteCodes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateOtp, storeOtp } from "@/lib/otp-store";
import { sendSmsCode } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const { phone, inviteCode } = await req.json();

    if (!phone || !inviteCode) {
      return NextResponse.json(
        { error: "Phone number and invite code are required" },
        { status: 400 }
      );
    }

    // Validate Chinese mobile number format
    const cleaned = phone.replace(/\s/g, "").replace(/^\+?86/, "");
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(cleaned)) {
      return NextResponse.json(
        { error: "Invalid Chinese phone number" },
        { status: 400 }
      );
    }

    // Validate invite code
    const [code] = await db
      .select()
      .from(inviteCodes)
      .where(
        and(
          eq(inviteCodes.code, inviteCode.toUpperCase()),
          eq(inviteCodes.status, "active")
        )
      )
      .limit(1);

    if (!code) {
      return NextResponse.json(
        { error: "Invalid or expired invite code" },
        { status: 400 }
      );
    }

    if (code.useCount >= code.maxUses) {
      return NextResponse.json(
        { error: "Invite code has reached its usage limit" },
        { status: 400 }
      );
    }

    if (code.expiresAt && code.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invite code has expired" },
        { status: 400 }
      );
    }

    // Generate and store OTP
    const otp = generateOtp();
    const rateLimitError = storeOtp(cleaned, otp);
    if (rateLimitError) {
      return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    // Send SMS via Aliyun
    const result = await sendSmsCode(cleaned, otp);
    if (!result.success) {
      console.error("[send-otp] SMS failed:", result.message);
      return NextResponse.json(
        { error: "Failed to send verification code. Please try again." },
        { status: 502 }
      );
    }

    // In development, include the OTP for testing
    const response: Record<string, string> = {
      message: "Verification code sent",
    };
    if (process.env.NODE_ENV === "development") {
      response.devOtp = otp;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[send-otp] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

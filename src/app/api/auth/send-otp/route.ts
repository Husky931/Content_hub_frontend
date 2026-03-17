import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inviteCodes } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// TODO: Integrate Aliyun SMS (阿里云短信服务) to send real OTPs.
// Required env vars: ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET, ALIYUN_SMS_SIGN_NAME, ALIYUN_SMS_TEMPLATE_CODE

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
    const phoneRegex = /^\+?86?1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ""))) {
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

    // TODO: Generate a 6-digit OTP, store it in a short-lived cache/table, and send via Aliyun SMS.
    // Example:
    //   const otp = Math.floor(100000 + Math.random() * 900000).toString();
    //   await storeOtp(phone, otp, ttl: 300s);
    //   await aliyunSms.send({ phone, templateCode, templateParam: { code: otp } });

    return NextResponse.json(
      { error: "SMS service not configured. Phone signup coming soon." },
      { status: 501 }
    );
  } catch (error) {
    console.error("[send-otp] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

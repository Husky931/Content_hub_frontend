import { NextRequest, NextResponse } from "next/server";

// TODO: Integrate Aliyun SMS (阿里云短信服务) to send real OTPs for login.
// Required env vars: ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET, ALIYUN_SMS_SIGN_NAME, ALIYUN_SMS_TEMPLATE_CODE
// Also requires: adding `phone` column to the users schema + DB migration.
//
// Flow:
//   1. Validate phone format
//   2. Look up user by phone (users.phone column)
//   3. Generate 6-digit OTP, store with TTL, send via Aliyun SMS
//   4. Return 200 (generic — don't confirm whether phone is registered)

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const phoneRegex = /^\+?86?1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ""))) {
      return NextResponse.json({ error: "Invalid Chinese phone number" }, { status: 400 });
    }

    return NextResponse.json(
      { error: "SMS service not configured. Phone login coming soon." },
      { status: 501 }
    );
  } catch (error) {
    console.error("[send-login-otp] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

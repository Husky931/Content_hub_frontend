import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateOtp, storeOtp } from "@/lib/otp-store";
import { sendSmsCode } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const cleaned = phone.replace(/\s/g, "").replace(/^\+?86/, "");
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(cleaned)) {
      return NextResponse.json({ error: "Invalid Chinese phone number" }, { status: 400 });
    }

    // Look up user by phone — but don't reveal whether account exists
    const [user] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.phone, cleaned))
      .limit(1);

    // Always return 200 to prevent phone number enumeration
    if (!user || user.status === "banned") {
      // Don't send SMS but pretend we did
      return NextResponse.json({ message: "If this phone is registered, a code has been sent" });
    }

    // Generate and store OTP
    const otp = generateOtp();
    const rateLimitError = storeOtp(`login:${cleaned}`, otp);
    if (rateLimitError) {
      return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    // Send SMS
    const result = await sendSmsCode(cleaned, otp);
    if (!result.success) {
      console.error("[send-login-otp] SMS failed:", result.message);
    }

    const response: Record<string, string> = {
      message: "If this phone is registered, a code has been sent",
    };
    if (process.env.NODE_ENV === "development") {
      response.devOtp = otp;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[send-login-otp] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

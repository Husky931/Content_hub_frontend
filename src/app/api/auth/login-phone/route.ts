import { NextRequest, NextResponse } from "next/server";

// TODO: Implement phone-based login once Aliyun SMS is integrated.
// Flow:
//   1. Look up user by phone number
//   2. Verify the OTP matches what was stored (from send-login-otp)
//   3. Delete/invalidate the OTP entry
//   4. Issue JWT session (same as email login)

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Phone login is not yet available. Please use email login." },
    { status: 501 }
  );
}

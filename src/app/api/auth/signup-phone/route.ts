import { NextRequest, NextResponse } from "next/server";

// TODO: Implement phone-based signup flow once Aliyun SMS is integrated.
// Flow:
//   1. Validate invite code (same checks as /api/auth/signup)
//   2. Verify the OTP matches what was sent to the phone (lookup from cache/table)
//   3. Create user with phone as identifier (no password), status: "active" (already verified via OTP)
//   4. Mark invite code as used
//   5. Issue JWT session

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Phone signup is not yet available. Please use email signup." },
    { status: 501 }
  );
}

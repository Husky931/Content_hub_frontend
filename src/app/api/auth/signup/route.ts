import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, inviteCodes, verificationTokens } from "@/db/schema";
import { hashPassword, generateVerificationToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, username, password, inviteCode } = body;

    // Validate required fields
    if (!email || !username || !password || !inviteCode) {
      return NextResponse.json(
        { error: "All fields are required: email, username, password, inviteCode" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate username (alphanumeric + underscores, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters, alphanumeric and underscores only" },
        { status: 400 }
      );
    }

    // Validate password (8+ chars)
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check invite code
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

    // Check if invite code has remaining uses
    if (code.useCount >= code.maxUses) {
      return NextResponse.json(
        { error: "Invite code has reached its usage limit" },
        { status: 400 }
      );
    }

    // Check expiration
    if (code.expiresAt && code.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invite code has expired" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const [existingEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingEmail) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Check if username already exists
    const [existingUsername] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1);

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    // Create user in PENDING_VERIFICATION state
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        passwordHash: hashPassword(password),
        role: "creator",
        status: "pending_verification",
        displayName: username,
      })
      .returning({ id: users.id, email: users.email });

    // Increment invite code usage
    await db
      .update(inviteCodes)
      .set({
        useCount: code.useCount + 1,
        usedById: newUser.id,
        status: code.useCount + 1 >= code.maxUses ? "used" : "active",
      })
      .where(eq(inviteCodes.id, code.id));

    // Generate verification token (24h TTL)
    const token = generateVerificationToken();
    await db.insert(verificationTokens).values({
      userId: newUser.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Send verification email via Resend
    const emailResult = await sendVerificationEmail(newUser.email, token);

    if (!emailResult.success) {
      console.error("[signup] Failed to send verification email:", emailResult.error);
      // Still return success — user was created, they can request resend later
    }

    return NextResponse.json(
      {
        message: "Account created. Please check your email to verify your account.",
        // DEV ONLY: include verify URL in response for testing
        ...(process.env.NODE_ENV !== "production" && {
          devVerifyUrl: `${req.nextUrl.origin}/api/auth/verify?token=${token}`,
        }),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

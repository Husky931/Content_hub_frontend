/**
 * Email service using Resend.
 *
 * Requires environment variables:
 *   RESEND_API_KEY - Your Resend API key (starts with re_)
 *   NEXT_PUBLIC_APP_URL - Base URL for links in emails (e.g. http://localhost:3000)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Default "from" address — use onboarding@resend.dev if no custom domain verified
const FROM_EMAIL = process.env.EMAIL_FROM || "Content Creator Hub <onboarding@resend.dev>";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("[email] RESEND_API_KEY not set — cannot send email");
    return { success: false, error: "Email service not configured (RESEND_API_KEY missing)" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      console.error("[email] Resend API error:", data);
      return { success: false, error: data.message || "Failed to send email" };
    }

    return { success: true };
  } catch (error) {
    console.error("[email] Failed to send:", error);
    return { success: false, error: "Email service unavailable" };
  }
}

/**
 * Send verification email to a new user.
 */
export async function sendVerificationEmail(email: string, token: string): Promise<{ success: boolean; error?: string }> {
  const verifyUrl = `${APP_URL}/api/auth/verify?token=${token}`;

  return sendEmail({
    to: email,
    subject: "Verify your Content Creator Hub account",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #5865f2; font-size: 24px;">Content Creator Hub</h1>
        <p style="color: #333; font-size: 16px;">Welcome! Click the link below to verify your email address:</p>
        <a href="${verifyUrl}" style="display: inline-block; background: #5865f2; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 14px;">Or copy and paste this URL into your browser:</p>
        <p style="color: #5865f2; font-size: 14px; word-break: break-all;">${verifyUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
  });
}

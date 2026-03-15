import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// GET /api/auth/ws-token — return the JWT token for WebSocket authentication.
// The auth_token cookie is httpOnly so client JS can't read it directly.
// This endpoint simply echoes it back for the WS handshake.
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ token });
}

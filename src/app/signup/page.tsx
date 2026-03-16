"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function SignupPage() {
  const { signup } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [devVerifyUrl, setDevVerifyUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setDevVerifyUrl("");
    setLoading(true);

    const result = await signup({ email, username, password, inviteCode });
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Account created! Check your email to verify your account.");
      if (result.devVerifyUrl) {
        setDevVerifyUrl(result.devVerifyUrl);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-bg-darker">
      <div className="w-full max-w-md">
        <div className="bg-discord-bg rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-discord-text">Join Creator Hub</h1>
            <p className="text-sm text-discord-text-secondary mt-2">You need an invite code to register</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-discord-red/10 border border-discord-red/30 rounded-lg text-sm text-discord-red">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-discord-green/10 border border-discord-green/30 rounded-lg text-sm text-discord-green">
                {success}
              </div>
            )}
            {devVerifyUrl && (
              <div className="p-3 bg-discord-accent/10 border border-discord-accent/30 rounded-lg text-sm">
                <p className="text-discord-text-secondary mb-1 font-semibold">DEV: Click to verify</p>
                <a
                  href={devVerifyUrl}
                  className="text-discord-accent hover:underline break-all text-xs"
                >
                  {devVerifyUrl}
                </a>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2 text-discord-text-secondary uppercase tracking-wide">
                Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full p-3 bg-discord-bg-dark border border-discord-border rounded-lg text-discord-text text-sm font-mono focus:outline-none focus:border-discord-accent"
                placeholder="INV-XXXX-XXXX"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-discord-text-secondary uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-discord-bg-dark border border-discord-border rounded-lg text-discord-text text-sm focus:outline-none focus:border-discord-accent"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-discord-text-secondary uppercase tracking-wide">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 bg-discord-bg-dark border border-discord-border rounded-lg text-discord-text text-sm focus:outline-none focus:border-discord-accent"
                placeholder="your_username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-discord-text-secondary uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-discord-bg-dark border border-discord-border rounded-lg text-discord-text text-sm focus:outline-none focus:border-discord-accent"
                placeholder="••••••••"
                minLength={8}
                required
              />
              <p className="text-xs text-discord-text-muted mt-1">Minimum 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-discord-text-muted mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-discord-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

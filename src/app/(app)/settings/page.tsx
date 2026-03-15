"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/Spinner";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error });
        return;
      }
      await refreshUser();
      setMessage({ type: "success", text: "Profile updated successfully" });
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const currencyLabel = user.currency === "usd" ? "US Dollar (USD)" : user.currency === "rmb" ? "Chinese Yuan (RMB)" : "Not set";

  return (
    <div className="flex-1 overflow-y-auto bg-discord-bg">
      <div className="max-w-2xl mx-auto p-6">
        {/* Account Info (read-only) */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-discord-text mb-4">Account</h3>
          <div className="bg-discord-bg-dark rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-discord-text-muted">Email</span>
              <span className="text-sm text-discord-text">{user.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-discord-text-muted">Username</span>
              <span className="text-sm text-discord-text">{user.username}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-discord-text-muted">Role</span>
              <span className={`text-sm px-2 py-0.5 rounded ${
                user.role === "admin"
                  ? "bg-red-500/20 text-red-300"
                  : user.role === "supermod"
                  ? "bg-indigo-500/20 text-indigo-300"
                  : user.role === "mod"
                  ? "bg-green-500/20 text-green-300"
                  : "bg-blue-500/20 text-blue-300"
              }`}>
                {user.role}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-discord-text-muted">Currency</span>
              <span className="text-sm text-discord-text">{currencyLabel}</span>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div>
          <h3 className="text-lg font-semibold text-discord-text mb-4">Profile</h3>
          <form onSubmit={handleSave} className="bg-discord-bg-dark rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-discord-text-secondary mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user.username}
                maxLength={100}
                className="w-full p-3 bg-discord-bg rounded-lg text-sm text-discord-text placeholder-discord-text-muted focus:outline-none focus:ring-2 focus:ring-discord-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-discord-text-secondary mb-1">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={4}
                maxLength={500}
                className="w-full p-3 bg-discord-bg rounded-lg text-sm text-discord-text placeholder-discord-text-muted focus:outline-none focus:ring-2 focus:ring-discord-accent resize-none"
              />
            </div>

            {message && (
              <p className={`text-sm ${message.type === "success" ? "text-green-400" : "text-discord-red"}`}>
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-discord-accent hover:bg-discord-accent-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50 text-sm flex items-center gap-1"
            >
              {saving ? <Spinner /> : "Save Changes"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

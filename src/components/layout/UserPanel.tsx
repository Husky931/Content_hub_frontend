"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { useTranslations } from "next-intl";

export function UserPanel() {
  const { user, mounted } = useAuth();
  const { openSettings } = useSettingsModal();
  const t = useTranslations("common");

  if (!mounted || !user) return null;

  const initials = (user.displayName || user.username).slice(0, 2).toUpperCase();

  return (
    <div className="h-14 px-2 flex items-center gap-2 bg-discord-bg-darker/50 border-t border-discord-bg-darker shrink-0">
      {/* Avatar + online dot */}
      <div className="relative shrink-0">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
        )}
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-discord-green rounded-full border-2 border-discord-bg-darker" />
      </div>

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-discord-text truncate leading-tight">
          {user.displayName || user.username}
        </div>
        <div className="text-xs text-discord-text-muted leading-tight">{t("online")}</div>
      </div>

      {/* Icons */}
      <div className="flex items-center shrink-0">
        {/* Settings gear */}
        <button
          onClick={() => openSettings()}
          className="p-1.5 text-discord-text-muted hover:text-discord-text transition rounded"
          title={t("userSettings")}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

"use client";

import { createContext, useContext, useState, useCallback } from "react";

type SettingsSection =
  | "my-account"
  | "profile"
  | "admin-overview"
  | "admin-users"
  | "admin-invites"
  | "admin-tags"
  | "admin-tasks"
  | "admin-channels"
  | "admin-audit";

interface SettingsModalContextValue {
  isOpen: boolean;
  initialSection: SettingsSection;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
}

const SettingsModalContext = createContext<SettingsModalContextValue>({
  isOpen: false,
  initialSection: "my-account",
  openSettings: () => {},
  closeSettings: () => {},
});

export function SettingsModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialSection, setInitialSection] = useState<SettingsSection>("my-account");

  const openSettings = useCallback((section?: SettingsSection) => {
    setInitialSection(section || "my-account");
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <SettingsModalContext.Provider value={{ isOpen, initialSection, openSettings, closeSettings }}>
      {children}
    </SettingsModalContext.Provider>
  );
}

export function useSettingsModal() {
  return useContext(SettingsModalContext);
}

export type { SettingsSection };

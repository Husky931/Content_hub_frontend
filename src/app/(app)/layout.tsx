"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { ChannelNavbar } from "@/components/layout/ChannelNavbar";
import { UserSettingsModal } from "@/components/layout/UserSettingsModal";
import { SettingsModalProvider, useSettingsModal } from "@/contexts/SettingsModalContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading, mounted } = useAuth();
  const router = useRouter();
  const { isOpen, initialSection, closeSettings } = useSettingsModal();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (!loading && user && !user.onboardingCompleted) {
      router.push("/onboarding");
    }
  }, [user, loading, router]);

  if (!mounted || loading) return null;
  if (!user) return null;
  if (!user.onboardingCompleted) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChannelNavbar />
        {children}
      </main>
      <UserSettingsModal
        isOpen={isOpen}
        onClose={closeSettings}
        initialSection={initialSection}
      />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SettingsModalProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </SettingsModalProvider>
  );
}

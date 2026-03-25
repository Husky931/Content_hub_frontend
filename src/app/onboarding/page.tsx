"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ButtonSpinner } from "@/components/ui/Spinner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Step = "welcome" | "currency" | "profile" | "done";

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const t = useTranslations("onboarding");

  const STEPS: { id: Step; label: string; num: number }[] = [
    { id: "welcome", label: t("welcome"), num: 1 },
    { id: "currency", label: t("currency"), num: 2 },
    { id: "profile", label: t("profile"), num: 3 },
    { id: "done", label: t("done"), num: 4 },
  ];
  const [step, setStep] = useState<Step>("welcome");
  const [currency, setCurrency] = useState<"usd" | "rmb" | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user?.onboardingCompleted && step !== "done") {
    router.push("/channels");
    return null;
  }

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  const handleComplete = async () => {
    if (!currency) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, displayName, bio }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setStep("done");
      await refreshUser();
    } catch {
      setError(t("somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-discord-bg-darker flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        {/* Outer card */}
        <div className="bg-discord-bg-light rounded-xl p-8 shadow-2xl">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-discord-text mb-1">{t("onboardingFlow")}</h1>
            <p className="text-sm text-discord-text-muted">
              {t("onboardingDescription")}
            </p>
          </div>

          {/* Stepper */}
          <div className="grid grid-cols-4 gap-3 mb-8">
            {STEPS.map((s, i) => {
              const isActive = s.id === step;
              const isCompleted = i < currentIndex;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors ${
                    isActive
                      ? "border-discord-accent bg-discord-bg-hover"
                      : isCompleted
                      ? "border-discord-accent/40 bg-discord-bg-hover/60"
                      : "border-discord-border bg-discord-bg-hover/20"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isActive
                        ? "bg-discord-accent text-white"
                        : isCompleted
                        ? "bg-discord-accent/50 text-white"
                        : "bg-discord-bg-hover text-discord-text-muted"
                    }`}
                  >
                    {isCompleted ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s.num
                    )}
                  </div>
                  <span
                    className={`font-medium text-sm ${
                      isActive ? "text-discord-text" : "text-discord-text-muted"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step content — centered card */}
          <div className="flex justify-center">
            <div className="w-full max-w-lg bg-discord-bg-dark rounded-xl p-8">

              {/* Step 1: Welcome */}
              {step === "welcome" && (
                <div>
                  <div className="flex justify-center mb-5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 text-discord-accent" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10.5 1.5a.75.75 0 00-1.5 0v1.5a.75.75 0 001.5 0V1.5zM5.636 4.136a.75.75 0 011.06 0l1.061 1.06a.75.75 0 01-1.06 1.061l-1.061-1.06a.75.75 0 010-1.061zm11.314 0a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 01-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zM3 9.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5H3zm15.75 0a.75.75 0 000 1.5H20.25a.75.75 0 000-1.5h-1.5zM6.343 15.657a.75.75 0 010-1.06l1.06-1.061a.75.75 0 011.061 1.06l-1.06 1.061a.75.75 0 01-1.061 0zm10.607-1.06a.75.75 0 010 1.06l-1.061 1.061a.75.75 0 01-1.06-1.061l1.06-1.06a.75.75 0 011.061 0zM9.75 15a.75.75 0 000 1.5v1.5a.75.75 0 001.5 0V16.5A.75.75 0 009.75 15z" />
                      <path fillRule="evenodd" d="M9 9a3 3 0 116 0 3 3 0 01-6 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-discord-text mb-3 text-center">
                    {t("welcomeTitle")}
                  </h2>
                  <p className="text-sm text-discord-text-muted mb-6 text-center">
                    {t("invitedDescription")}
                  </p>
                  <div className="flex items-start gap-3 p-4 mb-6 bg-discord-bg/50 border border-discord-border rounded-lg">
                    <div className="shrink-0 w-5 h-5 mt-0.5 text-discord-accent">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-sm text-discord-text-muted">
                      {t("setupTime")}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep("currency")}
                    className="flex items-center gap-2 px-6 py-3 bg-discord-accent hover:bg-discord-accent-hover text-white font-medium rounded-lg transition-colors"
                  >
                    {t("getStarted")}
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Step 2: Currency Selection */}
              {step === "currency" && (
                <div>
                  <h2 className="text-xl font-bold text-discord-text mb-2">
                    {t("currencyTitle")}
                  </h2>
                  <p className="text-sm text-discord-text-muted mb-1">
                    {t("selectCurrencyDescription")}
                  </p>
                  <p className="text-xs text-discord-red mb-6">
                    {t("currencyPermanent")}
                  </p>

                  <div className="space-y-3 mb-6">
                    <button
                      onClick={() => setCurrency("usd")}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                        currency === "usd"
                          ? "border-discord-accent bg-discord-accent/10"
                          : "border-discord-border hover:border-discord-text-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-discord-text-secondary">$</span>
                        <div>
                          <div className="font-medium text-discord-text">{t("usdLabel")}</div>
                          <div className="text-xs text-discord-text-muted">{t("paymentsUsd")}</div>
                        </div>
                        {currency === "usd" && (
                          <div className="ml-auto w-5 h-5 rounded-full bg-discord-accent flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => setCurrency("rmb")}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                        currency === "rmb"
                          ? "border-discord-accent bg-discord-accent/10"
                          : "border-discord-border hover:border-discord-text-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-discord-text-secondary">¥</span>
                        <div>
                          <div className="font-medium text-discord-text">{t("rmbLabel")}</div>
                          <div className="text-xs text-discord-text-muted">{t("paymentsRmb")}</div>
                        </div>
                        {currency === "rmb" && (
                          <div className="ml-auto w-5 h-5 rounded-full bg-discord-accent flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep("welcome")}
                      className="flex items-center gap-2 px-5 py-3 bg-discord-bg-hover text-discord-text-muted font-medium rounded-lg hover:bg-discord-border transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                      </svg>
                      {t("back")}
                    </button>
                    <button
                      onClick={() => currency && setStep("profile")}
                      disabled={!currency}
                      className="flex items-center gap-2 px-6 py-3 bg-discord-accent hover:bg-discord-accent-hover text-white font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t("continue")}
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Profile Setup */}
              {step === "profile" && (
                <div>
                  <h2 className="text-xl font-bold text-discord-text mb-2">
                    {t("profileTitle")}
                  </h2>
                  <p className="text-sm text-discord-text-muted mb-6">
                    {t("profileOptional")}
                  </p>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-discord-text-secondary mb-1">
                        {t("displayName")}
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={user?.username || t("displayNamePlaceholder")}
                        maxLength={100}
                        className="w-full p-3 bg-discord-bg rounded-lg text-sm text-discord-text placeholder-discord-text-muted focus:outline-none focus:ring-2 focus:ring-discord-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-discord-text-secondary mb-1">
                        {t("bio")}
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder={t("bioPlaceholder")}
                        rows={3}
                        maxLength={500}
                        className="w-full p-3 bg-discord-bg rounded-lg text-sm text-discord-text placeholder-discord-text-muted focus:outline-none focus:ring-2 focus:ring-discord-accent resize-none"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-discord-red text-sm mb-4">{error}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep("currency")}
                      className="flex items-center gap-2 px-5 py-3 bg-discord-bg-hover text-discord-text-muted font-medium rounded-lg hover:bg-discord-border transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                      </svg>
                      {t("back")}
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={submitting}
                      className="flex items-center gap-2 px-6 py-3 bg-discord-accent hover:bg-discord-accent-hover text-white font-medium rounded-lg transition-colors disabled:opacity-40"
                    >
                      <ButtonSpinner loading={submitting}>{t("completeSetup")}</ButtonSpinner>
                      {!submitting && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Done */}
              {step === "done" && (
                <div className="text-center">
                  <div className="flex justify-center mb-5">
                    <div className="w-16 h-16 rounded-full bg-discord-green/20 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-discord-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-discord-text mb-3">
                    {t("allDoneWelcome")}
                  </h2>
                  <p className="text-sm text-discord-text-muted mb-6">
                    {t("allSetDescription")}
                  </p>
                  <button
                    onClick={() => router.push("/channels")}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-discord-accent hover:bg-discord-accent-hover text-white font-medium rounded-lg transition-colors"
                  >
                    {t("ok")}
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

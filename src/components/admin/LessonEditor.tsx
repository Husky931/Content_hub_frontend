"use client";

import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui/Spinner";

interface TrainerPrompt {
  id: string;
  order: number;
  content: string;
  resources: { name: string; url: string; type: string; size: number }[] | null;
}

interface TestQuestion {
  id: string;
  type: "mc" | "tf" | "rating" | "upload";
  prompt: string;
  promptCn?: string | null;
  options: unknown;
  correctAnswers: unknown;
  points: number;
  sortOrder: number;
}

interface LessonDetail {
  id: string;
  title: string;
  titleCn?: string | null;
  description?: string | null;
  descriptionCn?: string | null;
  order: number;
  status: "draft" | "published";
  tagId?: string | null;
  prerequisiteTagId?: string | null;
  passingScore: number;
  retryAfterHours: number;
  prompts: TrainerPrompt[];
  test: { id: string; questions: TestQuestion[] } | null;
  tag: { id: string; name: string; color: string } | null;
  prerequisiteTag: { id: string; name: string } | null;
}

interface Tag {
  id: string;
  name: string;
  nameCn?: string | null;
  color: string;
}

export function LessonEditor({
  lessonId,
  onBack,
  onNavigateToTags,
}: {
  lessonId: string;
  onBack: () => void;
  onNavigateToTags?: () => void;
}) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"prompts" | "test" | "settings">(
    "prompts"
  );
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);

  // Prompt editing
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [promptContent, setPromptContent] = useState("");
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);

  // Settings editing
  const [settingsForm, setSettingsForm] = useState({
    title: "",
    titleCn: "",
    description: "",
    descriptionCn: "",
    passingScore: 100,
    retryAfterHours: 24,
    tagId: "",
    prerequisiteTagId: "",
    order: 0,
  });

  useEffect(() => {
    loadLesson();
    loadTags();
  }, [lessonId]);

  async function loadLesson() {
    setLoading(true);
    try {
      const res = await fetch(`/api/training/lessons/${lessonId}`);
      if (res.ok) {
        const data: LessonDetail = await res.json();
        setLesson(data);
        setSettingsForm({
          title: data.title || "",
          titleCn: data.titleCn || "",
          description: data.description || "",
          descriptionCn: data.descriptionCn || "",
          passingScore: data.passingScore,
          retryAfterHours: data.retryAfterHours,
          tagId: data.tagId || "",
          prerequisiteTagId: data.prerequisiteTagId || "",
          order: data.order,
        });
        // Select first prompt if any
        if (data.prompts.length > 0 && !selectedPromptId) {
          setSelectedPromptId(data.prompts[0].id);
          setPromptContent(data.prompts[0].content);
        }
      }
    } catch (err) {
      console.error("Failed to load lesson:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTags() {
    try {
      const res = await fetch("/api/admin/tags");
      if (res.ok) {
        const data = await res.json();
        setTags(Array.isArray(data) ? data : data.tags ?? []);
      }
    } catch { }
  }

  // ── Prompt Operations ──

  async function addPrompt() {
    try {
      const res = await fetch(`/api/training/lessons/${lessonId}/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:
            "### Question\n\nWrite your question here.\n\n### Correct Answer\n\nWhat counts as correct.\n\n### Hints\n\n1. First hint\n2. Second hint\n3. Third hint\n\n### Wrong Answer Guidance\n\nCommon mistakes and redirects.\n\n### After Correct\n\nTransition message to next question.",
        }),
      });
      if (res.ok) {
        await loadLesson();
      }
    } catch (err) {
      console.error("Failed to add prompt:", err);
    }
  }

  async function savePrompt() {
    if (!selectedPromptId) return;
    setPromptSaving(true);
    setPromptSaved(false);
    try {
      await fetch(`/api/training/prompts/${selectedPromptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: promptContent }),
      });
      await loadLesson();
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save prompt:", err);
    } finally {
      setPromptSaving(false);
    }
  }

  async function deletePrompt(promptId: string) {
    if (!confirm("Delete this trainer prompt?")) return;
    try {
      await fetch(`/api/training/prompts/${promptId}`, { method: "DELETE" });
      if (selectedPromptId === promptId) {
        setSelectedPromptId(null);
        setPromptContent("");
      }
      await loadLesson();
    } catch (err) {
      console.error("Failed to delete prompt:", err);
    }
  }

  // ── Question Operations ──

  async function addQuestion(type: "mc" | "tf" | "rating" | "upload") {
    const defaults: Record<string, { options: unknown; correctAnswers: unknown; prompt: string }> = {
      mc: {
        prompt: "What is the correct answer?",
        options: { options: ["Option A", "Option B", "Option C", "Option D"] },
        correctAnswers: { correctIndex: 0 },
      },
      tf: {
        prompt: "This statement is true or false.",
        options: null,
        correctAnswers: { correct: true },
      },
      rating: {
        prompt: "Rate this content sample.",
        options: {
          ratingOptions: ["Good", "OK", "Bad"],
          reasonOptions: ["Reason 1", "Reason 2", "Reason 3"],
        },
        correctAnswers: { correctRating: "Bad", correctReasonIndex: 0 },
      },
      upload: {
        prompt: "Upload your deliverable file.",
        options: {
          acceptedTypes: ["mp4", "mov", "avi"],
          maxSize: 200 * 1024 * 1024,
        },
        correctAnswers: null,
      },
    };

    const d = defaults[type];
    try {
      const res = await fetch(
        `/api/training/lessons/${lessonId}/questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            prompt: d.prompt,
            options: d.options,
            correctAnswers: d.correctAnswers,
            points: 25,
          }),
        }
      );
      if (res.ok) await loadLesson();
    } catch (err) {
      console.error("Failed to add question:", err);
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!confirm("Delete this test question?")) return;
    try {
      await fetch(`/api/training/questions/${questionId}`, {
        method: "DELETE",
      });
      await loadLesson();
    } catch (err) {
      console.error("Failed to delete question:", err);
    }
  }

  async function updateQuestion(questionId: string, updates: Record<string, unknown>) {
    try {
      await fetch(`/api/training/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      await loadLesson();
    } catch (err) {
      console.error("Failed to update question:", err);
    }
  }

  // ── Settings Operations ──

  async function saveSettings() {
    setSaving(true);
    try {
      await fetch(`/api/training/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settingsForm,
          tagId: settingsForm.tagId || null,
          prerequisiteTagId: settingsForm.prerequisiteTagId || null,
        }),
      });
      await loadLesson();
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !lesson) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const questions = [...(lesson.test?.questions || [])].sort((a, b) => b.sortOrder - a.sortOrder);
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb Header */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={onBack}
          className="text-sm text-discord-accent hover:text-discord-accent/80 hover:underline cursor-pointer font-medium"
        >
          Training Management
        </button>
        <svg className="w-3.5 h-3.5 text-discord-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <h2 className="text-lg font-bold text-discord-text truncate">{lesson.title}</h2>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${lesson.status === "published"
            ? "bg-green-500/20 text-green-300"
            : "bg-yellow-500/20 text-yellow-300"
            }`}
        >
          {lesson.status.toUpperCase()}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-discord-bg-darker/60">
        {(
          [
            { id: "prompts", label: "Training Prompts" },
            { id: "test", label: "Test Questions" },
            { id: "settings", label: "Settings & Tag" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition cursor-pointer ${activeTab === tab.id
              ? "text-discord-text border-discord-accent"
              : "text-discord-text-muted border-transparent hover:text-discord-text"
              }`}
          >
            {tab.label}
            {tab.id === "prompts" && (
              <span className="ml-1.5 text-[10px] text-discord-text-muted">
                ({lesson.prompts.length})
              </span>
            )}
            {tab.id === "test" && (
              <span className="ml-1.5 text-[10px] text-discord-text-muted">
                ({questions.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 1: Training Prompts */}
      {activeTab === "prompts" && (
        <div>
          {/* Prompt list */}
          <div className="flex gap-2 flex-wrap mb-4">
            {lesson.prompts.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer border transition ${selectedPromptId === p.id
                  ? "bg-discord-accent/20 border-discord-accent text-discord-text"
                  : "bg-discord-bg-dark border-discord-bg-darker/60 text-discord-text-muted hover:bg-discord-bg-hover"
                  }`}
                onClick={() => {
                  if (selectedPromptId === p.id) {
                    setSelectedPromptId(null);
                    setPromptContent("");
                  } else {
                    setSelectedPromptId(p.id);
                    setPromptContent(p.content);
                  }
                }}
              >
                <span className="font-mono text-[10px]">#{i + 1}</span>
                <span className="text-xs truncate max-w-[120px]">
                  {p.content.split("\n")[0].replace(/^#+\s*/, "") || "Empty"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePrompt(p.id);
                  }}
                  className="text-red-400 hover:text-red-300 text-[10px] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={addPrompt}
              className="px-3 py-2 rounded-lg text-sm bg-discord-accent/10 text-discord-accent border border-discord-accent/30 hover:bg-discord-accent/20 cursor-pointer"
            >
              + Add Prompt
            </button>
          </div>

          {/* Prompt editor */}
          {selectedPromptId ? (
            <div>
              <div className="bg-discord-bg-dark rounded-lg p-1 border border-discord-bg-darker/60 mb-3">
                <textarea
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  className="w-full bg-transparent text-sm text-discord-text p-3 min-h-[400px] resize-y font-mono leading-relaxed focus:outline-none"
                  placeholder="Write trainer prompt markdown here..."
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={savePrompt}
                  disabled={promptSaving}
                  className="px-4 py-2 bg-discord-accent text-white rounded text-sm font-medium hover:bg-discord-accent/80 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  {promptSaving && <Spinner className="w-3 h-3" />}
                  Save Prompt
                </button>
                {promptSaved && (
                  <span className="flex items-center gap-1 text-xs text-green-400 font-medium animate-in fade-in">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
                <span className="text-[10px] text-discord-text-muted">
                  Sections: ### Question, ### Correct Answer, ### Hints, ### Wrong Answer Guidance, ### After Correct
                </span>
              </div>


            </div>
          ) : (
            <div className="bg-discord-bg-dark rounded-lg p-12 text-center border border-discord-bg-darker/60">
              <p className="text-discord-text-muted">
                {lesson.prompts.length === 0
                  ? "Add your first trainer prompt to get started."
                  : "Select a prompt from the list above to edit."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Test Questions */}
      {activeTab === "test" && (
        <div>
          {/* Add buttons */}
          <div className="flex gap-2 mb-4">
            {(
              [
                { type: "mc" as const, label: "Multiple Choice", icon: "Aa", color: "blue" },
                { type: "tf" as const, label: "True / False", icon: "T/F", color: "purple" },
                { type: "rating" as const, label: "Rating", icon: "★", color: "yellow" },
                { type: "upload" as const, label: "Upload", icon: "↑", color: "orange" },
              ] as const
            ).map(({ type, label, icon, color }) => {
              const hasQuestions = questions.some((q) => q.type === type);
              const colorMap: Record<string, { active: string; idle: string }> = {
                blue: { active: "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-blue-500/10 shadow-sm", idle: "bg-discord-bg text-discord-text-muted border-discord-bg-darker/60 hover:border-blue-500/30 hover:text-blue-300" },
                purple: { active: "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-purple-500/10 shadow-sm", idle: "bg-discord-bg text-discord-text-muted border-discord-bg-darker/60 hover:border-purple-500/30 hover:text-purple-300" },
                yellow: { active: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40 shadow-yellow-500/10 shadow-sm", idle: "bg-discord-bg text-discord-text-muted border-discord-bg-darker/60 hover:border-yellow-500/30 hover:text-yellow-300" },
                orange: { active: "bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-orange-500/10 shadow-sm", idle: "bg-discord-bg text-discord-text-muted border-discord-bg-darker/60 hover:border-orange-500/30 hover:text-orange-300" },
              };
              const styles = colorMap[color];
              return (
                <button
                  key={type}
                  onClick={() => addQuestion(type)}
                  className={`px-4 py-2.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-2 ${
                    hasQuestions ? styles.active : styles.idle
                  }`}
                >
                  <span className="text-sm font-bold opacity-70">{icon}</span>
                  + {label}
                </button>
              );
            })}
          </div>

          {/* Questions list */}
          {questions.length === 0 ? (
            <div className="bg-discord-bg-dark rounded-lg p-12 text-center border border-discord-bg-darker/60">
              <p className="text-discord-text-muted">
                Add your first test question.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={i}
                  onUpdate={(updates) => updateQuestion(q.id, updates)}
                  onDelete={() => deleteQuestion(q.id)}
                />
              ))}
            </div>
          )}

          {/* Test settings */}
          <div className="mt-6 bg-discord-bg-dark rounded-lg p-4 border border-discord-bg-darker/60">
            <div className="grid grid-cols-3 gap-4 text-xs text-discord-text-muted">
              <div>
                <span className="uppercase text-[10px]">Total Points</span>
                <div className="text-lg font-bold text-discord-text">
                  {totalPoints}
                </div>
              </div>
              <div>
                <span className="uppercase text-[10px]">Pass Threshold</span>
                <div className="text-lg font-bold text-discord-text">
                  {lesson.passingScore}%
                </div>
              </div>
              <div>
                <span className="uppercase text-[10px]">Retry Cooldown</span>
                <div className="text-lg font-bold text-discord-text">
                  {lesson.retryAfterHours}h
                </div>
              </div>
            </div>
            <p className="text-[10px] text-discord-text-muted mt-3 leading-relaxed">
              <strong className="text-discord-text">Behind the scenes:</strong>{" "}
              Tests are fully deterministic — no LLM involved. MC, T/F, Rating
              auto-scored. Upload questions go to Upload Review queue for human
              grading. Test not finalized until all uploads reviewed.
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Settings & Tag */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          {/* Tag Binding */}
          <div className="bg-discord-bg-dark rounded-lg border border-yellow-500/30 overflow-hidden">
            <div className="px-5 py-3 border-b border-yellow-500/20">
              <h3 className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
                <span>🏷</span> Tag Binding
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-discord-text-muted leading-relaxed">
                {"When a learner passes this lesson's test, the following tag is written to their profile via the host platform's webhook API."}
              </p>

              {/* Tag selector + Create New */}
              <div>
                <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                  Tag ID to Award
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={settingsForm.tagId}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, tagId: e.target.value })
                    }
                    className="flex-1 bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2.5 text-sm text-discord-text cursor-pointer font-mono"
                  >
                    <option value="">No tag selected (required to publish)</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.nameCn ? ` (${t.nameCn})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onNavigateToTags?.()}
                    className="px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition cursor-pointer shrink-0"
                  >
                    Create New Tag
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Lesson Metadata */}
          <div className="bg-discord-bg-dark rounded-lg border border-discord-bg-darker/60 overflow-hidden">
            <div className="px-5 py-3 border-b border-discord-bg-darker/40">
              <h3 className="text-sm font-semibold text-discord-text flex items-center gap-2">
                <span>⚙</span> Lesson Metadata
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {/* Title + Description */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    value={settingsForm.title}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, title: e.target.value })
                    }
                    className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2.5 text-sm text-discord-text"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                    Description
                  </label>
                  <input
                    type="text"
                    value={settingsForm.description}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, description: e.target.value })
                    }
                    className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2.5 text-sm text-discord-text"
                  />
                </div>
              </div>

              {/* Prerequisite Tag + Order + Passing Score */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                    Prerequisite Tag
                  </label>
                  <select
                    value={settingsForm.prerequisiteTagId}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, prerequisiteTagId: e.target.value })
                    }
                    className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2.5 text-sm text-discord-text cursor-pointer"
                  >
                    <option value="">None (first lesson)</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                    Order
                  </label>
                  <input
                    type="number"
                    value={settingsForm.order}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, order: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2.5 text-sm text-discord-text"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                    Passing Score
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={settingsForm.passingScore}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, passingScore: parseInt(e.target.value) || 100 })
                      }
                      className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2.5 text-sm text-discord-text"
                    />
                    <span className="text-sm text-discord-text-muted">%</span>
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="pt-2">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="px-5 py-2.5 bg-discord-accent text-white rounded-lg text-sm font-medium hover:bg-discord-accent/80 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  {saving && <Spinner className="w-3 h-3" />}
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Question Card Component ─────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  onUpdate,
  onDelete,
}: {
  question: TestQuestion;
  index: number;
  onUpdate: (updates: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [prompt, setPrompt] = useState(question.prompt);
  const [points, setPoints] = useState(question.points);
  const [options, setOptions] = useState<string[]>(
    (question.options as { options?: string[] })?.options || []
  );
  const [correctIndex, setCorrectIndex] = useState<number>(
    (question.correctAnswers as { correctIndex?: number })?.correctIndex ?? 0
  );
  const [tfCorrect, setTfCorrect] = useState<boolean>(
    (question.correctAnswers as { correct?: boolean })?.correct ?? true
  );
  // Rating state
  const ratingOpts = (question.options as { ratingOptions?: string[]; reasonOptions?: string[]; sampleFile?: { name: string; url: string; type: string } }) || {};
  const ratingAnswers = (question.correctAnswers as { correctRating?: string; correctReasonIndex?: number }) || {};
  const [correctRating, setCorrectRating] = useState<string>(ratingAnswers.correctRating ?? "Bad");
  const [reasonOptions, setReasonOptions] = useState<string[]>(ratingOpts.reasonOptions || ["Reason 1"]);
  const [correctReasonIndex, setCorrectReasonIndex] = useState<number>(ratingAnswers.correctReasonIndex ?? 0);
  const [sampleFile, setSampleFile] = useState<{ name: string; url: string; type: string } | null>(ratingOpts.sampleFile || null);
  const [uploading, setUploading] = useState(false);
  // Upload question state
  const uploadOpts = (question.options as { acceptedTypes?: string[]; maxSize?: number }) || {};
  const [acceptedTypes, setAcceptedTypes] = useState<string[]>(uploadOpts.acceptedTypes || ["mp4", "mov", "avi"]);
  const [maxSizeMB, setMaxSizeMB] = useState<number>(Math.round((uploadOpts.maxSize || 200 * 1024 * 1024) / (1024 * 1024)));

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  const typeBadge: Record<string, { label: string; color: string }> = {
    mc: { label: "MC", color: "bg-blue-500/20 text-blue-300" },
    tf: { label: "T/F", color: "bg-purple-500/20 text-purple-300" },
    rating: { label: "RATING", color: "bg-yellow-500/20 text-yellow-300" },
    upload: { label: "UPLOAD", color: "bg-orange-500/20 text-orange-300" },
  };

  const badge = typeBadge[question.type] || {
    label: question.type,
    color: "bg-gray-500/20 text-gray-300",
  };

  function markDirty() {
    setDirty(true);
  }

  async function handleSampleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          prefix: "training-samples",
        }),
      });
      if (!presignRes.ok) {
        // Fallback to local upload
        const formData = new FormData();
        formData.append("file", file);
        const localRes = await fetch("/api/upload/local", { method: "POST", body: formData });
        if (localRes.ok) {
          const data = await localRes.json();
          setSampleFile({ name: file.name, url: data.url, type: file.type });
          markDirty();
        }
        return;
      }
      const { presignedUrl, publicUrl } = await presignRes.json();
      await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      setSampleFile({ name: file.name, url: publicUrl, type: file.type });
      markDirty();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  function saveQuestion() {
    setSaving(true);
    const updates: Record<string, unknown> = { prompt, points };
    if (question.type === "mc") {
      updates.options = { options };
      updates.correctAnswers = { correctIndex };
    } else if (question.type === "tf") {
      updates.correctAnswers = { correct: tfCorrect };
    } else if (question.type === "rating") {
      updates.options = {
        ratingOptions: ["Good", "OK", "Bad"],
        reasonOptions,
        sampleFile,
      };
      updates.correctAnswers = { correctRating, correctReasonIndex };
    } else if (question.type === "upload") {
      updates.options = {
        acceptedTypes,
        maxSize: maxSizeMB * 1024 * 1024,
      };
    }
    onUpdate(updates);
    setDirty(false);
    setSaving(false);
  }

  return (
    <div className="bg-discord-bg-dark rounded-lg border border-discord-bg-darker/60 overflow-hidden">
      {/* Header bar — click to toggle collapse */}
      <div
        className="px-4 py-3 flex items-center gap-3 border-b border-discord-bg-darker/40 cursor-pointer select-none hover:bg-discord-bg-hover/20 transition"
        onClick={() => setCollapsed(!collapsed)}
      >
        <svg
          className={`w-3.5 h-3.5 text-discord-text-muted transition-transform shrink-0 ${collapsed ? "" : "rotate-90"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${badge.color}`}
        >
          {badge.label}
        </span>
        <span className="text-sm font-medium text-discord-text flex-1 truncate">
          Q{index + 1}: {prompt || "Untitled question"}
        </span>
        {question.type === "upload" && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-300">
            HUMAN REVIEWED
          </span>
        )}
        <span className="text-[10px] text-discord-text-muted">
          {points} pts
        </span>
        {dirty && (
          <span className="w-2 h-2 rounded-full bg-discord-accent shrink-0" title="Unsaved changes" />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-discord-text-muted hover:text-red-400 cursor-pointer"
          title="Delete question"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Editor body — collapsible */}
      {!collapsed && <div className="p-4 space-y-4">
        {/* Question prompt (not shown for T/F or Upload — they have their own input) */}
        {question.type !== "tf" && question.type !== "upload" && (
          <div>
            <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
              Question Prompt
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); markDirty(); }}
              className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2.5 text-sm text-discord-text placeholder-discord-text-muted"
              placeholder="Write your question here..."
            />
          </div>
        )}

        {/* MC: Editable options with click-to-mark-correct */}
        {question.type === "mc" && (
          <div>
            <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
              Options (click to mark correct)
            </label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-3">
                  {/* Radio circle — click to mark correct */}
                  <button
                    onClick={() => { setCorrectIndex(i); markDirty(); }}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition ${correctIndex === i
                      ? "border-green-500 bg-green-500"
                      : "border-discord-text-muted/40 hover:border-discord-text-muted"
                      }`}
                    title={correctIndex === i ? "Correct answer" : "Click to mark as correct"}
                  >
                    {correctIndex === i && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Editable option text */}
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...options];
                      newOpts[i] = e.target.value;
                      setOptions(newOpts);
                      markDirty();
                    }}
                    className={`flex-1 bg-discord-bg border rounded-lg px-4 py-2.5 text-sm text-discord-text placeholder-discord-text-muted ${correctIndex === i
                      ? "border-green-500/40"
                      : "border-discord-bg-darker/60"
                      }`}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  />

                  {/* Remove option */}
                  {options.length > 2 && (
                    <button
                      onClick={() => {
                        const newOpts = options.filter((_, j) => j !== i);
                        setOptions(newOpts);
                        if (correctIndex >= newOpts.length) setCorrectIndex(newOpts.length - 1);
                        else if (correctIndex > i) setCorrectIndex(correctIndex - 1);
                        markDirty();
                      }}
                      className="text-discord-text-muted hover:text-red-400 cursor-pointer shrink-0"
                      title="Remove option"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add option */}
            {options.length < 6 && (
              <button
                onClick={() => {
                  setOptions([...options, ""]);
                  markDirty();
                }}
                className="mt-2 text-xs text-discord-accent hover:text-discord-accent/80 cursor-pointer font-medium"
              >
                + Add Option
              </button>
            )}
          </div>
        )}

        {/* TF: Statement input + two large toggle buttons */}
        {question.type === "tf" && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                Statement
              </label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); markDirty(); }}
                className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2.5 text-sm text-discord-text placeholder-discord-text-muted"
                placeholder="Write a true or false statement..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([true, false] as const).map((val) => {
                const isSelected = tfCorrect === val;
                const colorClass = val
                  ? (isSelected ? "border-green-500/60 bg-green-500/10 text-green-300" : "border-discord-bg-darker/60 text-discord-text-muted hover:border-discord-text-muted/40")
                  : (isSelected ? "border-red-500/60 bg-red-500/10 text-red-300" : "border-discord-bg-darker/60 text-discord-text-muted hover:border-discord-text-muted/40");
                return (
                  <button
                    key={String(val)}
                    onClick={() => { setTfCorrect(val); markDirty(); }}
                    className={`py-4 rounded-lg border-2 text-sm font-medium cursor-pointer transition flex items-center justify-center gap-2 ${colorClass}`}
                  >
                    {val ? "True" : "False"}
                    {isSelected && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Rating: sample file + rating buttons + reason options */}
        {question.type === "rating" && (
          <div className="space-y-4">
            {/* Embedded sample content */}
            <div>
              <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                Embedded Sample Content
              </label>
              {sampleFile ? (
                <div className="flex items-center gap-3 bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2.5">
                  <span className="text-sm">
                    {sampleFile.type.startsWith("video") ? "🎬" : sampleFile.type.startsWith("audio") ? "🎵" : "🖼️"}
                  </span>
                  <span className="text-sm text-discord-text font-medium">{sampleFile.name}</span>
                  <span className="text-xs text-discord-text-muted">({sampleFile.url})</span>
                  <button
                    onClick={() => { setSampleFile(null); markDirty(); }}
                    className="ml-auto text-discord-text-muted hover:text-red-400 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="block bg-discord-bg border border-dashed border-discord-bg-darker/60 rounded-lg px-4 py-4 text-center cursor-pointer hover:border-discord-text-muted/40 transition">
                  <input
                    type="file"
                    accept="video/*,audio/*,image/*"
                    onChange={handleSampleUpload}
                    className="hidden"
                  />
                  {uploading ? (
                    <span className="text-xs text-discord-text-muted flex items-center justify-center gap-2">
                      <Spinner className="w-3 h-3" /> Uploading...
                    </span>
                  ) : (
                    <span className="text-xs text-discord-text-muted">
                      Click to upload a sample video, audio, or image for rating
                    </span>
                  )}
                </label>
              )}
            </div>

            {/* Rating options: Good / OK / Bad */}
            <div>
              <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                Rating Options
              </label>
              <div className="flex gap-2">
                {["Good", "OK", "Bad"].map((rating) => {
                  const isSelected = correctRating === rating;
                  const colorClass = rating === "Bad"
                    ? (isSelected ? "border-red-500/60 bg-red-500/10 text-red-300" : "border-discord-bg-darker/60 text-discord-text hover:border-discord-text-muted/40")
                    : (isSelected ? "border-green-500/60 bg-green-500/10 text-green-300" : "border-discord-bg-darker/60 text-discord-text hover:border-discord-text-muted/40");
                  return (
                    <button
                      key={rating}
                      onClick={() => { setCorrectRating(rating); markDirty(); }}
                      className={`px-5 py-2.5 rounded-lg border-2 text-sm font-medium cursor-pointer transition flex items-center gap-1.5 ${colorClass}`}
                    >
                      {rating}
                      {isSelected && (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reason options (shown when "Bad" is correct) */}
            {correctRating === "Bad" && (
              <div>
                <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                  {`Reason Options (when rated "Bad")`}
                </label>
                <div className="space-y-2">
                  {reasonOptions.map((reason, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <button
                        onClick={() => { setCorrectReasonIndex(i); markDirty(); }}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition ${correctReasonIndex === i
                          ? "border-green-500 bg-green-500"
                          : "border-discord-text-muted/40 hover:border-discord-text-muted"
                          }`}
                      >
                        {correctReasonIndex === i && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => {
                          const newReasons = [...reasonOptions];
                          newReasons[i] = e.target.value;
                          setReasonOptions(newReasons);
                          markDirty();
                        }}
                        className="flex-1 bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2 text-sm text-discord-text placeholder-discord-text-muted"
                        placeholder={`Reason ${i + 1}`}
                      />
                      {reasonOptions.length > 1 && (
                        <button
                          onClick={() => {
                            const newReasons = reasonOptions.filter((_, j) => j !== i);
                            setReasonOptions(newReasons);
                            if (correctReasonIndex >= newReasons.length) setCorrectReasonIndex(newReasons.length - 1);
                            else if (correctReasonIndex > i) setCorrectReasonIndex(correctReasonIndex - 1);
                            markDirty();
                          }}
                          className="text-discord-text-muted hover:text-red-400 cursor-pointer shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setReasonOptions([...reasonOptions, ""]); markDirty(); }}
                  className="mt-2 text-xs text-discord-accent hover:text-discord-accent/80 cursor-pointer font-medium"
                >
                  + Add Reason
                </button>
              </div>
            )}
          </div>
        )}

        {/* Upload: prompt + file type config + size config + warning */}
        {question.type === "upload" && (
          <div className="space-y-4">
            {/* Prompt */}
            <div>
              <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                Prompt
              </label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); markDirty(); }}
                className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2.5 text-sm text-discord-text placeholder-discord-text-muted"
                placeholder="Describe what the learner should upload..."
              />
            </div>

            {/* File types + max size */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                  Accepted File Types
                </label>
                {/* Read-only display of current types */}
                <div className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2.5 text-sm text-discord-text">
                  {acceptedTypes.map((t) => t.toUpperCase()).join(", ")}
                </div>
                {/* Preset buttons to change */}
                <div className="flex gap-1.5 mt-2">
                  {[
                    { label: "Video", types: ["mp4", "mov", "avi"] },
                    { label: "Audio", types: ["mp3", "wav", "aac"] },
                    { label: "Image", types: ["jpg", "png", "gif"] },
                    { label: "All Media", types: ["mp4", "mov", "avi", "mp3", "wav", "jpg", "png", "gif"] },
                  ].map((preset) => {
                    const isActive = preset.types.length === acceptedTypes.length && preset.types.every((t) => acceptedTypes.includes(t));
                    return (
                      <button
                        key={preset.label}
                        onClick={() => { setAcceptedTypes(preset.types); markDirty(); }}
                        className={`px-2.5 py-1 rounded text-[10px] cursor-pointer transition ${isActive
                          ? "bg-discord-accent/20 text-discord-accent border border-discord-accent/30"
                          : "bg-discord-bg text-discord-text-muted border border-discord-bg-darker/60 hover:border-discord-text-muted/40"
                          }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1.5">
                  Max File Size
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={maxSizeMB === 0 ? "" : maxSizeMB}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setMaxSizeMB(raw === "" ? 0 : parseInt(raw));
                      markDirty();
                    }}
                    onBlur={() => { if (maxSizeMB === 0) setMaxSizeMB(200); }}
                    className="w-24 bg-discord-bg border border-discord-bg-darker/60 rounded-lg px-4 py-2.5 text-sm text-discord-text"
                  />
                  <span className="text-sm text-discord-text-muted">MB</span>
                </div>
              </div>
            </div>

            {/* Human reviewed warning */}
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 flex gap-3">
              <span className="text-orange-400 shrink-0">&#9888;</span>
              <p className="text-xs text-orange-300 leading-relaxed">
                <strong>Human Reviewed:</strong> This question{"'"}s submissions go to the <strong>Upload Review</strong> queue.
                The test is held as {"\""}pending{"\""}  until a moderator approves or rejects the upload.
                Auto-scored questions are graded immediately.
              </p>
            </div>
          </div>
        )}

        {/* Points + Save row */}
        <div className="flex items-center gap-3 pt-2 border-t border-discord-bg-darker/40">
          <div>
            <label className="text-[10px] text-discord-text-muted uppercase tracking-wide block mb-1">
              Points
            </label>
            <input
              type="number"
              value={points}
              onChange={(e) => { setPoints(parseInt(e.target.value) || 25); markDirty(); }}
              className="w-20 bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-1.5 text-sm text-discord-text"
            />
          </div>
          <div className="flex-1" />
          {dirty && (
            <button
              onClick={saveQuestion}
              disabled={saving}
              className="px-4 py-2 bg-discord-accent text-white rounded-lg text-xs font-medium hover:bg-discord-accent/80 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              {saving && <Spinner className="w-3 h-3" />}
              Save Changes
            </button>
          )}
        </div>
      </div>}
    </div>
  );
}

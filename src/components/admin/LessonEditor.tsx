"use client";

import { useState, useEffect, useCallback } from "react";
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
}: {
  lessonId: string;
  onBack: () => void;
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
    } catch {}
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
    try {
      await fetch(`/api/training/prompts/${selectedPromptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: promptContent }),
      });
      await loadLesson();
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

  const questions = lesson.test?.questions || [];
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="text-discord-text-muted hover:text-discord-text text-sm cursor-pointer"
        >
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-discord-text">{lesson.title}</h2>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
            lesson.status === "published"
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
            className={`px-4 py-2 text-sm font-medium border-b-2 transition cursor-pointer ${
              activeTab === tab.id
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
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer border transition ${
                  selectedPromptId === p.id
                    ? "bg-discord-accent/20 border-discord-accent text-discord-text"
                    : "bg-discord-bg-dark border-discord-bg-darker/60 text-discord-text-muted hover:bg-discord-bg-hover"
                }`}
                onClick={() => {
                  setSelectedPromptId(p.id);
                  setPromptContent(p.content);
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
                <span className="text-[10px] text-discord-text-muted">
                  Sections: ### Question, ### Correct Answer, ### Hints, ### Wrong Answer Guidance, ### After Correct
                </span>
              </div>

              {/* Behind the scenes info */}
              <div className="mt-4 bg-discord-bg-dark rounded-lg p-4 border border-discord-bg-darker/60">
                <p className="text-[10px] text-discord-text-muted leading-relaxed">
                  <strong className="text-discord-text">Behind the scenes:</strong>{" "}
                  This markdown is the instruction set for the AI tutor. The learner
                  never sees raw markdown — the LLM reads it and provides the voice.
                  Embed media with{" "}
                  <code className="bg-discord-bg px-1 rounded">
                    {"<video url=\"oss://...\">"}
                  </code>
                  . App extracts oss:// tags before sending to LLM and renders as
                  playable media in chat.
                </p>
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
                { type: "mc" as const, label: "+ Multiple Choice" },
                { type: "tf" as const, label: "+ True/False" },
                { type: "rating" as const, label: "+ Rating" },
                { type: "upload" as const, label: "+ Upload" },
              ]
            ).map(({ type, label }) => (
              <button
                key={type}
                onClick={() => addQuestion(type)}
                className="px-3 py-2 rounded-lg text-xs bg-discord-accent/10 text-discord-accent border border-discord-accent/30 hover:bg-discord-accent/20 cursor-pointer"
              >
                {label}
              </button>
            ))}
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
          <div className="bg-discord-bg-dark rounded-lg p-5 border border-yellow-500/20">
            <h3 className="text-sm font-semibold text-yellow-400 mb-3">
              Tag Binding
            </h3>
            <div className="flex items-center gap-3 mb-3">
              <select
                value={settingsForm.tagId}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, tagId: e.target.value })
                }
                className="bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text flex-1 cursor-pointer"
              >
                <option value="">No tag (required to publish)</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.nameCn ? ` (${t.nameCn})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {settingsForm.tagId && (
              <p className="text-[10px] text-discord-text-muted">
                When a learner passes this lesson, they earn this tag. The tag
                unlocks channels gated by it and prerequisites for other lessons.
              </p>
            )}
          </div>

          {/* Lesson Metadata */}
          <div className="bg-discord-bg-dark rounded-lg p-5 border border-discord-bg-darker/60">
            <h3 className="text-sm font-semibold text-discord-text mb-4">
              Lesson Metadata
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-discord-text-muted block mb-1">
                  Title (EN)
                </label>
                <input
                  type="text"
                  value={settingsForm.title}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, title: e.target.value })
                  }
                  className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text"
                />
              </div>
              <div>
                <label className="text-xs text-discord-text-muted block mb-1">
                  Title (CN)
                </label>
                <input
                  type="text"
                  value={settingsForm.titleCn}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      titleCn: e.target.value,
                    })
                  }
                  className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-discord-text-muted block mb-1">
                  Description (EN)
                </label>
                <textarea
                  value={settingsForm.description}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text h-20 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-discord-text-muted block mb-1">
                  Description (CN)
                </label>
                <textarea
                  value={settingsForm.descriptionCn}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      descriptionCn: e.target.value,
                    })
                  }
                  className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text h-20 resize-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-xs text-discord-text-muted block mb-1">
                  Order
                </label>
                <input
                  type="number"
                  value={settingsForm.order}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      order: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text"
                />
              </div>
              <div>
                <label className="text-xs text-discord-text-muted block mb-1">
                  Passing Score (%)
                </label>
                <input
                  type="number"
                  value={settingsForm.passingScore}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      passingScore: parseInt(e.target.value) || 100,
                    })
                  }
                  className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text"
                />
              </div>
              <div>
                <label className="text-xs text-discord-text-muted block mb-1">
                  Retry After (hours)
                </label>
                <input
                  type="number"
                  value={settingsForm.retryAfterHours}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      retryAfterHours: parseInt(e.target.value) || 24,
                    })
                  }
                  className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text"
                />
              </div>
              <div>
                <label className="text-xs text-discord-text-muted block mb-1">
                  Prerequisite Tag
                </label>
                <select
                  value={settingsForm.prerequisiteTagId}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      prerequisiteTagId: e.target.value,
                    })
                  }
                  className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text cursor-pointer"
                >
                  <option value="">None</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-4 py-2 bg-discord-accent text-white rounded text-sm font-medium hover:bg-discord-accent/80 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              {saving && <Spinner className="w-3 h-3" />}
              Save Settings
            </button>
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
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(question.prompt);
  const [points, setPoints] = useState(question.points);

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

  return (
    <div className="bg-discord-bg-dark rounded-lg p-4 border border-discord-bg-darker/60">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs text-discord-text-muted font-mono">
          Q{index + 1}
        </span>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${badge.color}`}
        >
          {badge.label}
        </span>
        {question.type === "upload" && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-300">
            HUMAN REVIEWED
          </span>
        )}
        <span className="text-[10px] text-discord-text-muted ml-auto">
          {question.points} pts
        </span>
        <button
          onClick={() => setEditing(!editing)}
          className="text-[10px] text-discord-accent hover:underline cursor-pointer"
        >
          {editing ? "Close" : "Edit"}
        </button>
        <button
          onClick={onDelete}
          className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
        >
          Delete
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-discord-text-muted block mb-1">
              Question Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text h-20 resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <div>
              <label className="text-[10px] text-discord-text-muted block mb-1">
                Points
              </label>
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value) || 25)}
                className="w-20 bg-discord-bg border border-discord-bg-darker/60 rounded px-3 py-2 text-sm text-discord-text"
              />
            </div>
            <button
              onClick={() => {
                onUpdate({ prompt, points });
                setEditing(false);
              }}
              className="px-3 py-2 bg-discord-accent text-white rounded text-xs hover:bg-discord-accent/80 cursor-pointer mt-4"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-discord-text">{question.prompt}</p>
      )}

      {/* Show options for MC */}
      {question.type === "mc" && !editing && (
        <div className="mt-2 flex flex-wrap gap-1">
          {((question.options as { options?: string[] })?.options || []).map(
            (opt, i) => (
              <span
                key={i}
                className={`text-[10px] px-2 py-0.5 rounded ${
                  (question.correctAnswers as { correctIndex: number })
                    .correctIndex === i
                    ? "bg-green-500/20 text-green-300"
                    : "bg-discord-bg text-discord-text-muted"
                }`}
              >
                {String.fromCharCode(65 + i)}. {opt}
              </span>
            )
          )}
        </div>
      )}

      {/* Show T/F answer */}
      {question.type === "tf" && !editing && (
        <div className="mt-2 text-[10px] text-discord-text-muted">
          Answer:{" "}
          <span className="text-green-400 font-medium">
            {(question.correctAnswers as { correct: boolean }).correct
              ? "True"
              : "False"}
          </span>
        </div>
      )}
    </div>
  );
}

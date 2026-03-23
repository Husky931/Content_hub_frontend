"use client";

import { useState } from "react";
import type {
  DeliverableSlot,
  SlotType,
} from "@/types/deliverable-slot";
import {
  SLOT_TYPES,
  SLOT_TYPE_BADGE,
  isUploadType,
  slotTypeLabel,
  slotTypeIcon,
  createDefaultSlot,
  buildChecksFromSlot,
} from "@/types/deliverable-slot";

interface DeliverableSlotEditorProps {
  slots: DeliverableSlot[];
  onChange: (slots: DeliverableSlot[]) => void;
  allowEmpty?: boolean;
}

export function DeliverableSlotEditor({
  slots,
  onChange,
  allowEmpty = false,
}: DeliverableSlotEditorProps) {
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState<number | null>(null);

  const update = (next: DeliverableSlot[]) => onChange([...next]);

  const addSlot = (type: SlotType) => {
    const s = createDefaultSlot(type);
    const next = [...slots, s];
    update(next);
    setEditingSlotId(s.id);
    setShowTypePicker(false);
  };

  const cloneSlot = (idx: number) => {
    const src = slots[idx];
    if (!src) return;
    const cloned: DeliverableSlot = {
      ...JSON.parse(JSON.stringify(src)),
      id: crypto.randomUUID(),
      title: src.title ? `${src.title} (copy)` : "(copy)",
    };
    const next = [...slots];
    next.splice(idx + 1, 0, cloned);
    update(next);
    setEditingSlotId(cloned.id);
  };

  const moveSlot = (idx: number, dir: number) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= slots.length) return;
    const next = [...slots];
    [next[idx], next[newIdx]] = [next[newIdx]!, next[idx]!];
    update(next);
  };

  const deleteSlot = () => {
    if (deleteConfirmIdx === null) return;
    const removedId = slots[deleteConfirmIdx]?.id;
    const next = slots.filter((_, i) => i !== deleteConfirmIdx);
    update(next);
    if (editingSlotId === removedId) setEditingSlotId(null);
    setDeleteConfirmIdx(null);
  };

  const patchSlot = (id: string, patch: Partial<DeliverableSlot>) => {
    const next = slots.map((s) => (s.id === id ? { ...s, ...patch } : s));
    update(next);
  };

  const finishEdit = (slot: DeliverableSlot) => {
    const checks = buildChecksFromSlot(slot);
    patchSlot(slot.id, { checks });
    setEditingSlotId(null);
  };

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-discord-text-muted mb-1 uppercase tracking-wide">
        Deliverable Slots
      </label>
      <p className="text-[11px] text-discord-text-muted mb-2">
        Each slot defines one required deliverable from the creator (like a question in a survey form). Mix and match different types.
      </p>

      {/* Warning: no slots */}
      {slots.length === 0 && !allowEmpty && (
        <div className="p-2.5 mb-2 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20">
          ⚠ At least one deliverable slot is required before you can publish this task.
        </div>
      )}

      {/* Slot list */}
      <div className="space-y-1.5">
        {slots.map((slot, idx) => {
          const editing = editingSlotId === slot.id;
          return (
            <div
              key={slot.id}
              className={`rounded-lg border transition ${
                editing
                  ? "border-discord-accent bg-discord-bg-dark"
                  : "border-discord-border bg-discord-bg-dark/60"
              }`}
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-base">{slotTypeIcon(slot.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-discord-text-muted">
                      SLOT {idx + 1}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        SLOT_TYPE_BADGE[slot.type] || "bg-gray-500/20 text-gray-300"
                      }`}
                    >
                      {slotTypeLabel(slot.type)}
                    </span>
                    {slot.required !== false ? (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-500/15 text-red-400">REQUIRED</span>
                    ) : (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-gray-500/15 text-gray-400">OPTIONAL</span>
                    )}
                  </div>
                  {editing ? (
                    <input
                      type="text"
                      value={slot.title}
                      onChange={(e) => patchSlot(slot.id, { title: e.target.value })}
                      placeholder="Slot title (required)"
                      className="w-full mt-0.5 p-1 bg-discord-bg border border-discord-border rounded text-sm text-discord-text focus:outline-none focus:border-discord-accent"
                    />
                  ) : (
                    <div className="text-sm font-medium text-discord-text truncate">
                      {slot.title || "(untitled)"}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <SlotBtn
                    disabled={idx === 0}
                    title="Move up"
                    onClick={() => moveSlot(idx, -1)}
                  >
                    ▲
                  </SlotBtn>
                  <SlotBtn
                    disabled={idx === slots.length - 1}
                    title="Move down"
                    onClick={() => moveSlot(idx, 1)}
                  >
                    ▼
                  </SlotBtn>
                  <SlotBtn title="Clone" onClick={() => cloneSlot(idx)}>
                    ⧉
                  </SlotBtn>
                  <SlotBtn
                    title="Edit"
                    onClick={() =>
                      setEditingSlotId(editing ? null : slot.id)
                    }
                  >
                    ✏️
                  </SlotBtn>
                  <SlotBtn
                    title="Delete"
                    onClick={() => setDeleteConfirmIdx(idx)}
                    className="hover:!text-red-400"
                  >
                    🗑
                  </SlotBtn>
                </div>
              </div>

              {/* Checks summary (collapsed) */}
              {!editing && slot.checks.length > 0 && (
                <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-discord-text-muted">
                    CHECKS:
                  </span>
                  {slot.checks.map((c, ci) => (
                    <span
                      key={ci}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-discord-bg-hover text-discord-text-secondary border border-discord-border"
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Expanded edit form */}
              {editing && (
                <SlotEditForm
                  slot={slot}
                  onPatch={(p) => patchSlot(slot.id, p)}
                  onDone={() => finishEdit(slot)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Add Slot */}
      {!showTypePicker && (
        <button
          type="button"
          onClick={() => setShowTypePicker(true)}
          className="mt-2 w-full py-2 text-xs font-semibold text-discord-accent bg-discord-accent/10 hover:bg-discord-accent/20 border border-dashed border-discord-accent/30 rounded-lg transition"
        >
          + Add Deliverable Slot
        </button>
      )}

      {/* Type picker */}
      {showTypePicker && (
        <div className="mt-2 p-3 rounded-lg border border-discord-accent/40 bg-discord-bg-dark">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-discord-text">
              Pick slot type
            </span>
            <button
              type="button"
              onClick={() => setShowTypePicker(false)}
              className="text-discord-text-muted hover:text-discord-text text-xs"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {SLOT_TYPES.map((st) => (
              <button
                key={st.value}
                type="button"
                onClick={() => addSlot(st.value)}
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-discord-bg hover:bg-discord-bg-hover border border-discord-border hover:border-discord-accent/50 transition text-center"
              >
                <span className="text-xl">{st.icon}</span>
                <span className="text-[11px] font-semibold text-discord-text leading-tight">
                  {st.label}
                </span>
                <span className="text-[9px] text-discord-text-muted leading-tight">
                  {st.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirmIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmIdx(null);
          }}
        >
          <div className="bg-discord-bg-dark rounded-xl p-5 border border-discord-border shadow-xl max-w-sm w-full">
            <h4 className="text-sm font-semibold text-discord-text mb-2">
              ⚠ Delete Slot?
            </h4>
            <p className="text-xs text-discord-text-secondary mb-4">
              Are you sure you want to delete &quot;
              {slots[deleteConfirmIdx]?.title || "Untitled slot"}&quot;? This
              cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmIdx(null)}
                className="px-3 py-1.5 text-xs bg-discord-bg-hover text-discord-text-muted rounded hover:bg-discord-border transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteSlot}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition"
              >
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tiny helper button ──────────────────────────────────────────────────── */

function SlotBtn({
  children,
  disabled,
  title,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`w-6 h-6 flex items-center justify-center text-[11px] rounded hover:bg-discord-bg-hover text-discord-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition ${className}`}
    >
      {children}
    </button>
  );
}

/* ── Slot edit form (expanded) ───────────────────────────────────────────── */

function SlotEditForm({
  slot,
  onPatch,
  onDone,
}: {
  slot: DeliverableSlot;
  onPatch: (patch: Partial<DeliverableSlot>) => void;
  onDone: () => void;
}) {
  const [checksOpen, setChecksOpen] = useState(false);

  const inp =
    "w-full p-1.5 bg-discord-bg border border-discord-border rounded text-sm text-discord-text focus:outline-none focus:border-discord-accent";
  const inpSm = `${inp} max-w-[120px]`;
  const lbl = "block text-[10px] font-semibold text-discord-text-muted mb-0.5 uppercase";

  return (
    <div className="px-3 pb-3 space-y-2.5 border-t border-discord-border/50 mt-1 pt-2.5">
      {/* Description */}
      <div>
        <label className={lbl}>
          Description <span className="text-discord-text-muted normal-case">(optional, supports Markdown)</span>
        </label>
        <textarea
          value={slot.description}
          onChange={(e) => onPatch({ description: e.target.value })}
          rows={2}
          placeholder="Instructions for this slot (Markdown supported)..."
          className={`${inp} resize-none`}
        />
      </div>

      {/* Type readonly */}
      <div className="text-[11px] text-discord-text-secondary">
        {slotTypeIcon(slot.type)} Type: <strong>{slotTypeLabel(slot.type)}</strong>
        <span className="text-discord-text-muted ml-1">(to change type, delete this slot and add a new one)</span>
      </div>

      {/* Required toggle */}
      <label className="flex items-center gap-2 text-xs text-discord-text-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={slot.required !== false}
          onChange={(e) => onPatch({ required: e.target.checked })}
          className="rounded border-discord-border accent-discord-accent"
        />
        <span>Required for submission</span>
      </label>

      {/* Type-specific: upload-other extensions */}
      {slot.type === "upload-other" && (
        <div>
          <label className={lbl}>Allowed file extensions</label>
          <input
            type="text"
            value={slot.fileExtensions || ""}
            onChange={(e) => onPatch({ fileExtensions: e.target.value })}
            placeholder="e.g. .pdf, .doc, .docx"
            className={inp}
          />
        </div>
      )}

      {/* Type-specific: multiple-selection */}
      {slot.type === "multiple-selection" && (
        <div>
          <label className={lbl}>Options (one per line)</label>
          <textarea
            value={slot.selectionOptions || ""}
            onChange={(e) => onPatch({ selectionOptions: e.target.value })}
            rows={3}
            placeholder={"Option A\nOption B\nOption C"}
            className={`${inp} resize-none`}
          />
          <div className="flex gap-3 mt-1.5">
            <div>
              <label className={lbl}>Min selections</label>
              <input
                type="number"
                value={slot.minSelections ?? 0}
                onChange={(e) => onPatch({ minSelections: parseInt(e.target.value) || 0 })}
                min={0}
                className={inpSm}
              />
            </div>
            <div>
              <label className={lbl}>Max selections</label>
              <input
                type="number"
                value={slot.maxSelections ?? 0}
                onChange={(e) => onPatch({ maxSelections: parseInt(e.target.value) || 0 })}
                min={0}
                className={inpSm}
              />
            </div>
          </div>
        </div>
      )}

      {/* Type-specific: rating */}
      {slot.type === "rating" && (
        <div className="flex gap-3">
          <div>
            <label className={lbl}>Min rating</label>
            <input type="number" value={slot.ratingMin ?? 1} onChange={(e) => onPatch({ ratingMin: parseFloat(e.target.value) || 1 })} className={inpSm} />
          </div>
          <div>
            <label className={lbl}>Max rating</label>
            <input type="number" value={slot.ratingMax ?? 5} onChange={(e) => onPatch({ ratingMax: parseFloat(e.target.value) || 5 })} className={inpSm} />
          </div>
          <div>
            <label className={lbl}>Step</label>
            <input type="number" value={slot.ratingStep ?? 1} onChange={(e) => onPatch({ ratingStep: parseFloat(e.target.value) || 1 })} min={0.1} step={0.1} className={inpSm} />
          </div>
        </div>
      )}

      {/* ── Automated Checks (collapsible) ── */}
      <div className="rounded-lg border border-discord-border overflow-hidden">
        <button
          type="button"
          onClick={() => setChecksOpen(!checksOpen)}
          className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-discord-text-secondary bg-discord-bg-hover/50 hover:bg-discord-bg-hover transition"
        >
          ⚙ Automated Checks (optional)
          <span className="ml-auto text-[10px]">{checksOpen ? "▲" : "▼"}</span>
        </button>

        {checksOpen && (
          <div className="px-3 py-2.5 space-y-3 bg-discord-bg-dark/50">
            <p className="text-[10px] text-discord-text-muted">
              Non-AI checks that run automatically on upload. AI checking via webhook is configured separately.
            </p>

            {/* File size (all upload types) */}
            {isUploadType(slot.type) && (
              <CheckGroup title="File Size">
                <div className="flex gap-3">
                  <div>
                    <label className={lbl}>Min size</label>
                    <div className="flex gap-1">
                      <input type="number" value={slot.minFileSize ?? ""} onChange={(e) => onPatch({ minFileSize: e.target.value ? parseFloat(e.target.value) : null })} min={0} className={inpSm} />
                      <select value={slot.minFileSizeUnit || "KB"} onChange={(e) => onPatch({ minFileSizeUnit: e.target.value })} className="p-1 bg-discord-bg border border-discord-border rounded text-[11px] text-discord-text focus:outline-none">
                        <option value="KB">KB</option>
                        <option value="MB">MB</option>
                        <option value="GB">GB</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Max size</label>
                    <div className="flex gap-1">
                      <input type="number" value={slot.maxFileSize ?? ""} onChange={(e) => onPatch({ maxFileSize: e.target.value ? parseFloat(e.target.value) : null })} min={0} className={inpSm} />
                      <select value={slot.maxFileSizeUnit || "MB"} onChange={(e) => onPatch({ maxFileSizeUnit: e.target.value })} className="p-1 bg-discord-bg border border-discord-border rounded text-[11px] text-discord-text focus:outline-none">
                        <option value="KB">KB</option>
                        <option value="MB">MB</option>
                        <option value="GB">GB</option>
                      </select>
                    </div>
                  </div>
                </div>
              </CheckGroup>
            )}

            {/* TSV checks */}
            {slot.type === "upload-tsv" && (
              <CheckGroup title="TSV Validation">
                <div className="space-y-1.5">
                  <div>
                    <label className={lbl}>Expected columns (comma-separated)</label>
                    <input type="text" value={slot.tsvColumnPattern || ""} onChange={(e) => onPatch({ tsvColumnPattern: e.target.value })} placeholder="e.g. id, name, value, category" className={inp} />
                  </div>
                  <CheckboxRow checked={!!slot.tsvCheckMissingColumns} onChange={(v) => onPatch({ tsvCheckMissingColumns: v })} label="Flag missing columns in data" />
                  <CheckboxRow checked={!!slot.tsvExactColumnMatch} onChange={(v) => onPatch({ tsvExactColumnMatch: v })} label="Columns must exactly match pattern (order & names)" />
                </div>
              </CheckGroup>
            )}

            {/* SRT checks */}
            {slot.type === "upload-srt" && (
              <CheckGroup title="SRT Validation">
                <CheckboxRow checked={slot.srtValidateParsing !== false} onChange={(v) => onPatch({ srtValidateParsing: v })} label="Validate SRT format (correct numbering, timestamps)" />
                <CheckboxRow checked={slot.srtNoOverlaps !== false} onChange={(v) => onPatch({ srtNoOverlaps: v })} label="Check for no timestamp overlaps" />
              </CheckGroup>
            )}

            {/* Text / Textbox checks */}
            {(slot.type === "upload-text" || slot.type === "textbox") && (
              <CheckGroup title="Text Validation">
                <div>
                  <label className={lbl}>Regex pattern</label>
                  <input type="text" value={slot.textRegex || ""} onChange={(e) => onPatch({ textRegex: e.target.value })} placeholder="e.g. ^[A-Z].*\.$" className={inp} />
                  <span className="text-[10px] text-discord-text-muted">Content must match this pattern to pass</span>
                </div>
                <div className="flex gap-3 mt-1.5">
                  <div>
                    <label className={lbl}>Min length (chars)</label>
                    <input type="number" value={slot.textMinLength ?? ""} onChange={(e) => onPatch({ textMinLength: e.target.value ? parseInt(e.target.value) : null })} min={0} className={inpSm} />
                  </div>
                  <div>
                    <label className={lbl}>Max length (chars)</label>
                    <input type="number" value={slot.textMaxLength ?? ""} onChange={(e) => onPatch({ textMaxLength: e.target.value ? parseInt(e.target.value) : null })} min={0} className={inpSm} />
                  </div>
                </div>
              </CheckGroup>
            )}

            {/* Video checks */}
            {slot.type === "upload-video" && (
              <CheckGroup title="Video Validation">
                <div className="flex gap-3 flex-wrap">
                  <div>
                    <label className={lbl}>Duration check</label>
                    <select value={slot.videoDurationOp || "gte"} onChange={(e) => onPatch({ videoDurationOp: e.target.value })} className={inp}>
                      <option value="between">Between min & max</option>
                      <option value="gte">≥ at least</option>
                      <option value="lte">≤ at most</option>
                    </select>
                  </div>
                  {slot.videoDurationOp !== "lte" && (
                    <div>
                      <label className={lbl}>Min (seconds)</label>
                      <input type="number" value={slot.videoDurationMin ?? ""} onChange={(e) => onPatch({ videoDurationMin: e.target.value ? parseFloat(e.target.value) : null })} min={0} className={inpSm} />
                    </div>
                  )}
                  {slot.videoDurationOp !== "gte" && (
                    <div>
                      <label className={lbl}>Max (seconds)</label>
                      <input type="number" value={slot.videoDurationMax ?? ""} onChange={(e) => onPatch({ videoDurationMax: e.target.value ? parseFloat(e.target.value) : null })} min={0} className={inpSm} />
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-1.5">
                  <div>
                    <label className={lbl}>Min resolution</label>
                    <select value={slot.videoResolution || ""} onChange={(e) => onPatch({ videoResolution: e.target.value })} className={inp}>
                      <option value="">No check</option>
                      <option value="1280x720">1280×720 (720p)</option>
                      <option value="1920x1080">1920×1080 (1080p)</option>
                      <option value="2560x1440">2560×1440 (1440p)</option>
                      <option value="3840x2160">3840×2160 (4K)</option>
                      <option value="custom">Custom...</option>
                    </select>
                    {slot.videoResolution === "custom" && (
                      <input type="text" value={slot.videoResolutionCustom || ""} onChange={(e) => onPatch({ videoResolutionCustom: e.target.value })} placeholder="e.g. 1080x720" className={`${inp} mt-1`} />
                    )}
                  </div>
                  <div>
                    <label className={lbl}>Aspect ratio</label>
                    <select value={slot.videoAspectRatio || ""} onChange={(e) => onPatch({ videoAspectRatio: e.target.value })} className={inp}>
                      <option value="">No check</option>
                      <option value="16:9">16:9 (Widescreen)</option>
                      <option value="9:16">9:16 (Vertical)</option>
                      <option value="4:3">4:3 (Classic)</option>
                      <option value="1:1">1:1 (Square)</option>
                      <option value="21:9">21:9 (Ultrawide)</option>
                      <option value="custom">Custom...</option>
                    </select>
                    {slot.videoAspectRatio === "custom" && (
                      <input type="text" value={slot.videoAspectRatioCustom || ""} onChange={(e) => onPatch({ videoAspectRatioCustom: e.target.value })} placeholder="e.g. 3:2" className={`${inp} mt-1`} />
                    )}
                  </div>
                </div>
              </CheckGroup>
            )}

            {/* Audio checks */}
            {slot.type === "upload-audio" && (
              <CheckGroup title="Audio Validation">
                <div className="flex gap-3 flex-wrap">
                  <div>
                    <label className={lbl}>Duration check</label>
                    <select value={slot.audioDurationOp || "gte"} onChange={(e) => onPatch({ audioDurationOp: e.target.value })} className={inp}>
                      <option value="between">Between min & max</option>
                      <option value="gte">≥ at least</option>
                      <option value="lte">≤ at most</option>
                    </select>
                  </div>
                  {slot.audioDurationOp !== "lte" && (
                    <div>
                      <label className={lbl}>Min (seconds)</label>
                      <input type="number" value={slot.audioDurationMin ?? ""} onChange={(e) => onPatch({ audioDurationMin: e.target.value ? parseFloat(e.target.value) : null })} min={0} className={inpSm} />
                    </div>
                  )}
                  {slot.audioDurationOp !== "gte" && (
                    <div>
                      <label className={lbl}>Max (seconds)</label>
                      <input type="number" value={slot.audioDurationMax ?? ""} onChange={(e) => onPatch({ audioDurationMax: e.target.value ? parseFloat(e.target.value) : null })} min={0} className={inpSm} />
                    </div>
                  )}
                </div>
              </CheckGroup>
            )}

            {/* Image checks */}
            {slot.type === "upload-image" && (
              <CheckGroup title="Image Validation">
                <div className="flex gap-3">
                  <div>
                    <label className={lbl}>Min resolution</label>
                    <select value={slot.imageResolution || ""} onChange={(e) => onPatch({ imageResolution: e.target.value })} className={inp}>
                      <option value="">No check</option>
                      <option value="640x480">640×480</option>
                      <option value="1280x720">1280×720 (720p)</option>
                      <option value="1920x1080">1920×1080 (1080p)</option>
                      <option value="3840x2160">3840×2160 (4K)</option>
                      <option value="custom">Custom...</option>
                    </select>
                    {slot.imageResolution === "custom" && (
                      <input type="text" value={slot.imageResolutionCustom || ""} onChange={(e) => onPatch({ imageResolutionCustom: e.target.value })} placeholder="e.g. 800x600" className={`${inp} mt-1`} />
                    )}
                  </div>
                  <div>
                    <label className={lbl}>Aspect ratio</label>
                    <select value={slot.imageAspectRatio || ""} onChange={(e) => onPatch({ imageAspectRatio: e.target.value })} className={inp}>
                      <option value="">No check</option>
                      <option value="16:9">16:9 (Widescreen)</option>
                      <option value="9:16">9:16 (Vertical)</option>
                      <option value="4:3">4:3 (Classic)</option>
                      <option value="1:1">1:1 (Square)</option>
                      <option value="3:2">3:2 (Photo)</option>
                      <option value="custom">Custom...</option>
                    </select>
                    {slot.imageAspectRatio === "custom" && (
                      <input type="text" value={slot.imageAspectRatioCustom || ""} onChange={(e) => onPatch({ imageAspectRatioCustom: e.target.value })} placeholder="e.g. 5:4" className={`${inp} mt-1`} />
                    )}
                  </div>
                </div>
              </CheckGroup>
            )}
          </div>
        )}
      </div>

      {/* Done button */}
      <button
        type="button"
        onClick={onDone}
        className="px-4 py-1.5 text-xs font-semibold bg-discord-accent hover:bg-discord-accent/80 text-white rounded transition"
      >
        ✓ Done
      </button>
    </div>
  );
}

/* ── Small helper components ─────────────────────────────────────────────── */

function CheckGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold text-discord-text-muted uppercase">
        {title}
      </div>
      {children}
    </div>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-discord-text-secondary cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-discord-border accent-discord-accent"
      />
      <span>{label}</span>
    </label>
  );
}

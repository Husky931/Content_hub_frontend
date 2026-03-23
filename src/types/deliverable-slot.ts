/** A single automated check label derived from slot config */
export interface SlotCheck {
  label: string;
}

/** One deliverable slot definition on a task */
export interface DeliverableSlot {
  id: string;
  type: SlotType;
  title: string;
  description: string;
  checks: SlotCheck[];
  /** Whether this slot is required for submission (default true) */
  required?: boolean;

  // upload-other
  fileExtensions?: string;
  // multiple-selection
  selectionOptions?: string;
  minSelections?: number;
  maxSelections?: number;
  // rating
  ratingMin?: number;
  ratingMax?: number;
  ratingStep?: number;
  // file size (all upload types)
  minFileSize?: number | null;
  minFileSizeUnit?: string;
  maxFileSize?: number | null;
  maxFileSizeUnit?: string;
  // TSV
  tsvColumnPattern?: string;
  tsvCheckMissingColumns?: boolean;
  tsvExactColumnMatch?: boolean;
  // SRT
  srtValidateParsing?: boolean;
  srtNoOverlaps?: boolean;
  // Text / Textbox
  textRegex?: string;
  textMinLength?: number | null;
  textMaxLength?: number | null;
  // Video
  videoDurationMin?: number | null;
  videoDurationMax?: number | null;
  videoDurationOp?: string;
  videoResolution?: string;
  videoResolutionCustom?: string;
  videoAspectRatio?: string;
  videoAspectRatioCustom?: string;
  // Audio
  audioDurationMin?: number | null;
  audioDurationMax?: number | null;
  audioDurationOp?: string;
  // Image
  imageResolution?: string;
  imageResolutionCustom?: string;
  imageAspectRatio?: string;
  imageAspectRatioCustom?: string;
}

export type SlotType =
  | "upload-text"
  | "upload-tsv"
  | "upload-srt"
  | "upload-video"
  | "upload-image"
  | "upload-audio"
  | "upload-other"
  | "textbox"
  | "multiple-selection"
  | "rating";

export const SLOT_TYPES: {
  value: SlotType;
  label: string;
  desc: string;
  icon: string;
  iconColor: string;
}[] = [
  { value: "upload-text", label: "Text / Markdown", desc: "Upload .txt or .md files", icon: "📄", iconColor: "text-blue-400" },
  { value: "upload-tsv", label: "TSV", desc: "Upload tab-separated data", icon: "📊", iconColor: "text-green-400" },
  { value: "upload-srt", label: "SRT", desc: "Upload subtitle files", icon: "🔤", iconColor: "text-yellow-400" },
  { value: "upload-video", label: "Video", desc: "Upload video files", icon: "🎬", iconColor: "text-purple-400" },
  { value: "upload-image", label: "Image", desc: "Upload image files", icon: "🖼️", iconColor: "text-pink-400" },
  { value: "upload-audio", label: "Audio", desc: "Upload audio files", icon: "🎵", iconColor: "text-sky-400" },
  { value: "upload-other", label: "Other File", desc: "Custom file extension matching", icon: "📁", iconColor: "text-gray-400" },
  { value: "textbox", label: "Textbox", desc: "Free text input field", icon: "⌨️", iconColor: "text-emerald-400" },
  { value: "multiple-selection", label: "Multiple Selection", desc: "Pick from predefined options", icon: "☑️", iconColor: "text-amber-400" },
  { value: "rating", label: "Rating", desc: "Numeric rating scale", icon: "⭐", iconColor: "text-yellow-300" },
];

export const SLOT_TYPE_BADGE: Record<string, string> = {
  "upload-text": "bg-blue-500/20 text-blue-300",
  "upload-tsv": "bg-green-500/20 text-green-300",
  "upload-srt": "bg-yellow-500/20 text-yellow-300",
  "upload-video": "bg-purple-500/20 text-purple-300",
  "upload-image": "bg-pink-500/20 text-pink-300",
  "upload-audio": "bg-sky-500/20 text-sky-300",
  "upload-other": "bg-gray-500/20 text-gray-300",
  textbox: "bg-emerald-500/20 text-emerald-300",
  "multiple-selection": "bg-amber-500/20 text-amber-300",
  rating: "bg-yellow-500/20 text-yellow-300",
};

export function isUploadType(type: string): boolean {
  return type.startsWith("upload-");
}

export function slotTypeLabel(type: string): string {
  return SLOT_TYPES.find((s) => s.value === type)?.label || type;
}

export function slotTypeIcon(type: string): string {
  return SLOT_TYPES.find((s) => s.value === type)?.icon || "📄";
}

export function createDefaultSlot(type: SlotType): DeliverableSlot {
  return {
    id: crypto.randomUUID(),
    type,
    title: "",
    description: "",
    checks: [],
    required: true,
    fileExtensions: "",
    selectionOptions: "",
    minSelections: 0,
    maxSelections: 0,
    ratingMin: 1,
    ratingMax: 5,
    ratingStep: 1,
    minFileSize: 1,
    minFileSizeUnit: "KB",
    maxFileSize: null,
    maxFileSizeUnit: "MB",
    tsvColumnPattern: "",
    tsvCheckMissingColumns: false,
    tsvExactColumnMatch: false,
    srtValidateParsing: true,
    srtNoOverlaps: true,
    textRegex: "",
    textMinLength: null,
    textMaxLength: null,
    videoDurationMin: 1,
    videoDurationMax: null,
    videoDurationOp: "gte",
    videoResolution: "",
    videoResolutionCustom: "",
    videoAspectRatio: "",
    videoAspectRatioCustom: "",
    audioDurationMin: 1,
    audioDurationMax: null,
    audioDurationOp: "gte",
    imageResolution: "",
    imageResolutionCustom: "",
    imageAspectRatio: "",
    imageAspectRatioCustom: "",
  };
}

export function buildChecksFromSlot(slot: DeliverableSlot): SlotCheck[] {
  const checks: SlotCheck[] = [];
  if (isUploadType(slot.type)) {
    if (slot.minFileSize) checks.push({ label: `Min size: ${slot.minFileSize} ${slot.minFileSizeUnit}` });
    if (slot.maxFileSize) checks.push({ label: `Max size: ${slot.maxFileSize} ${slot.maxFileSizeUnit}` });
  }
  if (slot.type === "upload-tsv") {
    if (slot.tsvExactColumnMatch && slot.tsvColumnPattern) checks.push({ label: "Columns: exact match" });
    if (slot.tsvCheckMissingColumns) checks.push({ label: "No missing columns" });
  }
  if (slot.type === "upload-srt") {
    if (slot.srtValidateParsing) checks.push({ label: "SRT format valid" });
    if (slot.srtNoOverlaps) checks.push({ label: "No timestamp overlaps" });
  }
  if (slot.type === "upload-text" || slot.type === "textbox") {
    if (slot.textRegex) checks.push({ label: `Regex: ${slot.textRegex}` });
    if (slot.textMinLength) checks.push({ label: `Min ${slot.textMinLength} chars` });
    if (slot.textMaxLength) checks.push({ label: `Max ${slot.textMaxLength} chars` });
  }
  if (slot.type === "upload-video") {
    if (slot.videoDurationOp === "between" && (slot.videoDurationMin || slot.videoDurationMax)) {
      checks.push({ label: `Duration: ${slot.videoDurationMin ?? "?"}–${slot.videoDurationMax ?? "?"}s` });
    } else if (slot.videoDurationOp === "gte" && slot.videoDurationMin) {
      checks.push({ label: `Duration ≥ ${slot.videoDurationMin}s` });
    } else if (slot.videoDurationOp === "lte" && slot.videoDurationMax) {
      checks.push({ label: `Duration ≤ ${slot.videoDurationMax}s` });
    }
    const vRes = slot.videoResolution === "custom" ? slot.videoResolutionCustom : slot.videoResolution;
    if (vRes) checks.push({ label: `Resolution ≥ ${vRes}` });
    const vRatio = slot.videoAspectRatio === "custom" ? slot.videoAspectRatioCustom : slot.videoAspectRatio;
    if (vRatio) checks.push({ label: `Ratio: ${vRatio}` });
  }
  if (slot.type === "upload-audio") {
    if (slot.audioDurationOp === "between" && (slot.audioDurationMin || slot.audioDurationMax)) {
      checks.push({ label: `Duration: ${slot.audioDurationMin ?? "?"}–${slot.audioDurationMax ?? "?"}s` });
    } else if (slot.audioDurationOp === "gte" && slot.audioDurationMin) {
      checks.push({ label: `Duration ≥ ${slot.audioDurationMin}s` });
    } else if (slot.audioDurationOp === "lte" && slot.audioDurationMax) {
      checks.push({ label: `Duration ≤ ${slot.audioDurationMax}s` });
    }
  }
  if (slot.type === "upload-image") {
    const iRes = slot.imageResolution === "custom" ? slot.imageResolutionCustom : slot.imageResolution;
    if (iRes) checks.push({ label: `Resolution ≥ ${iRes}` });
    const iRatio = slot.imageAspectRatio === "custom" ? slot.imageAspectRatioCustom : slot.imageAspectRatio;
    if (iRatio) checks.push({ label: `Ratio: ${iRatio}` });
  }
  if (slot.type === "upload-other" && slot.fileExtensions) {
    checks.push({ label: `Extensions: ${slot.fileExtensions}` });
  }
  if (slot.type === "multiple-selection") {
    if (slot.minSelections) checks.push({ label: `Min ${slot.minSelections} selected` });
    if (slot.maxSelections) checks.push({ label: `Max ${slot.maxSelections} selected` });
  }
  return checks;
}

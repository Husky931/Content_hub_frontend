"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Spinner } from "./Spinner";

export interface UploadedFile {
  name: string;
  url: string;
  type: string;
  size: number;
  objectKey?: string;
}

interface FileUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  context: "task-attachment" | "attempt-deliverable";
  maxFiles?: number;
  maxSizeMb?: number;
  accept?: string;
  label?: string;
  compact?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string): string {
  if (type.startsWith("image/")) return "🖼️";
  if (type.startsWith("audio/")) return "🎵";
  if (type.startsWith("video/")) return "🎬";
  if (type === "application/pdf") return "📄";
  return "📎";
}

export function FileUpload({
  files,
  onFilesChange,
  context,
  maxFiles = 10,
  maxSizeMb = 100,
  accept,
  label,
  compact = false,
}: FileUploadProps) {
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Resolve signed URLs for any OSS files already in the list (e.g. editing)
  useEffect(() => {
    const ossFiles = files.filter((f) => isOssUrl(f.url) && !signedUrls[f.url]);
    if (ossFiles.length === 0) return;
    let cancelled = false;
    Promise.all(
      ossFiles.map(async (f) => {
        try {
          const res = await fetch(`/api/upload/signed-url?url=${encodeURIComponent(f.url)}`);
          if (!res.ok) return { url: f.url, signed: f.url };
          const data = await res.json();
          return { url: f.url, signed: data.signedUrl };
        } catch {
          return { url: f.url, signed: f.url };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      setSignedUrls((prev) => {
        const next = { ...prev };
        for (const r of results) next[r.url] = r.signed;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [files]);

  const resolveUrl = (url: string) => signedUrls[url] || url;

  const uploadFile = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      const maxBytes = maxSizeMb * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`"${file.name}" exceeds ${maxSizeMb} MB limit`);
        return null;
      }

      const tempId = `${file.name}-${Date.now()}`;
      setUploading((prev) => ({ ...prev, [tempId]: 0 }));

      try {
        // Try OSS presigned upload first
        let ossSuccess = false;
        try {
          const presignRes = await fetch("/api/upload/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              contentType: file.type,
              fileSize: file.size,
              context,
            }),
          });

          if (presignRes.ok) {
            const { presignedUrl, objectKey, publicUrl } =
              await presignRes.json();

            // Upload directly to OSS
            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open("PUT", presignedUrl);
              xhr.setRequestHeader("Content-Type", file.type);

              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  const pct = Math.round((e.loaded / e.total) * 100);
                  setUploading((prev) => ({ ...prev, [tempId]: pct }));
                }
              };

              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve();
                else {
                  console.warn(`OSS PUT failed for ${file.name}: ${xhr.status} ${xhr.statusText}`, xhr.responseText);
                  reject(new Error(`OSS upload failed: ${xhr.status}`));
                }
              };
              xhr.onerror = () => {
                console.warn(`OSS PUT network error for ${file.name} — may be CORS`);
                reject(new Error("Network error"));
              };
              xhr.send(file);
            });

            setUploading((prev) => {
              const next = { ...prev };
              delete next[tempId];
              return next;
            });

            ossSuccess = true;
            return {
              name: file.name,
              url: publicUrl,
              type: file.type,
              size: file.size,
              objectKey,
            };
          }
        } catch (ossErr) {
          console.warn(`OSS upload failed for ${file.name}, falling back to local:`, ossErr);
        }

        // Fallback: local upload
        if (!ossSuccess) console.warn(`Using local upload for ${file.name}`);
        setUploading((prev) => ({ ...prev, [tempId]: 50 }));
        const formData = new FormData();
        formData.append("file", file);
        formData.append("context", context);
        const localRes = await fetch("/api/upload/local", {
          method: "POST",
          body: formData,
        });

        if (!localRes.ok) {
          const data = await localRes.json();
          throw new Error(data.error || "Upload failed");
        }

        const data = await localRes.json();
        setUploading((prev) => {
          const next = { ...prev };
          delete next[tempId];
          return next;
        });

        return {
          name: data.name || file.name,
          url: data.url,
          type: data.type || file.type,
          size: data.size || file.size,
        };
      } catch (err: any) {
        setUploading((prev) => {
          const next = { ...prev };
          delete next[tempId];
          return next;
        });
        setError(err.message || "Upload failed");
        return null;
      }
    },
    [context, maxSizeMb]
  );

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      setError("");
      const remaining = maxFiles - files.length;
      if (remaining <= 0) {
        setError(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const toUpload = Array.from(fileList).slice(0, remaining);
      const results = await Promise.all(toUpload.map(uploadFile));
      const successful = results.filter(Boolean) as UploadedFile[];
      if (successful.length > 0) {
        onFilesChange([...files, ...successful]);
      }
    },
    [files, maxFiles, onFilesChange, uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const isUploading = Object.keys(uploading).length > 0;

  return (
    <div>
      {label && (
        <label className="block text-xs text-discord-text-muted mb-1">
          {label}
        </label>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg text-center cursor-pointer transition ${
          compact ? "p-3" : "p-5"
        } ${
          dragOver
            ? "border-discord-accent bg-discord-accent/5"
            : "border-discord-border hover:border-discord-accent/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className={`text-discord-text-muted ${compact ? "text-xs" : "text-sm"}`}>
          {isUploading
            ? "Uploading..."
            : `Drag & drop files here or click to browse`}
        </p>
        {!compact && (
          <p className="text-xs text-discord-text-muted mt-1">
            Max {maxSizeMb} MB per file · {maxFiles - files.length} slots remaining
          </p>
        )}
      </div>

      {/* Upload progress */}
      {Object.entries(uploading).map(([id, pct]) => (
        <div key={id} className="mt-2">
          <div className="flex items-center gap-2 text-xs text-discord-text-muted">
            <Spinner />
            <span className="truncate flex-1">{id.split("-")[0]}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1 bg-discord-bg-dark rounded mt-1 overflow-hidden">
            <div
              className="h-full bg-discord-accent rounded transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ))}

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {files.map((f, i) => {
            const ready = !isOssUrl(f.url) || !!signedUrls[f.url];
            const src = resolveUrl(f.url);
            return (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 px-3 py-2 bg-discord-bg-dark rounded-lg border border-discord-border"
              >
                {/* Preview */}
                {f.type.startsWith("image/") && ready ? (
                  <img
                    src={src}
                    alt={f.name}
                    className="w-8 h-8 rounded object-cover shrink-0"
                  />
                ) : (
                  <span className="text-base shrink-0">{getFileIcon(f.type)}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-discord-text font-medium truncate">
                    {f.name}
                  </p>
                  <p className="text-[10px] text-discord-text-muted">
                    {formatSize(f.size)}
                  </p>
                </div>
                {/* Inline audio player */}
                {f.type.startsWith("audio/") && ready && (
                  <audio key={src} controls preload="none" className="h-7 max-w-[160px]">
                    <source src={src} type={f.type} />
                  </audio>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="text-red-400 hover:text-red-300 text-xs shrink-0"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-discord-red mt-1">{error}</p>}
    </div>
  );
}

/** Check if a URL points to an OSS bucket (not a local /uploads/ path) */
function isOssUrl(url: string): boolean {
  return url.startsWith("https://") && url.includes(".aliyuncs.com");
}

/**
 * Read-only file display for review pages — shows previews + download.
 * Automatically resolves signed URLs for private OSS files.
 */
export function FilePreviewList({
  files,
  label,
}: {
  files: UploadedFile[];
  label?: string;
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const hasOssFiles = files?.some((f) => isOssUrl(f.url)) ?? false;
  const [loading, setLoading] = useState(hasOssFiles);

  useEffect(() => {
    if (!files || files.length === 0) return;

    const ossFiles = files.filter((f) => isOssUrl(f.url));
    if (ossFiles.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all(
      ossFiles.map(async (f) => {
        try {
          const res = await fetch(
            `/api/upload/signed-url?url=${encodeURIComponent(f.url)}`
          );
          if (!res.ok) return { url: f.url, signed: f.url };
          const data = await res.json();
          return { url: f.url, signed: data.signedUrl };
        } catch {
          return { url: f.url, signed: f.url };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const r of results) map[r.url] = r.signed;
      setSignedUrls(map);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [files]);

  if (!files || files.length === 0) return null;

  // For OSS files: only use the signed URL, never the raw one
  const resolveUrl = (url: string) => signedUrls[url] || url;
  // Whether a given file's URL is ready to render media
  const isReady = (url: string) => !isOssUrl(url) || !!signedUrls[url];

  return (
    <div>
      {label && (
        <h5 className="text-xs font-semibold text-discord-text-muted mb-2 uppercase">
          {label}
        </h5>
      )}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-discord-text-muted mb-2">
          <Spinner /> Loading file previews…
        </div>
      )}
      <div className="space-y-2">
        {files.map((f, i) => {
          const ready = isReady(f.url);
          const src = resolveUrl(f.url);
          return (
            <div
              key={`${f.name}-${i}`}
              className="p-3 bg-discord-sidebar rounded-lg border border-discord-border"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{getFileIcon(f.type)}</span>
                <span className="text-sm text-discord-text font-medium flex-1 truncate">
                  {f.name}
                </span>
                <span className="text-xs text-discord-text-muted">
                  {formatSize(f.size)}
                </span>
                {ready && (
                  <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 bg-discord-accent/20 text-discord-accent rounded hover:bg-discord-accent/30 transition"
                  >
                    Download
                  </a>
                )}
              </div>

              {/* Only render media once signed URL is resolved — browsers cache <source> failures */}
              {ready && (
                <>
                  {/* Image preview — clickable to open full size */}
                  {f.type.startsWith("image/") && (
                    <a href={src} target="_blank" rel="noopener noreferrer" className="block">
                      <img
                        src={src}
                        alt={f.name}
                        className="max-w-full max-h-60 rounded border border-discord-border hover:opacity-90 transition cursor-pointer"
                      />
                    </a>
                  )}

                  {/* Audio player */}
                  {f.type.startsWith("audio/") && (
                    <audio key={src} controls preload="metadata" className="w-full mt-1">
                      <source src={src} type={f.type} />
                    </audio>
                  )}

                  {/* Video player */}
                  {f.type.startsWith("video/") && (
                    <video
                      key={src}
                      controls
                      preload="metadata"
                      className="w-full max-h-60 rounded mt-1"
                    >
                      <source src={src} type={f.type} />
                    </video>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

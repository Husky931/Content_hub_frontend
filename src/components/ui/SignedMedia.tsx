"use client";

import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui/Spinner";

/** Renders an OSS file (audio/video/image) using a signed URL, with download + open in new tab */
export function SignedMedia({ url, type, name }: { url: string; type: string; name: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (url.startsWith("/")) {
      setSignedUrl(url);
      return;
    }
    fetch(`/api/upload/signed-url?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.signedUrl) setSignedUrl(data.signedUrl);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [url]);

  if (error) {
    return <div className="text-xs text-red-400">Failed to load media: {name}</div>;
  }
  if (!signedUrl) {
    return (
      <div className="flex items-center justify-center py-6 bg-discord-bg rounded-lg">
        <Spinner className="w-4 h-4" />
        <span className="ml-2 text-xs text-discord-text-muted">Loading {name}...</span>
      </div>
    );
  }

  const mediaElement = type.startsWith("audio") ? (
    <audio controls className="w-full" src={signedUrl} preload="auto" />
  ) : type.startsWith("video") ? (
    <video controls className="w-full max-h-72 rounded" src={signedUrl} preload="metadata" />
  ) : type.startsWith("image") ? (
    <img src={signedUrl} alt={name} className="max-w-full max-h-72 rounded cursor-pointer" onClick={() => window.open(signedUrl, "_blank")} />
  ) : null;

  return (
    <div>
      {mediaElement || (
        <div className="text-sm text-discord-text py-4 text-center">{name}</div>
      )}
      {/* Action bar */}
      <div className="flex items-center gap-3 mt-2">
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-discord-accent hover:underline cursor-pointer flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open in new tab
        </a>
        <a
          href={signedUrl}
          download={name}
          className="text-[11px] text-discord-accent hover:underline cursor-pointer flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>
        <span className="text-[10px] text-discord-text-muted ml-auto">{name}</span>
      </div>
    </div>
  );
}

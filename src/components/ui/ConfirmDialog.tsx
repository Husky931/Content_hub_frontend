"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "@/components/ui/Spinner";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirm",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
  children,
}: ConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const confirmCls =
    variant === "danger"
      ? "bg-discord-red hover:bg-[#c93b3e]"
      : variant === "warning"
        ? "bg-yellow-600 hover:bg-yellow-700"
        : "bg-discord-accent hover:bg-discord-accent-hover";

  const dialog = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-200 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="bg-discord-bg rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-0">
          <h3 className="text-xl font-bold text-discord-text">{title}</h3>
        </div>

        {/* Body */}
        <div className="px-4 py-4 text-sm text-discord-text-secondary leading-relaxed">
          {children}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-4 bg-discord-bg-dark rounded-b-lg">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium text-discord-text bg-discord-bg-light hover:bg-discord-bg-hover rounded transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2.5 text-sm text-white font-medium rounded transition disabled:opacity-50 flex items-center gap-1.5 ${confirmCls}`}
          >
            {loading ? <Spinner /> : confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

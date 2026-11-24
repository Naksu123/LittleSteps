"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<NonNullable<DialogProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
}: DialogProps) {
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const dialogNode = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#24334D]/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "relative w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90dvh] flex flex-col rounded-3xl bg-white shadow-2xl border-2 border-[#24334D]/10 overflow-hidden",
          SIZE_CLASSES[size]
        )}
      >
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-3 sm:px-6 sm:pt-6 border-b border-[#24334D]/8 bg-white">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-display text-lg sm:text-xl font-semibold text-[#24334D] break-words"
            >
              {title}
            </h2>
            {description && (
              <p className="text-xs sm:text-sm text-[#24334D]/70 mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#24334D]/65 hover:bg-[#24334D]/8 -mr-2 -mt-1.5 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:pb-6">
          {children}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(dialogNode, document.body)
    : dialogNode;
}

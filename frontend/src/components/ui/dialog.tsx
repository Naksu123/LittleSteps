"use client";

import * as React from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: DialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#24334D]/45 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#24334D]/10">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2
              id="dialog-title"
              className="font-display text-xl font-semibold text-[#24334D]"
            >
              {title}
            </h2>
            {description && (
              <p className="text-sm text-[#24334D]/70 mt-1">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full p-2 text-[#24334D]/60 hover:bg-[#24334D]/8 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

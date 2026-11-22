"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Theme } from "@/types";

const WEEK_EMOJIS: Record<number, string> = {
  1: "🎨",
  2: "🔤",
  3: "🍎",
  4: "🔺",
  5: "🦁",
  6: "🥗",
  7: "👂",
  8: "😊",
  9: "🌱",
  10: "🚒",
  11: "☀️",
  12: "🤝",
};

interface JourneyMapProps {
  themes: Theme[];
  completedThemeIds: Set<string>;
  onSelectTheme?: (theme: Theme) => void;
}

export function JourneyMap({
  themes,
  completedThemeIds,
  onSelectTheme,
}: JourneyMapProps) {
  const firstIncompleteIdx = themes.findIndex((t) => !completedThemeIds.has(t.id));

  return (
    <div className="rounded-3xl bg-white p-4 sm:p-5 border-2 border-[#78C8F5]/30 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg sm:text-xl font-bold text-[#24334D]">
          My Learning Map
        </h2>
        <span className="text-xs font-bold text-[#24334D]/60">
          {completedThemeIds.size} / {themes.length} Themes
        </span>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto pb-2 pt-1 snap-x scrollbar-subtle">
        {themes.map((theme, idx) => {
          const isCompleted = completedThemeIds.has(theme.id);
          const isCurrent = idx === firstIncompleteIdx;
          const emoji = WEEK_EMOJIS[theme.week_number] || "⭐";

          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelectTheme?.(theme)}
              title={`Week ${theme.week_number}: ${theme.title}`}
              className={cn(
                "snap-start shrink-0 flex flex-col items-center gap-1.5 rounded-3xl px-3 sm:px-3.5 py-2.5 sm:py-3 min-w-[78px] sm:min-w-[84px] border-2 transition-transform hover:scale-105 cursor-pointer",
                isCompleted
                  ? "bg-[#DDF8EC] border-[#9BE7C4] text-[#166041]"
                  : isCurrent
                    ? "bg-[#FFF5CF] border-[#FFE58A] text-[#24334D] ring-2 ring-[#FFE58A] animate-pulse"
                    : "bg-[#F3F5F7] border-[#24334D]/10 text-[#24334D]/60"
              )}
            >
              <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl shadow-xs">
                <span>{emoji}</span>
                {isCompleted && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#166041] text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </div>
              <span className="font-display text-xs font-bold">
                Wk {theme.week_number}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

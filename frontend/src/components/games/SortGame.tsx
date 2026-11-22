"use client";

import { useMemo, useRef, useState } from "react";
import {
  ENCOURAGE_SUCCESS,
  ENCOURAGE_TRY,
  pick,
  scoreFromFirstTries,
} from "@/lib/gameScoring";
import { playChime } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { ShapeIcon } from "@/components/games/ShapeIcon";
import type { GameResult, SortConfig, SortItem } from "@/types";

interface SortGameProps {
  config: SortConfig;
  onComplete: (result: GameResult) => void;
}

export function SortGame({ config, onComplete }: SortGameProps) {
  const [remaining, setRemaining] = useState<SortItem[]>(config.items);
  const [placedByBin, setPlacedByBin] = useState<Record<string, SortItem[]>>(
    () =>
      Object.fromEntries(config.bins.map((b) => [b.key, []]))
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    config.items[0]?.id ?? null
  );
  const [feedback, setFeedback] = useState<string>(
    "Tap an item below, then tap the matching basket!"
  );
  const [tone, setTone] = useState<"info" | "success" | "try">("info");

  const missedIdsRef = useRef<Set<string>>(new Set());
  const totalAttemptsRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const selectedItem = useMemo(
    () => remaining.find((i) => i.id === selectedId) || null,
    [remaining, selectedId]
  );

  function handleBinTap(binKey: string) {
    if (!selectedItem) {
      setTone("info");
      setFeedback("Tap an item first, then tap a basket!");
      return;
    }

    totalAttemptsRef.current += 1;

    if (selectedItem.bin === binKey) {
      playChime("success");
      setTone("success");
      setFeedback(pick(ENCOURAGE_SUCCESS));

      const nextRemaining = remaining.filter((i) => i.id !== selectedItem.id);
      setPlacedByBin((prev) => ({
        ...prev,
        [binKey]: [...(prev[binKey] || []), selectedItem],
      }));
      setRemaining(nextRemaining);
      setSelectedId(nextRemaining[0]?.id ?? null);

      if (nextRemaining.length === 0) {
        const firstTryCount =
          config.items.length - missedIdsRef.current.size;
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - startTimeRef.current) / 1000)
        );
        onComplete({
          score_pct: scoreFromFirstTries(firstTryCount, config.items.length),
          attempts_count: totalAttemptsRef.current,
          duration_seconds: durationSeconds,
        });
      }
    } else {
      missedIdsRef.current.add(selectedItem.id);
      playChime("try");
      setTone("try");
      setFeedback(pick(ENCOURAGE_TRY));
    }
  }

  return (
    <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-8 border-2 border-[#78C8F5]/35 shadow-md space-y-5 sm:space-y-6">
      <div
        role="status"
        className={cn(
          "rounded-2xl px-4 sm:px-5 py-3 text-center font-display text-base sm:text-lg font-bold",
          tone === "success"
            ? "bg-[#DDF8EC] text-[#166041]"
            : tone === "try"
              ? "bg-[#FFF5CF] text-[#785700]"
              : "bg-[#DCF2FD]/70 text-[#175B82]"
        )}
      >
        {feedback}
      </div>

      {/* Items Tray */}
      <div className="space-y-2">
        <p className="font-display text-sm font-bold text-[#24334D]/70">
          Items to Sort ({remaining.length} left)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
          {remaining.map((item) => {
            const active = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "min-h-[88px] rounded-2xl p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 border-2 transition-all cursor-pointer",
                  active
                    ? "bg-[#FFF5CF] border-[#24334D] ring-4 ring-[#FFE58A] scale-[1.03]"
                    : "bg-[#FFF9F0] border-[#24334D]/12 hover:bg-[#DCF2FD]/50"
                )}
              >
                {item.shape ? (
                  <ShapeIcon
                    shape={item.shape}
                    color={item.color || "#78C8F5"}
                    size={40}
                  />
                ) : (
                  <span className="text-3xl sm:text-4xl">{item.emoji}</span>
                )}
                <span className="font-display text-xs sm:text-sm font-bold text-center break-words">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Bins */}
      <div
        className={cn(
          "grid grid-cols-1 gap-3 sm:gap-4",
          config.bins.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"
        )}
      >
        {config.bins.map((bin) => {
          const placed = placedByBin[bin.key] || [];
          return (
            <button
              key={bin.key}
              type="button"
              onClick={() => handleBinTap(bin.key)}
              className="min-h-[132px] sm:min-h-[160px] rounded-3xl bg-[#FFF9F0] border-2 border-dashed border-[#24334D]/25 p-4 flex flex-col items-center justify-between gap-3 hover:bg-[#DDF8EC]/50 transition-colors cursor-pointer"
            >
              <div className="flex flex-col items-center gap-1">
                {bin.shape ? (
                  <ShapeIcon shape={bin.shape} color="#78C8F5" size={44} />
                ) : (
                  <span className="text-4xl">{bin.emoji}</span>
                )}
                <span className="font-display text-lg font-bold text-[#24334D]">
                  {bin.label}
                </span>
              </div>

              <div className="flex flex-wrap justify-center gap-1.5">
                {placed.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold shadow-xs"
                  >
                    {p.emoji || "✓"} {p.label}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { createPortal } from "react-dom";
import { Award, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Reward } from "@/types";

interface RewardCelebrationProps {
  starsAwarded: number;
  encouragement: string;
  newRewards?: Reward[];
  note?: string | null;
  onPlayAgain?: () => void;
  onBack: () => void;
  backLabel?: string;
}

export function RewardCelebration({
  starsAwarded,
  encouragement,
  newRewards = [],
  note,
  onPlayAgain,
  onBack,
  backLabel = "Back",
}: RewardCelebrationProps) {
  const content = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#24334D]/60 p-3 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain rounded-3xl bg-white p-5 sm:p-7 text-center shadow-2xl border-4 border-[#FFE58A] space-y-4 sm:space-y-5 animate-pop-in">
        <div className="mx-auto flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-[#FFF5CF] text-5xl sm:text-6xl shadow-sm animate-wobble">
          🌟
        </div>

        <div className="space-y-1.5">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#24334D]">
            {encouragement}
          </h2>
          <p className="font-display text-xl sm:text-2xl font-bold text-[#9A7100]">
            +{starsAwarded} ⭐
          </p>
          {starsAwarded === 0 && (
            <p className="text-xs font-semibold text-[#24334D]/65">
              You already collected today&apos;s stars for this one—awesome
              practice!
            </p>
          )}
        </div>

        {newRewards.length > 0 && (
          <div className="space-y-2 rounded-2xl bg-[#DDF8EC]/70 p-4 border border-[#9BE7C4]">
            <p className="font-display text-sm font-bold text-[#166041] inline-flex items-center gap-1.5">
              <Award className="h-4 w-4" />
              New Badge Unlocked!
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {newRewards.map((r) => (
                <Badge key={r.id} variant="sunshine" className="text-sm px-3 py-1">
                  🏆 {r.title} (+{r.stars_value} ⭐)
                </Badge>
              ))}
            </div>
          </div>
        )}

        {note && (
          <p className="text-xs font-semibold text-[#8E3022] bg-[#FFE3DE]/60 rounded-xl p-2.5">
            {note}
          </p>
        )}

        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-2.5 sm:gap-3 pt-1">
          {onPlayAgain && (
            <Button
              type="button"
              variant="secondary"
              size="kid"
              onClick={onPlayAgain}
              className="w-full sm:w-auto"
            >
              <RotateCcw className="h-5 w-5" />
              Play Again
            </Button>
          )}
          <Button
            type="button"
            variant="kids"
            size="kid"
            onClick={onBack}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="h-5 w-5" />
            {backLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}

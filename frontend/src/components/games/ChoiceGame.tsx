"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import {
  ENCOURAGE_SUCCESS,
  ENCOURAGE_TRY,
  pick,
  scoreFromFirstTries,
} from "@/lib/gameScoring";
import { playChime } from "@/lib/sound";
import { speak } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ChoiceConfig, ChoiceOption, GameResult } from "@/types";

interface ChoiceGameProps {
  config: ChoiceConfig;
  onComplete: (result: GameResult) => void;
  shuffle?: boolean;
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function ChoiceGame({
  config,
  onComplete,
  shuffle = true,
}: ChoiceGameProps) {
  const rounds = config.rounds;
  const [roundIdx, setRoundIdx] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "try" | null>(
    null
  );
  const [missedKeys, setMissedKeys] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);

  const missedThisRoundRef = useRef(false);
  const firstTryCountRef = useRef(0);
  const totalAttemptsRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const currentRound = rounds[roundIdx];

  const displayedChoices = useMemo<ChoiceOption[]>(() => {
    if (!currentRound) return [];
    return shuffle ? shuffleArray(currentRound.choices) : currentRound.choices;
  }, [currentRound, shuffle]);

  if (!currentRound) {
    return null;
  }

  function handleSpeak() {
    const text =
      currentRound.speak ||
      (currentRound.visual?.kind === "sound"
        ? currentRound.visual.text
        : currentRound.prompt);
    speak(text);
  }

  function handleSelect(choice: ChoiceOption) {
    if (locked) return;
    totalAttemptsRef.current += 1;

    if (choice.key === currentRound.answer) {
      setLocked(true);
      if (!missedThisRoundRef.current) {
        firstTryCountRef.current += 1;
      }
      playChime("success");
      setFeedbackTone("success");
      setFeedback(pick(ENCOURAGE_SUCCESS));

      timerRef.current = setTimeout(() => {
        if (roundIdx + 1 >= rounds.length) {
          const durationSeconds = Math.max(
            1,
            Math.round((Date.now() - startTimeRef.current) / 1000)
          );
          onComplete({
            score_pct: scoreFromFirstTries(
              firstTryCountRef.current,
              rounds.length
            ),
            attempts_count: totalAttemptsRef.current,
            duration_seconds: durationSeconds,
          });
        } else {
          missedThisRoundRef.current = false;
          setMissedKeys([]);
          setFeedback(null);
          setFeedbackTone(null);
          setLocked(false);
          setRoundIdx((prev) => prev + 1);
        }
      }, 900);
    } else {
      missedThisRoundRef.current = true;
      playChime("try");
      setFeedbackTone("try");
      setFeedback(pick(ENCOURAGE_TRY));
      setMissedKeys((prev) =>
        prev.includes(choice.key) ? prev : [...prev, choice.key]
      );
    }
  }

  const visual = currentRound.visual;

  return (
    <div className="rounded-3xl bg-white p-6 sm:p-8 border-2 border-[#78C8F5]/35 shadow-md space-y-6">
      {/* Progress Dots */}
      <div className="flex items-center justify-between gap-4">
        <div
          className="flex flex-wrap items-center gap-1.5"
          aria-label="Round progress"
        >
          {rounds.map((_, idx) => (
            <span
              key={idx}
              className={cn(
                "h-3 rounded-full transition-all",
                idx < roundIdx
                  ? "w-3 bg-[#9BE7C4]"
                  : idx === roundIdx
                    ? "w-6 bg-[#78C8F5]"
                    : "w-3 bg-[#24334D]/12"
              )}
            />
          ))}
        </div>
        <span className="font-display text-sm font-bold text-[#24334D]/65 shrink-0">
          {roundIdx + 1} / {rounds.length}
        </span>
      </div>

      {/* Prompt + Audio */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#24334D]">
          {currentRound.prompt}
        </h2>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={handleSpeak}
          aria-label="Hear prompt"
          className="shrink-0 rounded-2xl min-h-12"
        >
          <Volume2 className="h-5 w-5" />
          Listen
        </Button>
      </div>

      {/* Visual Hint */}
      {visual && (
        <div className="rounded-3xl bg-[#FFF9F0] p-6 flex flex-wrap items-center justify-center gap-4 border border-[#24334D]/8">
          {visual.kind === "emoji" && (
            <span className="text-7xl select-none">{visual.value}</span>
          )}

          {visual.kind === "count" && (
            <div className="flex flex-wrap justify-center gap-3 max-w-md">
              {Array.from({ length: visual.count }).map((_, i) => (
                <span key={i} className="text-5xl select-none">
                  {visual.emoji}
                </span>
              ))}
            </div>
          )}

          {visual.kind === "sequence" && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {visual.items.map((item, i) => (
                <span
                  key={i}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-xs"
                >
                  {item}
                </span>
              ))}
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFE58A] font-display text-2xl font-bold text-[#24334D] border-2 border-dashed border-[#24334D]/30">
                ?
              </span>
            </div>
          )}

          {visual.kind === "sound" && (
            <button
              type="button"
              onClick={handleSpeak}
              className="inline-flex items-center gap-3 rounded-3xl bg-[#DCF2FD] px-6 py-4 font-display text-2xl font-bold text-[#175B82] hover:scale-105 transition-transform cursor-pointer"
            >
              <Volume2 className="h-7 w-7" />
              &ldquo;{visual.text}&rdquo;
            </button>
          )}
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={cn(
            "rounded-2xl px-5 py-3 text-center font-display text-xl font-bold",
            feedbackTone === "success"
              ? "bg-[#DDF8EC] text-[#166041]"
              : "bg-[#FFF5CF] text-[#785700]"
          )}
        >
          {feedback}
        </div>
      )}

      {/* Dynamic Choice Grid */}
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          displayedChoices.length <= 2
            ? "sm:grid-cols-2"
            : displayedChoices.length === 4
              ? "sm:grid-cols-2 lg:grid-cols-4"
              : "sm:grid-cols-3"
        )}
      >
        {displayedChoices.map((choice) => {
          const isMissed = missedKeys.includes(choice.key);
          const isSuccess =
            feedbackTone === "success" && choice.key === currentRound.answer;

          return (
            <button
              key={choice.key}
              type="button"
              onClick={() => handleSelect(choice)}
              className={cn(
                "min-h-[128px] rounded-3xl border-b-4 p-5 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer",
                isSuccess
                  ? "bg-[#DDF8EC] border-[#9BE7C4] ring-4 ring-[#9BE7C4] scale-[1.03]"
                  : isMissed
                    ? "bg-[#FFF9F0] border-[#24334D]/15 opacity-70 animate-pulse"
                    : "bg-[#FFF9F0] border-[#24334D]/15 hover:bg-[#DCF2FD]/60 hover:scale-[1.02]"
              )}
            >
              {choice.hex ? (
                <span
                  className="h-20 w-20 rounded-full border-4 border-white shadow-md"
                  style={{ backgroundColor: choice.hex }}
                  aria-hidden="true"
                />
              ) : choice.emoji ? (
                <span className="text-5xl select-none">{choice.emoji}</span>
              ) : null}

              {(choice.text || choice.label) && (
                <span
                  className={cn(
                    "font-display font-bold text-[#24334D]",
                    choice.text && !choice.emoji ? "text-5xl" : "text-xl"
                  )}
                >
                  {choice.text || choice.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

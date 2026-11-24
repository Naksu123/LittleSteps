"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw, Volume2 } from "lucide-react";
import {
  getAnimalSoundMeta,
  playAnimalSound,
  preloadAnimalSounds,
  resolveAnimalKey,
  stopAnimalSound,
  type AnimalSoundKey,
} from "@/lib/animalSounds";
import {
  ENCOURAGE_SUCCESS,
  ENCOURAGE_TRY,
  pick,
  scoreFromFirstTries,
} from "@/lib/gameScoring";
import { playChime } from "@/lib/sound";
import { speak, stopSpeaking } from "@/lib/speech";
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
  const [animalAudioState, setAnimalAudioState] = useState<
    "idle" | "loading" | "playing" | "blocked" | "error"
  >("idle");
  const [animalAudioError, setAnimalAudioError] = useState<string | null>(null);
  const playingAnimalSound = animalAudioState === "playing";

  const missedThisRoundRef = useRef(false);
  const firstTryCountRef = useRef(0);
  const totalAttemptsRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      stopAnimalSound();
      stopSpeaking();
    };
  }, []);

  const currentRound = rounds[roundIdx];
  const visual = currentRound?.visual;

  const roundAnimalKey = useMemo(() => {
    if (!currentRound || currentRound.visual?.kind !== "sound") return null;
    return resolveAnimalKey(
      currentRound.visual.animal ||
        currentRound.answer ||
        currentRound.visual.text
    );
  }, [currentRound]);

  const roundAnimalMeta = useMemo(
    () => (roundAnimalKey ? getAnimalSoundMeta(roundAnimalKey) : null),
    [roundAnimalKey]
  );

  const nextRound = rounds[roundIdx + 1];
  const nextRoundAnimalKey = useMemo(() => {
    if (!nextRound || nextRound.visual?.kind !== "sound") return null;
    return resolveAnimalKey(
      nextRound.visual.animal || nextRound.answer || nextRound.visual.text
    );
  }, [nextRound]);

  useEffect(() => {
    if (!currentRound || currentRound.visual?.kind !== "sound") return;
    const keys: AnimalSoundKey[] = [];
    if (roundAnimalKey) keys.push(roundAnimalKey);
    if (nextRoundAnimalKey && nextRoundAnimalKey !== roundAnimalKey) {
      keys.push(nextRoundAnimalKey);
    }
    if (keys.length > 0) {
      preloadAnimalSounds(keys);
    }
  }, [currentRound, roundAnimalKey, nextRoundAnimalKey]);

  const triggerRoundAnimalSound = useCallback(
    (withPromptAfter = false) => {
      if (!roundAnimalKey) return false;
      setAnimalAudioError(null);
      return playAnimalSound(roundAnimalKey, {
        pronounceNameAfter: false,
        followUpText: withPromptAfter
          ? "Which animal friend makes that sound?"
          : undefined,
        onLoading: () => {
          if (mountedRef.current) setAnimalAudioState("loading");
        },
        onStart: () => {
          if (mountedRef.current) {
            setAnimalAudioError(null);
            setAnimalAudioState("playing");
          }
        },
        onBlocked: () => {
          if (mountedRef.current) setAnimalAudioState("blocked");
        },
        onError: (msg) => {
          if (mountedRef.current) {
            setAnimalAudioError(msg);
            setAnimalAudioState("error");
          }
        },
        onEnd: () => {
          if (mountedRef.current) {
            setAnimalAudioState((prev) =>
              prev === "blocked" || prev === "error" ? prev : "idle"
            );
          }
        },
      });
    },
    [roundAnimalKey]
  );

  useEffect(() => {
    setAnimalAudioState("idle");
    setAnimalAudioError(null);
    if (!roundAnimalKey) return;
    const autoTimer = setTimeout(() => {
      triggerRoundAnimalSound(false);
    }, 0);
    return () => clearTimeout(autoTimer);
  }, [roundIdx, roundAnimalKey, triggerRoundAnimalSound]);

  const displayedChoices = useMemo<ChoiceOption[]>(() => {
    if (!currentRound) return [];
    return shuffle ? shuffleArray(currentRound.choices) : currentRound.choices;
  }, [currentRound, shuffle]);

  if (!currentRound) {
    return null;
  }

  function handleSpeak() {
    if (roundAnimalKey) {
      triggerRoundAnimalSound(true);
      return;
    }
    const text = currentRound.speak || currentRound.prompt;
    speak(text);
  }

  function handlePlayAnimalSoundOnly() {
    if (roundAnimalKey) {
      triggerRoundAnimalSound(false);
    } else {
      handleSpeak();
    }
  }

  function handleSelect(choice: ChoiceOption) {
    if (locked) return;
    totalAttemptsRef.current += 1;

    const tappedAnimalKey =
      resolveAnimalKey(choice.key) ||
      (visual?.kind === "sound" ? resolveAnimalKey(choice.label) : null);

    if (choice.key === currentRound.answer) {
      setLocked(true);
      if (!missedThisRoundRef.current) {
        firstTryCountRef.current += 1;
      }
      const encouragement = pick(ENCOURAGE_SUCCESS);
      setFeedbackTone("success");
      setFeedback(encouragement);
      setAnimalAudioError(null);

      let advanced = false;
      const advanceRound = () => {
        if (!mountedRef.current || advanced) return;
        advanced = true;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
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
      };

      if (tappedAnimalKey) {
        const meta = getAnimalSoundMeta(tappedAnimalKey);
        const maxFallbackMs =
          process.env.NODE_ENV === "test"
            ? 900
            : Math.max(2400, (meta?.durationMs ?? 2000) + 2200);

        timerRef.current = setTimeout(advanceRound, maxFallbackMs);

        // Play the authentic animal sound effect first, then warmly pronounce the animal's name
        playAnimalSound(tappedAnimalKey, {
          pronounceNameAfter: true,
          onLoading: () => {
            if (mountedRef.current) setAnimalAudioState("loading");
          },
          onStart: () => {
            if (mountedRef.current) setAnimalAudioState("playing");
          },
          onEnd: () => {
            if (!mountedRef.current) return;
            setAnimalAudioState("idle");
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(advanceRound, 350);
          },
        });
      } else {
        playChime("success");
        timerRef.current = setTimeout(advanceRound, 600);
      }
    } else {
      missedThisRoundRef.current = true;
      setFeedbackTone("try");
      setFeedback(pick(ENCOURAGE_TRY));
      setMissedKeys((prev) =>
        prev.includes(choice.key) ? prev : [...prev, choice.key]
      );

      if (tappedAnimalKey) {
        setAnimalAudioError(null);
        playAnimalSound(tappedAnimalKey, {
          pronounceNameAfter: true,
          onLoading: () => {
            if (mountedRef.current) setAnimalAudioState("loading");
          },
          onStart: () => {
            if (mountedRef.current) setAnimalAudioState("playing");
          },
          onBlocked: () => {
            if (mountedRef.current) setAnimalAudioState("blocked");
          },
          onError: (msg) => {
            if (mountedRef.current) {
              setAnimalAudioError(msg);
              setAnimalAudioState("error");
            }
          },
          onEnd: () => {
            if (mountedRef.current) {
              setAnimalAudioState((prev) =>
                prev === "blocked" || prev === "error" ? prev : "idle"
              );
            }
          },
        });
      } else {
        playChime("try");
      }
    }
  }

  return (
    <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-8 border-2 border-[#78C8F5]/35 shadow-md space-y-5 sm:space-y-6">
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-center sm:text-left">
        <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-[#24334D]">
          {currentRound.prompt}
        </h2>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={handleSpeak}
          aria-label="Hear prompt"
          className="w-full sm:w-auto shrink-0 rounded-2xl min-h-12"
        >
          <Volume2 className="h-5 w-5" />
          Listen
        </Button>
      </div>

      {/* Visual Hint */}
      {visual && (
        <div className="rounded-3xl bg-[#FFF9F0] p-4 sm:p-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4 border border-[#24334D]/8">
          {visual.kind === "emoji" && (
            <span className="text-5xl sm:text-7xl select-none">{visual.value}</span>
          )}

          {visual.kind === "count" && (
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-md">
              {Array.from({ length: visual.count }).map((_, i) => (
                <span key={i} className="text-4xl sm:text-5xl select-none">
                  {visual.emoji}
                </span>
              ))}
            </div>
          )}

          {visual.kind === "sequence" && (
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {visual.items.map((item, i) => (
                <span
                  key={i}
                  className="flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white text-2xl sm:text-3xl shadow-xs"
                >
                  {item}
                </span>
              ))}
              <span className="flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-[#FFE58A] font-display text-xl sm:text-2xl font-bold text-[#24334D] border-2 border-dashed border-[#24334D]/30">
                ?
              </span>
            </div>
          )}

          {visual.kind === "sound" && (
            <div className="flex flex-col items-center gap-2.5 w-full">
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handlePlayAnimalSoundOnly}
                  aria-label="Play animal sound"
                  className={cn(
                    "inline-flex items-center justify-center gap-2.5 sm:gap-3 rounded-3xl px-5 sm:px-6 py-3.5 sm:py-4 font-display text-lg sm:text-2xl font-bold text-[#175B82] transition-all cursor-pointer border-2",
                    playingAnimalSound
                      ? "bg-[#FFE58A] border-[#24334D]/25 scale-105 shadow-md"
                      : animalAudioState === "blocked"
                        ? "bg-[#FFE58A]/75 border-[#24334D]/25 hover:scale-105"
                        : "bg-[#DCF2FD] border-[#78C8F5]/50 hover:scale-105"
                  )}
                >
                  {animalAudioState === "loading" ? (
                    <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 shrink-0 animate-spin" />
                  ) : (
                    <Volume2
                      className={cn(
                        "h-6 w-6 sm:h-7 sm:w-7 shrink-0",
                        playingAnimalSound && "animate-bounce"
                      )}
                    />
                  )}
                  <span>
                    {roundAnimalMeta
                      ? animalAudioState === "loading"
                        ? "Loading Sound..."
                        : playingAnimalSound
                          ? "Playing Animal Sound..."
                          : animalAudioState === "blocked"
                            ? "Tap to Hear Animal Sound"
                            : "Play Animal Sound"
                      : `“${visual.text}”`}
                  </span>
                </button>

                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handlePlayAnimalSoundOnly}
                  aria-label="Replay animal sound"
                  className="rounded-2xl min-h-12"
                >
                  <RotateCcw className="h-4 w-4" />
                  Replay Sound
                </Button>
              </div>
              {animalAudioError && (
                <p
                  role="alert"
                  className="text-xs sm:text-sm font-bold text-[#8E3022] text-center"
                >
                  {animalAudioError}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={cn(
            "rounded-2xl px-4 sm:px-5 py-3 text-center font-display text-lg sm:text-xl font-bold",
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
          "grid grid-cols-1 gap-3 sm:gap-4",
          displayedChoices.length <= 2
            ? "min-[380px]:grid-cols-2"
            : displayedChoices.length === 4
              ? "min-[380px]:grid-cols-2 lg:grid-cols-4"
              : "min-[380px]:grid-cols-2 sm:grid-cols-3"
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
                "min-h-[108px] sm:min-h-[128px] rounded-3xl border-b-4 p-4 sm:p-5 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer",
                isSuccess
                  ? "bg-[#DDF8EC] border-[#9BE7C4] ring-4 ring-[#9BE7C4] scale-[1.03]"
                  : isMissed
                    ? "bg-[#FFF9F0] border-[#24334D]/15 opacity-70 animate-pulse"
                    : "bg-[#FFF9F0] border-[#24334D]/15 hover:bg-[#DCF2FD]/60 hover:scale-[1.02]"
              )}
            >
              {choice.hex ? (
                <span
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-4 border-white shadow-md"
                  style={{ backgroundColor: choice.hex }}
                  aria-hidden="true"
                />
              ) : choice.emoji ? (
                <span className="text-4xl sm:text-5xl select-none">{choice.emoji}</span>
              ) : null}

              {(choice.text || choice.label) && (
                <span
                  className={cn(
                    "font-display font-bold text-[#24334D] text-center break-words",
                    choice.text && !choice.emoji
                      ? "text-4xl sm:text-5xl"
                      : "text-lg sm:text-xl"
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

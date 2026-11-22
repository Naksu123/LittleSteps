"use client";

import { useEffect, useRef, useState } from "react";
import { getMemoryPeekMs, type GameDifficulty } from "@/lib/gameDifficulty";
import { ENCOURAGE_SUCCESS, ENCOURAGE_TRY, pick } from "@/lib/gameScoring";
import { playChime } from "@/lib/sound";
import { cn } from "@/lib/utils";
import type { GameResult, MemoryConfig } from "@/types";

interface MemoryCard {
  uid: string;
  key: string;
  emoji: string;
  label: string;
}

interface MemoryGameProps {
  config: MemoryConfig;
  onComplete: (result: GameResult) => void;
  difficulty?: GameDifficulty;
}

function buildDeck(config: MemoryConfig): MemoryCard[] {
  const deck: MemoryCard[] = [];
  config.pairs.forEach((pair) => {
    deck.push({ uid: `${pair.key}-a`, ...pair });
    deck.push({ uid: `${pair.key}-b`, ...pair });
  });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function MemoryGame({
  config,
  onComplete,
  difficulty = "medium",
}: MemoryGameProps) {
  const peekMs = getMemoryPeekMs(difficulty);
  const [cards] = useState<MemoryCard[]>(() => buildDeck(config));
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedKeys, setMatchedKeys] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("Tap two cards to find a matching pair!");
  const [locked, setLocked] = useState(false);

  const pairAttemptsRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleFlip(index: number) {
    if (locked) return;
    if (flippedIndices.includes(index)) return;
    const card = cards[index];
    if (!card || matchedKeys.includes(card.key)) return;

    const nextFlipped = [...flippedIndices, index];
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length < 2) return;

    pairAttemptsRef.current += 1;
    const [firstIdx, secondIdx] = nextFlipped;
    const first = cards[firstIdx];
    const second = cards[secondIdx];

    if (first.key === second.key) {
      playChime("success");
      const nextMatched = [...matchedKeys, first.key];
      setMatchedKeys(nextMatched);
      setFlippedIndices([]);
      setFeedback(pick(ENCOURAGE_SUCCESS));

      if (nextMatched.length === config.pairs.length) {
        const attempts = Math.max(config.pairs.length, pairAttemptsRef.current);
        const scorePct = Math.min(
          100,
          Math.round((100 * config.pairs.length) / attempts)
        );
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - startTimeRef.current) / 1000)
        );
        timerRef.current = setTimeout(() => {
          onComplete({
            score_pct: scorePct,
            attempts_count: attempts,
            duration_seconds: durationSeconds,
          });
        }, 500);
      }
    } else {
      playChime("try");
      setFeedback(pick(ENCOURAGE_TRY));
      setLocked(true);
      timerRef.current = setTimeout(() => {
        setFlippedIndices([]);
        setLocked(false);
      }, peekMs);
    }
  }

  return (
    <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-8 border-2 border-[#78C8F5]/35 shadow-md space-y-5 sm:space-y-6">
      <div
        role="status"
        className="rounded-2xl bg-[#DCF2FD]/70 px-4 sm:px-5 py-3 text-center font-display text-base sm:text-lg font-bold text-[#175B82]"
      >
        {feedback} ({matchedKeys.length} / {config.pairs.length} pairs)
      </div>

      <div
        className={cn(
          "grid grid-cols-2 gap-2.5 sm:gap-4",
          config.pairs.length <= 3
            ? "min-[460px]:grid-cols-3"
            : "min-[480px]:grid-cols-3 sm:grid-cols-4"
        )}
      >
        {cards.map((card, idx) => {
          const isMatched = matchedKeys.includes(card.key);
          const isFaceUp = isMatched || flippedIndices.includes(idx);

          return (
            <button
              key={card.uid}
              type="button"
              onClick={() => handleFlip(idx)}
              aria-label={isFaceUp ? card.label : `Card ${idx + 1}`}
              className={cn(
                "min-h-[96px] sm:min-h-[120px] rounded-3xl border-b-4 p-3 sm:p-4 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer",
                isMatched
                  ? "bg-[#DDF8EC] border-[#9BE7C4]"
                  : isFaceUp
                    ? "bg-[#FFF5CF] border-[#FFE58A]"
                    : "bg-[#78C8F5] border-[#4ca9de] text-white hover:scale-[1.03]"
              )}
            >
              {isFaceUp ? (
                <>
                  <span className="text-4xl sm:text-5xl select-none">{card.emoji}</span>
                  <span className="font-display text-xs font-bold text-[#24334D] text-center break-words">
                    {card.label}
                  </span>
                </>
              ) : (
                <span className="font-display text-2xl sm:text-3xl font-bold">?</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import type { GameDifficulty } from "@/lib/gameDifficulty";
import {
  ENCOURAGE_SUCCESS,
  ENCOURAGE_TRY,
  pick,
  scoreFromFirstTries,
} from "@/lib/gameScoring";
import { playChime } from "@/lib/sound";
import { cn } from "@/lib/utils";
import type { GameResult, PuzzleConfig } from "@/types";

interface PuzzleGameProps {
  config: PuzzleConfig;
  onComplete: (result: GameResult) => void;
  difficulty?: GameDifficulty;
}

const SLOTS = [0, 1, 2, 3];

function shuffleOrder(): number[] {
  const arr = [0, 1, 2, 3];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function PieceVisual({
  emoji,
  bg,
  pieceIndex,
  dimmed = false,
}: {
  emoji: string;
  bg: string;
  pieceIndex: number;
  dimmed?: boolean;
}) {
  const row = Math.floor(pieceIndex / 2);
  const col = pieceIndex % 2;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-[#24334D]/15 select-none",
        dimmed && "opacity-20"
      )}
      style={{
        backgroundColor: bg,
        width: "var(--piece-size)",
        height: "var(--piece-size)",
      }}
    >
      <div
        className="flex items-center justify-center leading-none"
        style={{
          width: "calc(var(--piece-size) * 2)",
          height: "calc(var(--piece-size) * 2)",
          fontSize: "calc(var(--piece-size) * 1.32)",
          transform: `translate(calc(${-col} * var(--piece-size)), calc(${-row} * var(--piece-size)))`,
        }}
      >
        {emoji}
      </div>
    </div>
  );
}

export function PuzzleGame({
  config,
  onComplete,
  difficulty = "medium",
}: PuzzleGameProps) {
  const [picIdx, setPicIdx] = useState(0);
  const [placedSlots, setPlacedSlots] = useState<number[]>([]);
  const [trayPieces, setTrayPieces] = useState<number[]>(() => shuffleOrder());
  const [selectedPiece, setSelectedPiece] = useState<number | null>(
    trayPieces[0] ?? null
  );
  const [feedback, setFeedback] = useState(
    "Tap a puzzle piece, then tap its matching spot on the board!"
  );

  const missedSlotsRef = useRef<Set<string>>(new Set());
  const totalAttemptsRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const picture = config.pictures[picIdx];
  const totalPiecesAcrossGame = useMemo(
    () => config.pictures.length * 4,
    [config.pictures.length]
  );

  if (!picture) return null;

  function handleSlotTap(slotIdx: number) {
    if (placedSlots.includes(slotIdx)) return;
    if (selectedPiece === null) {
      setFeedback("Tap a puzzle piece first!");
      return;
    }

    totalAttemptsRef.current += 1;

    if (selectedPiece === slotIdx) {
      playChime("success");
      setFeedback(pick(ENCOURAGE_SUCCESS));
      const nextPlaced = [...placedSlots, slotIdx];
      const nextTray = trayPieces.filter((p) => p !== selectedPiece);
      setPlacedSlots(nextPlaced);
      setTrayPieces(nextTray);
      setSelectedPiece(nextTray[0] ?? null);

      if (nextPlaced.length === 4) {
        if (picIdx + 1 >= config.pictures.length) {
          const firstTries =
            totalPiecesAcrossGame - missedSlotsRef.current.size;
          const durationSeconds = Math.max(
            1,
            Math.round((Date.now() - startTimeRef.current) / 1000)
          );
          onComplete({
            score_pct: scoreFromFirstTries(firstTries, totalPiecesAcrossGame),
            attempts_count: totalAttemptsRef.current,
            duration_seconds: durationSeconds,
          });
        } else {
          const nextOrder = shuffleOrder();
          setTimeout(() => {
            setPicIdx((p) => p + 1);
            setPlacedSlots([]);
            setTrayPieces(nextOrder);
            setSelectedPiece(nextOrder[0] ?? null);
          }, 700);
        }
      }
    } else {
      missedSlotsRef.current.add(`${picIdx}-${slotIdx}`);
      playChime("try");
      setFeedback(pick(ENCOURAGE_TRY));
    }
  }

  return (
    <div
      className="rounded-3xl bg-white p-4 sm:p-6 lg:p-8 border-2 border-[#78C8F5]/35 shadow-md space-y-5 sm:space-y-6"
      style={{ ["--piece-size" as string]: "clamp(72px, 22vw, 104px)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-[#24334D]">
          Build: {picture.label}
        </h2>
        <span className="font-display text-sm font-bold text-[#24334D]/65">
          Picture {picIdx + 1} / {config.pictures.length}
        </span>
      </div>

      <div
        role="status"
        className="rounded-2xl bg-[#DCF2FD]/70 px-4 sm:px-5 py-3 text-center font-display text-base sm:text-lg font-bold text-[#175B82]"
      >
        {feedback}
      </div>

      <div className="flex flex-col md:flex-row items-center justify-around gap-6 sm:gap-8">
        {/* 2x2 Board */}
        <div className="grid grid-cols-2 gap-1.5 rounded-3xl bg-[#FFF9F0] p-2.5 sm:p-3 border-2 border-[#24334D]/15">
          {SLOTS.map((slotIdx) => {
            const isPlaced = placedSlots.includes(slotIdx);
            return (
                <button
                  key={slotIdx}
                  type="button"
                  onClick={() => handleSlotTap(slotIdx)}
                  aria-label={`Puzzle spot ${slotIdx + 1}`}
                  className="cursor-pointer rounded-2xl focus-visible:ring-2 focus-visible:ring-[#24334D]"
                >
                  {difficulty === "hard" && !isPlaced ? (
                    <div
                      className="rounded-2xl border-2 border-dashed border-[#24334D]/25 bg-white flex items-center justify-center font-display text-2xl font-bold text-[#24334D]/30 select-none"
                      style={{
                        width: "var(--piece-size)",
                        height: "var(--piece-size)",
                      }}
                    >
                      ?
                    </div>
                  ) : (
                    <PieceVisual
                      emoji={picture.emoji}
                      bg={picture.bg}
                      pieceIndex={slotIdx}
                      dimmed={!isPlaced}
                    />
                  )}
                </button>
            );
          })}
        </div>

        {/* Piece Tray */}
        <div className="space-y-3 text-center">
          <p className="font-display text-sm font-bold text-[#24334D]/70">
            Puzzle Pieces
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {trayPieces.map((pieceIdx) => {
              const selected = selectedPiece === pieceIdx;
              return (
                <button
                  key={pieceIdx}
                  type="button"
                  onClick={() => setSelectedPiece(pieceIdx)}
                  aria-label={`Piece ${pieceIdx + 1}`}
                  className={cn(
                    "rounded-2xl p-1 transition-all cursor-pointer",
                    selected
                      ? "ring-4 ring-[#FFE58A] scale-105 bg-[#FFE58A]"
                      : "hover:scale-105"
                  )}
                >
                  <PieceVisual
                    emoji={picture.emoji}
                    bg={picture.bg}
                    pieceIndex={pieceIdx}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

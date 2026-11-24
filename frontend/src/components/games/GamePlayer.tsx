"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Sparkles, Volume2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  adaptGameConfig,
  GAME_DIFFICULTY_META,
  getDefaultDifficultyForChild,
  type GameDifficulty,
} from "@/lib/gameDifficulty";
import { starsForScore } from "@/lib/gameScoring";
import { getSharedAudioContext, playChime } from "@/lib/sound";
import { speak } from "@/lib/speech";
import { cn, formatAgeGroupLabel } from "@/lib/utils";
import { progressApi } from "@/services/api";
import { ChoiceGame } from "@/components/games/ChoiceGame";
import { MemoryGame } from "@/components/games/MemoryGame";
import { PuzzleGame } from "@/components/games/PuzzleGame";
import { RewardCelebration } from "@/components/games/RewardCelebration";
import { SortGame } from "@/components/games/SortGame";
import { TracingGame } from "@/components/games/TracingGame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  Child,
  ChoiceConfig,
  Game,
  GameConfig,
  GameResult,
  MemoryConfig,
  ProgressResult,
  PuzzleConfig,
  SortConfig,
  TraceConfig,
} from "@/types";

interface GamePlayerProps {
  game: Game;
  childId: string;
  child?: Child | null;
  onExitHref?: string;
}

const DIFFICULTIES: GameDifficulty[] = ["normal", "medium", "hard"];

export function GamePlayer({
  game,
  childId,
  child,
  onExitHref = "/kids?tab=play",
}: GamePlayerProps) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const recommendedDifficulty = useMemo(
    () => getDefaultDifficultyForChild(child),
    [child]
  );
  const [difficulty, setDifficulty] = useState<GameDifficulty>(
    recommendedDifficulty
  );
  const [started, setStarted] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [celebration, setCelebration] = useState<{
    result: ProgressResult;
    note?: string | null;
  } | null>(null);

  useEffect(() => {
    setDifficulty(recommendedDifficulty);
    setStarted(false);
    setRunKey((k) => k + 1);
  }, [child?.id, recommendedDifficulty]);

  const rawCfg = game.config_json as GameConfig;
  const adaptedCfg = useMemo(
    () => adaptGameConfig(rawCfg, difficulty),
    [rawCfg, difficulty]
  );

  async function handleGameComplete(gameResult: GameResult) {
    playChime("celebrate");
    try {
      const saved = await progressApi.activity({
        child_id: childId,
        game_id: game.id,
        score_pct: gameResult.score_pct,
        attempts_count: gameResult.attempts_count,
        duration_seconds: gameResult.duration_seconds,
        completed: true,
      });
      setCelebration({ result: saved });
      void refreshUser();
    } catch {
      setCelebration({
        result: {
          stars_awarded: starsForScore(gameResult.score_pct),
          total_stars: 0,
          streak_days: 1,
          new_rewards: [],
          encouragement: "Wonderful effort!",
        },
        note: "We couldn't save this one, but wonderful effort!",
      });
    }
  }

  function handlePlayAgain() {
    setCelebration(null);
    setRunKey((k) => k + 1);
  }

  function handleSwitchMode(nextMode: GameDifficulty) {
    if (nextMode === difficulty) return;
    setDifficulty(nextMode);
    setCelebration(null);
    setRunKey((k) => k + 1);
  }

  if (!started) {
    return (
      <Card className="border-2 border-[#FFE58A] bg-white">
        <CardContent className="p-5 sm:p-8 text-center space-y-5 sm:space-y-6">
          <div className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-[#FFF5CF] text-4xl sm:text-5xl">
            🎮
          </div>
          <div className="space-y-2">
            {(rawCfg as { weekly_label?: string })?.weekly_label && (
              <Badge variant="mint" className="text-xs px-3 py-1">
                <Sparkles className="h-3.5 w-3.5" />
                {(rawCfg as { weekly_label?: string }).weekly_label} •{" "}
                {adaptedCfg.engine === "choice"
                  ? `${adaptedCfg.rounds.length} Questions`
                  : adaptedCfg.engine === "sort"
                    ? `${adaptedCfg.items.length} Items`
                    : adaptedCfg.engine === "memory"
                      ? `${adaptedCfg.pairs.length} Pairs`
                      : adaptedCfg.engine === "trace"
                        ? `${adaptedCfg.prompts.length} Traces`
                        : `${adaptedCfg.pictures.length} Puzzles`}{" "}
                • New every week!
              </Badge>
            )}
            <h1 className="font-display text-fluid-h1 font-bold text-[#24334D]">
              {game.title}
            </h1>
            <p className="text-sm sm:text-base font-semibold text-[#24334D]/80 max-w-lg mx-auto">
              {game.instructions}
            </p>
          </div>

          {/* Age-Based Mode Selector */}
          <div className="space-y-2.5 max-w-2xl mx-auto">
            <p className="font-display text-sm font-bold text-[#24334D]/75">
              Choose Challenge Mode
              {child
                ? ` (Recommended for ${child.display_name}, ${formatAgeGroupLabel(child.age_group, child.birth_year)})`
                : ""}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              {DIFFICULTIES.map((mode) => {
                const meta = GAME_DIFFICULTY_META[mode];
                const selected = difficulty === mode;
                const isRecommended = recommendedDifficulty === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDifficulty(mode)}
                    className={cn(
                      "rounded-2xl border-2 p-4 transition-all cursor-pointer space-y-1.5",
                      selected ? meta.activeClass : meta.pillClass
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display text-lg font-bold">
                        {meta.label}
                      </span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold">
                        {meta.ageTag}
                      </span>
                    </div>
                    <p className="text-xs font-semibold opacity-90">
                      {meta.description}
                    </p>
                    {isRecommended && (
                      <Badge variant="sunshine" className="text-[10px]">
                        <Sparkles className="h-3 w-3" />
                        Recommended
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="kid"
              onClick={() => speak(`${game.title}. ${game.instructions}`)}
              className="w-full sm:w-auto"
            >
              <Volume2 className="h-5 w-5" />
              Hear Instructions
            </Button>
            <Button
              type="button"
              variant="kids"
              size="kid"
              onClick={() => {
                getSharedAudioContext();
                setStarted(true);
              }}
              className="w-full sm:w-auto"
            >
              <Play className="h-5 w-5" />
              Start {GAME_DIFFICULTY_META[difficulty].label} Mode
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live Difficulty Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-3.5 sm:px-4 py-2.5 border border-[#24334D]/10 shadow-xs">
        <span className="font-display text-xs font-bold uppercase tracking-wide text-[#24334D]/65">
          Mode:
        </span>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {DIFFICULTIES.map((mode) => {
            const meta = GAME_DIFFICULTY_META[mode];
            const active = difficulty === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleSwitchMode(mode)}
                className={cn(
                  "rounded-full border min-h-9 px-3 sm:px-3.5 py-1 text-xs font-bold transition-all cursor-pointer",
                  active ? meta.activeClass : meta.pillClass
                )}
              >
                {meta.label} ({meta.ageTag})
              </button>
            );
          })}
        </div>
      </div>

      {adaptedCfg?.engine === "choice" && (
        <ChoiceGame
          key={`${difficulty}-${runKey}`}
          config={adaptedCfg as ChoiceConfig}
          onComplete={handleGameComplete}
        />
      )}
      {adaptedCfg?.engine === "sort" && (
        <SortGame
          key={`${difficulty}-${runKey}`}
          config={adaptedCfg as SortConfig}
          onComplete={handleGameComplete}
        />
      )}
      {adaptedCfg?.engine === "memory" && (
        <MemoryGame
          key={`${difficulty}-${runKey}`}
          config={adaptedCfg as MemoryConfig}
          difficulty={difficulty}
          onComplete={handleGameComplete}
        />
      )}
      {adaptedCfg?.engine === "puzzle" && (
        <PuzzleGame
          key={`${difficulty}-${runKey}`}
          config={adaptedCfg as PuzzleConfig}
          difficulty={difficulty}
          onComplete={handleGameComplete}
        />
      )}
      {adaptedCfg?.engine === "trace" && (
        <TracingGame
          key={`${difficulty}-${runKey}`}
          config={adaptedCfg as TraceConfig}
          onComplete={handleGameComplete}
        />
      )}
      {(!adaptedCfg ||
        !["choice", "sort", "memory", "puzzle", "trace"].includes(
          adaptedCfg.engine
        )) && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="font-display text-xl font-bold">
              This game is getting ready!
            </p>
            <Button
              variant="secondary"
              onClick={() => router.push(onExitHref)}
            >
              Back to Games
            </Button>
          </CardContent>
        </Card>
      )}

      {celebration && (
        <RewardCelebration
          starsAwarded={celebration.result.stars_awarded}
          encouragement={celebration.result.encouragement}
          newRewards={celebration.result.new_rewards}
          note={celebration.note}
          onPlayAgain={handlePlayAgain}
          onBack={() => router.push(onExitHref)}
          backLabel="More Games"
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { ENCOURAGE_SUCCESS, pick, scoreFromFirstTries } from "@/lib/gameScoring";
import { normalizeLanguage, tText } from "@/lib/i18n";
import { playChime } from "@/lib/sound";
import { speak } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { useOptionalAuth } from "@/hooks/authContext";
import { Button } from "@/components/ui/button";
import type { GameResult, TraceConfig } from "@/types";

interface TracingGameProps {
  config: TraceConfig;
  onComplete: (result: GameResult) => void;
}

const HIT_RADIUS = 13; // Forgiving percentage-space radius (0..100 scale) for 3-6yo fingers

export function TracingGame({ config, onComplete }: TracingGameProps) {
  const auth = useOptionalAuth();
  const lang = normalizeLanguage(auth?.parentPreferences?.preferred_language);

  const prompts = useMemo(() => config.prompts || [], [config.prompts]);
  const [idx, setIdx] = useState(0);
  const [visitedIndices, setVisitedIndices] = useState<number[]>([]);
  const [strokesCount, setStrokesCount] = useState(0);
  const [feedback, setFeedback] = useState<string>(
    tText(
      lang,
      "Start at the glowing star and trace along the dots!",
      "Magsimula sa bituin at sundan ang mga tuldok!"
    )
  );
  const [completedRound, setCompletedRound] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const attemptsRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prompt = prompts[idx];
  const points = useMemo(() => prompt?.points || [], [prompt]);

  const progressPct = useMemo(() => {
    if (points.length === 0) return 0;
    return Math.min(100, Math.round((visitedIndices.length / points.length) * 100));
  }, [points.length, visitedIndices.length]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!prompt) return;
    setVisitedIndices([]);
    setStrokesCount(0);
    setCompletedRound(false);
    setFeedback(
      tText(
        lang,
        prompt.speak || "Follow the dotted star path with your finger!",
        prompt.speak_fil || "Sundan ang landas ng bituin gamit ang daliri!"
      )
    );

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Warm cream canvas backdrop
    ctx.fillStyle = "#FFFDF8";
    ctx.fillRect(0, 0, w, h);

    // Draw guide track
    if (points.length >= 2) {
      ctx.save();
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = 22;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([12, 16]);
      ctx.beginPath();
      points.forEach(([px, py], i) => {
        const x = (px / 100) * w;
        const y = (py / 100) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();

      // Start circle glow
      const [sx, sy] = points[0];
      ctx.save();
      ctx.fillStyle = "#FFE58A";
      ctx.strokeStyle = "#24334D";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc((sx / 100) * w, (sy / 100) * h, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#24334D";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", (sx / 100) * w, (sy / 100) * h + 1);
      ctx.restore();
    }
  }, [idx, lang, points, prompt]);

  useEffect(() => {
    if (!prompt) return;
    const msg =
      lang === "fil" && prompt.speak_fil
        ? prompt.speak_fil
        : prompt.speak || prompt.label;
    speak(msg, { lang });
  }, [idx, lang, prompt]);

  function getNormCoords(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const rx = ((clientX - rect.left) / rect.width) * canvas.width;
    const ry = ((clientY - rect.top) / rect.height) * canvas.height;
    const nx = ((clientX - rect.left) / rect.width) * 100;
    const ny = ((clientY - rect.top) / rect.height) * 100;
    return { rx, ry, nx, ny };
  }

  function advanceToNext() {
    if (completedRound) return;
    setCompletedRound(true);
    playChime("success");
    setFeedback(pick(ENCOURAGE_SUCCESS));

    timerRef.current = setTimeout(() => {
      if (idx + 1 >= prompts.length) {
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - startTimeRef.current) / 1000)
        );
        onComplete({
          score_pct: scoreFromFirstTries(prompts.length, prompts.length),
          attempts_count: Math.max(1, attemptsRef.current),
          duration_seconds: durationSeconds,
        });
      } else {
        setIdx((cur) => cur + 1);
      }
    }, 850);
  }

  function markPathHit(nx: number, ny: number) {
    setVisitedIndices((prev) => {
      const nextSet = new Set(prev);
      points.forEach(([px, py], ptIdx) => {
        const dist = Math.hypot(px - nx, py - ny);
        if (dist <= HIT_RADIUS) {
          nextSet.add(ptIdx);
        }
      });
      const updated = Array.from(nextSet);
      if (points.length > 0 && updated.length >= Math.max(2, Math.ceil(points.length * 0.72))) {
        queueMicrotask(() => advanceToNext());
      }
      return updated;
    });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (completedRound) return;
    const coords = getNormCoords(e.clientX, e.clientY);
    const canvas = canvasRef.current;
    if (!coords || !canvas) return;
    canvas.setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    attemptsRef.current += 1;
    setStrokesCount((s) => s + 1);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#175B82";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(coords.rx, coords.ry);
    }
    markPathHit(coords.nx, coords.ny);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || completedRound) return;
    const coords = getNormCoords(e.clientX, e.clientY);
    const canvas = canvasRef.current;
    if (!coords || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.lineTo(coords.rx, coords.ry);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(coords.rx, coords.ry);
    }
    markPathHit(coords.nx, coords.ny);
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function handleResetStroke() {
    setIdx((cur) => {
      // Force redraw via state toggle on visitedIndices + repaint
      setVisitedIndices([]);
      setStrokesCount(0);
      return cur;
    });
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#FFFDF8";
        ctx.fillRect(0, 0, w, h);
        if (points.length >= 2) {
          ctx.save();
          ctx.strokeStyle = "#CBD5E1";
          ctx.lineWidth = 22;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.setLineDash([12, 16]);
          ctx.beginPath();
          points.forEach(([px, py], i) => {
            const x = (px / 100) * w;
            const y = (py / 100) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  if (!prompt) return null;

  return (
    <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-8 border-2 border-[#78C8F5]/35 shadow-md space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-bold text-[#24334D]/70">
        <span>
          {tText(lang, "Trace", "Bakasin")} {idx + 1} / {prompts.length}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            speak(
              lang === "fil" && prompt.speak_fil
                ? prompt.speak_fil
                : prompt.speak || prompt.label,
              { lang }
            )
          }
        >
          <Volume2 className="h-4 w-4" />
          {tText(lang, "Hear Hint", "Pakinggan")}
        </Button>
      </div>

      <div className="text-center space-y-1">
        <div className="text-4xl">{prompt.emoji || "✏️"}</div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#24334D]">
          {tText(lang, prompt.label, prompt.label_fil)}
        </h2>
      </div>

      <div className="mx-auto w-full max-w-[360px] space-y-2">
        <div className="h-2.5 w-full rounded-full bg-[#DCF2FD] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#9BE7C4] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <canvas
          ref={canvasRef}
          width={360}
          height={320}
          aria-label={prompt.label}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            "w-full aspect-[9/8] rounded-3xl border-4 border-[#FFE58A] bg-[#FFFDF8] touch-none cursor-crosshair shadow-inner",
            completedRound && "border-[#9BE7C4]"
          )}
        />
      </div>

      <div
        role="status"
        className={cn(
          "rounded-2xl px-4 py-3 text-center font-display text-base sm:text-lg font-bold",
          completedRound
            ? "bg-[#DDF8EC] text-[#166041]"
            : "bg-[#DCF2FD]/70 text-[#175B82]"
        )}
      >
        {feedback}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="outline" size="md" onClick={handleResetStroke}>
          <RotateCcw className="h-4 w-4" />
          {tText(lang, "Clear & Try Again", "Ulitin")}
        </Button>
        {strokesCount >= 1 && !completedRound && (
          <Button type="button" variant="kids" size="md" onClick={advanceToNext}>
            <Sparkles className="h-4 w-4" />
            {tText(lang, "I Did My Best!", "Tapos Na Ako!")}
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PaintBucket, Paintbrush, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TEMPLATES } from "@/lib/coloringTemplates";
import { floodFill } from "@/lib/floodFill";
import { playChime } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { ApiError, artworkApi } from "@/services/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Artwork } from "@/types";

const PALETTE = [
  { hex: "#FF6B6B", name: "Red" },
  { hex: "#FFA94D", name: "Orange" },
  { hex: "#FFE58A", name: "Yellow" },
  { hex: "#9BE7C4", name: "Mint" },
  { hex: "#78C8F5", name: "Sky" },
  { hex: "#B8A5F5", name: "Lavender" },
  { hex: "#FF9C8C", name: "Coral" },
  { hex: "#24334D", name: "Navy" },
];

const BRUSH_SIZES = [
  { label: "Small", size: 6 },
  { label: "Medium", size: 14 },
  { label: "Big", size: 24 },
];

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b, 255];
}

interface ColoringCanvasProps {
  childId: string;
  onSaved: (artwork: Artwork) => void;
}

export function ColoringCanvas({ childId, onSaved }: ColoringCanvasProps) {
  const { refreshUser } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const drawCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawRectRef = useRef<DOMRect | null>(null);
  const usedColorsRef = useRef<Set<string>>(new Set(["#78C8F5"]));

  const [tool, setTool] = useState<"brush" | "fill" | "eraser">("brush");
  const [color, setColor] = useState("#78C8F5");
  const [brushSize, setBrushSize] = useState(14);
  const [templateKey, setTemplateKey] = useState("sun");
  const [title, setTitle] = useState("My Sunny Picture");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [canvasUnavailable, setCanvasUnavailable] = useState(false);

  const renderTemplate = useCallback((tplKey: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCanvasUnavailable(true);
      return;
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tpl = TEMPLATES.find((t) => t.key === tplKey);
    tpl?.draw(ctx, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    renderTemplate(templateKey);
  }, [renderTemplate, templateKey]);

  function getCanvasCoords(
    e: React.PointerEvent<HTMLCanvasElement>,
    cachedRect?: DOMRect | null
  ) {
    const canvas = canvasRef.current!;
    const rect = cachedRect || canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const pt = getCanvasCoords(e, rect);

    if (tool === "fill") {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const changed = floodFill(
        img.data,
        canvas.width,
        canvas.height,
        pt.x,
        pt.y,
        hexToRgba(color)
      );
      if (changed) {
        ctx.putImageData(img, 0, 0);
        usedColorsRef.current.add(color);
      }
      return;
    }

    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    drawCtxRef.current = ctx;
    drawRectRef.current = rect;
    lastPointRef.current = pt;

    const strokeColor = tool === "eraser" ? "#FFFFFF" : color;
    if (tool === "brush") usedColorsRef.current.add(color);

    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || tool === "fill") return;
    const canvas = canvasRef.current;
    const ctx = drawCtxRef.current || canvas?.getContext("2d");
    if (!canvas || !ctx || !lastPointRef.current) return;

    const pt = getCanvasCoords(e, drawRectRef.current);
    ctx.strokeStyle = tool === "eraser" ? "#FFFFFF" : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPointRef.current = pt;
  }

  function handlePointerUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
    drawCtxRef.current = null;
    drawRectRef.current = null;
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const created = await artworkApi.create(childId, {
        title: title.trim() || "My LittleSteps Art",
        image_data: dataUrl,
        palette_used: Array.from(usedColorsRef.current),
      });
      playChime("celebrate");
      setSavedNotice("Saved to your Art Gallery! Great job, Young Artist!");
      onSaved(created);
      void refreshUser();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save your artwork."
      );
    } finally {
      setSaving(false);
    }
  }

  if (canvasUnavailable) {
    return (
      <Alert tone="warning" title="Canvas Unavailable">
        Your browser does not support the digital coloring canvas.
      </Alert>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-4 sm:p-6 border-2 border-[#FF9C8C]/40 shadow-md space-y-4 sm:space-y-5">
      {error && <Alert tone="warning">{error}</Alert>}
      {savedNotice && <Alert tone="success">{savedNotice}</Alert>}

      {/* Tools & Templates */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={tool === "brush" ? "secondary" : "outline"}
            size="md"
            onClick={() => setTool("brush")}
            className="min-h-11 sm:min-h-12"
          >
            <Paintbrush className="h-4 w-4" />
            Brush
          </Button>
          <Button
            type="button"
            variant={tool === "fill" ? "secondary" : "outline"}
            size="md"
            onClick={() => setTool("fill")}
            className="min-h-11 sm:min-h-12"
          >
            <PaintBucket className="h-4 w-4" />
            Fill
          </Button>
          <Button
            type="button"
            variant={tool === "eraser" ? "secondary" : "outline"}
            size="md"
            onClick={() => setTool("eraser")}
            className="min-h-11 sm:min-h-12"
          >
            <Eraser className="h-4 w-4" />
            Eraser
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => renderTemplate(templateKey)}
            className="min-h-11 sm:min-h-12"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              onClick={() => {
                setTemplateKey(tpl.key);
                renderTemplate(tpl.key);
              }}
              className={cn(
                "rounded-2xl min-h-10 px-3 py-2 text-xs font-bold border transition-all cursor-pointer",
                templateKey === tpl.key
                  ? "bg-[#FFE58A] border-[#24334D]"
                  : "bg-[#FFF9F0] border-[#24334D]/12"
              )}
            >
              {tpl.emoji} {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Palette & Brush Size */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {PALETTE.map((swatch) => (
            <button
              key={swatch.hex}
              type="button"
              aria-label={`Color ${swatch.name}`}
              onClick={() => {
                setColor(swatch.hex);
                if (tool === "eraser") setTool("brush");
              }}
              className={cn(
                "h-11 w-11 rounded-full border-4 border-white shadow-sm transition-transform cursor-pointer",
                color === swatch.hex && tool !== "eraser"
                  ? "ring-4 ring-[#24334D] scale-110"
                  : "hover:scale-105"
              )}
              style={{ backgroundColor: swatch.hex }}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {BRUSH_SIZES.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => setBrushSize(b.size)}
              className={cn(
                "rounded-2xl min-h-10 px-3 py-1.5 text-xs font-bold border cursor-pointer",
                brushSize === b.size
                  ? "bg-[#24334D] text-white border-[#24334D]"
                  : "bg-[#FFF9F0] text-[#24334D] border-[#24334D]/12"
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="mx-auto w-full max-w-[min(100%,calc(62dvh*4/3))] rounded-3xl border-4 border-[#78C8F5]/40 overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full aspect-[4/3] block cursor-crosshair"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* Title & Save */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give your drawing a title..."
          maxLength={80}
          aria-label="Artwork title"
        />
        <Button
          type="button"
          variant="kids"
          size="kid"
          disabled={saving}
          onClick={handleSave}
          className="w-full sm:w-auto shrink-0"
        >
          <Save className="h-5 w-5" />
          {saving ? "Saving..." : "Save My Art"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Child, ThemeDetail } from "@/types";

interface MilestoneCardModalProps {
  open: boolean;
  onClose: () => void;
  child: Child | null;
  lessonsCompleted: number;
  daysActiveThisWeek: number;
  currentTheme?: ThemeDetail | null;
}

export function MilestoneCardModal({
  open,
  onClose,
  child,
  lessonsCompleted,
  daysActiveThisWeek,
  currentTheme,
}: MilestoneCardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !child) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Warm cream background card
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#DCF2FD");
    grad.addColorStop(0.55, "#FFF9F0");
    grad.addColorStop(1, "#FFF5CF");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Rounded celebratory border
    ctx.strokeStyle = "#FFE58A";
    ctx.lineWidth = 12;
    ctx.strokeRect(16, 16, w - 32, h - 32);

    // Title Banner
    ctx.fillStyle = "#24334D";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("🦉 LittleSteps · Small Steps, Big Discoveries", 46, 68);

    // Child celebratory heading
    ctx.font = "bold 40px sans-serif";
    ctx.fillText(`Proud Moment for ${child.display_name}! ⭐`, 46, 134);

    // Highlights boxes
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(46, 170, 215, 130);
    ctx.fillRect(292, 170, 215, 130);
    ctx.fillRect(538, 170, 215, 130);

    ctx.strokeStyle = "#78C8F5";
    ctx.lineWidth = 3;
    ctx.strokeRect(46, 170, 215, 130);
    ctx.strokeRect(292, 170, 215, 130);
    ctx.strokeRect(538, 170, 215, 130);

    ctx.fillStyle = "#175B82";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText(`${child.total_stars} ⭐`, 74, 232);
    ctx.fillText(`${lessonsCompleted}`, 368, 232);
    ctx.fillText(`${daysActiveThisWeek}d`, 608, 232);

    ctx.fillStyle = "#24334D";
    ctx.font = "bold 17px sans-serif";
    ctx.fillText("Total Stars Earned", 66, 272);
    ctx.fillText("Lessons Explored", 316, 272);
    ctx.fillText("Days Active / Week", 564, 272);

    // Footer theme + date
    const themeTitle = currentTheme
      ? `Exploring Week ${currentTheme.week_number}: ${currentTheme.title}`
      : "Growing happily in Pre-School!";
    ctx.fillStyle = "#24334D";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(themeTitle, 46, 358);

    ctx.fillStyle = "#5B6A82";
    ctx.font = "16px sans-serif";
    ctx.fillText(
      `Saved ${new Date().toLocaleDateString()} · Safe to share with Nanay, Tatay, Lolo & Lola`,
      46,
      398
    );
  }, [open, child, lessonsCompleted, daysActiveThisWeek, currentTheme]);

  if (!child) return null;

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas || !child) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `littlesteps-${child.display_name.toLowerCase()}-milestone.png`;
    link.click();
    setShareNote("Card downloaded! Ready to send in Messenger or Viber.");
  }

  async function handleShare() {
    const canvas = canvasRef.current;
    if (!canvas || !child) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File(
        [blob],
        `littlesteps-${child.display_name.toLowerCase()}-milestone.png`,
        { type: "image/png" }
      );
      if (
        typeof navigator !== "undefined" &&
        "canShare" in navigator &&
        navigator.canShare?.({ files: [file] })
      ) {
        try {
          await navigator.share({
            title: `Proud Moment for ${child.display_name}!`,
            text: `${child.display_name} earned ${child.total_stars} stars on LittleSteps!`,
            files: [file],
          });
          setShareNote("Shared cleanly!");
          return;
        } catch {
          // User canceled or unsupported
        }
      }
      handleDownload();
    }, "image/png");
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        setShareNote(null);
        onClose();
      }}
      size="lg"
      title="Share a Family Milestone Card"
      description="Download or send this privacy-safe keepsake to working/OFW parents, Lolo, or Lola!"
    >
      <div className="space-y-4">
        <canvas
          ref={canvasRef}
          width={800}
          height={440}
          className="w-full h-auto rounded-2xl border border-[#24334D]/12 shadow-sm"
        />
        {shareNote && (
          <p className="text-xs font-bold text-[#166041] bg-[#DDF8EC] rounded-xl px-3 py-2">
            {shareNote}
          </p>
        )}
        <div className="flex flex-col sm:flex-row justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Save Image (.PNG)
          </Button>
          <Button type="button" variant="primary" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
            Send to Family
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

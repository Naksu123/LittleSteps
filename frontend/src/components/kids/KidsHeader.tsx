"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame, Music, Star, Volume2, VolumeX } from "lucide-react";
import {
  getMusicEnabled,
  getSoundEnabled,
  getSoundVolume,
  onAudioSettingsChange,
  setMusicEnabled,
  setSoundEnabled,
  setSoundVolume,
} from "@/lib/sound";
import { GrownUpGate } from "@/components/layout/GrownUpGate";
import { ChildAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Child } from "@/types";

interface KidsHeaderProps {
  child: Child | null;
  backHref: string;
  backLabel?: string;
  exitHref?: string;
}

export function KidsHeader({
  child,
  backHref,
  backLabel = "Back",
  exitHref = "/parent",
}: KidsHeaderProps) {
  const [soundOn, setSoundOn] = useState(true);
  const [volumePct, setVolumePct] = useState(85);
  const [musicOn, setMusicOn] = useState(false);

  useEffect(() => {
    const sync = () => {
      setSoundOn(getSoundEnabled());
      setVolumePct(Math.round(getSoundVolume() * 100));
      setMusicOn(getMusicEnabled());
    };
    sync();
    return onAudioSettingsChange(sync);
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  function handleVolumeChange(nextPct: number) {
    const clamped = Math.min(100, Math.max(0, nextPct));
    setVolumePct(clamped);
    setSoundVolume(clamped / 100);
    if (clamped > 0 && !soundOn) {
      setSoundOn(true);
      setSoundEnabled(true);
    }
  }

  function toggleMusic() {
    const next = !musicOn;
    setMusicOn(next);
    setMusicEnabled(next);
  }

  return (
    <header className="w-full rounded-3xl bg-white p-3 sm:px-5 shadow-md border-2 border-[#78C8F5]/30 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
      <div className="order-1 flex items-center gap-2 sm:gap-3 min-w-0">
        <Link href={backHref} className="shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="kid"
            className="min-h-11 sm:min-h-14 px-3.5 sm:px-6 text-sm sm:text-lg"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>{backLabel}</span>
          </Button>
        </Link>

        {child && (
          <div className="flex items-center gap-1.5 sm:gap-2.5 rounded-2xl bg-[#FFF9F0] px-2.5 sm:px-3 py-1 sm:py-1.5 border border-[#24334D]/10 min-w-0">
            <ChildAvatar
              avatarKey={child.avatar_key}
              colorHex={child.favorite_color}
              size="sm"
              className="h-8 w-8 sm:h-10 sm:w-10 text-lg sm:text-xl shrink-0"
            />
            <span className="font-display font-bold text-[#24334D] hidden sm:inline truncate max-w-[140px]">
              {child.display_name}
            </span>
            <Badge variant="sunshine" className="text-xs px-2 sm:px-2.5 py-1 shrink-0">
              <Star className="h-3.5 w-3.5 fill-current" />
              {child.total_stars}
            </Badge>
            <Badge variant="coral" className="text-xs px-2 sm:px-2.5 py-1 shrink-0">
              <Flame className="h-3.5 w-3.5" />
              {child.streak_days}d
            </Badge>
          </div>
        )}
      </div>

      <div className="order-2 md:order-3 shrink-0">
        <GrownUpGate exitHref={exitHref} />
      </div>

      <div className="order-3 md:order-2 w-full md:w-auto flex flex-wrap items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t border-[#24334D]/8 md:border-t-0">
        <div className="flex items-center gap-2 rounded-2xl bg-[#FFF9F0] px-2.5 py-1 border border-[#24334D]/12">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleSound}
            aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
            className="rounded-xl px-2.5 min-h-10 sm:min-h-9"
          >
            {soundOn && volumePct > 0 ? (
              <Volume2 className="h-5 w-5 text-[#175B82]" />
            ) : (
              <VolumeX className="h-5 w-5 text-[#24334D]/50" />
            )}
            <span className="hidden sm:inline text-xs font-bold">
              {soundOn && volumePct > 0 ? "Sound On" : "Muted"}
            </span>
          </Button>

          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={soundOn ? volumePct : 0}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            aria-label="Audio volume"
            className="w-20 sm:w-24 accent-[#175B82] cursor-pointer"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={toggleMusic}
          aria-label={
            musicOn ? "Turn background music off" : "Turn background music on"
          }
          className="rounded-2xl min-h-11 sm:min-h-12 px-3 sm:px-4"
        >
          <Music
            className={
              musicOn ? "h-4 w-4 text-[#166041]" : "h-4 w-4 text-[#24334D]/45"
            }
          />
          <span className="text-xs font-bold">
            {musicOn ? "Music On" : "Music Off"}
          </span>
        </Button>
      </div>
    </header>
  );
}

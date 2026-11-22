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
    <header className="w-full rounded-3xl bg-white p-3 sm:px-5 shadow-md border-2 border-[#78C8F5]/30 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button type="button" variant="secondary" size="kid" className="min-h-14">
            <ArrowLeft className="h-5 w-5" />
            {backLabel}
          </Button>
        </Link>

        {child && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-[#FFF9F0] px-3 py-1.5 border border-[#24334D]/10">
            <ChildAvatar
              avatarKey={child.avatar_key}
              colorHex={child.favorite_color}
              size="sm"
            />
            <span className="font-display font-bold text-[#24334D] hidden sm:inline">
              {child.display_name}
            </span>
            <Badge variant="sunshine" className="text-xs px-2.5 py-1">
              <Star className="h-3.5 w-3.5 fill-current" />
              {child.total_stars}
            </Badge>
            <Badge variant="coral" className="text-xs px-2.5 py-1">
              <Flame className="h-3.5 w-3.5" />
              {child.streak_days}d
            </Badge>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-2xl bg-[#FFF9F0] px-2.5 py-1.5 border border-[#24334D]/12">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleSound}
            aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
            className="rounded-xl px-2.5 min-h-9"
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
            className="w-16 sm:w-20 accent-[#175B82] cursor-pointer"
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
          className="rounded-2xl min-h-12"
        >
          <Music
            className={
              musicOn ? "h-4 w-4 text-[#166041]" : "h-4 w-4 text-[#24334D]/45"
            }
          />
          <span className="hidden md:inline text-xs">
            {musicOn ? "Music On" : "Music Off"}
          </span>
        </Button>

        <GrownUpGate exitHref={exitHref} />
      </div>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Music, SkipForward } from "lucide-react";
import {
  getCurrentBackgroundSong,
  getMusicEnabled,
  getSoundEnabled,
  onAudioSettingsChange,
  setMusicEnabled,
  skipToNextRandomSong,
  type PreschoolSongSummary,
} from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface KidsMusicControlProps {
  compact?: boolean;
  className?: string;
}

export function KidsMusicControl({
  compact = false,
  className,
}: KidsMusicControlProps) {
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [currentSong, setCurrentSong] = useState<PreschoolSongSummary | null>(
    null
  );

  useEffect(() => {
    const sync = () => {
      setSoundOn(getSoundEnabled());
      setMusicOn(getMusicEnabled());
      setCurrentSong(getCurrentBackgroundSong());
    };
    sync();
    return onAudioSettingsChange(sync);
  }, []);

  function toggleMusic() {
    const next = !musicOn;
    setMusicOn(next);
    setMusicEnabled(next);
  }

  function handleNextSong() {
    if (!soundOn || !musicOn) return;
    const next = skipToNextRandomSong();
    if (next) setCurrentSong(next);
  }

  const active = musicOn && soundOn;

  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={toggleMusic}
        aria-label={
          musicOn ? "Turn background music off" : "Turn background music on"
        }
        className={cn(
          "rounded-2xl min-h-10 sm:min-h-11 px-3 sm:px-3.5 transition-colors",
          active
            ? "bg-[#DDF8EC] border-[#9BE7C4] text-[#166041] hover:bg-[#c8f2df]"
            : "bg-white text-[#24334D]/75"
        )}
      >
        <Music
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-[#166041]" : "text-[#24334D]/45"
          )}
        />
        <span className="text-xs font-bold">
          {musicOn ? "Music On" : "Music Off"}
        </span>
      </Button>

      {active && (
        <>
          {currentSong && (
            <span
              data-testid="current-bgm-title"
              title={`${currentSong.title}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-full bg-[#FFF9F0] border border-[#24334D]/12 px-2.5 py-1 text-xs font-semibold text-[#24334D]/85 truncate",
                compact
                  ? "hidden sm:inline-flex max-w-[140px] lg:max-w-[180px]"
                  : "max-w-[165px] sm:max-w-[210px]"
              )}
            >
              <span aria-hidden="true">{currentSong.emoji}</span>
              <span className="truncate">{currentSong.title}</span>
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNextSong}
            aria-label="Play next random song"
            title="Next random song"
            className="rounded-2xl min-h-10 sm:min-h-11 px-2.5 bg-white hover:bg-[#FFF5CF]"
          >
            <SkipForward className="h-4 w-4 text-[#175B82]" />
          </Button>
        </>
      )}
    </div>
  );
}

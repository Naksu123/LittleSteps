"use client";

import { useEffect } from "react";
import {
  ensureBackgroundMusicUnlocked,
  getMusicEnabled,
  getSoundEnabled,
  startBackgroundMusic,
  stopBackgroundMusic,
} from "@/lib/sound";

export function KidsMusicController() {
  useEffect(() => {
    if (getSoundEnabled() && getMusicEnabled()) {
      startBackgroundMusic();
    }

    const handleUserGesture = () => {
      if (getSoundEnabled() && getMusicEnabled()) {
        ensureBackgroundMusicUnlocked();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopBackgroundMusic();
      } else if (getSoundEnabled() && getMusicEnabled()) {
        startBackgroundMusic();
      }
    };

    window.addEventListener("pointerdown", handleUserGesture, { passive: true });
    window.addEventListener("keydown", handleUserGesture, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointerdown", handleUserGesture);
      window.removeEventListener("keydown", handleUserGesture);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopBackgroundMusic();
    };
  }, []);

  return null;
}

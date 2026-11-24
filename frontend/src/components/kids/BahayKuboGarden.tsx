"use client";

import { useState } from "react";
import { Droplets, Sparkles, Sun, Volume2 } from "lucide-react";
import { useOptionalAuth } from "@/hooks/authContext";
import {
  GARDEN_CROPS,
  normalizeLanguage,
  STICKERS_META,
  tText,
  type GardenCropMeta,
} from "@/lib/i18n";
import { playChime } from "@/lib/sound";
import { speak } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { childrenApi } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Child } from "@/types";

interface BahayKuboGardenProps {
  child: Child | null;
}

const STAGE_LABELS = [
  { en: "Seed", fil: "Buto" },
  { en: "Sprout", fil: "Sumisibol" },
  { en: "Budding", fil: "Lumalaki" },
  { en: "Full Bloom!", fil: "Namumunga!" },
];

export function BahayKuboGarden({ child }: BahayKuboGardenProps) {
  const auth = useOptionalAuth();
  const lang = normalizeLanguage(auth?.parentPreferences?.preferred_language);
  const refreshUser = auth?.refreshUser;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [gardenTip, setGardenTip] = useState<string | null>(null);

  if (!child) return null;

  const garden = child.garden_state_json || {
    sunbeams: 1,
    raindrops: 1,
    plants: { kalabasa: 1 },
    stickers: [],
  };
  const plants = garden.plants || {};
  const earnedStickers = new Set(garden.stickers || []);

  async function handleCropTap(crop: GardenCropMeta) {
    if (!child || busyKey) return;
    const stage = Math.min(3, Math.max(0, Number(plants[crop.key] ?? 0)));

    if (stage >= 3) {
      const msg = lang === "fil" ? crop.factFil : crop.factEn;
      setGardenTip(msg);
      speak(msg, { lang });
      playChime("success");
      return;
    }

    const useResource: "raindrop" | "sunbeam" | null =
      (garden.raindrops ?? 0) > 0
        ? "raindrop"
        : (garden.sunbeams ?? 0) > 0
          ? "sunbeam"
          : null;

    if (!useResource) {
      const tip = tText(
        lang,
        "Finish a lesson or ask a grown-up to check off a Home Activity to get Sunbeams or Raindrops!",
        "Tapusin ang isang aralin o Home Activity para makakuha ng Sikat ng Araw o Patak ng Ulan!"
      );
      setGardenTip(tip);
      speak(tip, { lang });
      return;
    }

    setBusyKey(crop.key);
    try {
      await childrenApi.growGarden(child.id, {
        crop_key: crop.key,
        use_resource: useResource,
      });
      playChime("celebrate");
      const fact = tText(lang, crop.factEn, crop.factFil);
      setGardenTip(fact);
      speak(fact, { lang });
      await refreshUser?.();
    } catch {
      setGardenTip(
        tText(
          lang,
          "Keep learning and playing to water more plants!",
          "Magpatuloy sa pag-aaral para madiligan ang ating hardin!"
        )
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-br from-[#DDF8EC]/80 via-[#FFF9F0] to-[#FFF5CF]/80 border-2 border-[#9BE7C4]">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#24334D] flex items-center gap-2">
                🏡 {tText(lang, "Pip's Bahay Kubo Garden", "Hardin sa Bahay Kubo ni Pip")}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#24334D]/75">
                {tText(
                  lang,
                  "Lessons give Sunbeams ☀️ • Family Home Play gives Raindrops 💧 — Tap a plant to grow!",
                  "Aralin = Sikat ng Araw ☀️ • Gawaing-Bahay = Patak ng Ulan 💧 — Pindutin ang halaman!"
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="sunshine" className="text-sm px-3 py-1.5">
                <Sun className="h-4 w-4" />
                {garden.sunbeams ?? 0} {tText(lang, "Sunbeams", "Araw")}
              </Badge>
              <Badge variant="sky" className="text-sm px-3 py-1.5">
                <Droplets className="h-4 w-4" />
                {garden.raindrops ?? 0} {tText(lang, "Raindrops", "Ulan")}
              </Badge>
            </div>
          </div>

          {gardenTip && (
            <div
              role="status"
              className="rounded-2xl bg-white/95 border border-[#9BE7C4] px-4 py-2.5 flex items-center justify-between gap-2 text-sm font-bold text-[#166041]"
            >
              <span>🌱 {gardenTip}</span>
              <button
                type="button"
                aria-label="Hear garden tip"
                onClick={() => speak(gardenTip, { lang })}
                className="rounded-xl p-1.5 hover:bg-[#DDF8EC] cursor-pointer"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {GARDEN_CROPS.map((crop) => {
              const stage = Math.min(3, Math.max(0, Number(plants[crop.key] ?? 0)));
              const emoji = crop.stages[stage];
              const stageMeta = STAGE_LABELS[stage];
              const isBusy = busyKey === crop.key;
              return (
                <button
                  key={crop.key}
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleCropTap(crop)}
                  className={cn(
                    "rounded-2xl p-3 border-2 border-[#24334D]/10 text-center space-y-1.5 transition-all hover:scale-[1.03] active:scale-[0.98] cursor-pointer",
                    stage === 3 && "ring-2 ring-[#9BE7C4]"
                  )}
                  style={{ backgroundColor: crop.bg }}
                >
                  <div className="text-4xl sm:text-5xl leading-none py-1">
                    {emoji}
                  </div>
                  <p className="font-display text-sm font-bold text-[#24334D] leading-tight">
                    {lang === "fil" ? crop.nameFil : crop.nameEn}
                  </p>
                  <span className="inline-block rounded-full bg-white/85 px-2.5 py-0.5 text-[11px] font-bold text-[#24334D]/80">
                    {tText(lang, stageMeta.en, stageMeta.fil)}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filipino Sticker Passport */}
      <Card className="border-2 border-[#FFE58A] bg-white">
        <CardContent className="p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg sm:text-xl font-bold text-[#24334D] flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#9A7100]" />
              {tText(lang, "Pasaporte Sticker Album", "Pasaporte ng Mga Sticker")}
            </h3>
            <Badge variant="lavender">
              {earnedStickers.size} / 12 {tText(lang, "Collected", "Nakolekta")}
            </Badge>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {Object.entries(STICKERS_META).map(([slug, meta]) => {
              const unlocked = earnedStickers.has(slug);
              return (
                <div
                  key={slug}
                  className={cn(
                    "rounded-2xl p-2.5 text-center border text-xs space-y-1",
                    unlocked
                      ? "bg-[#FFF5CF] border-[#FFE58A] text-[#24334D]"
                      : "bg-[#FFF9F0] border-[#24334D]/10 text-[#24334D]/40"
                  )}
                >
                  <div className={cn("text-2xl", !unlocked && "grayscale opacity-40")}>
                    {meta.emoji}
                  </div>
                  <p className="font-bold leading-tight truncate">
                    {lang === "fil" ? meta.titleFil : meta.titleEn}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

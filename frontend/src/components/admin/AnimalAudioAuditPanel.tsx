"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Flag,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  ANIMAL_SOUND_LIST,
  playAnimalSound,
  stopAnimalSound,
  type AnimalCategory,
  type AnimalSoundKey,
  type AnimalSoundMeta,
} from "@/lib/animalSounds";
import {
  getSoundEnabled,
  getSoundVolume,
  onAudioSettingsChange,
  setSoundEnabled,
  setSoundVolume,
} from "@/lib/sound";
import { stopSpeaking } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const QA_FLAGS_KEY = "littlesteps_audio_qa_flags";

type FilterKind = "all" | AnimalCategory | "flagged";
type ProbeState = "untested" | "ok" | "missing";

interface ProbeResult {
  status: ProbeState;
  sizeBytes?: number;
}

export function AnimalAudioAuditPanel() {
  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [volumePct, setVolumePct] = useState(85);
  const [pronounceAfter, setPronounceAfter] = useState(false);

  const [playingKey, setPlayingKey] = useState<AnimalSoundKey | null>(null);
  const [loadingKey, setLoadingKey] = useState<AnimalSoundKey | null>(null);
  const [errorByKey, setErrorByKey] = useState<
    Partial<Record<AnimalSoundKey, string>>
  >({});
  const [queueRunning, setQueueRunning] = useState(false);
  const [flaggedKeys, setFlaggedKeys] = useState<Record<string, boolean>>({});
  const [probes, setProbes] = useState<
    Partial<Record<AnimalSoundKey, ProbeResult>>
  >({});
  const [verifyingAll, setVerifyingAll] = useState(false);

  const mountedRef = useRef(true);
  const queueCancelledRef = useRef(true);
  const queueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const syncAudio = () => {
      setSoundOn(getSoundEnabled());
      setVolumePct(Math.round(getSoundVolume() * 100));
    };
    syncAudio();
    const unsub = onAudioSettingsChange(syncAudio);

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(QA_FLAGS_KEY);
        if (raw) {
          setFlaggedKeys(JSON.parse(raw) as Record<string, boolean>);
        }
      } catch {
        // Ignore storage errors
      }
    }

    // Audio files are loaded on demand when auditioning or running Play All.

    return () => {
      mountedRef.current = false;
      queueCancelledRef.current = true;
      if (queueTimerRef.current) clearTimeout(queueTimerRef.current);
      unsub();
      stopAnimalSound();
      stopSpeaking();
    };
  }, []);

  function toggleFlag(key: AnimalSoundKey) {
    setFlaggedKeys((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next[key]) delete next[key];
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(QA_FLAGS_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
      }
      return next;
    });
  }

  const handleStopAll = useCallback(() => {
    queueCancelledRef.current = true;
    if (queueTimerRef.current) {
      clearTimeout(queueTimerRef.current);
      queueTimerRef.current = null;
    }
    stopAnimalSound();
    stopSpeaking();
    setQueueRunning(false);
    setPlayingKey(null);
    setLoadingKey(null);
  }, []);

  function ensureAudible() {
    if (!getSoundEnabled()) {
      setSoundEnabled(true);
    }
    if (getSoundVolume() <= 0) {
      setSoundVolume(0.85);
    }
  }

  function handlePlaySingle(meta: AnimalSoundMeta) {
    if (playingKey === meta.key && !queueRunning) {
      handleStopAll();
      return;
    }
    queueCancelledRef.current = true;
    if (queueTimerRef.current) {
      clearTimeout(queueTimerRef.current);
      queueTimerRef.current = null;
    }
    setQueueRunning(false);
    ensureAudible();
    setErrorByKey((prev) => ({ ...prev, [meta.key]: undefined }));

    playAnimalSound(meta.key, {
      pronounceNameAfter: pronounceAfter,
      onLoading: () => {
        if (mountedRef.current) setLoadingKey(meta.key);
      },
      onStart: () => {
        if (mountedRef.current) {
          setLoadingKey(null);
          setPlayingKey(meta.key);
        }
      },
      onError: (msg) => {
        if (mountedRef.current) {
          setErrorByKey((prev) => ({ ...prev, [meta.key]: msg }));
        }
      },
      onEnd: () => {
        if (mountedRef.current) {
          setLoadingKey((prev) => (prev === meta.key ? null : prev));
          setPlayingKey((prev) => (prev === meta.key ? null : prev));
        }
      },
    });
  }

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ANIMAL_SOUND_LIST.filter((item) => {
      if (filter === "flagged" && !flaggedKeys[item.key]) return false;
      if (
        filter !== "all" &&
        filter !== "flagged" &&
        item.category !== filter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q) ||
        item.soundDescription.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q)
      );
    });
  }, [filter, search, flaggedKeys]);

  function startAuditionQueue() {
    if (filteredList.length === 0) return;
    handleStopAll();
    ensureAudible();
    queueCancelledRef.current = false;
    setQueueRunning(true);

    const playAtIndex = (idx: number) => {
      if (!mountedRef.current || queueCancelledRef.current) return;
      if (idx >= filteredList.length) {
        setQueueRunning(false);
        setPlayingKey(null);
        setLoadingKey(null);
        return;
      }
      const item = filteredList[idx];
      playAnimalSound(item.key, {
        pronounceNameAfter: pronounceAfter,
        onLoading: () => {
          if (mountedRef.current) setLoadingKey(item.key);
        },
        onStart: () => {
          if (mountedRef.current) {
            setLoadingKey(null);
            setPlayingKey(item.key);
          }
        },
        onError: (msg) => {
          if (mountedRef.current) {
            setErrorByKey((prev) => ({ ...prev, [item.key]: msg }));
          }
        },
        onEnd: () => {
          if (!mountedRef.current || queueCancelledRef.current) return;
          setLoadingKey(null);
          setPlayingKey(null);
          queueTimerRef.current = setTimeout(() => {
            playAtIndex(idx + 1);
          }, 400);
        },
      });
    };

    playAtIndex(0);
  }

  async function verifyAllAssets() {
    setVerifyingAll(true);
    try {
      const results = await Promise.all(
        ANIMAL_SOUND_LIST.map(async (item) => {
          try {
            const res = await fetch(item.audioSrc, { method: "HEAD" });
            const len = res.headers.get("content-length");
            const sizeBytes = len ? Number.parseInt(len, 10) : undefined;
            return [
              item.key,
              {
                status: res.ok ? ("ok" as const) : ("missing" as const),
                sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
              },
            ] as const;
          } catch {
            return [item.key, { status: "missing" as const }] as const;
          }
        })
      );
      if (mountedRef.current) {
        setProbes(Object.fromEntries(results));
      }
    } finally {
      if (mountedRef.current) setVerifyingAll(false);
    }
  }

  const flaggedCount = Object.values(flaggedKeys).filter(Boolean).length;

  return (
    <Card className="border-2 border-[#78C8F5]/40">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-[#175B82]" />
              Animal Audio QA &amp; Preview Studio ({ANIMAL_SOUND_LIST.length}{" "}
              Authentic Clips)
            </CardTitle>
            <CardDescription>
              Audition every real animal vocalization side by side, check loudness
              and clarity before publishing, and flag any distant clips for
              replacement.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="mint">Target: -16 LUFS • 44.1 kHz Mono MP3</Badge>
            <Badge variant={flaggedCount > 0 ? "coral" : "sky"}>
              {flaggedCount} Flagged
            </Badge>
          </div>
        </div>

        {/* Studio Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FFF9F0] p-3.5 border border-[#24334D]/8">
          <div className="flex flex-wrap items-center gap-2">
            {queueRunning ? (
              <Button
                type="button"
                variant="coral"
                size="sm"
                onClick={handleStopAll}
              >
                <Square className="h-4 w-4" />
                Stop Audition Queue
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={startAuditionQueue}
                disabled={filteredList.length === 0}
              >
                <Play className="h-4 w-4" />
                Play All ({filteredList.length})
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleStopAll}
              disabled={!playingKey && !loadingKey && !queueRunning}
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={verifyAllAssets}
              disabled={verifyingAll}
            >
              <RefreshCw
                className={cn("h-4 w-4", verifyingAll && "animate-spin")}
              />
              {verifyingAll ? "Checking Files..." : "Verify All 18 Audio Files"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#24334D] cursor-pointer">
              <input
                type="checkbox"
                checked={pronounceAfter}
                onChange={(e) => setPronounceAfter(e.target.checked)}
                className="h-4 w-4 accent-[#175B82] rounded"
              />
              Speak Name After Sound
            </label>

            <div className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1 border border-[#24334D]/10">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundOn)}
                aria-label={soundOn ? "Mute preview audio" : "Unmute preview audio"}
                className="flex items-center gap-1 text-xs font-bold text-[#24334D] cursor-pointer"
              >
                {soundOn && volumePct > 0 ? (
                  <Volume2 className="h-4 w-4 text-[#175B82]" />
                ) : (
                  <VolumeX className="h-4 w-4 text-[#24334D]/50" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={soundOn ? volumePct : 0}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setVolumePct(next);
                  setSoundVolume(next / 100);
                  if (next > 0 && !soundOn) setSoundEnabled(true);
                }}
                aria-label="Preview volume"
                className="w-20 accent-[#175B82] cursor-pointer"
              />
              <span className="text-[11px] font-bold text-[#24334D]/70 w-8 text-right">
                {soundOn ? `${volumePct}%` : "0%"}
              </span>
            </div>
          </div>
        </div>

        {/* Category Filter + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: "All Animals" },
                { id: "farm", label: "Farm" },
                { id: "wild", label: "Wild" },
                { id: "garden", label: "Garden & Forest" },
                { id: "flagged", label: `Flagged (${flaggedCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-bold border transition-colors cursor-pointer",
                  filter === tab.id
                    ? "bg-[#24334D] text-white border-[#24334D]"
                    : "bg-white text-[#24334D] border-[#24334D]/12 hover:bg-[#DCF2FD]/50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-[#24334D]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search animal or source..."
              aria-label="Search animal sounds"
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredList.length === 0 ? (
          <p className="text-sm text-[#24334D]/65 py-6 text-center">
            No animal clips match the current filter.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredList.map((item) => {
              const isPlaying = playingKey === item.key;
              const isLoading = loadingKey === item.key;
              const isFlagged = Boolean(flaggedKeys[item.key]);
              const probe = probes[item.key];
              const itemError = errorByKey[item.key];

              return (
                <div
                  key={item.key}
                  className={cn(
                    "rounded-2xl p-4 border transition-all space-y-3 flex flex-col justify-between",
                    isPlaying
                      ? "bg-[#FFE58A]/35 border-[#24334D]/35 ring-2 ring-[#78C8F5]/60"
                      : isFlagged
                        ? "bg-[#FFE3DE]/30 border-[#FF9C8C]"
                        : "bg-[#FFF9F0] border-[#24334D]/10"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-3xl select-none shrink-0">
                          {item.emoji}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-display font-bold text-base text-[#24334D] truncate">
                            {item.label}
                          </h3>
                          <p className="text-xs text-[#24334D]/70 truncate">
                            {item.soundDescription}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          item.category === "farm"
                            ? "mint"
                            : item.category === "wild"
                              ? "sunshine"
                              : "lavender"
                        }
                        className="capitalize shrink-0"
                      >
                        {item.category}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold text-[#24334D]/75 bg-white rounded-xl p-2 border border-[#24334D]/8">
                      <div>
                        <span className="block text-[10px] text-[#24334D]/50">
                          Duration
                        </span>
                        {(item.durationMs / 1000).toFixed(2)}s
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#24334D]/50">
                          Loudness
                        </span>
                        {item.loudnessLufs.toFixed(1)} LUFS
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#24334D]/50">
                          Size
                        </span>
                        {item.fileSizeKb} KB
                      </div>
                    </div>

                    <div className="text-[11px] text-[#24334D]/70 space-y-0.5">
                      <p className="font-mono text-[10px] text-[#24334D]/60 truncate">
                        {item.audioSrc}
                      </p>
                      <p className="truncate">
                        <strong>Source:</strong> {item.source} • {item.license}
                      </p>
                    </div>

                    {probe && (
                      <div>
                        {probe.status === "ok" ? (
                          <Badge variant="mint" className="text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            Asset Verified (
                            {probe.sizeBytes
                              ? `${(probe.sizeBytes / 1024).toFixed(1)} KB`
                              : "HTTP 200"}
                            )
                          </Badge>
                        ) : (
                          <Badge variant="coral" className="text-[10px]">
                            Missing / Unreachable
                          </Badge>
                        )}
                      </div>
                    )}

                    {itemError && (
                      <p className="text-xs font-bold text-[#8E3022]">
                        {itemError}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#24334D]/8">
                    <Button
                      type="button"
                      size="sm"
                      variant={isPlaying ? "coral" : "secondary"}
                      onClick={() => handlePlaySingle(item)}
                      aria-label={
                        isPlaying
                          ? `Stop ${item.label} sound`
                          : `Play ${item.label} sound`
                      }
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Loading...
                        </>
                      ) : isPlaying ? (
                        <>
                          <Square className="h-3.5 w-3.5" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          Listen
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={isFlagged ? "coral" : "ghost"}
                      onClick={() => toggleFlag(item.key)}
                      aria-label={`Toggle QA flag for ${item.label}`}
                    >
                      <Flag className="h-3.5 w-3.5" />
                      {isFlagged ? "Flagged: Distant/Fix" : "Verified Clear"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

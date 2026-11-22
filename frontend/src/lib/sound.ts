import {
  NOTE_FREQUENCIES,
  PRESCHOOL_SONGS,
  createShuffledSongQueue,
  toSongSummary,
  type MusicNote,
  type PreschoolSong,
  type PreschoolSongSummary,
} from "@/lib/preschoolMusic";

const SOUND_KEY = "littlesteps_sound";
const VOLUME_KEY = "littlesteps_volume";
const MUSIC_KEY = "littlesteps_bgm";
const AUDIO_EVENT = "littlesteps-audio-change";

const DEFAULT_VOLUME = 0.85;
const NORMAL_BGM_GAIN = 0.115;
const DUCKED_BGM_GAIN = 0.022;
const INTERLUDE_PAUSE_MS = 1200;

let sharedAudioCtx: AudioContext | null = null;
let bgmTimer: ReturnType<typeof setTimeout> | null = null;
let bgmDuckRestoreTimer: ReturnType<typeof setTimeout> | null = null;
let bgmPlaybackEpoch = 0;
let bgmQueue: PreschoolSong[] = [];
let bgmCurrentSong: PreschoolSong | null = null;
let bgmNoteIndex = 0;
let bgmIsPlaying = false;
let bgmWaitingForGesture = false;
let bgmDuckedUntil = 0;

let bgmBusCtx: AudioContext | null = null;
let bgmBusGain: GainNode | null = null;
let bgmBusFilter: BiquadFilterNode | null = null;

const stopCallbacks: Array<() => void> = [];

export { PRESCHOOL_SONGS, type PreschoolSongSummary };

function emitAudioChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(AUDIO_EVENT));
  } catch {
    // Ignore dispatch errors in restricted environments
  }
}

export function registerAudioStopCallback(cb: () => void): void {
  if (!stopCallbacks.includes(cb)) {
    stopCallbacks.push(cb);
  }
}

export function stopAllActiveAudio(): void {
  for (const cb of stopCallbacks) {
    try {
      cb();
    } catch {
      // Ignore individual stop handler errors
    }
  }
}

export function onAudioSettingsChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUDIO_EVENT, listener);
  return () => window.removeEventListener(AUDIO_EVENT, listener);
}

export function getSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = window.localStorage.getItem(SOUND_KEY);
    return val !== "false";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage errors
  }
  if (!enabled) {
    stopBackgroundMusic();
    stopAllActiveAudio();
  } else if (getMusicEnabled()) {
    startBackgroundMusic();
  }
  emitAudioChange();
}

export function getSoundVolume(): number {
  if (typeof window === "undefined") return DEFAULT_VOLUME;
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    if (raw === null) return DEFAULT_VOLUME;
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed)) return DEFAULT_VOLUME;
    return Math.min(1, Math.max(0, parsed));
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function setSoundVolume(volume: number): void {
  if (typeof window === "undefined") return;
  const clamped = Math.min(
    1,
    Math.max(0, Number.isFinite(volume) ? volume : DEFAULT_VOLUME)
  );
  try {
    window.localStorage.setItem(VOLUME_KEY, clamped.toFixed(2));
  } catch {
    // Ignore storage errors
  }
  syncBgmBusGain();
  emitAudioChange();
}

export function getMusicEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(MUSIC_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setMusicEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUSIC_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage errors
  }
  if (enabled && getSoundEnabled()) {
    startBackgroundMusic();
  } else {
    stopBackgroundMusic();
  }
  emitAudioChange();
}

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedAudioCtx && sharedAudioCtx.state !== "closed") {
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume?.().catch(() => {});
    }
    return sharedAudioCtx;
  }
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctx = w.AudioContext || w.webkitAudioContext;
  if (!Ctx) return null;
  try {
    sharedAudioCtx = new Ctx();
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume?.().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function setGainTargetSmooth(gainParam: AudioParam, target: number, ctx: AudioContext): void {
  try {
    if (typeof gainParam.setTargetAtTime === "function") {
      gainParam.setTargetAtTime(target, ctx.currentTime, 0.06);
    } else {
      gainParam.value = target;
    }
  } catch {
    // Ignore mock/restricted AudioParam errors
  }
}

function ensureBgmBus(ctx: AudioContext): { gain: GainNode; input: AudioNode } | null {
  if (bgmBusCtx === ctx && bgmBusGain) {
    return { gain: bgmBusGain, input: bgmBusFilter || bgmBusGain };
  }
  try {
    const gain = ctx.createGain();
    let input: AudioNode = gain;
    if (typeof ctx.createBiquadFilter === "function") {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 2600;
      filter.Q.value = 0.7;
      filter.connect(gain);
      bgmBusFilter = filter;
      input = filter;
    } else {
      bgmBusFilter = null;
    }
    gain.connect(ctx.destination);
    bgmBusCtx = ctx;
    bgmBusGain = gain;
    return { gain, input };
  } catch {
    return null;
  }
}

function syncBgmBusGain(ctx?: AudioContext | null): void {
  const targetCtx = ctx || bgmBusCtx;
  if (!targetCtx || !bgmBusGain || bgmBusCtx !== targetCtx) return;

  const vol = getSoundVolume();
  if (!bgmIsPlaying || !getSoundEnabled() || !getMusicEnabled() || vol <= 0) {
    setGainTargetSmooth(bgmBusGain.gain, 0.0001, targetCtx);
    return;
  }
  const isDucked = Date.now() < bgmDuckedUntil;
  const targetGain = Math.max(0.0001, (isDucked ? DUCKED_BGM_GAIN : NORMAL_BGM_GAIN) * vol);
  setGainTargetSmooth(bgmBusGain.gain, targetGain, targetCtx);
}

function clearBgmTimer(): void {
  if (bgmTimer) {
    clearTimeout(bgmTimer);
    bgmTimer = null;
  }
}

function clearDuckRestoreTimer(): void {
  if (bgmDuckRestoreTimer) {
    clearTimeout(bgmDuckRestoreTimer);
    bgmDuckRestoreTimer = null;
  }
}

function pickNextSong(excludeId?: string): PreschoolSong {
  if (bgmQueue.length === 0) {
    bgmQueue = createShuffledSongQueue(excludeId);
  }
  const next = bgmQueue.shift();
  if (!next) {
    return PRESCHOOL_SONGS[0];
  }
  if (excludeId && next.id === excludeId && bgmQueue.length > 0) {
    const alternate = bgmQueue.shift()!;
    bgmQueue.push(next);
    return alternate;
  }
  return next;
}

function scheduleMusicBoxNote(ctx: AudioContext, item: MusicNote, durSec: number): void {
  const bus = ensureBgmBus(ctx);
  if (!bus) return;
  syncBgmBusGain(ctx);

  const now = ctx.currentTime;

  if (item.note) {
    const freq = NOTE_FREQUENCIES[item.note];
    const sustainSec = Math.min(Math.max(durSec * 1.15, 0.35), 1.45);
    const shimmerSec = Math.min(durSec * 0.65, 0.42);

    try {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.linearRampToValueAtTime(0.42, now + 0.018);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + sustainSec);
      osc.connect(noteGain);
      noteGain.connect(bus.input);
      osc.start(now);
      osc.stop(now + sustainSec + 0.03);
    } catch {
      // Ignore Web Audio note scheduling errors
    }

    if (shimmerSec > 0.04) {
      try {
        const shimmerOsc = ctx.createOscillator();
        const shimmerGain = ctx.createGain();
        shimmerOsc.type = "sine";
        shimmerOsc.frequency.setValueAtTime(freq * 2, now);
        shimmerGain.gain.setValueAtTime(0.0001, now);
        shimmerGain.gain.linearRampToValueAtTime(0.08, now + 0.01);
        shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + shimmerSec);
        shimmerOsc.connect(shimmerGain);
        shimmerGain.connect(bus.input);
        shimmerOsc.start(now);
        shimmerOsc.stop(now + shimmerSec + 0.02);
      } catch {
        // Ignore shimmer harmonic errors
      }
    }
  }

  if (item.bass) {
    const bassFreq = NOTE_FREQUENCIES[item.bass];
    const bassSec = Math.min(Math.max(durSec * 1.8, 0.55), 1.65);
    try {
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = "sine";
      bassOsc.frequency.setValueAtTime(bassFreq, now);
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.linearRampToValueAtTime(0.22, now + 0.035);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + bassSec);
      bassOsc.connect(bassGain);
      bassGain.connect(bus.input);
      bassOsc.start(now);
      bassOsc.stop(now + bassSec + 0.03);
    } catch {
      // Ignore bass voice errors
    }
  }
}

function scheduleNextStep(epoch: number): void {
  if (
    epoch !== bgmPlaybackEpoch ||
    !bgmIsPlaying ||
    !getSoundEnabled() ||
    !getMusicEnabled()
  ) {
    return;
  }

  const ctx = getSharedAudioContext();
  if (!ctx) {
    bgmIsPlaying = false;
    bgmWaitingForGesture = false;
    clearBgmTimer();
    return;
  }

  if (ctx.state === "suspended") {
    ctx.resume?.().catch(() => {});
    bgmWaitingForGesture = true;
    clearBgmTimer();
    emitAudioChange();
    return;
  }

  bgmWaitingForGesture = false;

  if (!bgmCurrentSong) {
    bgmCurrentSong = pickNextSong();
    bgmNoteIndex = 0;
    emitAudioChange();
  }

  if (bgmNoteIndex >= bgmCurrentSong.notes.length) {
    const previousId = bgmCurrentSong.id;
    clearBgmTimer();
    bgmTimer = setTimeout(() => {
      if (
        epoch !== bgmPlaybackEpoch ||
        !bgmIsPlaying ||
        !getSoundEnabled() ||
        !getMusicEnabled()
      ) {
        return;
      }
      bgmCurrentSong = pickNextSong(previousId);
      bgmNoteIndex = 0;
      emitAudioChange();
      scheduleNextStep(epoch);
    }, INTERLUDE_PAUSE_MS);
    return;
  }

  const item = bgmCurrentSong.notes[bgmNoteIndex];
  const durSec = (item.beats * 60) / bgmCurrentSong.bpm;
  bgmNoteIndex += 1;

  if (getSoundVolume() > 0) {
    scheduleMusicBoxNote(ctx, item, durSec);
  }

  clearBgmTimer();
  bgmTimer = setTimeout(() => {
    scheduleNextStep(epoch);
  }, Math.max(90, Math.round(durSec * 1000)));
}

export function duckBackgroundMusic(durationMs = 1800): void {
  bgmDuckedUntil = Math.max(bgmDuckedUntil, Date.now() + durationMs);
  syncBgmBusGain();

  clearDuckRestoreTimer();
  if (bgmIsPlaying && bgmBusGain) {
    const delayMs = Math.max(50, bgmDuckedUntil - Date.now() + 40);
    bgmDuckRestoreTimer = setTimeout(() => {
      bgmDuckRestoreTimer = null;
      syncBgmBusGain();
    }, delayMs);
  }
}

export function startBackgroundMusic(): void {
  if (typeof window === "undefined") return;
  if (!getSoundEnabled() || !getMusicEnabled()) return;
  if (bgmIsPlaying && !bgmWaitingForGesture) return;

  if (!bgmCurrentSong) {
    bgmCurrentSong = pickNextSong();
    bgmNoteIndex = 0;
  }

  bgmPlaybackEpoch += 1;
  bgmIsPlaying = true;
  bgmWaitingForGesture = false;
  syncBgmBusGain();
  emitAudioChange();
  scheduleNextStep(bgmPlaybackEpoch);
}

export function stopBackgroundMusic(): void {
  bgmPlaybackEpoch += 1;
  bgmIsPlaying = false;
  bgmWaitingForGesture = false;
  clearBgmTimer();
  clearDuckRestoreTimer();
  syncBgmBusGain();
  emitAudioChange();
}

export function ensureBackgroundMusicUnlocked(): void {
  if (typeof window === "undefined") return;
  if (!getSoundEnabled() || !getMusicEnabled()) return;

  const ctx = getSharedAudioContext();
  if (!ctx) return;

  const resumePlayback = () => {
    if (!getSoundEnabled() || !getMusicEnabled()) return;
    if (!bgmIsPlaying || bgmWaitingForGesture) {
      startBackgroundMusic();
    }
  };

  if (ctx.state === "suspended" && typeof ctx.resume === "function") {
    ctx
      .resume()
      .then(() => {
        resumePlayback();
      })
      .catch(() => {});
  } else {
    resumePlayback();
  }
}

export function skipToNextRandomSong(): PreschoolSongSummary | null {
  const nextSong = pickNextSong(bgmCurrentSong?.id);
  bgmCurrentSong = nextSong;
  bgmNoteIndex = 0;

  if (typeof window !== "undefined" && getSoundEnabled() && getMusicEnabled()) {
    clearBgmTimer();
    bgmPlaybackEpoch += 1;
    bgmIsPlaying = true;
    bgmWaitingForGesture = false;
    syncBgmBusGain();
    scheduleNextStep(bgmPlaybackEpoch);
  }

  emitAudioChange();
  return toSongSummary(nextSong);
}

export function getCurrentBackgroundSong(): PreschoolSongSummary | null {
  return bgmCurrentSong ? toSongSummary(bgmCurrentSong) : null;
}

export function isBackgroundMusicPlaying(): boolean {
  return bgmIsPlaying && !bgmWaitingForGesture;
}

export function playChime(kind: "success" | "try" | "celebrate" | "tap"): void {
  if (!getSoundEnabled()) return;
  const vol = getSoundVolume();
  if (vol <= 0) return;

  const ctx = getSharedAudioContext();
  if (!ctx) return;

  const notes =
    kind === "celebrate"
      ? [523.25, 659.25, 783.99, 1046.5]
      : kind === "success"
        ? [523.25, 659.25]
        : kind === "tap"
          ? [587.33]
          : [392.0, 440.0];

  const peakGain = Math.min(0.14, 0.08 * vol);

  try {
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(peakGain, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  } catch {
    // Safely no-op in restricted audio environments
  }
}

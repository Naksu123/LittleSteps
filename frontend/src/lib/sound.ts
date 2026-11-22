const SOUND_KEY = "littlesteps_sound";
const VOLUME_KEY = "littlesteps_volume";
const MUSIC_KEY = "littlesteps_bgm";
const AUDIO_EVENT = "littlesteps-audio-change";

const DEFAULT_VOLUME = 0.85;

let sharedAudioCtx: AudioContext | null = null;
let bgmTimer: ReturnType<typeof setInterval> | null = null;
let bgmNoteIndex = 0;
let bgmDuckedUntil = 0;
const stopCallbacks: Array<() => void> = [];

const PENTATONIC_LULLABY_HZ = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  659.25, // E5
  880.0,  // A5
  783.99, // G5
  587.33, // D5
];

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
  if (typeof window === "undefined") return () => { };
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
  const clamped = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : DEFAULT_VOLUME));
  try {
    window.localStorage.setItem(VOLUME_KEY, clamped.toFixed(2));
  } catch {
    // Ignore storage errors
  }
  emitAudioChange();
}

export function getMusicEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUSIC_KEY) === "true";
  } catch {
    return false;
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
      sharedAudioCtx.resume?.().catch(() => { });
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
      sharedAudioCtx.resume?.().catch(() => { });
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function duckBackgroundMusic(durationMs = 1800): void {
  bgmDuckedUntil = Math.max(bgmDuckedUntil, Date.now() + durationMs);
}

export function startBackgroundMusic(): void {
  if (typeof window === "undefined") return;
  if (bgmTimer || !getSoundEnabled() || !getMusicEnabled()) return;

  bgmTimer = setInterval(() => {
    if (!getSoundEnabled() || !getMusicEnabled()) {
      stopBackgroundMusic();
      return;
    }
    const vol = getSoundVolume();
    if (vol <= 0) return;

    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const isDucked = Date.now() < bgmDuckedUntil;
    const noteGain = (isDucked ? 0.01 : 0.032) * vol;
    const freq = PENTATONIC_LULLABY_HZ[bgmNoteIndex % PENTATONIC_LULLABY_HZ.length];
    bgmNoteIndex += 1;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(noteGain, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.58);
    } catch {
      // Ignore audio errors
    }
  }, 680);
}

export function stopBackgroundMusic(): void {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
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

import {
  duckBackgroundMusic,
  getSharedAudioContext,
  getSoundEnabled,
  getSoundVolume,
  registerAudioStopCallback,
} from "@/lib/sound";
import { setBeforeSpeakHook, speak, stopSpeaking } from "@/lib/speech";

export type AnimalSoundKey =
  | "dog"
  | "cat"
  | "cow"
  | "duck"
  | "lion"
  | "elephant"
  | "bird"
  | "sheep"
  | "horse"
  | "pig"
  | "frog"
  | "owl"
  | "bee"
  | "chick"
  | "goat"
  | "rooster";

export interface AnimalSoundMeta {
  key: AnimalSoundKey;
  label: string;
  emoji: string;
  audioSrc: string;
  soundDescription: string;
  durationMs: number;
}

export const ANIMAL_SOUND_CATALOG: Record<AnimalSoundKey, AnimalSoundMeta> = {
  dog: {
    key: "dog",
    label: "Dog",
    emoji: "🐶",
    audioSrc: "/sounds/animals/dog.wav",
    soundDescription: "Friendly dog barking",
    durationMs: 920,
  },
  cat: {
    key: "cat",
    label: "Cat",
    emoji: "🐱",
    audioSrc: "/sounds/animals/cat.wav",
    soundDescription: "Gentle cat meowing",
    durationMs: 960,
  },
  cow: {
    key: "cow",
    label: "Cow",
    emoji: "🐮",
    audioSrc: "/sounds/animals/cow.wav",
    soundDescription: "Warm cow mooing",
    durationMs: 1250,
  },
  duck: {
    key: "duck",
    label: "Duck",
    emoji: "🦆",
    audioSrc: "/sounds/animals/duck.wav",
    soundDescription: "Playful duck quacking",
    durationMs: 860,
  },
  lion: {
    key: "lion",
    label: "Lion",
    emoji: "🦁",
    audioSrc: "/sounds/animals/lion.wav",
    soundDescription: "Deep lion roaring",
    durationMs: 1300,
  },
  elephant: {
    key: "elephant",
    label: "Elephant",
    emoji: "🐘",
    audioSrc: "/sounds/animals/elephant.wav",
    soundDescription: "Brassy elephant trumpeting",
    durationMs: 1160,
  },
  bird: {
    key: "bird",
    label: "Bird",
    emoji: "🐦",
    audioSrc: "/sounds/animals/bird.wav",
    soundDescription: "Natural bird chirping",
    durationMs: 960,
  },
  sheep: {
    key: "sheep",
    label: "Sheep",
    emoji: "🐑",
    audioSrc: "/sounds/animals/sheep.wav",
    soundDescription: "Soft sheep bleating",
    durationMs: 1060,
  },
  horse: {
    key: "horse",
    label: "Horse",
    emoji: "🐴",
    audioSrc: "/sounds/animals/horse.wav",
    soundDescription: "Cheerful horse neighing",
    durationMs: 1160,
  },
  pig: {
    key: "pig",
    label: "Pig",
    emoji: "🐷",
    audioSrc: "/sounds/animals/pig.wav",
    soundDescription: "Happy pig oinking",
    durationMs: 860,
  },
  frog: {
    key: "frog",
    label: "Frog",
    emoji: "🐸",
    audioSrc: "/sounds/animals/frog.wav",
    soundDescription: "Pond frog croaking",
    durationMs: 860,
  },
  owl: {
    key: "owl",
    label: "Owl",
    emoji: "🦉",
    audioSrc: "/sounds/animals/owl.wav",
    soundDescription: "Cozy owl hooting",
    durationMs: 1060,
  },
  bee: {
    key: "bee",
    label: "Bee",
    emoji: "🐝",
    audioSrc: "/sounds/animals/bee.wav",
    soundDescription: "Garden bee buzzing",
    durationMs: 960,
  },
  chick: {
    key: "chick",
    label: "Chick",
    emoji: "🐥",
    audioSrc: "/sounds/animals/chick.wav",
    soundDescription: "Little chick cheeping",
    durationMs: 860,
  },
  goat: {
    key: "goat",
    label: "Goat",
    emoji: "🐐",
    audioSrc: "/sounds/animals/goat.wav",
    soundDescription: "Mountain goat bleating",
    durationMs: 960,
  },
  rooster: {
    key: "rooster",
    label: "Rooster",
    emoji: "🐓",
    audioSrc: "/sounds/animals/rooster.wav",
    soundDescription: "Morning rooster crowing",
    durationMs: 1160,
  },
};

const ANIMAL_LOOKUP_ALIASES: Record<string, AnimalSoundKey> = {
  dog: "dog",
  puppy: "dog",
  woof: "dog",
  "woof woof": "dog",
  bark: "dog",
  cat: "cat",
  kitten: "cat",
  kitty: "cat",
  meow: "cat",
  "meow meow": "cat",
  cow: "cow",
  calf: "cow",
  moo: "cow",
  "moo moo": "cow",
  duck: "duck",
  duckling: "duck",
  quack: "duck",
  "quack quack": "duck",
  lion: "lion",
  roar: "lion",
  elephant: "elephant",
  pawoo: "elephant",
  trumpet: "elephant",
  bird: "bird",
  birdie: "bird",
  tweet: "bird",
  "tweet tweet": "bird",
  chirp: "bird",
  sheep: "sheep",
  lamb: "sheep",
  baa: "sheep",
  "baa baa": "sheep",
  horse: "horse",
  pony: "horse",
  neigh: "horse",
  pig: "pig",
  piglet: "pig",
  oink: "pig",
  "oink oink": "pig",
  frog: "frog",
  toad: "frog",
  ribbit: "frog",
  "ribbit ribbit": "frog",
  owl: "owl",
  hoo: "owl",
  "hoo hoo": "owl",
  bee: "bee",
  honeybee: "bee",
  buzz: "bee",
  "buzz buzz": "bee",
  chick: "chick",
  chicken: "chick",
  cheep: "chick",
  "cheep cheep": "chick",
  goat: "goat",
  maa: "goat",
  "maa maa": "goat",
  rooster: "rooster",
  "cock-a-doodle-doo": "rooster",
  "cock a doodle doo": "rooster",
};

export function resolveAnimalKey(input?: string | null): AnimalSoundKey | null {
  if (!input) return null;
  const cleaned = input
    .toLowerCase()
    .replace(/[!?.',"“”‘’]/g, "")
    .trim();
  if (!cleaned) return null;
  if (cleaned in ANIMAL_LOOKUP_ALIASES) {
    return ANIMAL_LOOKUP_ALIASES[cleaned];
  }
  for (const [alias, key] of Object.entries(ANIMAL_LOOKUP_ALIASES)) {
    if (
      alias.length >= 3 &&
      new RegExp(`\\b${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i").test(
        cleaned
      )
    ) {
      return key;
    }
  }
  return null;
}

export function getAnimalSoundMeta(
  animalKeyOrLabel?: string | null
): AnimalSoundMeta | null {
  const key = resolveAnimalKey(animalKeyOrLabel);
  return key ? ANIMAL_SOUND_CATALOG[key] : null;
}

let activeAudioElement: HTMLAudioElement | null = null;
let activeTimer: ReturnType<typeof setTimeout> | null = null;
let playbackSequenceId = 0;

export function stopAnimalSound(): void {
  playbackSequenceId += 1;
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  if (activeAudioElement) {
    try {
      activeAudioElement.onended = null;
      activeAudioElement.onerror = null;
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {
      // Ignore audio pause errors
    }
    activeAudioElement = null;
  }
}

registerAudioStopCallback(stopAnimalSound);
setBeforeSpeakHook(stopAnimalSound);

/**
 * Multi-harmonic Web Audio bio-acoustic fallback used only if the .wav file
 * cannot be loaded (e.g. offline mode or headless test environments).
 * Never uses text-to-speech to imitate animal sounds.
 */
function playFallbackBioAcousticAnimalSound(
  key: AnimalSoundKey,
  volume: number,
  onDone: () => void
): void {
  const ctx = getSharedAudioContext();
  if (!ctx) {
    activeTimer = setTimeout(onDone, 250);
    return;
  }

  const profileMap: Record<
    AnimalSoundKey,
    { notes: Array<[number, number, number]>; type: OscillatorType; formantHz: number }
  > = {
    cow: { notes: [[125, 138, 0.85]], type: "sawtooth", formantHz: 520 },
    cat: { notes: [[460, 620, 0.38], [620, 410, 0.42]], type: "triangle", formantHz: 1450 },
    dog: { notes: [[240, 155, 0.22], [250, 150, 0.24]], type: "sawtooth", formantHz: 780 },
    duck: { notes: [[330, 260, 0.22], [325, 250, 0.24]], type: "sawtooth", formantHz: 1500 },
    lion: { notes: [[110, 88, 0.9]], type: "sawtooth", formantHz: 420 },
    elephant: { notes: [[410, 740, 0.4], [740, 580, 0.45]], type: "sawtooth", formantHz: 1650 },
    bird: {
      notes: [
        [2400, 3300, 0.16],
        [2600, 3600, 0.18],
        [2500, 3450, 0.22],
      ],
      type: "sine",
      formantHz: 3100,
    },
    sheep: { notes: [[265, 250, 0.78]], type: "sawtooth", formantHz: 1100 },
    horse: { notes: [[640, 480, 0.42], [480, 360, 0.42]], type: "sawtooth", formantHz: 1350 },
    pig: { notes: [[155, 210, 0.24], [165, 220, 0.25]], type: "sawtooth", formantHz: 680 },
    frog: { notes: [[195, 420, 0.24], [205, 450, 0.25]], type: "sawtooth", formantHz: 920 },
    owl: { notes: [[390, 375, 0.32], [375, 355, 0.45]], type: "sine", formantHz: 450 },
    bee: { notes: [[205, 215, 0.75]], type: "sawtooth", formantHz: 1200 },
    chick: {
      notes: [
        [2900, 3450, 0.15],
        [2950, 3500, 0.15],
        [2900, 3400, 0.16],
      ],
      type: "sine",
      formantHz: 3200,
    },
    goat: { notes: [[340, 315, 0.75]], type: "sawtooth", formantHz: 1300 },
    rooster: {
      notes: [
        [520, 560, 0.15],
        [630, 660, 0.15],
        [780, 820, 0.18],
        [830, 630, 0.4],
      ],
      type: "sawtooth",
      formantHz: 1550,
    },
  };

  const profile = profileMap[key];
  let elapsed = 0;
  const now = ctx.currentTime;
  const peakGain = Math.min(0.18, 0.12 * volume);

  try {
    profile.notes.forEach(([fStart, fEnd, dur]) => {
      const start = now + elapsed;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = profile.type;
      osc.frequency.setValueAtTime(fStart, start);
      osc.frequency.linearRampToValueAtTime?.(fEnd, start + dur);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(peakGain, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      if (typeof ctx.createBiquadFilter === "function") {
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(profile.formantHz, start);
        filter.Q.setValueAtTime(2.4, start);
        osc.connect(filter);
        filter.connect(gain);
      } else {
        osc.connect(gain);
      }
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
      elapsed += dur + 0.07;
    });
  } catch {
    // Ignore synth fallback errors
  }

  activeTimer = setTimeout(onDone, Math.max(250, Math.round(elapsed * 1000)));
}

export function playAnimalSound(
  animalKeyOrLabel: string,
  opts?: {
    pronounceNameAfter?: boolean;
    followUpText?: string;
    onStart?: () => void;
    onEnd?: () => void;
  }
): boolean {
  const meta = getAnimalSoundMeta(animalKeyOrLabel);
  if (!meta) return false;

  // Prevent overlapping audio across rapid animal selections or active TTS
  stopSpeaking();
  stopAnimalSound();

  if (!getSoundEnabled()) {
    opts?.onEnd?.();
    return false;
  }
  const volume = getSoundVolume();
  if (volume <= 0) {
    opts?.onEnd?.();
    return false;
  }

  const seqId = playbackSequenceId;
  duckBackgroundMusic(meta.durationMs + 1400);
  opts?.onStart?.();

  const handleSoundFinished = () => {
    if (seqId !== playbackSequenceId) return;
    activeAudioElement = null;
    if (!getSoundEnabled()) {
      opts?.onEnd?.();
      return;
    }

    const followUp =
      opts?.followUpText ??
      (opts?.pronounceNameAfter ? `${meta.label}!` : "");

    if (followUp) {
      activeTimer = setTimeout(() => {
        if (seqId !== playbackSequenceId || !getSoundEnabled()) {
          opts?.onEnd?.();
          return;
        }
        speak(followUp, {
          keepAnimalSound: true,
          onEnd: () => {
            if (seqId === playbackSequenceId) {
              opts?.onEnd?.();
            }
          },
        });
      }, 120);
    } else {
      opts?.onEnd?.();
    }
  };

  if (
    typeof window !== "undefined" &&
    typeof window.Audio === "function" &&
    process.env.NODE_ENV !== "test"
  ) {
    try {
      const audio = new window.Audio(meta.audioSrc);
      audio.preload = "auto";
      audio.volume = Math.min(1, Math.max(0.05, volume * 0.9));
      activeAudioElement = audio;

      let settled = false;
      const finishOnce = () => {
        if (settled) return;
        settled = true;
        if (activeTimer) {
          clearTimeout(activeTimer);
          activeTimer = null;
        }
        handleSoundFinished();
      };

      const fallbackOnce = () => {
        if (settled || seqId !== playbackSequenceId) return;
        settled = true;
        activeAudioElement = null;
        playFallbackBioAcousticAnimalSound(meta.key, volume, handleSoundFinished);
      };

      audio.onended = finishOnce;
      audio.onerror = fallbackOnce;

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            if (seqId !== playbackSequenceId) {
              audio.pause();
              return;
            }
            activeTimer = setTimeout(finishOnce, meta.durationMs + 350);
          })
          .catch(fallbackOnce);
        return true;
      }

      activeTimer = setTimeout(finishOnce, meta.durationMs + 350);
      return true;
    } catch {
      playFallbackBioAcousticAnimalSound(meta.key, volume, handleSoundFinished);
      return true;
    }
  }

  playFallbackBioAcousticAnimalSound(meta.key, volume, handleSoundFinished);
  return true;
}

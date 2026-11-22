import {
  duckBackgroundMusic,
  getSoundEnabled,
  getSoundVolume,
  onAudioSettingsChange,
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
  | "chicken"
  | "goat"
  | "rooster"
  | "monkey";

export type AnimalCategory = "farm" | "wild" | "garden";

export interface AnimalSoundMeta {
  key: AnimalSoundKey;
  label: string;
  emoji: string;
  category: AnimalCategory;
  audioSrc: string;
  soundDescription: string;
  durationMs: number;
  fileSizeKb: number;
  loudnessLufs: number;
  source: string;
  license: string;
  attribution: string;
  verified: boolean;
}

export const ANIMAL_SOUND_CATALOG: Record<AnimalSoundKey, AnimalSoundMeta> = {
  dog: {
    key: "dog",
    label: "Dog",
    emoji: "🐶",
    category: "farm",
    audioSrc: "/sounds/animals/dog.mp3",
    soundDescription: "Clear close-up dog barking",
    durationMs: 2400,
    fileSizeKb: 38.4,
    loudnessLufs: -16.9,
    source: "BigSoundBank (#0612)",
    license: "CC0 1.0 Public Domain",
    attribution: "BigSoundBank (CC0)",
    verified: true,
  },
  cat: {
    key: "cat",
    label: "Cat",
    emoji: "🐱",
    category: "farm",
    audioSrc: "/sounds/animals/cat.mp3",
    soundDescription: "Warm cat meowing twice",
    durationMs: 2200,
    fileSizeKb: 35.6,
    loudnessLufs: -16.5,
    source: "BigSoundBank (#0098)",
    license: "CC0 1.0 Public Domain",
    attribution: "BigSoundBank (CC0)",
    verified: true,
  },
  cow: {
    key: "cow",
    label: "Cow",
    emoji: "🐮",
    category: "farm",
    audioSrc: "/sounds/animals/cow.mp3",
    soundDescription: "Warm farm cow mooing",
    durationMs: 1750,
    fileSizeKb: 28.2,
    loudnessLufs: -16.4,
    source: "BigSoundBank (#0546)",
    license: "CC0 1.0 Public Domain",
    attribution: "BigSoundBank (CC0)",
    verified: true,
  },
  duck: {
    key: "duck",
    label: "Duck",
    emoji: "🦆",
    category: "farm",
    audioSrc: "/sounds/animals/duck.mp3",
    soundDescription: "Playful pond duck quacking",
    durationMs: 2200,
    fileSizeKb: 35.6,
    loudnessLufs: -16.7,
    source: "BigSoundBank (#0276)",
    license: "CC0 1.0 Public Domain",
    attribution: "BigSoundBank (CC0)",
    verified: true,
  },
  lion: {
    key: "lion",
    label: "Lion",
    emoji: "🦁",
    category: "wild",
    audioSrc: "/sounds/animals/lion.mp3",
    soundDescription: "Deep realistic lion roaring",
    durationMs: 2600,
    fileSizeKb: 41.7,
    loudnessLufs: -16.4,
    source: "Wikimedia Commons (Lion Tamil Nadu)",
    license: "Public Domain",
    attribution: "Wikimedia Commons (Public Domain)",
    verified: true,
  },
  elephant: {
    key: "elephant",
    label: "Elephant",
    emoji: "🐘",
    category: "wild",
    audioSrc: "/sounds/animals/elephant.mp3",
    soundDescription: "Authentic elephant trumpeting",
    durationMs: 1440,
    fileSizeKb: 23.3,
    loudnessLufs: -16.4,
    source: "Wikimedia Commons (Elephant trumpet)",
    license: "CC0 1.0 Public Domain",
    attribution: "Wikimedia Commons (CC0)",
    verified: true,
  },
  bird: {
    key: "bird",
    label: "Bird",
    emoji: "🐦",
    category: "garden",
    audioSrc: "/sounds/animals/bird.mp3",
    soundDescription: "Cheerful songbird chirping",
    durationMs: 2200,
    fileSizeKb: 35.6,
    loudnessLufs: -16.5,
    source: "BigSoundBank (#0692)",
    license: "CC0 1.0 Public Domain",
    attribution: "BigSoundBank (CC0)",
    verified: true,
  },
  sheep: {
    key: "sheep",
    label: "Sheep",
    emoji: "🐑",
    category: "farm",
    audioSrc: "/sounds/animals/sheep.mp3",
    soundDescription: "Warm woolly sheep baaing",
    durationMs: 2100,
    fileSizeKb: 33.9,
    loudnessLufs: -16.4,
    source: "Wikimedia Commons (Sheep field)",
    license: "Public Domain",
    attribution: "Wikimedia Commons (Public Domain)",
    verified: true,
  },
  horse: {
    key: "horse",
    label: "Horse",
    emoji: "🐴",
    category: "farm",
    audioSrc: "/sounds/animals/horse.mp3",
    soundDescription: "Bright horse neighing and whinnying",
    durationMs: 1550,
    fileSizeKb: 25.4,
    loudnessLufs: -16.4,
    source: "BigSoundBank (#0284)",
    license: "CC0 1.0 Public Domain",
    attribution: "BigSoundBank (CC0)",
    verified: true,
  },
  pig: {
    key: "pig",
    label: "Pig",
    emoji: "🐷",
    category: "farm",
    audioSrc: "/sounds/animals/pig.mp3",
    soundDescription: "Friendly pig oinking and grunting",
    durationMs: 1390,
    fileSizeKb: 22.9,
    loudnessLufs: -16.5,
    source: "Wikimedia Commons (Erdie + Mudchute)",
    license: "CC BY 3.0 / CC BY-SA 3.0",
    attribution: "erdie & Secretlondon / Wikimedia Commons",
    verified: true,
  },
  frog: {
    key: "frog",
    label: "Frog",
    emoji: "🐸",
    category: "garden",
    audioSrc: "/sounds/animals/frog.mp3",
    soundDescription: "Classic pond frog croaking",
    durationMs: 2200,
    fileSizeKb: 35.6,
    loudnessLufs: -16.8,
    source: "BigSoundBank (#0998)",
    license: "CC0 1.0 Public Domain",
    attribution: "BigSoundBank (CC0)",
    verified: true,
  },
  owl: {
    key: "owl",
    label: "Owl",
    emoji: "🦉",
    category: "garden",
    audioSrc: "/sounds/animals/owl.mp3",
    soundDescription: "Gentle tawny owl hooting",
    durationMs: 1300,
    fileSizeKb: 21.3,
    loudnessLufs: -16.4,
    source: "BigSoundBank (#1763)",
    license: "CC0 1.0 Public Domain",
    attribution: "BigSoundBank (CC0)",
    verified: true,
  },
  bee: {
    key: "bee",
    label: "Bee",
    emoji: "🐝",
    category: "garden",
    audioSrc: "/sounds/animals/bee.mp3",
    soundDescription: "Close-up bumblebee buzzing",
    durationMs: 2000,
    fileSizeKb: 32.3,
    loudnessLufs: -16.4,
    source: "BigSoundBank (#1001)",
    license: "CC0 1.0 Public Domain",
    attribution: "BigSoundBank (CC0)",
    verified: true,
  },
  chick: {
    key: "chick",
    label: "Chick",
    emoji: "🐥",
    category: "farm",
    audioSrc: "/sounds/animals/chick.mp3",
    soundDescription: "Baby chick cheeping and peeping",
    durationMs: 2000,
    fileSizeKb: 32.3,
    loudnessLufs: -16.4,
    source: "BigSoundBank (#0672)",
    license: "CC0 1.0 Public Domain",
    attribution: "BigSoundBank (CC0)",
    verified: true,
  },
  chicken: {
    key: "chicken",
    label: "Chicken",
    emoji: "🐔",
    category: "farm",
    audioSrc: "/sounds/animals/chicken.mp3",
    soundDescription: "Happy farm hen clucking",
    durationMs: 2200,
    fileSizeKb: 35.6,
    loudnessLufs: -16.4,
    source: "Wikimedia Commons (Hen egg call)",
    license: "Public Domain",
    attribution: "alys / Wikimedia Commons (Public Domain)",
    verified: true,
  },
  goat: {
    key: "goat",
    label: "Goat",
    emoji: "🐐",
    category: "farm",
    audioSrc: "/sounds/animals/goat.mp3",
    soundDescription: "Expressive goat bleating twice",
    durationMs: 2100,
    fileSizeKb: 33.9,
    loudnessLufs: -18.6,
    source: "BigSoundBank (#0880)",
    license: "CC0 1.0 Public Domain",
    attribution: "BigSoundBank (CC0)",
    verified: true,
  },
  rooster: {
    key: "rooster",
    label: "Rooster",
    emoji: "🐓",
    category: "farm",
    audioSrc: "/sounds/animals/rooster.mp3",
    soundDescription: "Bright morning rooster crowing",
    durationMs: 2500,
    fileSizeKb: 40.1,
    loudnessLufs: -16.4,
    source: "BigSoundBank (#0104)",
    license: "CC0 1.0 Public Domain",
    attribution: "BigSoundBank (CC0)",
    verified: true,
  },
  monkey: {
    key: "monkey",
    label: "Monkey",
    emoji: "🐵",
    category: "wild",
    audioSrc: "/sounds/animals/monkey.mp3",
    soundDescription: "Playful monkey pant-hoot calls",
    durationMs: 2400,
    fileSizeKb: 38.4,
    loudnessLufs: -16.4,
    source: "Wikimedia Commons (Pant-hoot call)",
    license: "CC BY 4.0",
    attribution: "Pawel Fedurek et al. / Wikimedia Commons",
    verified: true,
  },
};

export const ANIMAL_SOUND_LIST: AnimalSoundMeta[] = Object.values(
  ANIMAL_SOUND_CATALOG
);

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
  cheep: "chick",
  "cheep cheep": "chick",
  peep: "chick",
  chicken: "chicken",
  hen: "chicken",
  cluck: "chicken",
  "cluck cluck": "chicken",
  goat: "goat",
  maa: "goat",
  "maa maa": "goat",
  rooster: "rooster",
  "cock-a-doodle-doo": "rooster",
  "cock a doodle doo": "rooster",
  monkey: "monkey",
  chimp: "monkey",
  chimpanzee: "monkey",
  "ooh ooh": "monkey",
  "ooh ooh aah aah": "monkey",
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
  const orderedAliases = Object.entries(ANIMAL_LOOKUP_ALIASES).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [alias, key] of orderedAliases) {
    if (
      alias.length >= 3 &&
      new RegExp(
        `\\b${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`,
        "i"
      ).test(cleaned)
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

const preloadedAudioMap = new Map<AnimalSoundKey, HTMLAudioElement>();
let activeAudioElement: HTMLAudioElement | null = null;
let activeTimer: ReturnType<typeof setTimeout> | null = null;
let activeAudioUnsub: (() => void) | null = null;
let playbackSequenceId = 0;

function detachAudioListeners(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  audio.onended = null;
  audio.onerror = null;
  audio.onplaying = null;
}

export function stopAnimalSound(): void {
  playbackSequenceId += 1;
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  if (activeAudioUnsub) {
    activeAudioUnsub();
    activeAudioUnsub = null;
  }
  if (activeAudioElement) {
    try {
      detachAudioListeners(activeAudioElement);
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

export function preloadAnimalSounds(keys?: AnimalSoundKey[]): void {
  if (
    typeof window === "undefined" ||
    typeof window.Audio !== "function" ||
    process.env.NODE_ENV === "test"
  ) {
    return;
  }
  const targets = keys ?? ANIMAL_SOUND_LIST.map((item) => item.key);
  for (const key of targets) {
    const meta = ANIMAL_SOUND_CATALOG[key];
    if (!meta || preloadedAudioMap.has(key)) continue;
    try {
      const audio = new window.Audio(meta.audioSrc);
      audio.preload = "auto";
      audio.load?.();
      preloadedAudioMap.set(key, audio);
    } catch {
      // Ignore preload errors in restricted browsers
    }
  }
}

function getOrCreateAudioElement(meta: AnimalSoundMeta): HTMLAudioElement {
  const cached = preloadedAudioMap.get(meta.key);
  if (cached) {
    detachAudioListeners(cached);
    try {
      cached.pause();
      cached.currentTime = 0;
    } catch {
      // Ignore seek reset errors on unbuffered elements
    }
    return cached;
  }
  const fresh = new window.Audio(meta.audioSrc);
  fresh.preload = "auto";
  preloadedAudioMap.set(meta.key, fresh);
  return fresh;
}

export function playAnimalSound(
  animalKeyOrLabel: string,
  opts?: {
    pronounceNameAfter?: boolean;
    followUpText?: string;
    onLoading?: () => void;
    onStart?: () => void;
    onEnd?: () => void;
    onBlocked?: () => void;
    onError?: (message: string) => void;
  }
): boolean {
  const meta = getAnimalSoundMeta(animalKeyOrLabel);
  if (!meta) return false;

  // Prevent overlapping audio across rapid selections or active narration
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
  duckBackgroundMusic(meta.durationMs + 1600);

  const handleSoundFinished = () => {
    if (seqId !== playbackSequenceId) return;
    if (activeAudioUnsub) {
      activeAudioUnsub();
      activeAudioUnsub = null;
    }
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
      }, 140);
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
      const audio = getOrCreateAudioElement(meta);
      audio.volume = Math.min(1, Math.max(0.05, volume * 0.92));
      activeAudioElement = audio;

      activeAudioUnsub = onAudioSettingsChange(() => {
        if (seqId !== playbackSequenceId || activeAudioElement !== audio) return;
        const nextEnabled = getSoundEnabled();
        const nextVol = getSoundVolume();
        if (!nextEnabled || nextVol <= 0) {
          stopAnimalSound();
          opts?.onEnd?.();
          return;
        }
        audio.volume = Math.min(1, Math.max(0.05, nextVol * 0.92));
      });

      let started = false;
      let settled = false;

      const markStarted = () => {
        if (started || settled || seqId !== playbackSequenceId) return;
        started = true;
        opts?.onStart?.();
      };

      const finishOnce = () => {
        if (settled) return;
        settled = true;
        if (activeTimer) {
          clearTimeout(activeTimer);
          activeTimer = null;
        }
        detachAudioListeners(audio);
        handleSoundFinished();
      };

      const handlePlaybackFailure = (err?: unknown) => {
        if (settled || seqId !== playbackSequenceId) return;
        settled = true;
        if (activeTimer) {
          clearTimeout(activeTimer);
          activeTimer = null;
        }
        if (activeAudioUnsub) {
          activeAudioUnsub();
          activeAudioUnsub = null;
        }
        detachAudioListeners(audio);
        activeAudioElement = null;

        const errName =
          err && typeof err === "object" && "name" in err
            ? String((err as { name?: unknown }).name)
            : "";

        if (errName === "NotAllowedError" || errName === "AbortError") {
          opts?.onBlocked?.();
          opts?.onEnd?.();
          return;
        }

        console.warn(
          `[LittleSteps Audio] Failed to load/play ${meta.audioSrc}`,
          err
        );
        opts?.onError?.(
          "Could not load this animal sound. Please check your connection and tap Replay."
        );
        opts?.onEnd?.();
      };

      if (audio.readyState < 3) {
        opts?.onLoading?.();
      }

      audio.onplaying = markStarted;
      audio.onended = finishOnce;
      audio.onerror = () => handlePlaybackFailure(audio.error);

      const scheduleSafetyTimeout = () => {
        const knownDuration =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.round(audio.duration * 1000)
            : meta.durationMs;
        if (activeTimer) clearTimeout(activeTimer);
        activeTimer = setTimeout(
          finishOnce,
          Math.max(meta.durationMs, knownDuration) + 1500
        );
      };

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            if (seqId !== playbackSequenceId) {
              audio.pause();
              return;
            }
            markStarted();
            scheduleSafetyTimeout();
          })
          .catch((err) => handlePlaybackFailure(err));
        return true;
      }

      markStarted();
      scheduleSafetyTimeout();
      return true;
    } catch (err) {
      console.warn(
        `[LittleSteps Audio] Unexpected audio error for ${meta.audioSrc}`,
        err
      );
      opts?.onError?.(
        "Could not play this animal sound. Please tap Replay to try again."
      );
      opts?.onEnd?.();
      return false;
    }
  }

  // Deterministic timing path for headless Jest test runs (never uses TTS to fake sounds)
  opts?.onStart?.();
  activeTimer = setTimeout(handleSoundFinished, 220);
  return true;
}

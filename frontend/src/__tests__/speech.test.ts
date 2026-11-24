import fs from "fs";
import path from "path";
import {
  ANIMAL_SOUND_CATALOG,
  ANIMAL_SOUND_LIST,
  getAnimalSoundMeta,
  playAnimalSound,
  resolveAnimalKey,
  stopAnimalSound,
} from "@/lib/animalSounds";
import {
  NOTE_FREQUENCIES,
  PRESCHOOL_SONGS,
  createShuffledSongQueue,
} from "@/lib/preschoolMusic";
import {
  formatKindergartenSpeech,
  selectPreferredFemaleVoice,
  selectPreferredFilipinoVoice,
} from "@/lib/speech";
import {
  getCurrentBackgroundSong,
  getMusicEnabled,
  getSoundEnabled,
  getSoundVolume,
  isBackgroundMusicPlaying,
  setMusicEnabled,
  setSoundEnabled,
  setSoundVolume,
  skipToNextRandomSong,
  startBackgroundMusic,
  stopBackgroundMusic,
} from "@/lib/sound";

function makeVoice(
  name: string,
  lang = "en-US"
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    default: false,
    localService: true,
    voiceURI: name,
  } as SpeechSynthesisVoice;
}

describe("selectPreferredFemaleVoice & kindergarten speech formatting", () => {
  it("picks Zira over David and Mark on standard Windows systems", () => {
    const selected = selectPreferredFemaleVoice([
      makeVoice("Microsoft David - English (United States)"),
      makeVoice("Microsoft Mark - English (United States)"),
      makeVoice("Microsoft Zira - English (United States)"),
    ]);

    expect(selected?.name).toBe("Microsoft Zira - English (United States)");
  });

  it("prefers Edge natural female voices like Aria Online over standard Zira", () => {
    const selected = selectPreferredFemaleVoice([
      makeVoice("Microsoft David - English (United States)"),
      makeVoice("Microsoft Zira - English (United States)"),
      makeVoice("Microsoft Aria Online (Natural) - English (United States)"),
    ]);

    expect(selected?.name).toBe(
      "Microsoft Aria Online (Natural) - English (United States)"
    );
  });

  it("picks Google UK English Female in Chrome over male voices", () => {
    const selected = selectPreferredFemaleVoice([
      makeVoice("Microsoft David - English (United States)"),
      makeVoice("Google UK English Male", "en-GB"),
      makeVoice("Google UK English Female", "en-GB"),
    ]);

    expect(selected?.name).toBe("Google UK English Female");
  });

  it("picks Samantha over Alex on macOS", () => {
    const selected = selectPreferredFemaleVoice([
      makeVoice("Alex"),
      makeVoice("Samantha"),
    ]);

    expect(selected?.name).toBe("Samantha");
  });

  it("formats kindergarten phonetic slashes, number ranges, and strips emojis", () => {
    expect(
      formatKindergartenSpeech(
        "Big B makes the bouncy /b/ sound! Count 1–10 🍎⭐"
      )
    ).toBe("Big B makes the bouncy buh sound! Count 1 to 10");
  });

  it("prefers Filipino fil-PH/tl-PH voices when Filipino mode is active", () => {
    const selected = selectPreferredFilipinoVoice([
      makeVoice("Microsoft Zira - English (United States)", "en-US"),
      makeVoice("Microsoft Blessica Online (Natural) - Filipino", "fil-PH"),
    ]);

    expect(selected?.lang).toBe("fil-PH");
  });
});

describe("Animal sound effects catalog & playback", () => {
  beforeEach(() => {
    setSoundEnabled(true);
    setSoundVolume(0.85);
    stopAnimalSound();
  });

  it("maps all 18 required animals to real mastered .mp3 audio assets on disk with no legacy .wav files", () => {
    const requiredAnimals = [
      "dog",
      "cat",
      "cow",
      "duck",
      "lion",
      "elephant",
      "bird",
      "sheep",
      "horse",
      "pig",
      "frog",
      "owl",
      "bee",
      "chick",
      "chicken",
      "goat",
      "rooster",
      "monkey",
    ] as const;

    const audioDir = path.resolve(process.cwd(), "public/sounds/animals");
    const filesInDir = fs.readdirSync(audioDir);
    expect(filesInDir.filter((f) => f.endsWith(".wav"))).toEqual([]);
    expect(ANIMAL_SOUND_LIST).toHaveLength(18);

    for (const animal of requiredAnimals) {
      expect(resolveAnimalKey(animal)).toBe(animal);
      const meta = getAnimalSoundMeta(animal);
      expect(meta).not.toBeNull();
      expect(meta?.audioSrc).toBe(`/sounds/animals/${animal}.mp3`);
      expect(meta?.verified).toBe(true);
      expect(ANIMAL_SOUND_CATALOG[animal].label.length).toBeGreaterThan(1);

      const filePath = path.join(audioDir, `${animal}.mp3`);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.statSync(filePath).size).toBeGreaterThan(5000);
    }

    expect(resolveAnimalKey("Moo moo!")).toBe("cow");
    expect(resolveAnimalKey("Woof woof!")).toBe("dog");
    expect(resolveAnimalKey("Pawoo!")).toBe("elephant");
    expect(resolveAnimalKey("Cluck cluck!")).toBe("chicken");
    expect(resolveAnimalKey("Hen")).toBe("chicken");
    expect(resolveAnimalKey("Cheep cheep!")).toBe("chick");
    expect(resolveAnimalKey("Ooh ooh aah aah!")).toBe("monkey");
  });

  it("respects mute and volume settings and plays animal sound cleanly", () => {
    setSoundVolume(0.6);
    expect(getSoundVolume()).toBeCloseTo(0.6, 2);

    const played = playAnimalSound("cow", { pronounceNameAfter: true });
    expect(played).toBe(true);

    setSoundEnabled(false);
    expect(getSoundEnabled()).toBe(false);
    expect(playAnimalSound("dog")).toBe(false);
    setSoundEnabled(true);
  });
});

function installMockAudioContext() {
  class MockAudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    resume = jest.fn().mockResolvedValue(undefined);
    createGain = () => ({
      gain: {
        value: 0,
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
        setTargetAtTime: jest.fn(),
      },
      connect: jest.fn(),
    });
    createBiquadFilter = () => ({
      type: "lowpass",
      frequency: { value: 0 },
      Q: { value: 0 },
      connect: jest.fn(),
    });
    createOscillator = () => ({
      type: "sine",
      frequency: { setValueAtTime: jest.fn() },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    });
  }

  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    writable: true,
    value: MockAudioContext,
  });
}

describe("Preschool random background music playlist & controls", () => {
  beforeEach(() => {
    stopBackgroundMusic();
    window.localStorage.clear();
    setSoundEnabled(true);
    setSoundVolume(0.85);
    installMockAudioContext();
  });

  afterEach(() => {
    stopBackgroundMusic();
    window.localStorage.clear();
    setSoundEnabled(true);
  });

  it("includes Twinkle Twinkle Little Star, Filipino folk songs, and valid notes across all 13 preschool songs", () => {
    expect(PRESCHOOL_SONGS).toHaveLength(13);
    expect(PRESCHOOL_SONGS.some((s) => s.id === "twinkle-twinkle")).toBe(true);
    expect(PRESCHOOL_SONGS.some((s) => s.id === "bahay-kubo")).toBe(true);
    expect(PRESCHOOL_SONGS.some((s) => s.id === "leron-leron-sinta")).toBe(true);

    for (const song of PRESCHOOL_SONGS) {
      expect(song.title.length).toBeGreaterThan(3);
      expect(song.bpm).toBeGreaterThan(60);
      expect(song.notes.length).toBeGreaterThan(10);
      for (const item of song.notes) {
        expect(item.beats).toBeGreaterThan(0);
        if (item.note !== null) {
          expect(NOTE_FREQUENCIES[item.note]).toBeGreaterThan(0);
        }
        if (item.bass) {
          expect(NOTE_FREQUENCIES[item.bass]).toBeGreaterThan(0);
        }
      }
    }
  });

  it("shuffles songs randomly without repeating the excluded previous song first", () => {
    for (let i = 0; i < 20; i += 1) {
      const queue = createShuffledSongQueue("twinkle-twinkle");
      expect(queue).toHaveLength(PRESCHOOL_SONGS.length);
      expect(new Set(queue.map((s) => s.id)).size).toBe(PRESCHOOL_SONGS.length);
      expect(queue[0].id).not.toBe("twinkle-twinkle");
    }
  });

  it("defaults background music to enabled and persists opt-out", () => {
    expect(getMusicEnabled()).toBe(true);

    setMusicEnabled(false);
    expect(getMusicEnabled()).toBe(false);
    expect(window.localStorage.getItem("littlesteps_bgm")).toBe("false");

    setMusicEnabled(true);
    expect(getMusicEnabled()).toBe(true);
    expect(window.localStorage.getItem("littlesteps_bgm")).toBe("true");
  });

  it("switches to a non-repeating random song and stops cleanly when muted", () => {
    startBackgroundMusic();
    const first = getCurrentBackgroundSong();
    expect(first).not.toBeNull();
    expect(isBackgroundMusicPlaying()).toBe(true);

    const next = skipToNextRandomSong();
    expect(next).not.toBeNull();
    expect(next?.id).not.toBe(first?.id);
    expect(getCurrentBackgroundSong()?.id).toBe(next?.id);

    setSoundEnabled(false);
    expect(isBackgroundMusicPlaying()).toBe(false);
  });
});

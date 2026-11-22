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
  formatKindergartenSpeech,
  selectPreferredFemaleVoice,
} from "@/lib/speech";
import {
  getSoundEnabled,
  getSoundVolume,
  setSoundEnabled,
  setSoundVolume,
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

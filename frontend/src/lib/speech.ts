import {
  duckBackgroundMusic,
  getSoundEnabled,
  getSoundVolume,
  registerAudioStopCallback,
} from "@/lib/sound";

const NATURAL_FEMALE_VOICE_PATTERNS = [
  "ana",
  "aria",
  "jenny",
  "ava",
  "emma",
  "michelle",
  "sara",
  "maisie",
  "sonia",
  "libby",
  "natasha",
  "clara",
  "google uk english female",
  "google us english",
  "samantha",
  "siri",
  "allison",
];

const STANDARD_FEMALE_VOICE_PATTERNS = [
  "zira",
  "hazel",
  "susan",
  "catherine",
  "heera",
  "linda",
  "victoria",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "veena",
  "female",
  "woman",
];

const MALE_VOICE_EXCLUSIONS = [
  "david",
  "mark",
  "guy",
  "george",
  "daniel",
  "james",
  "richard",
  "sean",
  "ryan",
  "christopher",
  "eric",
  "roger",
  "steffan",
  "alex",
  "fred",
  "aaron",
  "arthur",
  "oliver",
  "thomas",
  "male",
];

const PHONETIC_SOUND_MAP: Record<string, string> = {
  a: "ah",
  b: "buh",
  c: "kuh",
  d: "duh",
  e: "eh",
  f: "fff",
  g: "guh",
  h: "huh",
  i: "ih",
  j: "juh",
  k: "kuh",
  l: "lll",
  m: "mmm",
  n: "nnn",
  o: "aw",
  p: "puh",
  q: "kwuh",
  r: "rrr",
  s: "sss",
  t: "tuh",
  u: "uh",
  v: "vvv",
  w: "wuh",
  x: "ks",
  y: "yuh",
  z: "zzz",
};

const FILIPINO_VOICE_PATTERNS = [
  "blessica",
  "angelo",
  "fil-ph",
  "tl-ph",
  "filipino",
  "tagalog",
];

let cachedFemaleVoice: SpeechSynthesisVoice | null = null;
let cachedFilipinoVoice: SpeechSynthesisVoice | null = null;
let activeSpeechLang: "en" | "fil" | "bilingual" = "en";
let voicesListenerRegistered = false;
let pendingSpeechTimer: ReturnType<typeof setTimeout> | null = null;
let pendingEndTimer: ReturnType<typeof setTimeout> | null = null;

export function setActiveSpeechLanguage(lang: "en" | "fil" | "bilingual"): void {
  activeSpeechLang = lang;
}

export function getActiveSpeechLanguage(): "en" | "fil" | "bilingual" {
  return activeSpeechLang;
}
let beforeSpeakHook: (() => void) | null = null;

export function setBeforeSpeakHook(hook: (() => void) | null): void {
  beforeSpeakHook = hook;
}

function isMaleVoiceName(lowerName: string): boolean {
  return MALE_VOICE_EXCLUSIONS.some((male) =>
    new RegExp(`\\b${male}\\b`, "i").test(lowerName)
  );
}

function voiceNaturalnessBonus(lowerName: string): number {
  let score = 0;
  if (lowerName.includes("natural") || lowerName.includes("neural")) score += 4;
  if (lowerName.includes("online")) score += 2;
  if (lowerName.includes("enhanced") || lowerName.includes("premium")) score += 3;
  return score;
}

export function selectPreferredFilipinoVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;
  const filVoices = voices.filter((v) => /^(fil|tl)\b/i.test(v.lang || ""));
  if (filVoices.length > 0) {
    const femaleFil = filVoices.find((v) => !isMaleVoiceName((v.name || "").toLowerCase()));
    return femaleFil || filVoices[0];
  }
  const byName = voices.find((v) =>
    FILIPINO_VOICE_PATTERNS.some((pat) => (v.name || "").toLowerCase().includes(pat))
  );
  return byName || null;
}

export function selectPreferredFemaleVoice(
  voices: SpeechSynthesisVoice[],
  lang: "en" | "fil" | "bilingual" = "en"
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  if (lang === "fil") {
    const fil = selectPreferredFilipinoVoice(voices);
    if (fil) return fil;
  }

  const englishVoices = voices.filter((v) => /^en\b/i.test(v.lang || ""));
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  for (const pattern of NATURAL_FEMALE_VOICE_PATTERNS) {
    const matches = pool.filter((v) => {
      const lower = (v.name || "").toLowerCase();
      return lower.includes(pattern) && !isMaleVoiceName(lower);
    });
    if (matches.length > 0) {
      matches.sort(
        (a, b) =>
          voiceNaturalnessBonus((b.name || "").toLowerCase()) -
          voiceNaturalnessBonus((a.name || "").toLowerCase())
      );
      return matches[0];
    }
  }

  for (const pattern of STANDARD_FEMALE_VOICE_PATTERNS) {
    const matches = pool.filter((v) => {
      const lower = (v.name || "").toLowerCase();
      return lower.includes(pattern) && !isMaleVoiceName(lower);
    });
    if (matches.length > 0) {
      matches.sort(
        (a, b) =>
          voiceNaturalnessBonus((b.name || "").toLowerCase()) -
          voiceNaturalnessBonus((a.name || "").toLowerCase())
      );
      return matches[0];
    }
  }

  const nonMale = pool.find((v) => !isMaleVoiceName((v.name || "").toLowerCase()));
  return nonMale || pool[0] || null;
}

export function formatKindergartenSpeech(rawText: string): string {
  if (!rawText) return "";
  return rawText
    // Replace phonetic notation like /b/ with warm spoken sound "buh"
    .replace(/\/([a-zA-Z])\//g, (_, letter: string) => {
      const lower = letter.toLowerCase();
      return PHONETIC_SOUND_MAP[lower] || letter;
    })
    // Convert number ranges like 1–10 or 1-10 into "1 to 10"
    .replace(/\b(\d+)\s*[–—-]\s*(\d+)\b/g, "$1 to $2")
    // Strip decorative emojis so speech synthesis never reads emoji names mid-sentence
    .replace(
      /[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

function ensureVoiceCache(
  lang: "en" | "fil" | "bilingual" = activeSpeechLang
): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;

  const synth = window.speechSynthesis;
  const refresh = () => {
    const voices = synth.getVoices();
    if (voices.length > 0) {
      cachedFemaleVoice = selectPreferredFemaleVoice(voices, "en");
      cachedFilipinoVoice = selectPreferredFemaleVoice(voices, "fil");
    }
  };

  if (!voicesListenerRegistered) {
    voicesListenerRegistered = true;
    try {
      if (typeof synth.addEventListener === "function") {
        synth.addEventListener("voiceschanged", refresh);
      } else {
        synth.onvoiceschanged = refresh;
      }
    } catch {
      // Ignore listener errors in restricted environments
    }
  }

  refresh();
  if (lang === "fil" && cachedFilipinoVoice) return cachedFilipinoVoice;
  return cachedFemaleVoice;
}

export function stopSpeaking(): void {
  if (pendingSpeechTimer) {
    clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = null;
  }
  if (pendingEndTimer) {
    clearTimeout(pendingEndTimer);
    pendingEndTimer = null;
  }
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore browser speech errors
  }
}

registerAudioStopCallback(stopSpeaking);

export function speak(
  text: string,
  opts?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    lang?: "en" | "fil" | "bilingual";
    onEnd?: () => void;
    keepAnimalSound?: boolean;
  }
): void {
  const effectiveLang = opts?.lang ?? activeSpeechLang;
  const cleanedText = formatKindergartenSpeech(text);
  if (!getSoundEnabled() || !isSpeechSupported() || !cleanedText) {
    opts?.onEnd?.();
    return;
  }
  const masterVolume = getSoundVolume();
  if (masterVolume <= 0) {
    opts?.onEnd?.();
    return;
  }

  try {
    if (!opts?.keepAnimalSound && beforeSpeakHook) {
      beforeSpeakHook();
    }
    stopSpeaking();
    duckBackgroundMusic(Math.min(5000, Math.max(1500, cleanedText.length * 65)));
    const synth = window.speechSynthesis;

    const dispatchUtterance = () => {
      const preferredVoice = ensureVoiceCache(effectiveLang);
      const utterance = new SpeechSynthesisUtterance(cleanedText);
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang || (effectiveLang === "fil" ? "fil-PH" : "en-US");
      } else {
        utterance.lang = effectiveLang === "fil" ? "fil-PH" : "en-US";
      }
      // Warm, gentle, nurturing kindergarten teacher cadence
      utterance.rate = opts?.rate ?? 0.89;
      utterance.pitch = opts?.pitch ?? 1.1;
      utterance.volume = Math.min(1, Math.max(0, opts?.volume ?? masterVolume));

      let finished = false;
      const handleFinish = () => {
        if (finished) return;
        finished = true;
        if (pendingEndTimer) {
          clearTimeout(pendingEndTimer);
          pendingEndTimer = null;
        }
        opts?.onEnd?.();
      };

      utterance.onend = handleFinish;
      utterance.onerror = handleFinish;
      if (opts?.onEnd) {
        const estimatedMs = Math.max(1200, Math.min(8000, cleanedText.length * 85));
        pendingEndTimer = setTimeout(handleFinish, estimatedMs);
      }

      synth.speak(utterance);
    };

    const existingVoices = synth.getVoices();
    if (existingVoices.length > 0) {
      dispatchUtterance();
      return;
    }

    ensureVoiceCache();
    let spoken = false;
    const onVoicesReady = () => {
      if (spoken) return;
      spoken = true;
      if (pendingSpeechTimer) {
        clearTimeout(pendingSpeechTimer);
        pendingSpeechTimer = null;
      }
      try {
        synth.removeEventListener?.("voiceschanged", onVoicesReady);
      } catch {
        // Ignore
      }
      dispatchUtterance();
    };

    synth.addEventListener?.("voiceschanged", onVoicesReady);
    pendingSpeechTimer = setTimeout(onVoicesReady, 150);
  } catch {
    opts?.onEnd?.();
  }
}

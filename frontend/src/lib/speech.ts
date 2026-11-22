const NATURAL_FEMALE_VOICE_PATTERNS = [
  "aria",
  "jenny",
  "ava",
  "emma",
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

let cachedFemaleVoice: SpeechSynthesisVoice | null = null;
let voicesListenerRegistered = false;
let pendingSpeechTimer: ReturnType<typeof setTimeout> | null = null;

function isMaleVoiceName(lowerName: string): boolean {
  return MALE_VOICE_EXCLUSIONS.some((male) =>
    new RegExp(`\\b${male}\\b`, "i").test(lowerName)
  );
}

export function selectPreferredFemaleVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const englishVoices = voices.filter((v) => /^en\b/i.test(v.lang || ""));
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  for (const pattern of NATURAL_FEMALE_VOICE_PATTERNS) {
    const match = pool.find((v) => {
      const lower = (v.name || "").toLowerCase();
      return lower.includes(pattern) && !isMaleVoiceName(lower);
    });
    if (match) return match;
  }

  for (const pattern of STANDARD_FEMALE_VOICE_PATTERNS) {
    const match = pool.find((v) => {
      const lower = (v.name || "").toLowerCase();
      return lower.includes(pattern) && !isMaleVoiceName(lower);
    });
    if (match) return match;
  }

  const nonMale = pool.find((v) => !isMaleVoiceName((v.name || "").toLowerCase()));
  return nonMale || pool[0] || null;
}

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

function ensureVoiceCache(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;

  const synth = window.speechSynthesis;
  const refresh = () => {
    const voices = synth.getVoices();
    if (voices.length > 0) {
      cachedFemaleVoice = selectPreferredFemaleVoice(voices);
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
  return cachedFemaleVoice;
}

export function stopSpeaking(): void {
  if (pendingSpeechTimer) {
    clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = null;
  }
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore browser speech errors
  }
}

export function speak(
  text: string,
  opts?: { rate?: number; pitch?: number }
): void {
  if (!isSpeechSupported() || !text.trim()) return;
  try {
    stopSpeaking();
    const synth = window.speechSynthesis;

    const dispatchUtterance = () => {
      const preferredVoice = ensureVoiceCache();
      const utterance = new SpeechSynthesisUtterance(text);
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang || "en-US";
      } else {
        utterance.lang = "en-US";
      }
      utterance.rate = opts?.rate ?? 0.92;
      utterance.pitch = opts?.pitch ?? 1.08;
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
    // No-op when speech synthesis is unavailable
  }
}

import { selectPreferredFemaleVoice } from "@/lib/speech";

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

describe("selectPreferredFemaleVoice", () => {
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
});

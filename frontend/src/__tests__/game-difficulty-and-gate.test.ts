import {
  adaptGameConfig,
  getDefaultDifficultyForChild,
  getMemoryPeekMs,
} from "@/lib/gameDifficulty";
import { generateGrownUpChallenge } from "@/lib/grownUpGate";
import {
  formatAgeGroupLabel,
  getAgeGroupForPreschoolAge,
  getPreschoolAgeOptions,
} from "@/lib/preschoolAges";
import type {
  ChoiceConfig,
  MemoryConfig,
  PuzzleConfig,
  SortConfig,
} from "@/types";

const SAMPLE_CHOICE_12: ChoiceConfig = {
  engine: "choice",
  skill: "Numbers",
  rounds: Array.from({ length: 12 }, (_, idx) => ({
    prompt: `Round ${idx + 1}`,
    choices: [
      { key: `a-${idx}`, text: "A" },
      { key: `b-${idx}`, text: "B" },
      { key: `c-${idx}`, text: "C" },
      { key: `d-${idx}`, text: "D" },
    ],
    answer: `a-${idx}`,
  })),
};

const SAMPLE_SORT_12: SortConfig = {
  engine: "sort",
  bins: [
    { key: "b1", label: "Bin 1" },
    { key: "b2", label: "Bin 2" },
    { key: "b3", label: "Bin 3" },
  ],
  items: [
    ...Array.from({ length: 4 }, (_, i) => ({ id: `b1-${i}`, label: `One ${i}`, bin: "b1" })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `b2-${i}`, label: `Two ${i}`, bin: "b2" })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `b3-${i}`, label: `Three ${i}`, bin: "b3" })),
  ],
};

const SAMPLE_MEMORY_6: MemoryConfig = {
  engine: "memory",
  pairs: [
    { key: "p1", emoji: "🍎", label: "Apple" },
    { key: "p2", emoji: "🍌", label: "Banana" },
    { key: "p3", emoji: "🫐", label: "Berry" },
    { key: "p4", emoji: "🍏", label: "Pear" },
    { key: "p5", emoji: "🍇", label: "Grape" },
    { key: "p6", emoji: "🍓", label: "Strawberry" },
  ],
};

const SAMPLE_PUZZLE_3: PuzzleConfig = {
  engine: "puzzle",
  grid: 2,
  pictures: [
    { emoji: "🦁", label: "Lion", bg: "#FFE58A" },
    { emoji: "🦋", label: "Butterfly", bg: "#DCF2FD" },
    { emoji: "🌈", label: "Rainbow", bg: "#FFE3DE" },
  ],
};

describe("Age-adaptive game modes & dynamic Grown-Up Gate", () => {
  it("maps learner ages and age groups to Normal, Medium, and Hard defaults", () => {
    const year = new Date().getFullYear();
    expect(getDefaultDifficultyForChild({ age_group: "4-5", birth_year: year - 4 })).toBe("normal");
    expect(getDefaultDifficultyForChild({ age_group: "4-5", birth_year: year - 5 })).toBe("medium");
    expect(getDefaultDifficultyForChild({ age_group: "5-6", birth_year: year - 6 })).toBe("hard");
    expect(getDefaultDifficultyForChild({ age_group: "4-6" })).toBe("medium");
    expect(getDefaultDifficultyForChild({ age_group: "Pre-School" })).toBe("medium");

    expect(formatAgeGroupLabel("4-6")).toBe("Pre-School");
    expect(formatAgeGroupLabel("Pre-School")).toBe("Pre-School");
    expect(formatAgeGroupLabel("4-5", year - 4, year)).toBe("Pre-School · Age 4");
    expect(getAgeGroupForPreschoolAge(3)).toBe("3-4");
    expect(getAgeGroupForPreschoolAge(4)).toBe("4-5");
    expect(getAgeGroupForPreschoolAge(5)).toBe("5-6");
    expect(getPreschoolAgeOptions(year).map((o) => [o.age, o.birthYear])).toEqual([
      [3, year - 3],
      [4, year - 4],
      [5, year - 5],
      [6, year - 6],
    ]);
  });

  it("scales 12-question Choice and Sort, Memory, and Puzzle configs across Normal, Medium, and Hard", () => {
    const cNormal = adaptGameConfig(SAMPLE_CHOICE_12, "normal") as ChoiceConfig;
    const cMed = adaptGameConfig(SAMPLE_CHOICE_12, "medium") as ChoiceConfig;
    const cHard = adaptGameConfig(SAMPLE_CHOICE_12, "hard") as ChoiceConfig;
    expect(cNormal.rounds).toHaveLength(12);
    expect(cNormal.rounds[0].choices).toHaveLength(2);
    expect(cMed.rounds).toHaveLength(12);
    expect(cMed.rounds[0].choices).toHaveLength(3);
    expect(cHard.rounds).toHaveLength(12);
    expect(cHard.rounds[0].choices).toHaveLength(4);

    const sNormal = adaptGameConfig(SAMPLE_SORT_12, "normal") as SortConfig;
    const sMed = adaptGameConfig(SAMPLE_SORT_12, "medium") as SortConfig;
    const sHard = adaptGameConfig(SAMPLE_SORT_12, "hard") as SortConfig;
    expect(sNormal.bins).toHaveLength(2);
    expect(sNormal.items).toHaveLength(6);
    expect(sMed.bins).toHaveLength(3);
    expect(sMed.items).toHaveLength(9);
    expect(sHard.bins).toHaveLength(3);
    expect(sHard.items).toHaveLength(12);

    const mNormal = adaptGameConfig(SAMPLE_MEMORY_6, "normal") as MemoryConfig;
    const mMed = adaptGameConfig(SAMPLE_MEMORY_6, "medium") as MemoryConfig;
    const mHard = adaptGameConfig(SAMPLE_MEMORY_6, "hard") as MemoryConfig;
    expect(mNormal.pairs).toHaveLength(3);
    expect(mMed.pairs).toHaveLength(4);
    expect(mHard.pairs).toHaveLength(6);
    expect(getMemoryPeekMs("normal")).toBeGreaterThan(getMemoryPeekMs("hard"));

    expect((adaptGameConfig(SAMPLE_PUZZLE_3, "normal") as PuzzleConfig).pictures).toHaveLength(1);
    expect((adaptGameConfig(SAMPLE_PUZZLE_3, "medium") as PuzzleConfig).pictures).toHaveLength(2);
    expect((adaptGameConfig(SAMPLE_PUZZLE_3, "hard") as PuzzleConfig).pictures).toHaveLength(3);
  });

  it("generates dynamic non-repeating grown-up arithmetic questions", () => {
    let prev = "";
    const expressions = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const challenge = generateGrownUpChallenge(prev);
      expect(challenge.expression).not.toBe(prev);
      expect(Number.isInteger(challenge.answer)).toBe(true);
      expect(challenge.answer).toBeGreaterThan(0);

      const m = challenge.prompt.match(/What is\s+(\d+)\s*([+\-×])\s*(\d+)\?/);
      expect(m).not.toBeNull();
      const a = Number(m![1]);
      const b = Number(m![3]);
      const expected = m![2] === "+" ? a + b : m![2] === "-" ? a - b : a * b;
      expect(challenge.answer).toBe(expected);

      expressions.add(challenge.expression);
      prev = challenge.expression;
    }
    expect(expressions.size).toBeGreaterThan(10);
  });
});

import type {
  ChoiceConfig,
  ChoiceOption,
  GameConfig,
  MemoryConfig,
  MemoryPair,
  PuzzleConfig,
  SortConfig,
  SortItem,
} from "@/types";

export type GameDifficulty = "normal" | "medium" | "hard";

export const GAME_DIFFICULTY_META: Record<
  GameDifficulty,
  {
    label: string;
    ageTag: string;
    description: string;
    pillClass: string;
    activeClass: string;
  }
> = {
  normal: {
    label: "Normal",
    ageTag: "Age 4",
    description: "Gentle pace with 2 choices & helpful hints",
    pillClass: "bg-[#DDF8EC] text-[#166041] border-[#9BE7C4]",
    activeClass: "bg-[#9BE7C4] text-[#124530] border-[#166041] ring-2 ring-[#166041]",
  },
  medium: {
    label: "Medium",
    ageTag: "Age 5",
    description: "3 choices · balanced weekly challenge",
    pillClass: "bg-[#DCF2FD] text-[#175B82] border-[#78C8F5]",
    activeClass: "bg-[#78C8F5] text-[#103E59] border-[#175B82] ring-2 ring-[#175B82]",
  },
  hard: {
    label: "Hard",
    ageTag: "Age 6",
    description: "4 choices & extra challenge without hints",
    pillClass: "bg-[#EDE7FE] text-[#4C328B] border-[#B8A5F5]",
    activeClass: "bg-[#B8A5F5] text-[#2B1959] border-[#4C328B] ring-2 ring-[#4C328B]",
  },
};

const BONUS_MEMORY_PAIRS: MemoryPair[] = [
  { key: "star-bonus", emoji: "⭐", label: "Shining Star" },
  { key: "crab-bonus", emoji: "🦀", label: "Sunny Crab" },
  { key: "sunflower-bonus", emoji: "🌻", label: "Sun Flower" },
  { key: "rainbow-bonus", emoji: "🌈", label: "Bright Rainbow" },
];

export function getDefaultDifficultyForChild(
  child?: { age_group?: string; birth_year?: number } | null
): GameDifficulty {
  if (!child) return "normal";

  if (typeof child.birth_year === "number" && child.birth_year > 0) {
    const age = new Date().getFullYear() - child.birth_year;
    if (age >= 6) return "hard";
    if (age === 5) return "medium";
    return "normal";
  }

  if (child.age_group === "5-6") return "hard";
  if (child.age_group === "4-6" || child.age_group === "Pre-School") return "medium";
  return "normal";
}

export function getMemoryPeekMs(difficulty: GameDifficulty): number {
  if (difficulty === "normal") return 1200;
  if (difficulty === "hard") return 650;
  return 900;
}

function adaptChoiceConfig(
  config: ChoiceConfig,
  difficulty: GameDifficulty
): ChoiceConfig {
  const activeRounds = config.rounds.slice(0, 12);

  if (difficulty === "normal") {
    const rounds = activeRounds.map((r) => {
      const firstDistractor = r.choices.find((c) => c.key !== r.answer);
      const keepKeys = new Set(
        firstDistractor ? [r.answer, firstDistractor.key] : [r.answer]
      );
      return {
        ...r,
        choices: r.choices.filter((c) => keepKeys.has(c.key)),
      };
    });
    return { ...config, rounds };
  }

  if (difficulty === "medium") {
    const rounds = activeRounds.map((r) => {
      const distractors = r.choices.filter((c) => c.key !== r.answer).slice(0, 2);
      const keepKeys = new Set([r.answer, ...distractors.map((d) => d.key)]);
      return {
        ...r,
        choices: r.choices.filter((c) => keepKeys.has(c.key)),
      };
    });
    return { ...config, rounds };
  }

  // Hard: all 12 rounds with up to 4 distinct choices per round
  const pool: ChoiceOption[] = [];
  for (const r of activeRounds) {
    for (const c of r.choices) {
      if (!pool.some((p) => p.key === c.key)) {
        pool.push(c);
      }
    }
  }

  const rounds = activeRounds.map((r) => {
    const choices = [...r.choices];
    if (choices.length < 4) {
      const usedKeys = new Set(choices.map((c) => c.key));
      for (const candidate of pool) {
        if (choices.length >= 4) break;
        if (!usedKeys.has(candidate.key)) {
          usedKeys.add(candidate.key);
          choices.push(candidate);
        }
      }
    }
    return { ...r, choices: choices.slice(0, 4) };
  });

  return { ...config, rounds };
}

function adaptSortConfig(
  config: SortConfig,
  difficulty: GameDifficulty
): SortConfig {
  const bins =
    difficulty === "normal"
      ? config.bins.slice(0, Math.min(2, config.bins.length))
      : [...config.bins];

  const allowedBins = new Set(bins.map((b) => b.key));
  const perBinLimit = difficulty === "hard" ? 4 : 3;
  const counts: Record<string, number> = {};
  const items: SortItem[] = [];

  for (const item of config.items) {
    if (!allowedBins.has(item.bin)) continue;
    const count = counts[item.bin] ?? 0;
    if (count < perBinLimit) {
      counts[item.bin] = count + 1;
      items.push(item);
    }
  }

  if (difficulty === "hard" && items.length < 9) {
    const bonus = items
      .slice(0, Math.min(3, 9 - items.length))
      .map((item) => ({ ...item, id: `${item.id}-bonus` }));
    items.push(...bonus);
  }

  return { ...config, bins, items };
}

function adaptMemoryConfig(
  config: MemoryConfig,
  difficulty: GameDifficulty
): MemoryConfig {
  if (difficulty === "normal") {
    return {
      ...config,
      pairs: config.pairs.slice(0, Math.min(3, config.pairs.length)),
    };
  }

  if (difficulty === "medium") {
    return {
      ...config,
      pairs: config.pairs.slice(0, Math.min(4, config.pairs.length)),
    };
  }

  const pairs = config.pairs.slice(0, 6);
  const existingKeys = new Set(pairs.map((p) => p.key));
  const existingEmojis = new Set(pairs.map((p) => p.emoji));
  for (const bonus of BONUS_MEMORY_PAIRS) {
    if (pairs.length >= 6) break;
    if (!existingKeys.has(bonus.key) && !existingEmojis.has(bonus.emoji)) {
      existingKeys.add(bonus.key);
      existingEmojis.add(bonus.emoji);
      pairs.push(bonus);
    }
  }
  return { ...config, pairs };
}

function adaptPuzzleConfig(
  config: PuzzleConfig,
  difficulty: GameDifficulty
): PuzzleConfig {
  if (difficulty === "normal") {
    return {
      ...config,
      pictures: config.pictures.slice(0, Math.min(1, config.pictures.length)),
    };
  }
  if (difficulty === "medium") {
    return {
      ...config,
      pictures: config.pictures.slice(0, Math.min(2, config.pictures.length)),
    };
  }
  return {
    ...config,
    pictures: config.pictures.slice(0, 3),
  };
}

export function adaptGameConfig(
  config: GameConfig,
  difficulty: GameDifficulty
): GameConfig {
  switch (config.engine) {
    case "choice":
      return adaptChoiceConfig(config, difficulty);
    case "sort":
      return adaptSortConfig(config, difficulty);
    case "memory":
      return adaptMemoryConfig(config, difficulty);
    case "puzzle":
      return adaptPuzzleConfig(config, difficulty);
    default:
      return config;
  }
}

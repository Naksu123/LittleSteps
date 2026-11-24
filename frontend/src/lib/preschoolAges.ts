export const PRESCHOOL_AGES = [3, 4, 5, 6] as const;
export type PreschoolAge = (typeof PRESCHOOL_AGES)[number];

export const AGE_GROUP_VALUES = [
  "Pre-School",
  "3-4",
  "4-5",
  "5-6",
  "4-6",
] as const;

export type AgeGroupValue = (typeof AGE_GROUP_VALUES)[number];

export interface PreschoolAgeOption {
  age: PreschoolAge;
  birthYear: number;
  ageGroup: "3-4" | "4-5" | "5-6";
  label: string;
  stageLabel: string;
  modeHint: string;
}

export function getPreschoolBirthYearBounds(
  referenceYear = new Date().getFullYear()
): { minYear: number; maxYear: number } {
  return {
    minYear: referenceYear - 8,
    maxYear: referenceYear - 2,
  };
}

export function clampPreschoolAge(rawAge: number): PreschoolAge {
  if (rawAge <= 3) return 3;
  if (rawAge === 4) return 4;
  if (rawAge === 5) return 5;
  return 6;
}

export function getAgeGroupForPreschoolAge(
  age: number
): "3-4" | "4-5" | "5-6" {
  if (age <= 3) return "3-4";
  if (age === 4) return "4-5";
  return "5-6";
}

export function getPreschoolAgeOptions(
  referenceYear = new Date().getFullYear()
): PreschoolAgeOption[] {
  return [
    {
      age: 3,
      birthYear: referenceYear - 3,
      ageGroup: "3-4",
      label: "3 years old",
      stageLabel: "Nursery Pre-School",
      modeHint: "Normal · Gentle pace",
    },
    {
      age: 4,
      birthYear: referenceYear - 4,
      ageGroup: "4-5",
      label: "4 years old",
      stageLabel: "Junior Pre-School",
      modeHint: "Normal · Gentle pace",
    },
    {
      age: 5,
      birthYear: referenceYear - 5,
      ageGroup: "5-6",
      label: "5 years old",
      stageLabel: "Senior Pre-School",
      modeHint: "Medium · Balanced pace",
    },
    {
      age: 6,
      birthYear: referenceYear - 6,
      ageGroup: "5-6",
      label: "6 years old",
      stageLabel: "Pre-School Prep",
      modeHint: "Hard · Extra challenge",
    },
  ];
}

export function inferPreschoolAgeFromChild(
  child?: { birth_year?: number | null; age_group?: string | null } | null,
  referenceYear = new Date().getFullYear()
): PreschoolAge {
  if (typeof child?.birth_year === "number" && child.birth_year > 0) {
    return clampPreschoolAge(referenceYear - child.birth_year);
  }
  const group = (child?.age_group || "").trim();
  if (group === "3" || group === "3-4") return 3;
  if (group === "5") return 5;
  if (group === "6" || group === "5-6") return 6;
  return 4;
}

export function formatAgeGroupLabel(
  ageGroup?: string | null,
  birthYear?: number | null,
  referenceYear = new Date().getFullYear()
): string {
  if (typeof birthYear === "number" && birthYear > 0) {
    const computedAge = referenceYear - birthYear;
    if (computedAge >= 2 && computedAge <= 8) {
      return `Pre-School · Age ${clampPreschoolAge(computedAge)}`;
    }
  }

  const normalized = (ageGroup || "").trim();
  const lower = normalized.toLowerCase();
  if (!normalized || lower === "4-6" || lower === "pre-school" || lower === "preschool") {
    return "Pre-School";
  }
  if (normalized === "3-4") return "Pre-School (Ages 3–4)";
  if (normalized === "4-5") return "Pre-School (Ages 4–5)";
  if (normalized === "5-6") return "Pre-School (Ages 5–6)";
  if (/^[3-6]$/.test(normalized)) return `Pre-School · Age ${normalized}`;
  return `Pre-School (${normalized})`;
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const AVATAR_META: Record<
  string,
  { label: string; emoji: string; bg: string }
> = {
  bunny: { label: "Bunny", emoji: "🐰", bg: "#FFE3DE" },
  dino: { label: "Dino", emoji: "🦕", bg: "#DCF2FD" },
  fox: { label: "Fox", emoji: "🦊", bg: "#EDE7FE" },
  bear: { label: "Bear", emoji: "🐻", bg: "#FFF5CF" },
  owl: { label: "Owl", emoji: "🦉", bg: "#DDF8EC" },
  star: { label: "Star", emoji: "🌟", bg: "#FFF5CF" },
};

export const ENCOURAGING_PHRASES = [
  "Great job!",
  "You did it!",
  "Let's try another one!",
  "You're learning something new!",
  "Wonderful effort!",
];

export function formatShortDate(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getDefaultPortalPath(roles: string[]): string {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("teacher")) return "/teacher";
  return "/parent";
}

const COMPACT_SUBJECT_LABELS: Record<string, string> = {
  "alphabet & language": "Alphabet",
  "mathematics": "Math",
  "science & discovery": "Science",
  "social & emotional": "Social",
  "arts & creativity": "Arts",
  "life skills": "Life",
  "music & rhythm": "Music",
};

/** Shortens long subject names for narrow chart axes while preserving meaning. */
export function formatCompactSubjectLabel(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (COMPACT_SUBJECT_LABELS[normalized]) {
    return COMPACT_SUBJECT_LABELS[normalized];
  }
  const trimmed = name.trim();
  if (trimmed.length <= 11) return trimmed;
  return `${trimmed.slice(0, 10)}…`;
}

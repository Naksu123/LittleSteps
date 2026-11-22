export const ENCOURAGE_TRY = [
  "Let's try another one!",
  "Almost! Try again!",
  "Wonderful effort!",
] as const;

export const ENCOURAGE_SUCCESS = [
  "Great job!",
  "You did it!",
  "You're learning something new!",
] as const;

export function starsForScore(scorePct: number): number {
  if (scorePct >= 80) return 3;
  if (scorePct >= 50) return 2;
  return 1;
}

export function scoreFromFirstTries(
  firstTryCorrect: number,
  total: number
): number {
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((100 * firstTryCorrect) / total)));
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const STORAGE_PREFIX = "littlesteps_screen_secs";
const BONUS_PREFIX = "littlesteps_screen_bonus_secs";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getScreenSecondsUsed(childId: string): number {
  if (typeof window === "undefined" || !childId) return 0;
  try {
    const raw = window.localStorage.getItem(
      `${STORAGE_PREFIX}:${childId}:${todayKey()}`
    );
    const parsed = Number(raw || 0);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function addScreenSecondsUsed(childId: string, deltaSecs: number): number {
  if (typeof window === "undefined" || !childId || deltaSecs <= 0) {
    return getScreenSecondsUsed(childId);
  }
  const next = getScreenSecondsUsed(childId) + Math.round(deltaSecs);
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}:${childId}:${todayKey()}`,
      String(next)
    );
  } catch {
    // Ignore storage limits
  }
  return next;
}

export function getScreenBonusSeconds(childId: string): number {
  if (typeof window === "undefined" || !childId) return 0;
  try {
    const raw = window.localStorage.getItem(
      `${BONUS_PREFIX}:${childId}:${todayKey()}`
    );
    const parsed = Number(raw || 0);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function grantScreenTimeBonus(childId: string, minutes = 10): number {
  if (typeof window === "undefined" || !childId) return 0;
  const next = getScreenBonusSeconds(childId) + minutes * 60;
  try {
    window.localStorage.setItem(
      `${BONUS_PREFIX}:${childId}:${todayKey()}`,
      String(next)
    );
  } catch {
    // Ignore storage errors
  }
  return next;
}

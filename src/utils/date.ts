/**
 * Date helpers for MindCode.
 *
 * The Daily Challenge is the same puzzle for every user on the planet, so every
 * date key is computed in **UTC**. Using local dates would give players in
 * different timezones different puzzles on the same calendar day and make the
 * daily leaderboard incomparable.
 *
 * A "date key" is the canonical `YYYY-MM-DD` string used as the challenge id,
 * the leaderboard period id and the streak anchor.
 */

export type DateKey = string;

const MS_PER_DAY = 86_400_000;

export function toDateKey(epochMs: number = Date.now()): DateKey {
  const d = new Date(epochMs);
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${d.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateKeyToEpoch(key: DateKey): number {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Malformed date key: "${key}"`);
  return Date.UTC(y, m - 1, d);
}

/** Whole UTC days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((dateKeyToEpoch(to) - dateKeyToEpoch(from)) / MS_PER_DAY);
}

export function addDays(key: DateKey, days: number): DateKey {
  return toDateKey(dateKeyToEpoch(key) + days * MS_PER_DAY);
}

/** Milliseconds until the next Daily Challenge unlocks — drives the countdown. */
export function msUntilNextUtcDay(now: number = Date.now()): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return next - now;
}

/** `05:12:33` — used by the "next challenge in…" timer. */
export function formatCountdown(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => `${n}`.padStart(2, '0')).join(':');
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/** ISO week id (`2026-W31`) used for weekly leaderboard periods. */
export function toWeekKey(epochMs: number = Date.now()): string {
  const d = new Date(epochMs);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // ISO weeks start Monday; shift Sunday (0) to 7.
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(target.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((target.getTime() - yearStart) / MS_PER_DAY + 1) / 7);
  return `${target.getUTCFullYear()}-W${`${week}`.padStart(2, '0')}`;
}

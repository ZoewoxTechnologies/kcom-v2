/**
 * Africa/Lagos is UTC+1 all year (no daylight saving), so local midnight is
 * always 23:00 UTC the previous day.
 */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The next midnight in Africa/Lagos strictly after `now`. */
export function nextLagosMidnight(now: Date = new Date()): Date {
  const local = now.getTime() + LAGOS_OFFSET_MS;
  const nextLocalMidnight = (Math.floor(local / DAY_MS) + 1) * DAY_MS;
  return new Date(nextLocalMidnight - LAGOS_OFFSET_MS);
}

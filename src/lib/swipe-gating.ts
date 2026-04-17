export const FREE_SWIPE_LIMIT = 20;
export const AUTH_LIKES_PER_DAY = 10;

export function dayKeyUTC(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getSwipeCountKey(visitorId: string) {
  return `rs_swipe_count:${visitorId}`;
}

export function getLikesDayKey(visitorId: string, day = dayKeyUTC()) {
  return `rs_likes_day:${visitorId}:${day}`;
}

export function readLocalInt(key: string) {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(key);
  const n = Number(raw || "0");
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function writeLocalInt(key: string, value: number) {
  if (typeof window === "undefined") return;
  const v = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  window.localStorage.setItem(key, String(v));
}

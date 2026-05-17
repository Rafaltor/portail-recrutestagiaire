import crypto from "crypto";

declare global {
  var __rsRateLimitMaps: Map<string, Map<string, number[]>> | undefined;
}

function getMap(namespace: string): Map<string, number[]> {
  const root = (globalThis.__rsRateLimitMaps ??= new Map());
  if (!root.has(namespace)) root.set(namespace, new Map());
  return root.get(namespace)!;
}

export function rateLimitOrNull(
  namespace: string,
  key: string,
  limit: number,
  windowMs: number,
): { retryAfterSec: number } | null {
  const now = Date.now();
  const map = getMap(namespace);
  const prev = map.get(key) ?? [];
  const next = prev.filter((t) => now - t < windowMs);
  next.push(now);
  map.set(key, next);
  return next.length > limit
    ? { retryAfterSec: Math.ceil(windowMs / 1000) }
    : null;
}

export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export function hashIp(ip: string, salt: string | undefined): string {
  if (!salt) {
    console.warn("[rate-limit] salt non défini — rate-limiting affaibli");
  }
  return crypto
    .createHash("sha256")
    .update(`${ip}|${salt ?? crypto.randomUUID()}`)
    .digest("hex")
    .slice(0, 48);
}

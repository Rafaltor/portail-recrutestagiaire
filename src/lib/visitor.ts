export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "server";

  const key = "rs_visitor_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `v_${Math.random().toString(16).slice(2)}_${Date.now()}`;

  window.localStorage.setItem(key, id);
  return id;
}


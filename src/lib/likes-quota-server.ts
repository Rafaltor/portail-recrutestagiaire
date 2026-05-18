import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_LIKES_PER_DAY, dayKeyUTC } from "@/lib/swipe-gating";

export async function countLikesTodayForVisitors(
  supabase: SupabaseClient,
  visitorIds: string[],
): Promise<number> {
  const ids = [...new Set(visitorIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (ids.length === 0) return 0;

  const start = `${dayKeyUTC()}T00:00:00.000Z`;
  const end = `${dayKeyUTC()}T23:59:59.999Z`;
  const res = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .in("visitor_id", ids)
    .eq("value", 1)
    .gte("created_at", start)
    .lte("created_at", end);

  if (res.error) throw new Error(res.error.message);
  return Number(res.count ?? 0);
}

export function likesQuotaFromCount(likesToday: number) {
  const used = Math.max(0, Math.floor(likesToday));
  return {
    likesToday: used,
    likesLeft: Math.max(0, AUTH_LIKES_PER_DAY - used),
    limit: AUTH_LIKES_PER_DAY,
  };
}

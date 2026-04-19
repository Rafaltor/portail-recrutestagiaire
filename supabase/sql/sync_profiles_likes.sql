-- À exécuter dans Supabase → SQL Editor (une fois + optionnel trigger)
-- Colonne attendue : profiles.likes (bigint ou integer), table votes avec value IN (-1, 1).

-- Diagnostic : écarts entre somme des votes et colonne likes (avant rattrapage)
-- SELECT p.id, p.handle, p.likes AS likes_col,
--        COALESCE(s.total, 0) AS sum_votes
-- FROM public.profiles p
-- LEFT JOIN (
--   SELECT profile_id, SUM(value)::bigint AS total
--   FROM public.votes
--   GROUP BY profile_id
-- ) s ON s.profile_id = p.id
-- WHERE COALESCE(p.likes, -999999) <> COALESCE(s.total, 0)
--    OR (p.likes IS NULL AND s.total IS NOT NULL);

-- Votes orphelins (profile_id absent de profiles) — à traiter à la main si besoin
-- SELECT v.profile_id, COUNT(*) FROM public.votes v
-- LEFT JOIN public.profiles p ON p.id = v.profile_id
-- WHERE p.id IS NULL
-- GROUP BY v.profile_id;

-- Index utile pour le tri rapide « publiés par score » (optionnel)
-- CREATE INDEX IF NOT EXISTS idx_profiles_status_likes ON public.profiles (status, likes DESC);

-- 1) Rattrapage : aligner likes sur la somme réelle des votes
UPDATE public.profiles p
SET likes = COALESCE(s.total, 0)
FROM (
  SELECT profile_id, SUM(value)::bigint AS total
  FROM public.votes
  GROUP BY profile_id
) s
WHERE p.id = s.profile_id;

UPDATE public.profiles
SET likes = 0
WHERE id NOT IN (SELECT profile_id FROM public.votes);

-- 2) Optionnel : garder likes à jour même si les votes changent hors API Next
CREATE OR REPLACE FUNCTION public.sync_profile_likes_from_votes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.profile_id, OLD.profile_id);
  UPDATE public.profiles
  SET likes = COALESCE(
    (SELECT SUM(v.value)::bigint FROM public.votes v WHERE v.profile_id = pid),
    0
  )
  WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_votes_sync_profile_likes ON public.votes;

CREATE TRIGGER trg_votes_sync_profile_likes
  AFTER INSERT OR UPDATE OR DELETE ON public.votes
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_profile_likes_from_votes();

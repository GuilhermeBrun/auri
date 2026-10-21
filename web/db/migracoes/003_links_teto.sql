CREATE OR REPLACE FUNCTION links_limites() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM links WHERE expira_em < now();
  IF (
    SELECT count(*) FROM (
      SELECT 1 FROM links WHERE criado_em > now() - interval '1 day' LIMIT 3000
    ) AS hoje
  ) >= 3000 THEN
    RAISE EXCEPTION 'links: limite de 3000 links por dia' USING ERRCODE = '53400';
  END IF;
  IF (
    SELECT coalesce(sum(length(dados)), 0) FROM links WHERE criado_em > now() - interval '1 day'
  ) >= 3000000 THEN
    RAISE EXCEPTION 'links: limite de 3 MB por dia' USING ERRCODE = '53400';
  END IF;
  RETURN NULL;
END
$$;
REVOKE ALL ON FUNCTION links_limites() FROM PUBLIC;

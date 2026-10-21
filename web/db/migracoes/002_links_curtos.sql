CREATE TABLE IF NOT EXISTS links (
  id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{43}$'),
  dados text NOT NULL CHECK (length(dados) <= 6000 AND dados ~ '^[A-Za-z0-9_.-]+$'),
  expira_em timestamptz NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (expira_em <= criado_em + interval '61 days')
);
CREATE INDEX IF NOT EXISTS links_expira_em ON links (expira_em);
CREATE INDEX IF NOT EXISTS links_criado_em ON links (criado_em);

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
  RETURN NULL;
END
$$;
REVOKE ALL ON FUNCTION links_limites() FROM PUBLIC;
CREATE OR REPLACE TRIGGER links_limites
  BEFORE INSERT ON links
  FOR EACH STATEMENT EXECUTE FUNCTION links_limites();

DO $$
BEGIN
  CREATE ROLE links_uso NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;
REVOKE ALL ON links FROM PUBLIC;
GRANT SELECT, INSERT ON links TO links_uso;
GRANT links_uso TO erros_gravacao;

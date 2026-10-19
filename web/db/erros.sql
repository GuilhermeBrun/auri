CREATE TABLE IF NOT EXISTS error_reports (
  id uuid PRIMARY KEY,
  install_id uuid NOT NULL,
  happened_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  origin text NOT NULL,
  name text NOT NULL,
  message text,
  stack text,
  count integer NOT NULL,
  version text NOT NULL,
  channel text NOT NULL,
  platform text NOT NULL,
  arch text NOT NULL,
  os_version text NOT NULL,
  electron text NOT NULL
);
CREATE INDEX IF NOT EXISTS error_reports_happened_at ON error_reports (happened_at DESC);

DO $$
BEGIN
  CREATE ROLE erros_gravacao NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;
REVOKE ALL ON error_reports FROM PUBLIC;
GRANT INSERT ON error_reports TO erros_gravacao;

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
CREATE INDEX IF NOT EXISTS error_reports_received_at ON error_reports (received_at);

CREATE OR REPLACE FUNCTION error_reports_limits() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM error_reports WHERE received_at < now() - interval '90 days';
  IF (
    SELECT count(*) FROM (
      SELECT 1 FROM error_reports WHERE received_at > now() - interval '1 day' LIMIT 1000
    ) AS today
  ) >= 1000 THEN
    RAISE EXCEPTION 'error_reports: limite de 1000 falhas por dia' USING ERRCODE = '53400';
  END IF;
  RETURN NULL;
END
$$;
REVOKE ALL ON FUNCTION error_reports_limits() FROM PUBLIC;
CREATE OR REPLACE TRIGGER error_reports_limits
  BEFORE INSERT ON error_reports
  FOR EACH STATEMENT EXECUTE FUNCTION error_reports_limits();

DO $$
BEGIN
  CREATE ROLE erros_gravacao NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;
REVOKE ALL ON error_reports FROM PUBLIC;
GRANT INSERT ON error_reports TO erros_gravacao;

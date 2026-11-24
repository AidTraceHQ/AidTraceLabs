DO $$
BEGIN
  IF current_user <> 'aidtrace_migration' THEN
    RAISE EXCEPTION 'Run this migration as aidtrace_migration.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aidtrace_runtime') THEN
    RAISE EXCEPTION 'Required PostgreSQL role aidtrace_runtime does not exist.';
  END IF;
END
$$;

ALTER TABLE audit_events OWNER TO aidtrace_migration;

REVOKE ALL PRIVILEGES ON TABLE audit_events FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE audit_events FROM aidtrace_runtime;
GRANT SELECT, INSERT ON TABLE audit_events TO aidtrace_runtime;

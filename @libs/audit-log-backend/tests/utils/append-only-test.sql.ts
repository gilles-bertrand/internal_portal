// DDL de protection append-only pour les tests (réplique de la prod)
export const APPEND_ONLY_DDL_TEST = `
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % interdit sur %', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_event_no_mutation') THEN
    CREATE TRIGGER audit_event_no_mutation
      BEFORE UPDATE OR DELETE ON "audit_event"
      FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_event_no_truncate') THEN
    CREATE TRIGGER audit_event_no_truncate
      BEFORE TRUNCATE ON "audit_event"
      FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
  END IF;
END $$;
`;

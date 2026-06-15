export const APPEND_ONLY_DDL = `
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % interdit sur %', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- access_record : bloque UPDATE/DELETE (par ligne) et TRUNCATE (par commande)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'access_record_no_mutation'
  ) THEN
    CREATE TRIGGER access_record_no_mutation
      BEFORE UPDATE OR DELETE ON "access_record"
      FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'access_record_no_truncate'
  ) THEN
    CREATE TRIGGER access_record_no_truncate
      BEFORE TRUNCATE ON "access_record"
      FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
  END IF;
END $$;

-- audit_event : mêmes protections
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_event_no_mutation'
  ) THEN
    CREATE TRIGGER audit_event_no_mutation
      BEFORE UPDATE OR DELETE ON "audit_event"
      FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_event_no_truncate'
  ) THEN
    CREATE TRIGGER audit_event_no_truncate
      BEFORE TRUNCATE ON "audit_event"
      FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
  END IF;
END $$;
`;

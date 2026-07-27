export const APPEND_ONLY_DDL = `
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % interdit sur %', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- incident : append-only sur le CONTENU uniquement. Les UPDATE ne peuvent
-- toucher que les colonnes lifecycle (versioning + soft-delete) ; toute
-- modification d'une colonne de contenu lève une exception (tamper-evidence).
CREATE OR REPLACE FUNCTION forbid_incident_content_mutation() RETURNS trigger AS $$
DECLARE
  lifecycle text[] := ARRAY[
    'revision', 'superseded_by_id', 'updated_by', 'updated_at', 'deleted_at', 'deleted_by'
  ];
BEGIN
  IF (to_jsonb(OLD) - lifecycle) IS DISTINCT FROM (to_jsonb(NEW) - lifecycle) THEN
    RAISE EXCEPTION 'append-only: modification du contenu interdite sur %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- incident : UPDATE limité aux colonnes lifecycle, DELETE et TRUNCATE interdits
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'incident_no_mutation'
  ) THEN
    CREATE TRIGGER incident_no_mutation
      BEFORE UPDATE ON "incident"
      FOR EACH ROW EXECUTE FUNCTION forbid_incident_content_mutation();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'incident_no_delete'
  ) THEN
    CREATE TRIGGER incident_no_delete
      BEFORE DELETE ON "incident"
      FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'incident_no_truncate'
  ) THEN
    CREATE TRIGGER incident_no_truncate
      BEFORE TRUNCATE ON "incident"
      FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
  END IF;
END $$;

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

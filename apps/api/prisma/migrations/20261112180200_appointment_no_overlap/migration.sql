-- Interdit deux rendez-vous actifs qui se chevauchent sur le même agenda (SPEC-12).
-- Les RDV annulés ne comptent pas. Un RDV marqué allowOverlap (surbooking forcé par le cabinet,
-- ou plage à capacité > 1 gérée par le service + verrou Redis) sort de la contrainte.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
  ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    "agendaId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE (
    status NOT IN ('CANCELLED_BY_PATIENT', 'CANCELLED_BY_PRACTICE')
    AND "allowOverlap" = false
  );

ALTER TABLE "Appointment"
  ADD CONSTRAINT appointment_valid_range CHECK ("endsAt" > "startsAt");

-- Recherche insensible aux accents et tolérante aux fautes (SPEC-01).
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX practitioner_lastname_trgm ON "Practitioner" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX locality_name_trgm ON "Locality" USING gin ("name" gin_trgm_ops);
CREATE INDEX speciality_name_trgm ON "Speciality" USING gin ("name" gin_trgm_ops);

-- Le journal d'audit et le journal d'accès au dossier sont en ajout seul.
CREATE OR REPLACE FUNCTION forbid_update_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();
CREATE TRIGGER record_access_log_append_only BEFORE UPDATE ON "RecordAccessLog"
  FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

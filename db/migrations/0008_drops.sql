CREATE TABLE drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL,
  name text NOT NULL,
  registered_opens_at timestamptz NOT NULL,
  public_opens_at timestamptz NOT NULL,
  pieces integer NOT NULL,
  status text NOT NULL DEFAULT 'PREPARACION',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drops_number_uq UNIQUE (number),
  CONSTRAINT drops_number_chk CHECK (number BETWEEN 1 AND 999),
  CONSTRAINT drops_name_chk CHECK (char_length(name) BETWEEN 1 AND 60),
  CONSTRAINT drops_pieces_chk CHECK (pieces BETWEEN 1 AND 9999),
  CONSTRAINT drops_status_chk CHECK (status IN ('PREPARACION', 'REGISTRO', 'CERRADO')),
  CONSTRAINT drops_opens_chk CHECK (public_opens_at >= registered_opens_at)
);
CREATE UNIQUE INDEX drops_single_registro_uq ON drops (status) WHERE status = 'REGISTRO';

INSERT INTO drops (number, name, registered_opens_at, public_opens_at, pieces, status)
VALUES (1, 'Archivo 001', '2026-12-04 19:00:00-06', '2026-12-05 19:00:00-06', 50, 'REGISTRO');

ALTER TABLE registrations ADD COLUMN drop_id uuid REFERENCES drops (id) ON DELETE RESTRICT;
UPDATE registrations SET drop_id = (SELECT id FROM drops WHERE number = 1);
ALTER TABLE registrations ALTER COLUMN drop_id SET NOT NULL;

ALTER TABLE registrations
  DROP CONSTRAINT registrations_number_uq,
  DROP CONSTRAINT registrations_instagram_uq,
  DROP CONSTRAINT registrations_whatsapp_hash_uq,
  ADD CONSTRAINT registrations_drop_number_uq UNIQUE (drop_id, registration_number),
  ADD CONSTRAINT registrations_drop_instagram_uq UNIQUE (drop_id, instagram_handle),
  ADD CONSTRAINT registrations_drop_whatsapp_hash_uq UNIQUE (drop_id, whatsapp_hash);

DROP INDEX registrations_messaging_contact_uq;
CREATE UNIQUE INDEX registrations_drop_contact_uq ON registrations (drop_id, messaging_contact_id) WHERE messaging_contact_id IS NOT NULL;
CREATE INDEX registrations_messaging_contact_idx ON registrations (messaging_contact_id) WHERE messaging_contact_id IS NOT NULL;
CREATE INDEX registrations_whatsapp_hash_idx ON registrations (whatsapp_hash);
CREATE INDEX registrations_instagram_handle_idx ON registrations (instagram_handle);

UPDATE message_templates SET body = replace(body, 'del archivo drmr', 'del {archivo}'), updated_at = now()
WHERE key = 'BIENVENIDA' AND position('del archivo drmr' in body) > 0;

-- The app role on Railway (drmr_app) is created out of band; default privileges may not include UPDATE.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'drmr_app') THEN
    GRANT SELECT, INSERT, UPDATE ON drops TO drmr_app;
  END IF;
END $$;

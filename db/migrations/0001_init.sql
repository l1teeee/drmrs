CREATE TABLE registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number integer NOT NULL,
  full_name text NOT NULL,
  instagram_handle text NOT NULL,
  whatsapp_ciphertext text NOT NULL,
  whatsapp_hash text NOT NULL,
  email_ciphertext text,
  size text NOT NULL,
  archive_nominee text,
  source text NOT NULL,
  origin text NOT NULL,
  piece_status text NOT NULL DEFAULT 'REGISTRADO',
  link_version integer NOT NULL DEFAULT 1,
  privacy_accepted_at timestamptz NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registrations_number_uq UNIQUE (registration_number),
  CONSTRAINT registrations_instagram_uq UNIQUE (instagram_handle),
  CONSTRAINT registrations_whatsapp_hash_uq UNIQUE (whatsapp_hash),
  CONSTRAINT registrations_number_chk CHECK (registration_number BETWEEN 1 AND 9999),
  CONSTRAINT registrations_full_name_chk CHECK (char_length(full_name) BETWEEN 2 AND 80),
  CONSTRAINT registrations_instagram_chk CHECK (instagram_handle ~ '^[a-z0-9._]{1,30}$'),
  CONSTRAINT registrations_whatsapp_hash_chk CHECK (whatsapp_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT registrations_size_chk CHECK (size IN ('S', 'M', 'L', 'XL', 'NO_SE')),
  CONSTRAINT registrations_nominee_chk CHECK (archive_nominee IS NULL OR char_length(archive_nominee) BETWEEN 1 AND 80),
  CONSTRAINT registrations_source_chk CHECK (char_length(source) BETWEEN 1 AND 40),
  CONSTRAINT registrations_origin_chk CHECK (origin IN ('WEB', 'IMPORT')),
  CONSTRAINT registrations_piece_status_chk CHECK (piece_status IN ('REGISTRADO', 'APARTADO', 'EN_PERSONALIZACION', 'LISTA', 'ENTREGADA')),
  CONSTRAINT registrations_link_version_chk CHECK (link_version >= 1)
);
CREATE INDEX registrations_registered_at_idx ON registrations (registered_at DESC);
CREATE INDEX registrations_piece_status_idx ON registrations (piece_status);

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_normalized text NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,
  failed_sign_in_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  last_sign_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_email_normalized_uq UNIQUE (email_normalized),
  CONSTRAINT admin_users_role_chk CHECK (role IN ('OWNER', 'ADMIN')),
  CONSTRAINT admin_users_display_name_chk CHECK (char_length(display_name) BETWEEN 1 AND 60),
  CONSTRAINT admin_users_failed_count_chk CHECK (failed_sign_in_count >= 0)
);

CREATE TABLE admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  admin_user_id uuid NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT admin_sessions_token_hash_uq UNIQUE (token_hash),
  CONSTRAINT admin_sessions_token_hash_chk CHECK (token_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX admin_sessions_admin_user_idx ON admin_sessions (admin_user_id);

CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_admin_id uuid REFERENCES admin_users (id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audit_logs_action_chk CHECK (action ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  CONSTRAINT audit_logs_entity_type_chk CHECK (entity_type ~ '^[a-z][a-z_]{1,39}$')
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_logs_occurred_at_idx ON audit_logs (occurred_at DESC);

CREATE FUNCTION audit_logs_reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;
CREATE TRIGGER audit_logs_no_update_delete BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_change();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_reject_change();

CREATE UNLOGGED TABLE rate_limit_counters (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL,
  PRIMARY KEY (bucket_key, window_start),
  CONSTRAINT rate_limit_counters_hits_chk CHECK (hits >= 1)
);
CREATE INDEX rate_limit_counters_window_idx ON rate_limit_counters (window_start);

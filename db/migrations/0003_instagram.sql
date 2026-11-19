CREATE TABLE instagram_connection (
  id smallint PRIMARY KEY DEFAULT 1,
  account_id text NOT NULL,
  username text NOT NULL,
  access_token_ciphertext text NOT NULL,
  token_expires_at timestamptz,
  token_version integer NOT NULL DEFAULT 1,
  connected_by_admin_id uuid REFERENCES admin_users (id),
  connected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT instagram_connection_singleton_chk CHECK (id = 1),
  CONSTRAINT instagram_connection_account_chk CHECK (account_id ~ '^[0-9]{1,32}$'),
  CONSTRAINT instagram_connection_username_chk CHECK (username ~ '^[a-z0-9._]{1,30}$')
);

CREATE TABLE messaging_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_scoped_id text NOT NULL,
  username text,
  display_name text,
  last_inbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messaging_contacts_scoped_id_uq UNIQUE (instagram_scoped_id),
  CONSTRAINT messaging_contacts_scoped_id_chk CHECK (instagram_scoped_id ~ '^[0-9]{1,32}$'),
  CONSTRAINT messaging_contacts_username_chk CHECK (username IS NULL OR username ~ '^[a-z0-9._]{1,30}$'),
  CONSTRAINT messaging_contacts_display_name_chk CHECK (display_name IS NULL OR char_length(display_name) <= 100)
);
CREATE INDEX messaging_contacts_username_idx ON messaging_contacts (username);

ALTER TABLE registrations
  ADD COLUMN ig_link_code text,
  ADD COLUMN messaging_contact_id uuid REFERENCES messaging_contacts (id) ON DELETE SET NULL,
  ADD COLUMN contact_linked_by text,
  ADD CONSTRAINT registrations_ig_link_code_chk CHECK (ig_link_code IS NULL OR ig_link_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  ADD CONSTRAINT registrations_contact_linked_by_chk CHECK (
    (messaging_contact_id IS NULL AND contact_linked_by IS NULL)
    OR (messaging_contact_id IS NOT NULL AND contact_linked_by IN ('CODE', 'USERNAME', 'MANUAL'))
  );
CREATE UNIQUE INDEX registrations_ig_link_code_uq ON registrations (ig_link_code) WHERE ig_link_code IS NOT NULL;
CREATE UNIQUE INDEX registrations_messaging_contact_uq ON registrations (messaging_contact_id) WHERE messaging_contact_id IS NOT NULL;

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES registrations (id) ON DELETE CASCADE,
  contact_id uuid REFERENCES messaging_contacts (id) ON DELETE CASCADE,
  direction text NOT NULL,
  source text NOT NULL,
  template_key text,
  status text NOT NULL,
  body text NOT NULL,
  external_message_id text,
  external_part_ids text[] NOT NULL DEFAULT '{}',
  parts_sent integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  claims_without_progress integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  locked_until timestamptz,
  last_error text,
  created_by uuid REFERENCES admin_users (id),
  sent_at timestamptz,
  read_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_direction_chk CHECK (direction IN ('IN', 'OUT')),
  CONSTRAINT messages_source_chk CHECK (source IN ('ADMIN', 'INSTAGRAM_APP', 'CONTACT')),
  CONSTRAINT messages_status_chk CHECK (status IN ('WAITING_CONTACT', 'WAITING_WINDOW', 'QUEUED', 'SENT', 'FAILED', 'SENT_MANUALLY', 'RECEIVED')),
  CONSTRAINT messages_body_chk CHECK (char_length(body) BETWEEN 1 AND 2000),
  CONSTRAINT messages_last_error_chk CHECK (last_error IS NULL OR char_length(last_error) <= 200),
  CONSTRAINT messages_template_key_chk CHECK (template_key IS NULL OR template_key IN ('BIENVENIDA', 'CAMBIO_ESTADO', 'RECORDATORIO_DROP')),
  CONSTRAINT messages_inbound_chk CHECK (direction = 'OUT' OR (source = 'CONTACT' AND status = 'RECEIVED' AND contact_id IS NOT NULL)),
  CONSTRAINT messages_outbound_chk CHECK (direction = 'IN' OR (source IN ('ADMIN', 'INSTAGRAM_APP') AND status <> 'RECEIVED')),
  CONSTRAINT messages_admin_subject_chk CHECK (source <> 'ADMIN' OR registration_id IS NOT NULL),
  CONSTRAINT messages_delivery_contact_chk CHECK (status NOT IN ('QUEUED', 'SENT', 'WAITING_WINDOW') OR contact_id IS NOT NULL)
);
CREATE UNIQUE INDEX messages_external_message_id_uq ON messages (external_message_id) WHERE external_message_id IS NOT NULL;
CREATE INDEX messages_due_idx ON messages (next_attempt_at) WHERE status = 'QUEUED';
CREATE INDEX messages_waiting_idx ON messages (status) WHERE status IN ('WAITING_CONTACT', 'WAITING_WINDOW');
CREATE INDEX messages_registration_idx ON messages (registration_id, created_at);
CREATE INDEX messages_contact_idx ON messages (contact_id, created_at);

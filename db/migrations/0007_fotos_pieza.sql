CREATE TABLE piece_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  data bytea NOT NULL,
  created_by uuid REFERENCES admin_users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT piece_photos_type_chk CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT piece_photos_size_chk CHECK (byte_size BETWEEN 1 AND 1048576 AND octet_length(data) = byte_size)
);
CREATE INDEX piece_photos_registration_idx ON piece_photos (registration_id, created_at);

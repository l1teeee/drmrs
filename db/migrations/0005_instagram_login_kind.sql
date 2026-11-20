ALTER TABLE instagram_connection ADD COLUMN kind text NOT NULL DEFAULT 'UNIFIED_LOGIN';
ALTER TABLE instagram_connection ALTER COLUMN kind DROP DEFAULT;
ALTER TABLE instagram_connection ADD CONSTRAINT instagram_connection_kind_chk CHECK (kind IN ('INSTAGRAM_LOGIN', 'UNIFIED_LOGIN'));
ALTER TABLE instagram_connection ADD CONSTRAINT instagram_connection_legacy_expiry_chk CHECK (kind <> 'INSTAGRAM_LOGIN' OR token_expires_at IS NOT NULL);

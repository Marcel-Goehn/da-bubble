-- Uploaded Avatars. The object sits in storage under avatar_key; a User has a predefined Avatar or an uploaded
-- one, never both. An uploaded one is a Pending Upload of kind AVATAR until "Speichern" applies it.
ALTER TABLE users
    ADD COLUMN avatar_key text UNIQUE,
    ADD CONSTRAINT users_one_avatar CHECK (avatar IS NULL OR avatar_key IS NULL);

ALTER TABLE pending_uploads ADD COLUMN kind text NOT NULL DEFAULT 'ATTACHMENT' CHECK (kind IN ('ATTACHMENT', 'AVATAR'));
ALTER TABLE pending_uploads ALTER COLUMN kind DROP DEFAULT;

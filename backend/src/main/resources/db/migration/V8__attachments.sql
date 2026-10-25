-- Pending Uploads: files a User has requested an upload for but not yet used. The object (and an image's
-- thumbnail) sits in storage under a random key; sending it turns the row into an Attachment, and the object
-- stays where it is.
CREATE TABLE pending_uploads (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uploader_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    object_key    text        NOT NULL UNIQUE,
    thumbnail_key text UNIQUE,
    name          text        NOT NULL,
    size          bigint      NOT NULL CHECK (size > 0),
    content_type  text        NOT NULL,
    created_at    timestamptz NOT NULL
);

CREATE INDEX pending_uploads_uploader_id_idx ON pending_uploads (uploader_id);

-- Attachments, part of the Message aggregate: files sent with a Message, in the order they were attached.
CREATE TABLE attachments (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id    bigint NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    object_key    text   NOT NULL UNIQUE,
    thumbnail_key text UNIQUE,
    name          text   NOT NULL,
    size          bigint NOT NULL CHECK (size > 0),
    content_type  text   NOT NULL
);

CREATE INDEX attachments_message_id_idx ON attachments (message_id);

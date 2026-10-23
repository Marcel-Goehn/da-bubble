-- Users, Conversations (Channels and Direct Messages) and Channel Memberships.
-- Timestamps are written by the app from its Clock, truncated to microseconds; columns have no defaults.

-- id is the Keycloak `sub`. The name is the app's own; the email is synced from the token.
CREATE TABLE users (
    id         uuid PRIMARY KEY,
    name       varchar(50) NOT NULL CHECK (name <> '' AND name = btrim(name)),
    email      text        NOT NULL,
    avatar     text,
    created_at timestamptz NOT NULL
);

-- A Channel or a Direct Message. A DM stores its two Users sorted (user_low <= user_high, a self-DM has
-- both equal), so one unique index allows at most one DM per pair.
CREATE TABLE conversations (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind        varchar(16) NOT NULL CHECK (kind IN ('CHANNEL', 'DIRECT_MESSAGE')),
    name        text,
    description text,
    creator_id  uuid REFERENCES users (id) ON DELETE SET NULL,
    is_default  boolean     NOT NULL DEFAULT false,
    user_low    uuid REFERENCES users (id) ON DELETE CASCADE,
    user_high   uuid REFERENCES users (id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL,
    CONSTRAINT conversations_channel_shape CHECK (
        kind <> 'CHANNEL'
        OR (name IS NOT NULL AND name <> '' AND name = btrim(name) AND user_low IS NULL AND user_high IS NULL)
    ),
    CONSTRAINT conversations_dm_shape CHECK (
        kind <> 'DIRECT_MESSAGE'
        OR (
            user_low IS NOT NULL AND user_high IS NOT NULL AND user_low <= user_high
            AND name IS NULL AND description IS NULL AND creator_id IS NULL AND NOT is_default
        )
    )
);

-- Exactly one Default Channel, found by this flag and never by name.
CREATE UNIQUE INDEX conversations_default_key ON conversations (is_default) WHERE is_default;
CREATE UNIQUE INDEX conversations_dm_pair_key ON conversations (user_low, user_high) WHERE kind = 'DIRECT_MESSAGE';
CREATE UNIQUE INDEX conversations_channel_name_key ON conversations (lower(name)) WHERE kind = 'CHANNEL';

-- A Member of a Channel. DMs have no Memberships.
CREATE TABLE memberships (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id bigint      NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    joined_at       timestamptz NOT NULL,
    is_admin        boolean     NOT NULL DEFAULT false,
    CONSTRAINT memberships_conversation_user_key UNIQUE (conversation_id, user_id)
);

CREATE INDEX memberships_user_id_idx ON memberships (user_id);

-- The Default Channel: no Creator, no Admins. Its name is internal; the frontend shows "Allgemein" or "General".
INSERT INTO conversations (kind, name, is_default, created_at) VALUES ('CHANNEL', 'Allgemein', true, now());

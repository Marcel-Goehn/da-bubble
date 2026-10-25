-- Reactions, part of the Message aggregate: an emoji (native Unicode, skin tone included) a User attaches to
-- a Message, at most once per emoji. Ordered by when they were added.
CREATE TABLE reactions (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id bigint      NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users (id),
    emoji      text        NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT reactions_message_user_emoji_key UNIQUE (message_id, user_id, emoji)
);

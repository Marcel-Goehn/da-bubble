-- Mentions, part of the Message aggregate: which Messages mention which User or Channel, written whenever a
-- Message's text is. The text holds the tokens with the names at the time of writing; this table lets search
-- and renames find the Messages to re-render. Deleting a Channel drops the Mentions of it, which then read as
-- plain text.
CREATE TABLE message_mention (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id bigint NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    user_id    uuid REFERENCES users (id) ON DELETE CASCADE,
    channel_id bigint REFERENCES conversations (id) ON DELETE CASCADE,
    CONSTRAINT message_mention_one_target CHECK (num_nonnulls(user_id, channel_id) = 1),
    CONSTRAINT message_mention_message_user_key UNIQUE (message_id, user_id),
    CONSTRAINT message_mention_message_channel_key UNIQUE (message_id, channel_id)
);

CREATE INDEX message_mention_user_idx ON message_mention (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX message_mention_channel_idx ON message_mention (channel_id) WHERE channel_id IS NOT NULL;

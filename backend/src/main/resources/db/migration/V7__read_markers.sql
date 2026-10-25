-- Per-User read markers: when a User last opened a Conversation (its sidebar count of Messages and Replies),
-- and when they last opened a Thread (its "N neu"). Unread counts are derived from them and never stored.
CREATE TABLE conversation_read_markers (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    conversation_id bigint      NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    read_at         timestamptz NOT NULL,
    CONSTRAINT conversation_read_markers_user_conversation_key UNIQUE (user_id, conversation_id)
);

CREATE INDEX conversation_read_markers_conversation_id_idx ON conversation_read_markers (conversation_id);

CREATE TABLE thread_read_markers (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    parent_message_id bigint      NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    read_at           timestamptz NOT NULL,
    CONSTRAINT thread_read_markers_user_parent_key UNIQUE (user_id, parent_message_id)
);

CREATE INDEX thread_read_markers_parent_message_id_idx ON thread_read_markers (parent_message_id);

-- Counting a Conversation's Messages and Replies since a time.
CREATE INDEX messages_conversation_created_idx ON messages (conversation_id, created_at);

-- Messages and Replies. A Reply points at its parent Message in the same Conversation, one level deep.
-- A Deleted Message keeps its row (place, author, time) with deleted_at set and its text erased.
CREATE TABLE messages (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id   bigint      NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    author_id         uuid        NOT NULL REFERENCES users (id),
    parent_message_id bigint REFERENCES messages (id) ON DELETE CASCADE,
    text              text        NOT NULL,
    created_at        timestamptz NOT NULL,
    edited_at         timestamptz,
    deleted_at        timestamptz
);

-- Keyset pagination, newest first: a Conversation's top-level Messages, and a Thread's Replies.
CREATE INDEX messages_conversation_page_idx ON messages (conversation_id, created_at DESC, id DESC)
    WHERE parent_message_id IS NULL;
CREATE INDEX messages_thread_page_idx ON messages (parent_message_id, created_at DESC, id DESC);

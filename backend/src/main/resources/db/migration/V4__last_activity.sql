-- When a Conversation last had activity (a new Message for now); it orders the DM list.
ALTER TABLE conversations ADD COLUMN last_activity_at timestamptz;
UPDATE conversations c
SET last_activity_at = coalesce((SELECT max(m.created_at) FROM messages m WHERE m.conversation_id = c.id), c.created_at);
ALTER TABLE conversations ALTER COLUMN last_activity_at SET NOT NULL;

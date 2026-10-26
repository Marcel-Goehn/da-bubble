-- Stored objects storage failed to delete after their rows were gone; the cleanup retries them until it does.
CREATE TABLE file_deletions (
    object_key text PRIMARY KEY,
    failed_at  timestamptz NOT NULL
);

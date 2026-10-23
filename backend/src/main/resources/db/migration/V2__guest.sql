-- Marks the Guest, copied from the `guest` realm role when the User is provisioned.
ALTER TABLE users ADD COLUMN is_guest boolean NOT NULL DEFAULT false;

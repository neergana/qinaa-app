ALTER TABLE rooms ADD COLUMN role_mode TEXT NOT NULL DEFAULT 'automatic';
ALTER TABLE rooms ADD COLUMN role_config TEXT;

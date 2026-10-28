ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN status_reason TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;

CREATE TABLE admins (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_users_status_created ON users(account_status, created_at);
CREATE INDEX idx_admin_audit_created ON admin_audit_log(created_at);

INSERT INTO site_settings (key, value, updated_at) VALUES ('maintenance_mode', '0', datetime('now'));
INSERT INTO site_settings (key, value, updated_at) VALUES ('registration_enabled', '1', datetime('now'));
INSERT INTO site_settings (key, value, updated_at) VALUES ('room_creation_enabled', '1', datetime('now'));
INSERT INTO site_settings (key, value, updated_at) VALUES ('maintenance_message', 'قِناع في صيانة قصيرة. سنعود قريباً.', datetime('now'));

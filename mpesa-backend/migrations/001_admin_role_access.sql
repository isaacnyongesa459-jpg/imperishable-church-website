CREATE TABLE IF NOT EXISTS admin_roles (
  id BIGSERIAL PRIMARY KEY,
  role_key VARCHAR(40) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_roles_permissions_array CHECK (jsonb_typeof(permissions) = 'array')
);

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  password_hash TEXT NOT NULL,
  is_bootstrap BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  auth_version INTEGER NOT NULL DEFAULT 0 CHECK (auth_version >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_user_roles (
  user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  assigned_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_roles_role_id
  ON admin_user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_active
  ON admin_users(is_active, username);

INSERT INTO admin_roles (role_key, display_name, permissions) VALUES
  ('super_admin', 'Super Administrator', '["*"]'::jsonb),
  ('pastor', 'Pastor', '["content:read","content:manage","announcements:manage","sermons:manage","prayer:assigned"]'::jsonb),
  ('treasurer', 'Treasurer', '["donations:read","finance:manage","reports:manage"]'::jsonb),
  ('media_administrator', 'Media Administrator', '["media:manage","sermons:manage"]'::jsonb),
  ('prayer_team_member', 'Prayer Team Member', '["prayer:assigned"]'::jsonb)
ON CONFLICT (role_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  permissions = EXCLUDED.permissions;

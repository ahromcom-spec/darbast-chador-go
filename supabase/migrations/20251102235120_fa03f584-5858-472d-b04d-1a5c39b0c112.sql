-- Update organizational_positions table to support hierarchy
ALTER TABLE organizational_positions
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES organizational_positions(id) ON DELETE SET NULL;

-- Insert organizational positions based on the hierarchy
INSERT INTO organizational_positions (name, parent_id, description, is_active) VALUES
-- Level 1: Main positions (کل)
('مدیریت کل', NULL, 'مدیریت کل سازمان', true),
('مدیر اجرایی کل', NULL, 'مدیر اجرایی کل سازمان', true),
('مدیر فروش کل', NULL, 'مدیر فروش کل سازمان', true),
('مدیر مالی کل', NULL, 'مدیر مالی کل سازمان', true),
('مدیر انبارداری کل', NULL, 'مدیر انبارداری کل سازمان', true),
('مدیر پشتیبانی و حراست کل', NULL, 'مدیر پشتیبانی و حراست کل سازمان', true)
ON CONFLICT (name) DO NOTHING;

-- Insert sub-positions (specific to service types)
INSERT INTO organizational_positions (name, parent_id, description, is_active)
SELECT 
  'مدیریت خدمات اجرایی داربست به همراه اجناس',
  (SELECT id FROM organizational_positions WHERE name = 'مدیریت کل' LIMIT 1),
  'مدیریت خدمات اجرایی داربست به همراه اجناس',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM organizational_positions 
  WHERE name = 'مدیریت خدمات اجرایی داربست به همراه اجناس'
);

INSERT INTO organizational_positions (name, parent_id, description, is_active)
SELECT 
  'مدیر اجرایی خدمات اجرایی داربست به همراه اجناس',
  (SELECT id FROM organizational_positions WHERE name = 'مدیر اجرایی کل' LIMIT 1),
  'مدیر اجرایی خدمات اجرایی داربست به همراه اجناس',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM organizational_positions 
  WHERE name = 'مدیر اجرایی خدمات اجرایی داربست به همراه اجناس'
);

INSERT INTO organizational_positions (name, parent_id, description, is_active)
SELECT 
  'مدیر فروش خدمات اجرایی داربست به همراه اجناس',
  (SELECT id FROM organizational_positions WHERE name = 'مدیر فروش کل' LIMIT 1),
  'مدیر فروش خدمات اجرایی داربست به همراه اجناس',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM organizational_positions 
  WHERE name = 'مدیر فروش خدمات اجرایی داربست به همراه اجناس'
);

INSERT INTO organizational_positions (name, parent_id, description, is_active)
SELECT 
  'مدیر مالی خدمات اجرایی داربست به همراه اجناس',
  (SELECT id FROM organizational_positions WHERE name = 'مدیر مالی کل' LIMIT 1),
  'مدیر مالی خدمات اجرایی داربست به همراه اجناس',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM organizational_positions 
  WHERE name = 'مدیر مالی خدمات اجرایی داربست به همراه اجناس'
);

INSERT INTO organizational_positions (name, parent_id, description, is_active)
SELECT 
  'مدیر انبارداری خدمات اجرایی داربست به همراه اجناس',
  (SELECT id FROM organizational_positions WHERE name = 'مدیر انبارداری کل' LIMIT 1),
  'مدیر انبارداری خدمات اجرایی داربست به همراه اجناس',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM organizational_positions 
  WHERE name = 'مدیر انبارداری خدمات اجرایی داربست به همراه اجناس'
);

INSERT INTO organizational_positions (name, parent_id, description, is_active)
SELECT 
  'مدیر پشتیبانی و حراست خدمات اجرایی داربست به همراه اجناس',
  (SELECT id FROM organizational_positions WHERE name = 'مدیر پشتیبانی و حراست کل' LIMIT 1),
  'مدیر پشتیبانی و حراست خدمات اجرایی داربست به همراه اجناس',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM organizational_positions 
  WHERE name = 'مدیر پشتیبانی و حراست خدمات اجرایی داربست به همراه اجناس'
);

-- Update staff_whitelist table to support multiple positions
ALTER TABLE staff_whitelist
DROP COLUMN IF EXISTS allowed_role;

ALTER TABLE staff_whitelist
ADD COLUMN IF NOT EXISTS allowed_position_ids uuid[] DEFAULT '{}';

-- Update staff_verification_requests to use position_id instead
ALTER TABLE staff_verification_requests
ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES organizational_positions(id) ON DELETE SET NULL;
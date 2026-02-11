-- Create organization
CREATE organization:exp_repo SET
  org_id = 'exp-repo',
  name = 'Experimental Repository',
  plan = 'free',
  created_at = time::now(),
  updated_at = time::now();

-- Create user
CREATE user:test_user SET
  user_id = 'test-user',
  org_id = 'exp-repo',
  email = 'test@example.com',
  name = 'Test User',
  role = 'owner',
  created_at = time::now();

-- Create API key
-- Raw key: mb_test_v2_migration_2026
-- SHA256: 054cb1f26a6b7f7b85c55feb22d1604663d1601127a521a4c758b51b771414ae
CREATE apikey:test_v2_key SET
  key_id = 'apikey:test_v2_key',
  org_id = 'exp-repo',
  user_id = 'test-user',
  name = 'V2 Test API Key',
  key_hash = '054cb1f26a6b7f7b85c55feb22d1604663d1601127a521a4c758b51b771414ae',
  scopes = ['read', 'write'],
  status = 'active',
  created_at = time::now(),
  last_used_at = time::now();

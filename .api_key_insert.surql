
CREATE api_keys:`devbob_test_key` SET
  key_id = 'devbob_test_key',
  org_id = 'test-org',
  user_id = 'test-user',
  name = 'Devbob Test Key',
  key_hash = '7121f8d6fce81ad0a87c38373e265ebf9a0cbf7c48457e5bcde29f74839dac07',
  scopes = ['project:read', 'project:write', 'activity:read', 'activity:write'],
  is_active = true,
  created_at = time::now(),
  last_used_at = time::now();

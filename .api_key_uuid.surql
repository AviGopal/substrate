
USE NS metabob; USE DB metabob;
CREATE api_keys:`657951f8-4de6-41c0-9318-a1559efbe2bc` SET
  key_id = '657951f8-4de6-41c0-9318-a1559efbe2bc',
  org_id = 'test-org',
  user_id = 'test-user',
  name = 'Devbob Test Key UUID',
  key_hash = 'e91e476ceada3d6055594ea00b9de13cea3f0de8aecfcfb74a1977b62a5025af',
  scopes = ['project:read', 'project:write', 'activity:read', 'activity:write'],
  is_active = true,
  created_at = time::now(),
  last_used_at = time::now();

-- Delete old test data
DELETE FROM api_keys WHERE org_id = "test-org-v2";
DELETE FROM users WHERE id = users:`11111111-1111-1111-1111-111111111111`;
DELETE FROM organizations WHERE id = organizations:`test-org-v2`;

-- Create test API key for v2 endpoint testing  
-- Key hash is SHA-256 of "test-api-key"

CREATE api_keys:`22222222-2222-2222-2222-222222222222` CONTENT {
    key_hash: "4c806362b613f7496abf284146efd31da90e4b16169fe001841ca17290f427c4",
    key_id: "22222222-2222-2222-2222-222222222222",
    user_id: "11111111-1111-1111-1111-111111111111",
    org_id: "test-org-v2",
    name: "Test API Key",
    is_active: true,
    scopes: ["analysis:read", "analysis:write", "jobs:read", "jobs:write"],
    created_at: time::now(),
    expires_at: time::now() + 365d,
    last_used_at: NONE
};

CREATE users:`11111111-1111-1111-1111-111111111111` CONTENT {
    user_id: "11111111-1111-1111-1111-111111111111",
    name: "Test User V2",
    email: "test-v2@example.com",
    password_hash: "$2b$12$dummyhashfordummyuserforv2testing",
    org_id: "test-org-v2",
    role: "owner",
    metadata: {},
    created_at: time::now()
};

CREATE organizations:`test-org-v2` CONTENT {
    org_id: "test-org-v2",
    name: "Test Organization",
    created_at: time::now()
};

SELECT * FROM api_keys WHERE key_hash = "4c806362b613f7496abf284146efd31da90e4b16169fe001841ca17290f427c4";

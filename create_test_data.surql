-- Create test API key for v2 endpoint testing
-- Key hash is SHA-256 of "test-api-key"

CREATE api_key CONTENT {
    key_hash: "4c806362b613f7496abf284146efd31da90e4b16169fe001841ca17290f427c4",
    user_id: "test-user",
    org_id: "test-org-v2",
    name: "Test API Key",
    is_active: true,
    created_at: time::now(),
    expires_at: time::now() + 365d,
    last_used_at: NONE
};

CREATE user:`test-user` CONTENT {
    email: "test@example.com",
    org_id: "test-org-v2",
    created_at: time::now()
};

CREATE org:`test-org-v2` CONTENT {
    name: "Test Organization",
    created_at: time::now()
};

SELECT * FROM api_key WHERE key_hash = "4c806362b613f7496abf284146efd31da90e4b16169fe001841ca17290f427c4";

-- SurrealDB Schema for DevBob Activity Storage (v2.6.0 compatible)
USE NS metabob DB devbob;

-- Activity Template Table
DEFINE TABLE IF NOT EXISTS activity_template SCHEMAFULL;
DEFINE FIELD id ON activity_template TYPE string;
DEFINE FIELD name ON activity_template TYPE string;
DEFINE FIELD description ON activity_template TYPE string;
DEFINE FIELD category ON activity_template TYPE string;
DEFINE FIELD tasks ON activity_template TYPE array;
DEFINE FIELD variables ON activity_template TYPE array;
DEFINE FIELD metabob ON activity_template TYPE object;
DEFINE FIELD created_at ON activity_template TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON activity_template TYPE datetime DEFAULT time::now();

DEFINE INDEX activity_template_id_idx ON activity_template FIELDS id UNIQUE;
DEFINE INDEX activity_template_category_idx ON activity_template FIELDS category;
DEFINE INDEX activity_template_name_idx ON activity_template FIELDS name;

-- Activity Execution Table
DEFINE TABLE IF NOT EXISTS activity_execution SCHEMAFULL;
DEFINE FIELD id ON activity_execution TYPE string;
DEFINE FIELD template_id ON activity_execution TYPE string;
DEFINE FIELD status ON activity_execution TYPE string;
DEFINE FIELD agent_id ON activity_execution TYPE string;
DEFINE FIELD variables ON activity_execution TYPE object;
DEFINE FIELD start_time ON activity_execution TYPE datetime DEFAULT time::now();
DEFINE FIELD end_time ON activity_execution TYPE datetime;
DEFINE FIELD duration_ms ON activity_execution TYPE number;
DEFINE FIELD cost ON activity_execution TYPE number;
DEFINE FIELD tokens ON activity_execution TYPE object;
DEFINE FIELD error ON activity_execution TYPE string;
DEFINE FIELD created_at ON activity_execution TYPE datetime DEFAULT time::now();

DEFINE INDEX activity_execution_id_idx ON activity_execution FIELDS id UNIQUE;
DEFINE INDEX activity_execution_template_idx ON activity_execution FIELDS template_id;
DEFINE INDEX activity_execution_status_idx ON activity_execution FIELDS status;
DEFINE INDEX activity_execution_agent_idx ON activity_execution FIELDS agent_id;

-- ============================================================================
-- AUTHENTICATION TABLES (Added for dashboard login flow)
-- ============================================================================

-- Users Table
DEFINE TABLE IF NOT EXISTS users SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD user_id ON users TYPE string;
DEFINE FIELD email ON users TYPE string;
DEFINE FIELD password_hash ON users TYPE string;
DEFINE FIELD name ON users TYPE string;
DEFINE FIELD org_id ON users TYPE string;
DEFINE FIELD role ON users TYPE string DEFAULT "member";
DEFINE FIELD is_active ON users TYPE bool DEFAULT true;
DEFINE FIELD email_verified ON users TYPE bool DEFAULT false;
DEFINE FIELD last_login_at ON users TYPE datetime;
DEFINE FIELD metadata ON users TYPE object DEFAULT {};
DEFINE FIELD created_at ON users TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON users TYPE datetime DEFAULT time::now();

DEFINE INDEX users_id_idx ON users FIELDS user_id UNIQUE;
DEFINE INDEX users_email_idx ON users FIELDS email UNIQUE;
DEFINE INDEX users_org_idx ON users FIELDS org_id;

-- Organizations Table
DEFINE TABLE IF NOT EXISTS organizations SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD org_id ON organizations TYPE string;
DEFINE FIELD name ON organizations TYPE string;
DEFINE FIELD display_name ON organizations TYPE string;
DEFINE FIELD settings ON organizations TYPE object DEFAULT {};
DEFINE FIELD metadata ON organizations TYPE object DEFAULT {};
DEFINE FIELD created_at ON organizations TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON organizations TYPE datetime DEFAULT time::now();

DEFINE INDEX organizations_id_idx ON organizations FIELDS org_id UNIQUE;
DEFINE INDEX organizations_name_idx ON organizations FIELDS name;

-- User Organizations (Many-to-Many)
DEFINE TABLE IF NOT EXISTS user_organizations SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD user_id ON user_organizations TYPE string;
DEFINE FIELD org_id ON user_organizations TYPE string;
DEFINE FIELD role ON user_organizations TYPE string DEFAULT "member";
DEFINE FIELD is_active ON user_organizations TYPE bool DEFAULT true;
DEFINE FIELD joined_at ON user_organizations TYPE datetime DEFAULT time::now();

DEFINE INDEX user_orgs_user_idx ON user_organizations FIELDS user_id;
DEFINE INDEX user_orgs_org_idx ON user_organizations FIELDS org_id;
DEFINE INDEX user_orgs_composite_idx ON user_organizations FIELDS user_id, org_id UNIQUE;

-- Refresh Tokens
DEFINE TABLE IF NOT EXISTS refresh_tokens SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD token_id ON refresh_tokens TYPE string;
DEFINE FIELD user_id ON refresh_tokens TYPE string;
DEFINE FIELD refresh_token ON refresh_tokens TYPE string;
DEFINE FIELD expires_at ON refresh_tokens TYPE datetime;
DEFINE FIELD is_revoked ON refresh_tokens TYPE bool DEFAULT false;
DEFINE FIELD created_at ON refresh_tokens TYPE datetime DEFAULT time::now();

DEFINE INDEX refresh_tokens_token_idx ON refresh_tokens FIELDS refresh_token UNIQUE;
DEFINE INDEX refresh_tokens_user_idx ON refresh_tokens FIELDS user_id;

-- Impulse Learning System Database Schema
-- Based on: IMPULSE_LEARNING_REQUIREMENTS_SPECIFICATION.md Part 2

-- =============================================================================
-- Table 1: impulse_mapping_records (Raw learning data)
-- =============================================================================

CREATE TABLE IF NOT EXISTS impulse_mapping_records (
  -- Primary key
  id TEXT PRIMARY KEY,
  
  -- User intent
  raw_text TEXT NOT NULL,
  normalized_pattern TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  intent_confidence REAL NOT NULL,
  
  -- Context
  recent_files TEXT NOT NULL,              -- JSON array
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  
  -- Impulses created (JSON array)
  impulses TEXT NOT NULL,
  
  -- Outcome
  task_succeeded BOOLEAN NOT NULL,
  response_quality REAL NOT NULL,
  impulses_used_count INTEGER NOT NULL,
  time_to_success INTEGER NOT NULL,
  
  -- Metadata
  record_id TEXT NOT NULL,
  
  -- Indexes for fast lookup
  CHECK (intent_confidence >= 0 AND intent_confidence <= 1),
  CHECK (response_quality >= 0 AND response_quality <= 1)
);

CREATE INDEX IF NOT EXISTS idx_normalized_pattern ON impulse_mapping_records(normalized_pattern);
CREATE INDEX IF NOT EXISTS idx_intent_type ON impulse_mapping_records(intent_type);
CREATE INDEX IF NOT EXISTS idx_session_id ON impulse_mapping_records(session_id);
CREATE INDEX IF NOT EXISTS idx_captured_at ON impulse_mapping_records(captured_at DESC);

-- =============================================================================
-- Table 2: pattern_library (Learned patterns)
-- =============================================================================

CREATE TABLE IF NOT EXISTS pattern_library (
  -- Primary key
  id TEXT PRIMARY KEY,                     -- pattern_abc123
  
  -- Pattern template
  template TEXT NOT NULL,                  -- "fix bug in {file0}"
  normalized TEXT NOT NULL,                -- "fix_bug_in_X"
  variables TEXT NOT NULL,                 -- JSON array of PatternVariable
  intent_type TEXT NOT NULL,               -- "code_fix", "feature_request"
  
  -- Learned impulse mappings
  impulse_mapping TEXT NOT NULL,           -- JSON array of ImpulseMapping
  
  -- Pattern metrics
  observation_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0.0,
  avg_response_time_ms REAL DEFAULT 0.0,
  
  -- Reliability flags
  is_reliable BOOLEAN DEFAULT 1,           -- success_rate >= 0.75
  is_active BOOLEAN DEFAULT 1,             -- Used in skip decisions
  
  -- Timestamps
  first_observed INTEGER NOT NULL,         -- Unix timestamp (ms)
  last_used INTEGER NOT NULL,              -- Unix timestamp (ms)
  last_updated INTEGER NOT NULL,           -- Unix timestamp (ms)
  
  -- Metadata
  metadata TEXT,                           -- JSON object for additional data
  
  -- Constraints
  CHECK (success_rate >= 0 AND success_rate <= 1),
  CHECK (observation_count >= 0),
  CHECK (success_count >= 0),
  CHECK (failure_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_normalized ON pattern_library(normalized);
CREATE INDEX IF NOT EXISTS idx_intent_type_pattern ON pattern_library(intent_type);
CREATE INDEX IF NOT EXISTS idx_success_rate ON pattern_library(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_is_reliable ON pattern_library(is_reliable);
CREATE INDEX IF NOT EXISTS idx_is_active ON pattern_library(is_active);
CREATE INDEX IF NOT EXISTS idx_last_used ON pattern_library(last_used DESC);
CREATE INDEX IF NOT EXISTS idx_observation_count ON pattern_library(observation_count DESC);

-- Composite index for pattern matching queries
CREATE INDEX IF NOT EXISTS idx_pattern_lookup 
ON pattern_library(normalized, intent_type, is_reliable, is_active);

-- Composite index for pattern effectiveness queries
CREATE INDEX IF NOT EXISTS idx_pattern_metrics 
ON pattern_library(success_rate DESC, observation_count DESC);

-- =============================================================================
-- Table 3: memory_agent_performance (Per-turn tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS memory_agent_performance (
  -- Primary key
  id TEXT PRIMARY KEY,
  
  -- Session context
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  user_message TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  
  -- Skip decision
  skipped BOOLEAN NOT NULL,
  skip_reason TEXT,
  skip_confidence REAL,
  fallback_strategy TEXT,
  
  -- Pattern info (if skip_reason = pattern)
  pattern_id TEXT,
  pattern_template TEXT,
  pattern_confidence REAL,
  variable_bindings TEXT,
  
  -- Activity info (if skip_reason = activity)
  activity_id TEXT,
  template_id TEXT,
  requirement_count INTEGER,
  
  -- Outcome
  impulses_created INTEGER NOT NULL,
  impulses_loaded INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  task_succeeded BOOLEAN,
  response_quality REAL,
  
  -- Performance metrics
  decision_duration_ms REAL NOT NULL,
  fallback_duration_ms REAL,
  total_duration_ms REAL NOT NULL,
  llm_time_saved_ms REAL,
  
  -- Timestamps
  captured_at INTEGER NOT NULL,
  
  -- Constraints
  CHECK (skip_confidence IS NULL OR (skip_confidence >= 0 AND skip_confidence <= 1)),
  CHECK (pattern_confidence IS NULL OR (pattern_confidence >= 0 AND pattern_confidence <= 1)),
  CHECK (response_quality IS NULL OR (response_quality >= 0 AND response_quality <= 1))
);

CREATE INDEX IF NOT EXISTS idx_session_turn ON memory_agent_performance(session_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_skipped ON memory_agent_performance(skipped);
CREATE INDEX IF NOT EXISTS idx_skip_reason ON memory_agent_performance(skip_reason);
CREATE INDEX IF NOT EXISTS idx_pattern_id ON memory_agent_performance(pattern_id);
CREATE INDEX IF NOT EXISTS idx_captured_at_perf ON memory_agent_performance(captured_at DESC);

-- Composite index for session tracking
CREATE INDEX IF NOT EXISTS idx_session_tracking 
ON memory_agent_performance(session_id, turn_number, captured_at DESC);

-- =============================================================================
-- Table 4: activity_learning_records (Activity context learning)
-- =============================================================================

CREATE TABLE IF NOT EXISTS activity_learning_records (
  -- Primary key
  id TEXT PRIMARY KEY,
  
  -- Activity context
  activity_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  
  -- Outcome
  succeeded BOOLEAN NOT NULL,
  duration INTEGER NOT NULL,
  cost REAL NOT NULL,
  
  -- Context requirements
  context_requirements TEXT NOT NULL,      -- JSON array
  
  -- Impulse mappings
  impulses_mapped TEXT NOT NULL,           -- JSON object
  
  -- Task outcomes
  task_outcomes TEXT NOT NULL,             -- JSON array
  
  -- Metrics
  total_impulses_created INTEGER NOT NULL,
  total_impulses_used INTEGER NOT NULL,
  impulse_utilization REAL NOT NULL,
  
  -- Timestamp
  timestamp INTEGER NOT NULL,
  
  -- Constraints
  CHECK (impulse_utilization >= 0 AND impulse_utilization <= 1),
  CHECK (cost >= 0),
  CHECK (duration >= 0)
);

CREATE INDEX IF NOT EXISTS idx_template_id ON activity_learning_records(template_id);
CREATE INDEX IF NOT EXISTS idx_succeeded ON activity_learning_records(succeeded);
CREATE INDEX IF NOT EXISTS idx_impulse_utilization ON activity_learning_records(impulse_utilization DESC);
CREATE INDEX IF NOT EXISTS idx_timestamp ON activity_learning_records(timestamp DESC);

-- Composite index for template learning queries
CREATE INDEX IF NOT EXISTS idx_template_learning 
ON activity_learning_records(template_id, succeeded, impulse_utilization DESC, timestamp DESC);

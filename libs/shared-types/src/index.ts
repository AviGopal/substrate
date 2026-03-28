/**
 * @metabob/shared-types
 * Shared type definitions for Metabob services
 */

// ===== Severity and Status Types =====

/**
 * Severity levels for detected problems
 */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

/**
 * Problem categories
 */
export type ProblemCategory = 'security' | 'performance' | 'maintainability' | 'correctness';

/**
 * Problem status
 */
export type ProblemStatus = 'open' | 'in_progress' | 'resolved' | 'ignored';

/**
 * Risk levels for impact analysis
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ===== Problem Types =====

/**
 * Analysis problem detected in code
 * Stored in: SurrealDB::analysis_problems
 */
export interface AnalysisProblem {
  id: string;
  session_id: string;
  component_id: string;
  severity: Severity;
  category: ProblemCategory;
  message: string;
  impact_score: number;
  status: ProblemStatus;
  created_at: string;
  updated_at: string;
  resolution_summary?: string;
  fixed_in_commit?: string;
  resolved_at?: string;
}

// ===== Annotation Types =====

/**
 * Component annotation types
 */
export type AnnotationType = 'design_decision' | 'implementation_note' | 'bug_context' | 'todo';

/**
 * Component annotation
 */
export interface ComponentAnnotation {
  id: string;
  component_id: string;
  text: string;
  type: AnnotationType;
  session_id: string;
  created_by: string;
  created_at: string;
  linked_problem_id?: string;
}

// ===== Impact Analysis Types =====

/**
 * Impacted component
 */
export interface ImpactedComponent {
  component_id: string;
  component_name: string;
  file_path: string;
  depth: number;
  risk: RiskLevel;
  reason: string;
  annotations?: ComponentAnnotation[];
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysisResult {
  changed_components: string[];
  direct_dependencies: ImpactedComponent[];
  indirect_dependencies: ImpactedComponent[];
  affected_tests: ImpactedComponent[];
  risk_level: RiskLevel;
}

// ===== Co-change Types =====

/**
 * Co-change pattern learned from history
 */
export interface CochangePattern {
  id: string;
  project_id: string;
  file_a: string;
  file_b: string;
  frequency: number;
  confidence: number;
  total_commits: number;
  last_seen: string;
}

/**
 * Co-change suggestion
 */
export interface CochangeSuggestion {
  file_path: string;
  confidence: number;
  reason: 'historical_pattern' | 'semantic_similarity' | 'hybrid';
  affected_components: string[];
  historical_frequency?: number;
  embedding_similarity?: number;
}

// ===== Session Types =====

/**
 * Session scope
 */
export type Scope = 'session' | 'project' | 'org';

/**
 * Resolved scope with IDs
 */
export interface ResolvedScope {
  sessionId: string;
  projectId?: string;
  orgId?: string;
}

/**
 * Session context
 */
export interface SessionContext {
  sessionId: string;
  projectId?: string;
  orgId?: string;
  createdAt: Date;
  lastAccessedAt: Date;
  usageStats: {
    toolCalls: number;
    totalLatency: number;
    errors: number;
  };
}

// ===== Quality Signal Types =====

/**
 * CPG indexing status
 */
export type CPGStatus = 'empty' | 'indexing' | 'ready';

/**
 * Quality signals for tool output
 */
export interface QualitySignals {
  cpg_status?: CPGStatus;
  components_analyzed?: number;
  historical_patterns_found?: number;
  embedding_model_loaded?: boolean;
}

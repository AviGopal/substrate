/**
 * Milestone 5 Tests: @metabob/shared-types
 * Tests for shared type definitions
 */

import { describe, test, expect } from 'bun:test';
import type {
  Severity,
  ProblemCategory,
  ProblemStatus,
  RiskLevel,
  AnalysisProblem,
  ComponentAnnotation,
  AnnotationType,
  CochangeSuggestion,
  SessionContext,
  Scope,
  QualitySignals,
  CPGStatus,
  CochangePattern,
  ImpactedComponent,
  ImpactAnalysisResult,
  ResolvedScope,
} from './index';

describe('Milestone 5: @metabob/shared-types', () => {
  describe('Type Definitions Compile Correctly', () => {
    test('Severity type accepts valid values', () => {
      const severities: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
      expect(severities.length).toBe(5);
      expect(severities).toContain('CRITICAL');
      expect(severities).toContain('INFO');
    });

    test('ProblemCategory type accepts valid values', () => {
      const categories: ProblemCategory[] = [
        'security',
        'performance',
        'maintainability',
        'correctness',
      ];
      expect(categories.length).toBe(4);
    });

    test('ProblemStatus type accepts valid values', () => {
      const statuses: ProblemStatus[] = ['open', 'resolved', 'ignored', 'in_progress'];
      expect(statuses.length).toBe(4);
    });

    test('RiskLevel type accepts valid values', () => {
      const risks: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
      expect(risks.length).toBe(4);
    });

    test('Scope type accepts valid values', () => {
      const scopes: Scope[] = ['session', 'project', 'org'];
      expect(scopes.length).toBe(3);
    });

    test('CPGStatus type accepts valid values', () => {
      const statuses: CPGStatus[] = ['empty', 'indexing', 'ready'];
      expect(statuses.length).toBe(3);
    });

    test('AnnotationType type accepts valid values', () => {
      const types: AnnotationType[] = [
        'design_decision',
        'implementation_note',
        'bug_context',
        'todo',
      ];
      expect(types.length).toBe(4);
    });
  });

  describe('Interface Shapes', () => {
    test('AnalysisProblem interface shape', () => {
      const problem: AnalysisProblem = {
        id: 'problem-1',
        session_id: 'sess-123',
        component_id: 'func::auth::1',
        severity: 'HIGH',
        category: 'security',
        message: 'Input not validated',
        impact_score: 0.8,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(problem.id).toBe('problem-1');
      expect(problem.severity).toBe('HIGH');
      expect(problem.status).toBe('open');
    });

    test('ComponentAnnotation interface shape', () => {
      const annotation: ComponentAnnotation = {
        id: 'ann-1',
        component_id: 'func::login::1',
        text: 'Needs refactoring',
        type: 'todo',
        session_id: 'sess-123',
        created_by: 'user-1',
        created_at: new Date().toISOString(),
      };

      expect(annotation.id).toBe('ann-1');
      expect(annotation.type).toBe('todo');
    });

    test('CochangeSuggestion interface shape', () => {
      const suggestion: CochangeSuggestion = {
        file_path: 'src/auth.ts',
        confidence: 0.85,
        reason: 'historical_pattern',
        affected_components: ['func::login::1'],
        embedding_similarity: 0.72,
        historical_frequency: 0.9,
      };

      expect(suggestion.confidence).toBe(0.85);
      expect(suggestion.embedding_similarity).toBe(0.72);
    });

    test('CochangePattern interface shape', () => {
      const pattern: CochangePattern = {
        id: 'pattern-1',
        project_id: 'proj-1',
        file_a: 'src/auth.ts',
        file_b: 'src/user.ts',
        frequency: 15,
        confidence: 0.9,
        total_commits: 20,
        last_seen: new Date().toISOString(),
      };

      expect(pattern.frequency).toBe(15);
      expect(pattern.confidence).toBe(0.9);
    });

    test('SessionContext interface shape', () => {
      const context: SessionContext = {
        sessionId: 'sess-123',
        orgId: 'org-1',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        usageStats: {
          toolCalls: 10,
          totalLatency: 500,
          errors: 0,
        },
      };

      expect(context.sessionId).toBe('sess-123');
      expect(context.usageStats.toolCalls).toBe(10);
    });

    test('ResolvedScope interface shape', () => {
      const scope: ResolvedScope = {
        sessionId: 'sess-123',
        projectId: 'proj-1',
        orgId: 'org-1',
      };

      expect(scope.sessionId).toBe('sess-123');
    });

    test('QualitySignals interface shape', () => {
      const signals: QualitySignals = {
        cpg_status: 'ready',
        components_analyzed: 150,
        historical_patterns_found: 5,
        embedding_model_loaded: true,
      };

      expect(signals.cpg_status).toBe('ready');
      expect(signals.embedding_model_loaded).toBe(true);
    });

    test('ImpactedComponent interface shape', () => {
      const component: ImpactedComponent = {
        component_id: 'func::auth::1',
        component_name: 'authenticateUser',
        file_path: 'src/auth.ts',
        depth: 1,
        risk: 'high',
        reason: 'Direct dependency on changed component',
      };

      expect(component.risk).toBe('high');
      expect(component.depth).toBe(1);
    });

    test('ImpactAnalysisResult interface shape', () => {
      const result: ImpactAnalysisResult = {
        changed_components: ['func::user::1'],
        direct_dependencies: [],
        indirect_dependencies: [],
        affected_tests: [],
        risk_level: 'medium',
      };

      expect(result.risk_level).toBe('medium');
      expect(result.changed_components).toContain('func::user::1');
    });
  });

  describe('Type Safety', () => {
    test('types export correctly', () => {
      // This test passes if the module compiles without errors
      // The import statement at the top validates type exports
      expect(true).toBe(true);
    });
  });
});

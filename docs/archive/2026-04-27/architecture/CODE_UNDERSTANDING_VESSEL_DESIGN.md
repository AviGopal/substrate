# Code Understanding Vessel Design

## Goal
Enable metabob-mcp to act as a **code understanding vessel** that can:
1. Index code with intent and outcome metadata
2. Surface similar known implementations from graph structure
3. Resolve code-related impulses for activity context injection
4. Learn which patterns solve which goals

## Architectural Alignment with Foundation

This design follows the **Impulse-Activity Foundation** principles:

- **Impulses Are Universal Data:** Code components, patterns, and graph structures are impulses with metadata
- **Resolvers Live Where Data Lives:** metabob-analysis-api resolves code-related impulses (it has the CPG)
- **Activities Constrain Search:** Activities reference code impulses to inject relevant context
- **Metadata First, Content Later:** Reasoners see component metadata (intent/outcome), resolvers load full code
- **Backend is Flexible:** New impulse types can be added without MiniBob changes

## Design Overview

```
┌─────────────────────────────────────────────────────────────┐
│  MiniBob / Claude (via metabob-mcp)                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Activity: "Implement rate limiting"                   │  │
│  │  Impulses needed:                                      │  │
│  │  - codeComponent: Similar rate limiters in codebase   │  │
│  │  - implementationPattern: Circuit breaker pattern     │  │
│  │  - codeGraph: Dependencies of existing limiters       │  │
│  └──────────────────┬─────────────────────────────────────┘  │
└────────────────────┼────────────────────────────────────────┘
                     │ MCP: find_similar_implementations
                     │      resolve_impulse
┌────────────────────▼────────────────────────────────────────┐
│  metabob-mcp (MCP Server)                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  New Tools:                                            │  │
│  │  - index_codebase (progressive indexing)              │  │
│  │  - find_similar_implementations                       │  │
│  │  - get_component_intent                               │  │
│  │  - query_code_graph                                   │  │
│  └──────────────────┬─────────────────────────────────────┘  │
└────────────────────┼────────────────────────────────────────┘
                     │ HTTP: POST /v2/analysis/*
┌────────────────────▼────────────────────────────────────────┐
│  metabob-analysis-api (Code Understanding Backend)          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Enhanced Services:                                    │  │
│  │  1. ComponentMetadataService                          │  │
│  │     - Extract intent from code (LLM + heuristics)     │  │
│  │     - Track outcomes from activity executions         │  │
│  │     - Store semantic embeddings per component         │  │
│  │                                                        │  │
│  │  2. ImplementationCatalogService                      │  │
│  │     - Index known patterns from successful activities │  │
│  │     - Store pattern → outcome mappings                │  │
│  │     - Similarity search via embeddings                │  │
│  │                                                        │  │
│  │  3. GraphQueryService                                 │  │
│  │     - Execute Cypher-like queries on CPG              │  │
│  │     - Return subgraphs as impulse metadata            │  │
│  │     - Support pattern matching (e.g., "all factories")│  │
│  │                                                        │  │
│  │  4. ImpulseResolverService (NEW)                      │  │
│  │     - Resolve codeComponent impulses                  │  │
│  │     - Resolve implementationPattern impulses          │  │
│  │     - Resolve codeGraph impulses                      │  │
│  └──────────────────┬─────────────────────────────────────┘  │
└────────────────────┼────────────────────────────────────────┘
                     │ Store in SurrealDB
┌────────────────────▼────────────────────────────────────────┐
│  SurrealDB - New Tables                                      │
│  - component_metadata (intent, outcome, embeddings)         │
│  - implementation_patterns (pattern, goal, success_rate)    │
│  - pattern_usages (when/where patterns were used)           │
│  - graph_queries (cached query results)                     │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Enhanced Component Metadata

### New Database Schema

```sql
-- Component metadata with intent and outcome
DEFINE TABLE component_metadata SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create, update, delete WHERE org_id = $auth.org_id AND $auth.role IN ['admin', 'owner'];

DEFINE FIELD org_id ON component_metadata TYPE string ASSERT $value != NONE;
DEFINE FIELD project_id ON component_metadata TYPE option<string>;
DEFINE FIELD component_id ON component_metadata TYPE string ASSERT $value != NONE;
DEFINE FIELD file_path ON component_metadata TYPE string ASSERT $value != NONE;
DEFINE FIELD component_type ON component_metadata TYPE string;  -- function, class, method, module
DEFINE FIELD name ON component_metadata TYPE string ASSERT $value != NONE;

-- Intent: What this component is trying to do
DEFINE FIELD intent ON component_metadata TYPE object;
DEFINE FIELD intent.description ON component_metadata TYPE string;  -- Human-readable intent
DEFINE FIELD intent.category ON component_metadata TYPE string;     -- e.g., "rate_limiting", "caching", "auth"
DEFINE FIELD intent.keywords ON component_metadata TYPE array<string>;
DEFINE FIELD intent.inferred_by ON component_metadata TYPE string;  -- "llm", "heuristic", "manual"
DEFINE FIELD intent.confidence ON component_metadata TYPE float;

-- Outcome: What this component actually produces
DEFINE FIELD outcome ON component_metadata TYPE object;
DEFINE FIELD outcome.return_type ON component_metadata TYPE option<string>;
DEFINE FIELD outcome.side_effects ON component_metadata TYPE array<string>;  -- e.g., ["writes_file", "network_io"]
DEFINE FIELD outcome.error_conditions ON component_metadata TYPE array<string>;
DEFINE FIELD outcome.performance_characteristics ON component_metadata TYPE option<string>;

-- Embeddings for similarity search
DEFINE FIELD embedding ON component_metadata TYPE array<float>;
DEFINE FIELD embedding_model ON component_metadata TYPE string;  -- "onnx-v1", future models

-- Usage tracking
DEFINE FIELD times_referenced ON component_metadata TYPE int DEFAULT 0;
DEFINE FIELD last_referenced_at ON component_metadata TYPE option<datetime>;
DEFINE FIELD success_rate ON component_metadata TYPE option<float>;  -- When used as reference

-- Graph context
DEFINE FIELD depends_on ON component_metadata TYPE array<string>;   -- Component IDs
DEFINE FIELD depended_by ON component_metadata TYPE array<string>;  -- Component IDs
DEFINE FIELD complexity_score ON component_metadata TYPE option<float>;

DEFINE FIELD created_at ON component_metadata TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON component_metadata TYPE datetime DEFAULT time::now();

-- Indexes
DEFINE INDEX idx_component_metadata_org_project ON component_metadata COLUMNS org_id, project_id;
DEFINE INDEX idx_component_metadata_intent_category ON component_metadata COLUMNS intent.category;
DEFINE INDEX idx_component_metadata_component_id ON component_metadata COLUMNS component_id;
DEFINE INDEX idx_component_metadata_file_path ON component_metadata COLUMNS file_path;
```

### New Service: ComponentMetadataService

```typescript
// repos/metabob-analysis-api/src/services/component-metadata-service.ts

import { SurrealDBClient } from '../db/surreal';
import { CPGService } from './cpg-service';
import { EmbeddingService } from './embedding-service';
import type { CodeComponent } from '../models/types';

export interface ComponentIntent {
  description: string;
  category: string;  // rate_limiting, caching, auth, validation, etc.
  keywords: string[];
  inferred_by: 'llm' | 'heuristic' | 'manual';
  confidence: number;
}

export interface ComponentOutcome {
  return_type?: string;
  side_effects: string[];  // writes_file, network_io, state_mutation, etc.
  error_conditions: string[];
  performance_characteristics?: string;
}

export interface ComponentMetadata {
  org_id: string;
  project_id?: string;
  component_id: string;
  file_path: string;
  component_type: string;
  name: string;
  intent: ComponentIntent;
  outcome: ComponentOutcome;
  embedding: number[];
  embedding_model: string;
  depends_on: string[];
  depended_by: string[];
  complexity_score?: number;
  times_referenced: number;
  last_referenced_at?: Date;
  success_rate?: number;
}

export class ComponentMetadataService {
  constructor(
    private db: SurrealDBClient,
    private cpgService: CPGService,
    private embeddingService: EmbeddingService
  ) {}

  /**
   * Extract intent from a code component using heuristics + LLM
   */
  async extractIntent(
    component: CodeComponent,
    sourceCode: string
  ): Promise<ComponentIntent> {
    // Phase 1: Heuristic-based intent extraction
    const heuristicIntent = this.inferIntentFromHeuristics(component, sourceCode);

    if (heuristicIntent.confidence > 0.8) {
      return heuristicIntent;
    }

    // Phase 2: LLM-based intent extraction (Haiku for cost efficiency)
    const llmIntent = await this.inferIntentFromLLM(component, sourceCode);

    return llmIntent.confidence > heuristicIntent.confidence
      ? llmIntent
      : heuristicIntent;
  }

  /**
   * Infer intent from naming patterns, imports, and structure
   */
  private inferIntentFromHeuristics(
    component: CodeComponent,
    sourceCode: string
  ): ComponentIntent {
    const name = component.name.toLowerCase();
    const code = sourceCode.toLowerCase();

    // Rate limiting patterns
    if (
      name.includes('ratelimit') ||
      name.includes('throttle') ||
      code.includes('rate limit') ||
      code.includes('requests per')
    ) {
      return {
        description: 'Rate limiting to control request frequency',
        category: 'rate_limiting',
        keywords: ['rate-limit', 'throttle', 'quota'],
        inferred_by: 'heuristic',
        confidence: 0.85,
      };
    }

    // Caching patterns
    if (
      name.includes('cache') ||
      name.includes('memoize') ||
      code.includes('redis') ||
      code.includes('cache.get')
    ) {
      return {
        description: 'Caching to improve performance',
        category: 'caching',
        keywords: ['cache', 'memoization', 'ttl'],
        inferred_by: 'heuristic',
        confidence: 0.9,
      };
    }

    // Authentication patterns
    if (
      name.includes('auth') ||
      name.includes('login') ||
      name.includes('signin') ||
      code.includes('jwt') ||
      code.includes('bearer')
    ) {
      return {
        description: 'Authentication and authorization',
        category: 'auth',
        keywords: ['authentication', 'jwt', 'bearer'],
        inferred_by: 'heuristic',
        confidence: 0.85,
      };
    }

    // Validation patterns
    if (
      name.includes('validate') ||
      name.includes('check') ||
      code.includes('zod') ||
      code.includes('.parse(')
    ) {
      return {
        description: 'Input validation',
        category: 'validation',
        keywords: ['validation', 'schema', 'input-check'],
        inferred_by: 'heuristic',
        confidence: 0.8,
      };
    }

    // Circuit breaker patterns
    if (
      name.includes('circuit') ||
      name.includes('breaker') ||
      code.includes('circuit_breaker') ||
      code.includes('failure threshold')
    ) {
      return {
        description: 'Circuit breaker for resilience',
        category: 'resilience',
        keywords: ['circuit-breaker', 'fault-tolerance', 'failure-handling'],
        inferred_by: 'heuristic',
        confidence: 0.85,
      };
    }

    // Default: low-confidence generic intent
    return {
      description: `${component.component_type} named ${component.name}`,
      category: 'unknown',
      keywords: [component.name],
      inferred_by: 'heuristic',
      confidence: 0.3,
    };
  }

  /**
   * Use LLM to infer intent from source code
   */
  private async inferIntentFromLLM(
    component: CodeComponent,
    sourceCode: string
  ): Promise<ComponentIntent> {
    // TODO: Integrate with LLM (Haiku) for intent extraction
    // For now, return low-confidence placeholder
    return {
      description: `${component.component_type} ${component.name}`,
      category: 'unknown',
      keywords: [],
      inferred_by: 'llm',
      confidence: 0.5,
    };
  }

  /**
   * Extract outcome from component (return type, side effects, errors)
   */
  async extractOutcome(
    component: CodeComponent,
    sourceCode: string
  ): Promise<ComponentOutcome> {
    const sideEffects: string[] = [];
    const errorConditions: string[] = [];

    const code = sourceCode.toLowerCase();

    // Detect side effects
    if (code.includes('fs.write') || code.includes('writefile')) {
      sideEffects.push('writes_file');
    }
    if (code.includes('fs.read') || code.includes('readfile')) {
      sideEffects.push('reads_file');
    }
    if (code.includes('fetch(') || code.includes('axios') || code.includes('http.get')) {
      sideEffects.push('network_io');
    }
    if (code.includes('db.') || code.includes('query(') || code.includes('execute(')) {
      sideEffects.push('database_mutation');
    }
    if (code.includes('.set(') || code.includes('.push(') || code.includes('.delete(')) {
      sideEffects.push('state_mutation');
    }

    // Detect error conditions
    if (code.includes('throw new') || code.includes('throw error')) {
      errorConditions.push('throws_exception');
    }
    if (code.includes('return null') || code.includes('return undefined')) {
      errorConditions.push('returns_null');
    }
    if (code.includes('catch') || code.includes('try {')) {
      errorConditions.push('handles_errors');
    }

    return {
      side_effects: sideEffects,
      error_conditions: errorConditions,
    };
  }

  /**
   * Index a component with full metadata
   */
  async indexComponent(
    orgId: string,
    projectId: string | undefined,
    component: CodeComponent,
    sourceCode: string
  ): Promise<ComponentMetadata> {
    // Extract intent and outcome
    const intent = await this.extractIntent(component, sourceCode);
    const outcome = await this.extractOutcome(component, sourceCode);

    // Generate embedding for similarity search
    const embedding = await this.embeddingService.generateEmbedding(
      `${component.name} ${intent.description} ${intent.keywords.join(' ')}`
    );

    // Get dependencies from CPG (if available)
    const cpgGraph = this.cpgService.getGraphForSession(orgId); // TODO: Session ID mapping
    const depends_on: string[] = []; // TODO: Extract from CPG
    const depended_by: string[] = []; // TODO: Extract from CPG

    const metadata: ComponentMetadata = {
      org_id: orgId,
      project_id: projectId,
      component_id: component.id,
      file_path: component.file_path,
      component_type: component.component_type,
      name: component.name,
      intent,
      outcome,
      embedding,
      embedding_model: 'onnx-v1',
      depends_on,
      depended_by,
      complexity_score: component.complexity_score,
      times_referenced: 0,
    };

    // Store in database
    await this.db.create('component_metadata', metadata);

    return metadata;
  }

  /**
   * Find similar components by intent
   */
  async findSimilarByIntent(
    orgId: string,
    intentQuery: string,
    limit: number = 10
  ): Promise<ComponentMetadata[]> {
    // Generate embedding for query
    const queryEmbedding = await this.embeddingService.generateEmbedding(intentQuery);

    // Search using vector similarity (simplified - actual impl needs FAISS or similar)
    const results = await this.db.query<ComponentMetadata[]>(
      `
      SELECT * FROM component_metadata
      WHERE org_id = $org_id
      ORDER BY vector::similarity::cosine(embedding, $query_embedding) DESC
      LIMIT $limit
      `,
      {
        org_id: orgId,
        query_embedding: queryEmbedding,
        limit,
      }
    );

    return results[0].result || [];
  }

  /**
   * Find components by category
   */
  async findByCategory(
    orgId: string,
    category: string,
    limit: number = 10
  ): Promise<ComponentMetadata[]> {
    const results = await this.db.query<ComponentMetadata[]>(
      `
      SELECT * FROM component_metadata
      WHERE org_id = $org_id AND intent.category = $category
      ORDER BY intent.confidence DESC, success_rate DESC
      LIMIT $limit
      `,
      {
        org_id: orgId,
        category,
        limit,
      }
    );

    return results[0].result || [];
  }

  /**
   * Track usage when a component is referenced in an activity
   */
  async trackUsage(
    componentId: string,
    success: boolean
  ): Promise<void> {
    await this.db.query(
      `
      UPDATE component_metadata
      SET
        times_referenced += 1,
        last_referenced_at = time::now(),
        success_rate = math::mean([success_rate ?? 0, $success_indicator])
      WHERE component_id = $component_id
      `,
      {
        component_id: componentId,
        success_indicator: success ? 1.0 : 0.0,
      }
    );
  }
}
```

## Phase 2: Implementation Pattern Catalog

### New Database Schema

```sql
-- Catalog of known implementation patterns
DEFINE TABLE implementation_patterns SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id OR public = true
    FOR create, update, delete WHERE org_id = $auth.org_id AND $auth.role IN ['admin', 'owner'];

DEFINE FIELD org_id ON implementation_patterns TYPE string ASSERT $value != NONE;
DEFINE FIELD project_id ON implementation_patterns TYPE option<string>;
DEFINE FIELD pattern_id ON implementation_patterns TYPE string ASSERT $value != NONE;
DEFINE FIELD name ON implementation_patterns TYPE string ASSERT $value != NONE;
DEFINE FIELD category ON implementation_patterns TYPE string;  -- Same as intent.category

-- What goal does this pattern solve?
DEFINE FIELD solves_goal ON implementation_patterns TYPE string;
DEFINE FIELD goal_keywords ON implementation_patterns TYPE array<string>;

-- Pattern structure
DEFINE FIELD components ON implementation_patterns TYPE array<string>;  -- Component IDs
DEFINE FIELD entry_point ON implementation_patterns TYPE string;        -- Main component ID
DEFINE FIELD graph_structure ON implementation_patterns TYPE object;    -- Subgraph representation

-- Embeddings
DEFINE FIELD embedding ON implementation_patterns TYPE array<float>;
DEFINE FIELD embedding_model ON implementation_patterns TYPE string;

-- Learning metrics
DEFINE FIELD times_used ON implementation_patterns TYPE int DEFAULT 0;
DEFINE FIELD success_rate ON implementation_patterns TYPE float DEFAULT 0.5;
DEFINE FIELD avg_task_duration_ms ON implementation_patterns TYPE option<float>;
DEFINE FIELD last_used_at ON implementation_patterns TYPE option<datetime>;

-- Visibility
DEFINE FIELD public ON implementation_patterns TYPE bool DEFAULT false;
DEFINE FIELD source ON implementation_patterns TYPE string;  -- "extracted", "manual", "imported"

DEFINE FIELD created_at ON implementation_patterns TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON implementation_patterns TYPE datetime DEFAULT time::now();

-- Indexes
DEFINE INDEX idx_patterns_org_category ON implementation_patterns COLUMNS org_id, category;
DEFINE INDEX idx_patterns_success_rate ON implementation_patterns COLUMNS success_rate;
DEFINE INDEX idx_patterns_public ON implementation_patterns COLUMNS public;
```

### New Service: ImplementationCatalogService

```typescript
// repos/metabob-analysis-api/src/services/implementation-catalog-service.ts

export interface ImplementationPattern {
  org_id: string;
  project_id?: string;
  pattern_id: string;
  name: string;
  category: string;
  solves_goal: string;
  goal_keywords: string[];
  components: string[];  // Component IDs
  entry_point: string;
  graph_structure: object;
  embedding: number[];
  embedding_model: string;
  times_used: number;
  success_rate: number;
  avg_task_duration_ms?: number;
  last_used_at?: Date;
  public: boolean;
  source: 'extracted' | 'manual' | 'imported';
}

export class ImplementationCatalogService {
  constructor(
    private db: SurrealDBClient,
    private metadataService: ComponentMetadataService,
    private embeddingService: EmbeddingService
  ) {}

  /**
   * Extract a pattern from a successful activity execution
   */
  async extractPatternFromExecution(
    orgId: string,
    projectId: string | undefined,
    executionTrace: ActivityExecutionTrace
  ): Promise<ImplementationPattern | null> {
    // Only extract from successful executions
    if (executionTrace.status !== 'completed' || !executionTrace.success) {
      return null;
    }

    // Identify components modified/created in this execution
    const modifiedFiles = [
      ...executionTrace.stateTransition.filesModified,
      ...executionTrace.stateTransition.filesCreated,
    ];

    if (modifiedFiles.length === 0) {
      return null;
    }

    // Find components in these files
    const components = await this.metadataService.findByFiles(orgId, modifiedFiles);

    if (components.length === 0) {
      return null;
    }

    // Infer goal from activity name and description
    const goal = executionTrace.activityName || 'Unknown goal';
    const category = this.inferCategoryFromGoal(goal);

    // Generate pattern ID
    const patternId = `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate embedding
    const embedding = await this.embeddingService.generateEmbedding(
      `${goal} ${category} ${components.map(c => c.name).join(' ')}`
    );

    const pattern: ImplementationPattern = {
      org_id: orgId,
      project_id: projectId,
      pattern_id: patternId,
      name: `${category} pattern from ${executionTrace.activityName}`,
      category,
      solves_goal: goal,
      goal_keywords: this.extractKeywords(goal),
      components: components.map(c => c.component_id),
      entry_point: components[0]?.component_id || '',
      graph_structure: {}, // TODO: Extract subgraph
      embedding,
      embedding_model: 'onnx-v1',
      times_used: 0,
      success_rate: 0.5,
      public: false,
      source: 'extracted',
    };

    await this.db.create('implementation_patterns', pattern);

    return pattern;
  }

  /**
   * Find patterns that solve a given goal
   */
  async findPatternsForGoal(
    orgId: string,
    goalDescription: string,
    limit: number = 5
  ): Promise<ImplementationPattern[]> {
    const queryEmbedding = await this.embeddingService.generateEmbedding(goalDescription);

    const results = await this.db.query<ImplementationPattern[]>(
      `
      SELECT * FROM implementation_patterns
      WHERE org_id = $org_id OR public = true
      ORDER BY
        vector::similarity::cosine(embedding, $query_embedding) DESC,
        success_rate DESC,
        times_used DESC
      LIMIT $limit
      `,
      {
        org_id: orgId,
        query_embedding: queryEmbedding,
        limit,
      }
    );

    return results[0].result || [];
  }

  /**
   * Track pattern usage from activity execution
   */
  async trackPatternUsage(
    patternId: string,
    success: boolean,
    durationMs: number
  ): Promise<void> {
    await this.db.query(
      `
      UPDATE implementation_patterns
      SET
        times_used += 1,
        success_rate = math::mean([success_rate, $success_indicator]),
        avg_task_duration_ms = math::mean([avg_task_duration_ms ?? $duration_ms, $duration_ms]),
        last_used_at = time::now()
      WHERE pattern_id = $pattern_id
      `,
      {
        pattern_id: patternId,
        success_indicator: success ? 1.0 : 0.0,
        duration_ms: durationMs,
      }
    );
  }

  private inferCategoryFromGoal(goal: string): string {
    const lower = goal.toLowerCase();
    if (lower.includes('rate limit') || lower.includes('throttle')) return 'rate_limiting';
    if (lower.includes('cache') || lower.includes('memoize')) return 'caching';
    if (lower.includes('auth') || lower.includes('login')) return 'auth';
    if (lower.includes('validate') || lower.includes('check')) return 'validation';
    if (lower.includes('circuit') || lower.includes('resilience')) return 'resilience';
    return 'general';
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10);
  }
}
```

## Phase 3: New Impulse Types

```typescript
// New impulse pointer types for code understanding

interface CodeComponentImpulse extends BaseImpulse {
  pointer: {
    type: 'codeComponent';
    component_id: string;
    include_dependencies?: boolean;  // Include depends_on components
    include_dependents?: boolean;    // Include depended_by components
  };
}

interface ImplementationPatternImpulse extends BaseImpulse {
  pointer: {
    type: 'implementationPattern';
    pattern_id: string;
    include_components?: boolean;  // Load component source code
    include_graph?: boolean;       // Include graph structure
  };
}

interface CodeGraphImpulse extends BaseImpulse {
  pointer: {
    type: 'codeGraph';
    query: string;  // Cypher-like query or predefined query name
    max_depth?: number;
    node_filters?: {
      component_type?: string[];
      intent_category?: string[];
    };
  };
}
```

## Phase 4: New MCP Tools

```typescript
// repos/metabob-mcp/src/tools/index-codebase.ts

export const IndexCodebaseTool = {
  name: 'index_codebase',
  description: 'Index codebase files to enable similarity search and intent discovery',
  inputSchema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['path', 'content'],
        },
        description: 'Files to index with their contents',
      },
      progressive: {
        type: 'boolean',
        description: 'Only index changed files (hash-based)',
        default: true,
      },
    },
    required: ['files'],
  },
  handler: async (input, apiClient, sessionId) => {
    const response = await apiClient.post('/v2/analysis/index', {
      session_id: sessionId,
      files: input.files,
      progressive: input.progressive ?? true,
      extract_metadata: true,  // NEW: Extract intent/outcome
    });

    return `Indexed ${response.indexed} files, ${response.components} components found. ${response.metadata_extracted} components analyzed for intent.`;
  },
};
```

```typescript
// repos/metabob-mcp/src/tools/find-similar-implementations.ts

export const FindSimilarImplementationsTool = {
  name: 'find_similar_implementations',
  description: 'Find similar code implementations by intent, outcome, or pattern',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'What you want to implement (e.g., "rate limiting with Redis")',
      },
      search_by: {
        type: 'string',
        enum: ['intent', 'pattern', 'outcome'],
        description: 'Search by intent (what code does), pattern (how it\'s structured), or outcome (what it produces)',
        default: 'intent',
      },
      category: {
        type: 'string',
        description: 'Optional category filter (rate_limiting, caching, auth, validation, resilience)',
      },
      include_code: {
        type: 'boolean',
        description: 'Include full source code in results',
        default: false,
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return',
        default: 5,
      },
    },
    required: ['query'],
  },
  handler: async (input, apiClient, sessionId) => {
    const response = await apiClient.post('/v2/analysis/similar-implementations', {
      session_id: sessionId,
      query: input.query,
      search_by: input.search_by || 'intent',
      category: input.category,
      include_code: input.include_code ?? false,
      limit: input.limit || 5,
    });

    // Format results
    const results = response.results.map((r: any) => ({
      component: r.name,
      file: r.file_path,
      intent: r.intent.description,
      category: r.intent.category,
      similarity: r.similarity_score,
      success_rate: r.success_rate,
      times_used: r.times_referenced,
    }));

    return JSON.stringify({
      query: input.query,
      found: results.length,
      results,
    }, null, 2);
  },
};
```

```typescript
// repos/metabob-mcp/src/tools/get-component-intent.ts

export const GetComponentIntentTool = {
  name: 'get_component_intent',
  description: 'Get the inferred intent and outcome of a code component',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to file containing the component',
      },
      component_name: {
        type: 'string',
        description: 'Name of function/class/method',
      },
    },
    required: ['file_path'],
  },
  handler: async (input, apiClient, sessionId) => {
    const response = await apiClient.get('/v2/analysis/component-intent', {
      session_id: sessionId,
      file_path: input.file_path,
      component_name: input.component_name,
    });

    return JSON.stringify({
      component: response.name,
      type: response.component_type,
      intent: {
        description: response.intent.description,
        category: response.intent.category,
        keywords: response.intent.keywords,
        confidence: response.intent.confidence,
      },
      outcome: response.outcome,
      dependencies: response.depends_on,
      dependents: response.depended_by,
      complexity: response.complexity_score,
      usage_stats: {
        times_referenced: response.times_referenced,
        success_rate: response.success_rate,
      },
    }, null, 2);
  },
};
```

## Phase 5: Integration with Activity System

### Activity References Code Impulses

```typescript
// Example activity that uses code component impulses

{
  "id": "implement_rate_limiting",
  "name": "Implement Rate Limiting",
  "category": "feature",
  "impulses": [
    {
      "id": "similar_rate_limiters",
      "pointer": {
        "type": "codeComponent",
        "query": "rate limiting with sliding window",
        "category": "rate_limiting",
        "limit": 3
      },
      "budget": 3000,
      "priority": "high"
    },
    {
      "id": "rate_limiting_pattern",
      "pointer": {
        "type": "implementationPattern",
        "pattern_query": "rate limiting with Redis",
        "include_components": true
      },
      "budget": 5000,
      "priority": "high"
    }
  ],
  "tasks": [
    {
      "id": "analyze_existing",
      "description": "Analyze similar rate limiting implementations",
      "prompt": {
        "template": "Review these existing rate limiting implementations:\n\n{{impulse:similar_rate_limiters}}\n\nSummarize the approaches used.",
        "variables": []
      }
    },
    {
      "id": "implement",
      "description": "Implement rate limiting following the pattern",
      "prompt": {
        "template": "Using this proven pattern:\n\n{{impulse:rate_limiting_pattern}}\n\nImplement rate limiting for {{endpoint}}",
        "variables": [
          { "name": "endpoint", "type": "string" }
        ]
      }
    }
  ]
}
```

### Resolver in metabob-analysis-api

```typescript
// repos/metabob-analysis-api/src/routes/impulses.ts

router.post('/v2/impulses/resolve', async (c) => {
  const impulse = await c.req.json();
  const { org_id } = c.get('scope');

  // Resolve codeComponent impulses
  if (impulse.pointer.type === 'codeComponent') {
    const metadata = impulse.pointer.component_id
      ? await metadataService.getById(impulse.pointer.component_id)
      : await metadataService.findSimilarByIntent(
          org_id,
          impulse.pointer.query,
          impulse.pointer.limit || 5
        );

    return c.json({
      impulse_id: impulse.id,
      loaded: true,
      content: formatComponentMetadata(metadata),
      tokens_used: estimateTokens(metadata),
    });
  }

  // Resolve implementationPattern impulses
  if (impulse.pointer.type === 'implementationPattern') {
    const pattern = await catalogService.findPatternsForGoal(
      org_id,
      impulse.pointer.pattern_query,
      1
    );

    return c.json({
      impulse_id: impulse.id,
      loaded: true,
      content: formatPattern(pattern[0]),
      tokens_used: estimateTokens(pattern[0]),
    });
  }

  // Resolve codeGraph impulses
  if (impulse.pointer.type === 'codeGraph') {
    const graph = await graphQueryService.executeQuery(
      org_id,
      impulse.pointer.query,
      impulse.pointer
    );

    return c.json({
      impulse_id: impulse.id,
      loaded: true,
      content: formatGraph(graph),
      tokens_used: estimateTokens(graph),
    });
  }

  return c.json({ error: 'Unknown impulse type' }, 400);
});
```

## Implementation Roadmap

### Phase 1: Component Metadata (Week 1-2)
- [ ] Add `component_metadata` table schema
- [ ] Implement `ComponentMetadataService`
- [ ] Add heuristic-based intent extraction
- [ ] Integrate with existing `/v2/analysis/index` endpoint
- [ ] Add `find_similar_implementations` MCP tool
- [ ] Add `get_component_intent` MCP tool

### Phase 2: Pattern Catalog (Week 3-4)
- [ ] Add `implementation_patterns` table schema
- [ ] Implement `ImplementationCatalogService`
- [ ] Extract patterns from successful activity executions
- [ ] Add pattern search by goal
- [ ] Track pattern usage and success rates

### Phase 3: Impulse Integration (Week 5)
- [ ] Add new impulse types to metabob-activity-api
- [ ] Implement impulse resolvers in metabob-analysis-api
- [ ] Update MiniBob to handle new impulse types
- [ ] Create example activities using code impulses

### Phase 4: Graph Queries (Week 6)
- [ ] Implement `GraphQueryService`
- [ ] Add Cypher-like query language
- [ ] Support common patterns (all factories, all rate limiters)
- [ ] Add `query_code_graph` MCP tool

### Phase 5: Learning Loop (Week 7-8)
- [ ] Track which components are referenced in activities
- [ ] Update success rates based on activity outcomes
- [ ] Thompson Sampling for pattern recommendation
- [ ] Dashboard visualization for pattern performance

## Success Metrics

1. **Coverage**: % of codebase components with intent metadata
2. **Confidence**: Average confidence score of intent extraction
3. **Pattern Discovery**: Number of patterns extracted from executions
4. **Pattern Reuse**: % of activities that reference existing patterns
5. **Success Rate Improvement**: Do activities using patterns succeed more often?
6. **Search Quality**: Relevance of similar implementation results

## Alignment with Foundation

This design follows all key principles:

✅ **Impulses Are Universal Data**: Code components and patterns are impulses with metadata
✅ **Resolvers Live Where Data Lives**: metabob-analysis-api resolves code impulses (it has the CPG)
✅ **Metadata First, Content Later**: Reasoners see intent/outcome, resolvers load full source
✅ **Activities Constrain Search**: Activities reference specific components/patterns as impulses
✅ **Record Everything**: Component usage and pattern success tracked in learning loop
✅ **Learn From Traces**: Pattern extraction from successful executions, Thompson Sampling for recommendations
✅ **Backend is Flexible**: New impulse types added without MiniBob code changes
✅ **LLMs Are Tools, Not Controllers**: LLM used only for low-confidence intent extraction

## Example User Workflow

1. **User asks**: "How do I implement rate limiting?"

2. **metabob-mcp finds similar implementations**:
   ```
   find_similar_implementations("rate limiting with sliding window")
   ```

3. **metabob-analysis-api returns**:
   - 3 components with `rate_limiting` intent
   - Intent descriptions, confidence scores
   - Success rates from past usage
   - Dependencies and outcomes

4. **User reviews** intent and picks one

5. **Activity executes** with impulse reference to chosen component

6. **Learning loop**:
   - Component usage tracked
   - If successful, success rate increases
   - Pattern extracted for reuse

7. **Next time**: Thompson Sampling recommends the best pattern first

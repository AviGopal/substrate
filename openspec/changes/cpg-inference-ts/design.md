# cpg-inference-ts - Design Document

**Status:** Draft
**Created:** 2026-03-23
**Last Updated:** 2026-03-23

---

## Overview

TypeScript port of the `cpg-inference` Python library, providing Code Property Graph (CPG) construction, embedding-based similarity search, and co-change prediction capabilities. This is a standalone NPM library consumed by `metabob-analysis-api`.

**Technology Stack:**
- TypeScript + Bun
- tree-sitter (multi-language parsing)
- ONNX Runtime (embedding model)
- FAISS (vector similarity search)

**Size:** ~4,000-6,000 LOC

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  cpg-inference-ts (NPM Library)              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              CoChangePredictor (Main API)              │ │
│  │  - addFile(path, content)                              │ │
│  │  - updateFile(path, content)                           │ │
│  │  - analyzeChangeImpact(componentIds, maxDepth)         │ │
│  │  - predictCochanges(files)                             │ │
│  └───────────────┬─────────────────────┬──────────────────┘ │
│                  │                     │                    │
│     ┌────────────┴────────┐  ┌─────────┴────────────┐      │
│     │                     │  │                      │      │
│  ┌──▼────────────────┐ ┌──▼──────────────────┐ ┌───▼────┐ │
│  │ CodePropertyGraph │ │ ONNXEmbeddingModel  │ │ FAISS  │ │
│  │                   │ │                     │ │ Index  │ │
│  │ - Graph structure │ │ - 69KB GCN model    │ │        │ │
│  │ - Query engine    │ │ - Float32Array ops  │ │ - ANN  │ │
│  │ - Traversal       │ │ - Batch inference   │ │ search │ │
│  └──┬────────────────┘ └─────────────────────┘ └────────┘ │
│     │                                                       │
│  ┌──▼────────────────────────────────────────────────────┐ │
│  │              ParserRegistry                           │ │
│  │  - TypeScriptParser (tree-sitter-typescript)          │ │
│  │  - JavaScriptParser (tree-sitter-javascript)          │ │
│  │  - PythonParser (tree-sitter-python)                  │ │
│  │  - JavaParser (tree-sitter-java)                      │ │
│  │  - CppParser (tree-sitter-cpp)                        │ │
│  └───────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                          │
                          │ Used by
                          ▼
             ┌─────────────────────────┐
             │ metabob-analysis-api    │
             │ (HTTP backend)          │
             └─────────────────────────┘
```

---

## Directory Structure

```
repos/cpg-inference-ts/
├── src/
│   ├── index.ts                    # Public API exports
│   ├── predictor.ts                # CoChangePredictor class
│   ├── graph/
│   │   ├── cpg.ts                  # CodePropertyGraph class
│   │   ├── query-engine.ts         # GraphQueryEngine class
│   │   ├── traversal.ts            # Graph traversal algorithms
│   │   └── types.ts                # Component, Edge types
│   ├── parsers/
│   │   ├── registry.ts             # ParserRegistry
│   │   ├── typescript-parser.ts
│   │   ├── javascript-parser.ts
│   │   ├── python-parser.ts
│   │   ├── java-parser.ts
│   │   └── cpp-parser.ts
│   ├── embeddings/
│   │   ├── onnx-model.ts           # ONNXEmbeddingModel class
│   │   ├── faiss-index.ts          # FAISSIndex wrapper
│   │   └── models/
│   │       └── default.onnx        # Bundled 69KB GCN model
│   ├── storage/
│   │   ├── interface.ts            # Storage interface
│   │   ├── sqlite-storage.ts       # SQLiteStorage implementation
│   │   ├── redis-storage.ts        # RedisStorage implementation
│   │   └── memory-storage.ts       # In-memory (testing)
│   └── utils/
│       ├── logger.ts
│       └── model-info.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/                   # Sample codebases for testing
├── benchmarks/
│   └── performance.test.ts         # Performance benchmarks vs Python
├── package.json
├── tsconfig.json
└── README.md
```

---

## Key Classes and Interfaces

### 1. CoChangePredictor (Main API)

```typescript
export class CoChangePredictor {
  private cpg: CodePropertyGraph;
  private embeddingModel: ONNXEmbeddingModel;
  private faissIndex: FAISSIndex;
  private parserRegistry: ParserRegistry;
  private storage?: Storage;

  constructor(config: PredictorConfig);

  // File operations
  async addFile(filePath: string, content: string): Promise<AddFileResult>;
  async updateFile(filePath: string, content: string): Promise<UpdateFileResult>;
  async removeFile(filePath: string): Promise<RemoveFileResult>;

  // Analysis operations
  async analyzeChangeImpact(
    componentIds: string[],
    maxDepth: number
  ): Promise<ImpactAnalysis>;

  async predictCochanges(
    changedFiles: string[],
    k: number
  ): Promise<CochangePrediction[]>;

  // Graph access
  getCPG(): CodePropertyGraph;
  getComponent(componentId: string): Component | null;

  // Persistence
  async save(): Promise<void>;
  async load(): Promise<void>;
}

export interface PredictorConfig {
  modelPath?: string;           // Path to ONNX model (default: bundled)
  faissIndexType?: 'flat' | 'ivf';  // FAISS index type
  storage?: Storage;            // Optional persistence
  enableCache?: boolean;        // Cache embeddings
  parserLanguages?: string[];   // Languages to support
}
```

### 2. CodePropertyGraph

```typescript
export class CodePropertyGraph {
  private nodes: Map<string, Component>;
  private edges: Map<string, Edge[]>;
  private fileIndex: Map<string, Set<string>>;  // file → component IDs

  // Graph construction
  addNode(component: Component): void;
  removeNode(componentId: string): void;
  updateNode(component: Component): void;

  addEdge(edge: Edge): void;
  removeEdge(edgeId: string): void;

  // Graph queries
  getNode(componentId: string): Component | null;
  getComponentsByFile(filePath: string): Component[];
  getEdges(componentId: string, direction: 'in' | 'out' | 'both'): Edge[];

  // Traversal
  traverse(
    startIds: string[],
    direction: 'forward' | 'backward' | 'both',
    maxDepth: number,
    filter?: EdgeFilter
  ): Component[];

  // Serialization
  serialize(): SerializedGraph;
  static deserialize(data: SerializedGraph): CodePropertyGraph;
}

export interface Component {
  id: string;              // e.g., "src/auth.ts::login"
  name: string;            // e.g., "login"
  type: ComponentType;     // "function" | "class" | "variable" | ...
  filePath: string;
  startLine: number;
  endLine: number;
  metadata: Record<string, unknown>;
}

export interface Edge {
  id: string;
  source: string;          // Component ID
  target: string;          // Component ID
  type: EdgeType;          // "calls" | "imports" | "contains" | "dataflow"
  weight?: number;
}

export type ComponentType =
  | 'function'
  | 'class'
  | 'method'
  | 'variable'
  | 'module'
  | 'type';

export type EdgeType =
  | 'calls'
  | 'imports'
  | 'contains'
  | 'dataflow'
  | 'inheritance'
  | 'implements';
```

### 3. ONNXEmbeddingModel

```typescript
export class ONNXEmbeddingModel {
  private session: InferenceSession;
  private tokenizer: Tokenizer;
  private embeddingDim: number = 768;

  constructor(modelPath: string);

  async initialize(): Promise<void>;

  async generateEmbedding(text: string): Promise<Float32Array>;

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]>;

  // Utility methods
  cosineSimilarity(a: Float32Array, b: Float32Array): number;
  averageEmbeddings(embeddings: Float32Array[]): Float32Array;
}
```

### 4. FAISSIndex

```typescript
export class FAISSIndex {
  private index: faiss.Index;
  private idMap: Map<number, string>;  // FAISS internal ID → component ID
  private dimension: number;

  constructor(dimension: number, indexType: 'flat' | 'ivf' = 'flat');

  async add(componentId: string, embedding: Float32Array): Promise<void>;

  async search(
    query: Float32Array,
    k: number
  ): Promise<SimilarityResult[]>;

  async remove(componentId: string): Promise<void>;

  // Persistence
  serialize(): Buffer;
  static deserialize(data: Buffer): FAISSIndex;
}

export interface SimilarityResult {
  id: string;              // Component ID
  distance: number;        // L2 distance
  similarity: number;      // Cosine similarity (1 - distance/2)
}
```

### 5. ParserRegistry

```typescript
export class ParserRegistry {
  private parsers: Map<string, LanguageParser>;

  constructor(languages?: string[]);

  getParser(filePath: string): LanguageParser | null;

  async parseFile(filePath: string, content: string): Promise<ParseResult>;
}

export interface LanguageParser {
  language: string;
  extensions: string[];

  parse(content: string): Promise<ParseResult>;
}

export interface ParseResult {
  components: Component[];
  edges: Edge[];
  parseErrors: ParseError[];
}
```

---

## Critical Algorithms

### 1. Progressive File Update

**Purpose:** Incrementally update CPG when files change without rebuilding entire graph.

```typescript
async updateFile(filePath: string, content: string): Promise<UpdateFileResult> {
  const start = performance.now();

  // 1. Parse new file
  const parseResult = await this.parserRegistry.parseFile(filePath, content);

  // 2. Find existing components for this file
  const existingComponents = this.cpg.getComponentsByFile(filePath);

  // 3. Compute diff
  const { added, removed, modified } = this.computeComponentDiff(
    existingComponents,
    parseResult.components
  );

  // 4. Update graph nodes
  for (const component of removed) {
    this.cpg.removeNode(component.id);
  }
  for (const component of added) {
    this.cpg.addNode(component);
  }
  for (const component of modified) {
    this.cpg.updateNode(component);
  }

  // 5. Re-link edges for this file
  await this.relinkEdges(filePath, parseResult.edges);

  // 6. Update embeddings for changed components
  await this.updateEmbeddings(added.concat(modified));

  const duration = performance.now() - start;

  return {
    filePath,
    added: added.length,
    removed: removed.length,
    modified: modified.length,
    duration
  };
}

private computeComponentDiff(
  existing: Component[],
  updated: Component[]
): ComponentDiff {
  const existingMap = new Map(existing.map(c => [c.id, c]));
  const updatedMap = new Map(updated.map(c => [c.id, c]));

  const added: Component[] = [];
  const removed: Component[] = [];
  const modified: Component[] = [];

  // Find removed
  for (const [id, component] of existingMap) {
    if (!updatedMap.has(id)) {
      removed.push(component);
    }
  }

  // Find added and modified
  for (const [id, component] of updatedMap) {
    if (!existingMap.has(id)) {
      added.push(component);
    } else if (hasChanged(existingMap.get(id)!, component)) {
      modified.push(component);
    }
  }

  return { added, removed, modified };
}
```

### 2. Impact Analysis (CPG Traversal)

**Purpose:** Find all components affected by changes (forward dependencies) and all components that depend on changes (backward dependencies).

```typescript
async analyzeChangeImpact(
  componentIds: string[],
  maxDepth: number
): Promise<ImpactAnalysis> {
  // Forward traversal (what these components depend on)
  const graphForward = this.cpg.traverse(
    componentIds,
    'forward',
    maxDepth,
    (node, edge) => edge.type !== 'contains' // Skip structural edges
  );

  // Backward traversal (what depends on these components)
  const graphBackward = this.cpg.traverse(
    componentIds,
    'backward',
    maxDepth,
    (node, edge) => edge.type !== 'contains'
  );

  // Embedding similarity (find semantically similar components)
  const embeddings = await Promise.all(
    componentIds.map(id => this.getComponentEmbedding(id))
  );
  const avgEmbedding = this.embeddingModel.averageEmbeddings(embeddings);
  const similar = await this.faissIndex.search(avgEmbedding, 20);

  // Filter out components already in graph traversal
  const allGraphIds = new Set([
    ...graphForward.map(n => n.id),
    ...graphBackward.map(n => n.id)
  ]);
  const embeddingSimilar = similar.filter(s => !allGraphIds.has(s.id));

  return {
    directDependencies: graphForward,
    directDependents: graphBackward,
    semanticallySimilar: embeddingSimilar,
    totalImpactScore: this.computeImpactScore(
      graphForward.length,
      graphBackward.length,
      embeddingSimilar.length
    )
  };
}
```

### 3. Graph Traversal (BFS with Filtering)

```typescript
traverse(
  startIds: string[],
  direction: 'forward' | 'backward' | 'both',
  maxDepth: number,
  filter?: EdgeFilter
): Component[] {
  const visited = new Set<string>();
  const result: Component[] = [];
  const queue: Array<{ id: string; depth: number }> = startIds.map(id => ({
    id,
    depth: 0
  }));

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;

    if (visited.has(id) || depth > maxDepth) {
      continue;
    }

    visited.add(id);
    const component = this.getNode(id);
    if (component) {
      result.push(component);
    }

    // Get edges based on direction
    const edges = this.getEdges(id, direction === 'forward' ? 'out' : 'in');

    // Apply filter if provided
    const filteredEdges = filter
      ? edges.filter(edge => filter(component!, edge))
      : edges;

    // Add neighbors to queue
    for (const edge of filteredEdges) {
      const nextId = direction === 'forward' ? edge.target : edge.source;
      if (!visited.has(nextId)) {
        queue.push({ id: nextId, depth: depth + 1 });
      }
    }
  }

  return result;
}
```

---

## Python → TypeScript Translation Strategy

| Python Component | TypeScript Component | Translation Notes |
|------------------|---------------------|-------------------|
| `cpg_inference/predictor.py` | `src/predictor.ts` | Main API class |
| `cpg_inference/graph.py` | `src/graph/cpg.ts` | Replace NetworkX with custom adjacency lists |
| `cpg_inference/parsers/*.py` | `src/parsers/*.ts` | Use tree-sitter WASM bindings |
| `cpg_inference/embeddings.py` | `src/embeddings/onnx-model.ts` | ONNX Runtime JS |
| `cpg_inference/faiss_index.py` | `src/embeddings/faiss-index.ts` | faiss-node bindings |
| `networkx` graphs | Native adjacency lists | Simpler, faster for our use case |
| `numpy` arrays | `Float32Array` | TypedArrays native to JS |
| Synchronous operations | Async/await | All I/O operations return Promises |
| Exception handling | Custom error classes | `CPGError`, `ParseError`, etc. |

**Key Translation Decisions:**

1. **Graph Storage:** Custom adjacency list implementation instead of NetworkX
   - Faster lookups for our access patterns
   - Smaller memory footprint
   - Native TypeScript types

2. **Vector Storage:** Float32Array instead of numpy arrays
   - Native TypeScript support
   - Fast SIMD operations in modern JS engines
   - Compatible with ONNX Runtime

3. **Async Operations:** All I/O returns Promises
   - Tree-sitter parsing (WASM loading)
   - ONNX inference
   - FAISS index operations
   - Storage operations

4. **Error Handling:** Custom error class hierarchy
   ```typescript
   class CPGError extends Error {
     constructor(message: string, public code: string) {
       super(message);
     }
   }

   class ParseError extends CPGError {}
   class EmbeddingError extends CPGError {}
   class StorageError extends CPGError {}
   ```

---

## Storage Interface

```typescript
export interface Storage {
  save(key: string, data: SerializedGraph): Promise<void>;
  load(key: string): Promise<SerializedGraph | null>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}

export interface SerializedGraph {
  version: string;
  timestamp: number;
  nodes: Component[];
  edges: Edge[];
  fileIndex: Record<string, string[]>;
  faissIndex?: Buffer;  // Serialized FAISS index
}
```

**Implementations:**

1. **MemoryStorage:** In-memory only (testing)
2. **SQLiteStorage:** Local filesystem persistence
3. **RedisStorage:** Distributed cache integration

---

## Performance Targets

| Operation | Target P50 | Target P99 | Notes |
|-----------|-----------|-----------|-------|
| Parse file (1000 LOC) | <50ms | <100ms | Tree-sitter |
| Update CPG (1 file) | <100ms | <200ms | Progressive diff |
| Impact analysis (depth 3) | <15ms | <50ms | Graph traversal |
| Embedding generation | <10ms | <30ms | ONNX inference |
| FAISS search (10K index) | <5ms | <15ms | Approximate NN |
| Add file to CPG | <150ms | <300ms | Parse + embed + index |
| Serialize CPG (10K nodes) | <50ms | <100ms | JSON serialization |
| Deserialize CPG | <100ms | <200ms | JSON parse + index rebuild |

---

## Testing Strategy

### Unit Tests

```typescript
// Example: CPG progressive update test
test('updateFile should correctly diff components', async () => {
  const predictor = new CoChangePredictor(config);

  // Initial add
  await predictor.addFile('test.ts', 'function foo() {}');
  expect(predictor.getCPG().getNode('test.ts::foo')).toBeTruthy();

  // Update (add new function)
  await predictor.updateFile('test.ts', 'function foo() {}\nfunction bar() {}');
  expect(predictor.getCPG().getNode('test.ts::bar')).toBeTruthy();

  // Update (remove function)
  await predictor.updateFile('test.ts', 'function bar() {}');
  expect(predictor.getCPG().getNode('test.ts::foo')).toBeNull();
});

// Example: Embedding generation test
test('generateEmbedding should produce normalized vectors', async () => {
  const model = new ONNXEmbeddingModel('./models/default.onnx');
  await model.initialize();

  const embedding = await model.generateEmbedding('function test() {}');

  expect(embedding).toBeInstanceOf(Float32Array);
  expect(embedding.length).toBe(768);
  expect(Math.abs(norm(embedding) - 1.0)).toBeLessThan(0.01); // Normalized
});

// Example: Graph traversal test
test('traverse should respect maxDepth parameter', () => {
  const cpg = new CodePropertyGraph();
  // Build chain: A → B → C → D
  cpg.addNode({ id: 'A', name: 'A', type: 'function', ... });
  cpg.addNode({ id: 'B', name: 'B', type: 'function', ... });
  cpg.addNode({ id: 'C', name: 'C', type: 'function', ... });
  cpg.addNode({ id: 'D', name: 'D', type: 'function', ... });
  cpg.addEdge({ id: 'AB', source: 'A', target: 'B', type: 'calls' });
  cpg.addEdge({ id: 'BC', source: 'B', target: 'C', type: 'calls' });
  cpg.addEdge({ id: 'CD', source: 'C', target: 'D', type: 'calls' });

  const result = cpg.traverse(['A'], 'forward', 2);
  expect(result.map(c => c.id)).toEqual(['A', 'B', 'C']); // Stops at depth 2
});
```

### Integration Tests

```typescript
// Example: End-to-end impact analysis
test('analyzeChangeImpact returns comprehensive results', async () => {
  const predictor = new CoChangePredictor(config);

  // Add test files
  await predictor.addFile('auth.ts', `
    export function login(user: string) {
      return authenticate(user);
    }
  `);
  await predictor.addFile('db.ts', `
    export function authenticate(user: string) {
      return query('SELECT * FROM users WHERE name = ?', [user]);
    }
  `);

  const impact = await predictor.analyzeChangeImpact(['auth.ts::login'], 2);

  expect(impact.directDependencies).toContainEqual(
    expect.objectContaining({ id: 'db.ts::authenticate' })
  );
  expect(impact.totalImpactScore).toBeGreaterThan(0);
});
```

### Performance Benchmarks

```typescript
// Example: CPG traversal benchmark
benchmark('Impact analysis at depth 3', async () => {
  const predictor = await loadLargeCodebase(); // 10K components

  const start = performance.now();
  const impact = await predictor.analyzeChangeImpact(['src/core.ts::main'], 3);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(15); // Target: <15ms
  expect(impact.directDependencies.length).toBeGreaterThan(0);
});

// Benchmark vs Python baseline
benchmark('Compare with Python implementation', async () => {
  // Run same operation in both
  const tsResult = await tsPredictor.analyzeChangeImpact(['main'], 3);
  const pyResult = await runPythonVersion(['main'], 3);

  // Verify correctness
  expect(tsResult.directDependencies.length).toBe(pyResult.dependencies.length);

  // Verify performance (should be comparable or better)
  expect(tsResult.duration).toBeLessThanOrEqual(pyResult.duration * 1.2);
});
```

---

## Validation Criteria

**Phase 1 Success (Foundation):**
- ✅ All core classes implemented
- ✅ Tree-sitter parsers working for TypeScript, JavaScript, Python
- ✅ ONNX model loading and inference functional
- ✅ FAISS index add/search working
- ✅ Unit tests achieve >80% coverage

**Phase 2 Success (Feature Complete):**
- ✅ Progressive file update working
- ✅ Impact analysis produces correct results
- ✅ Co-change prediction functional
- ✅ Serialization/deserialization tested
- ✅ All performance targets met

**Phase 3 Success (Production Ready):**
- ✅ Integration tests pass
- ✅ Benchmarks show parity with Python
- ✅ Memory usage acceptable (<500MB for 10K components)
- ✅ Documentation complete
- ✅ Published to NPM

---

## Dependencies

```json
{
  "dependencies": {
    "tree-sitter": "^0.21.0",
    "tree-sitter-typescript": "^0.21.0",
    "tree-sitter-javascript": "^0.21.0",
    "tree-sitter-python": "^0.21.0",
    "tree-sitter-java": "^0.21.0",
    "tree-sitter-cpp": "^0.21.0",
    "onnxruntime-node": "^1.17.0",
    "faiss-node": "^0.5.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/node": "^20.11.0",
    "benchmark": "^2.1.4",
    "vitest": "^1.2.0"
  }
}
```

---

## References

- Python Source: `repos/cpg-inference/`
- Tree-sitter: https://tree-sitter.github.io/tree-sitter/
- ONNX Runtime: https://onnxruntime.ai/
- FAISS: https://github.com/facebookresearch/faiss
- Used by: `repos/metabob-analysis-api/`

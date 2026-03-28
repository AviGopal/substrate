# CPG Library Interface Specification

**Component:** cpg-inference-ts (TypeScript translation of repos/cpg-inference)
**Purpose:** Provide code analysis capabilities via tree-sitter parsing, CPG building, and ONNX embeddings

---

## Design Principles

1. **Stateless Library** - No knowledge of sessions/orgs/projects (caller manages state)
2. **Progressive Updates** - add/update/delete files incrementally without full rebuilds
3. **Multi-Language** - Tree-sitter parsers for TypeScript, JavaScript, Python, Java, C/C++
4. **Hybrid Analysis** - Graph traversal + semantic embeddings
5. **Performance** - Sub-second response times for typical queries

---

## Core API Surface

### CoChangePredictor

Main class for codebase analysis (translated from Python).

```typescript
class CoChangePredictor {
  constructor(config: InferenceConfig, projectRoot?: string);

  // File Operations (Progressive)
  addFile(filePath: string, content: string): Promise<AddFileResult>;
  updateFile(filePath: string, content: string): Promise<UpdateFileResult>;
  deleteFile(filePath: string): Promise<DeleteFileResult>;

  // Analysis
  analyzeChangeImpact(
    componentIds: string[],
    maxDepth: number
  ): Promise<ImpactAnalysis>;

  predictCochanges(
    changedFiles: string[],
    files: Record<string, string>,
    topK: number
  ): Promise<CochangePrediction[]>;

  // Graph Access
  queryGraph(): GraphQueryEngine;
  getCPG(): CodePropertyGraph;
  getStats(): CPGStats;

  // Embeddings
  getFileEmbedding(filePath: string): Promise<number[]>;
  getComponentEmbedding(componentId: string): Promise<number[]>;
  searchSimilar(embedding: number[], topK: number): Promise<SimilarityResult[]>;
}
```

### InferenceConfig

```typescript
interface InferenceConfig {
  modelPath: string;           // Path to ONNX model
  embeddingDim: number;        // 32 (from bundled model)
  storageBackend?: Storage;    // Optional: SQLite, Redis, in-memory
  languages?: string[];        // Default: all supported
  maxParseErrors?: number;     // Max parse errors before abort (default: 100)
}
```

### AddFileResult

```typescript
interface AddFileResult {
  filePath: string;
  components: Component[];     // Functions, classes extracted
  edges: Edge[];               // Relationships created
  parseErrors?: ParseError[];  // Non-fatal parse warnings
  duration: number;            // Parse time in ms
}

interface Component {
  id: string;                  // Format: "file.ts::ComponentName"
  type: "function" | "class" | "method" | "variable" | "import";
  name: string;
  startLine: number;
  endLine: number;
  metadata?: {
    params?: string[];
    returnType?: string;
    visibility?: "public" | "private" | "protected";
  };
}

interface Edge {
  from: string;                // Component ID
  to: string;                  // Component ID
  type: "calls" | "imports" | "inherits" | "data_flow" | "contains";
  metadata?: any;
}
```

### ImpactAnalysis

```typescript
interface ImpactAnalysis {
  graphForward: ImpactNode[];      // Dependencies (what this calls)
  graphBackward: ImpactNode[];     // Dependents (what calls this)
  embeddingSimilar: SimilarityNode[]; // Semantically similar components
}

interface ImpactNode {
  componentId: string;
  filePath: string;
  relationship: "calls" | "imports" | "inherits" | "data_flow";
  depth: number;                   // Distance from original component
  pathFromSource: string[];        // Chain of component IDs
}

interface SimilarityNode {
  componentId: string;
  filePath: string;
  similarity: number;              // 0-1 cosine similarity
  reason: string;                  // Why it's similar
}
```

### CochangePrediction

```typescript
interface CochangePrediction {
  filePath: string;
  embeddingSimilarity: number;     // 0-1 from FAISS
  affectedComponents: string[];    // Component IDs in this file
  confidence: number;              // Hybrid score (if frequency data available)
}
```

---

## GraphQueryEngine

Provides graph traversal and search (translated from Python).

```typescript
class GraphQueryEngine {
  // Traversal
  findCallers(nodeId: string): Promise<QueryResult[]>;
  findCallees(nodeId: string): Promise<QueryResult[]>;
  findDependencies(nodeId: string): Promise<QueryResult[]>;
  findDependents(nodeId: string): Promise<QueryResult[]>;

  // Search
  findPath(sourceId: string, targetId: string, maxDepth: number): Promise<string[] | null>;
  getNeighborhood(nodeId: string, depth: number): Promise<QueryResult[]>;
  findNodesByName(pattern: string, regex?: boolean): Promise<QueryResult[]>;
  findComponentsAtLine(filePath: string, lineNum: number): Promise<QueryResult[]>;

  // Analysis
  getImpactSet(nodeIds: string[], maxDepth: number): Promise<QueryResult[]>;
  getReverseImpactSet(nodeIds: string[], maxDepth: number): Promise<QueryResult[]>;
  getStats(): Promise<GraphStats>;

  // Existence checks
  hasComponent(componentId: string): Promise<boolean>;
  getComponent(componentId: string): Promise<Component | null>;
  getComponentsInFiles(filePaths: string[]): Promise<Component[]>;
}
```

### QueryResult

```typescript
interface QueryResult {
  componentId: string;
  filePath: string;
  componentType: string;
  name: string;
  startLine: number;
  endLine: number;
  metadata?: any;
}
```

### GraphStats

```typescript
interface GraphStats {
  totalFiles: number;
  totalComponents: number;
  totalEdges: number;
  componentsByType: Record<string, number>;
  edgesByType: Record<string, number>;
  averageDegree: number;
  maxDepth: number;
}
```

---

## CodePropertyGraph

Low-level graph access (mostly internal, exposed for advanced use).

```typescript
class CodePropertyGraph {
  // Node operations
  addNode(component: Component): void;
  removeNode(componentId: string): void;
  getNode(componentId: string): Component | null;
  hasNode(componentId: string): boolean;

  // Edge operations
  addEdge(from: string, to: string, type: EdgeType, metadata?: any): void;
  removeEdge(from: string, to: string, type: EdgeType): void;
  getEdges(componentId: string, direction: "in" | "out" | "both"): Edge[];

  // Traversal
  traverse(
    startIds: string[],
    direction: "forward" | "backward" | "both",
    maxDepth: number,
    filter?: (node: Component, edge: Edge) => boolean
  ): TraversalResult;

  // Serialization (for caching)
  toJSON(): string;
  static fromJSON(json: string): CodePropertyGraph;
}
```

---

## Embedding Operations

### ONNXEmbeddingModel

Wraps ONNX runtime for code embeddings.

```typescript
class ONNXEmbeddingModel {
  constructor(modelPath: string);

  // Generate embedding for code text
  async generateEmbedding(code: string): Promise<number[]>;

  // Batch embeddings (more efficient)
  async generateBatchEmbeddings(codes: string[]): Promise<number[][]>;

  // Model info
  getEmbeddingDim(): number;
  getModelVersion(): string;
}
```

### FAISSIndex

Wrapper for FAISS vector similarity search.

```typescript
class FAISSIndex {
  constructor(dimension: number);

  // Index operations
  async add(id: string, embedding: number[]): Promise<void>;
  async addBatch(items: Array<{ id: string; embedding: number[] }>): Promise<void>;
  async remove(id: string): Promise<void>;

  // Search
  async search(queryEmbedding: number[], k: number): Promise<SearchResult[]>;

  // Persistence
  async save(path: string): Promise<void>;
  static async load(path: string): Promise<FAISSIndex>;

  // Stats
  size(): number;
  getDimension(): number;
}

interface SearchResult {
  id: string;                  // Component/file ID
  similarity: number;          // 0-1 cosine similarity
  distance: number;            // L2 distance
}
```

---

## Storage Backends

Optional persistent storage for components (translated from Python).

### Storage Interface

```typescript
interface Storage {
  // Component CRUD
  saveComponent(component: Component): Promise<void>;
  getComponent(componentId: string): Promise<Component | null>;
  deleteComponent(componentId: string): Promise<void>;
  listComponents(): Promise<Component[]>;

  // Batch operations
  saveBatch(components: Component[]): Promise<void>;
  deleteBatch(componentIds: string[]): Promise<void>;

  // Edges
  saveEdge(edge: Edge): Promise<void>;
  getEdges(componentId: string): Promise<Edge[]>;
  deleteEdges(componentId: string): Promise<void>;

  // Metadata
  getStats(): Promise<StorageStats>;
  clear(): Promise<void>;
}
```

### SQLiteStorage

```typescript
class SQLiteStorage implements Storage {
  constructor(dbPath: string); // ":memory:" for in-memory

  // Storage interface implementation
  // ... (same methods as Storage)

  // SQLite-specific
  async vacuum(): Promise<void>;
  async getDbSize(): Promise<number>;
}
```

### RedisStorage

```typescript
class RedisStorage implements Storage {
  constructor(config: { host: string; port: number; db?: number });

  // Storage interface implementation
  // ... (same methods as Storage)

  // Redis-specific
  async setTTL(componentId: string, seconds: number): Promise<void>;
  async getClient(): Promise<RedisClient>;
}
```

---

## Utility Functions

### get_model_path

```typescript
function getModelPath(modelName: "default" | string): string;
```

Returns path to bundled ONNX model (69KB GCN trained on multi-language codebases).

### get_model_info

```typescript
interface ModelInfo {
  name: string;
  version: string;
  embeddingDim: number;
  architecture: string;
  trainingDataset: string;
  performance: {
    auc: number;
    latency_p50_ms: number;
    latency_p99_ms: number;
  };
}

function getModelInfo(modelName: "default" | string): ModelInfo;
```

---

## Parser Integration

### Tree-sitter Language Support

```typescript
enum Language {
  TypeScript = "typescript",
  JavaScript = "javascript",
  Python = "python",
  Java = "java",
  CPP = "cpp",
  C = "c",
  Ruby = "ruby",
  PHP = "php",
  Go = "go",
  Rust = "rust"
}

function getSupportedLanguages(): Language[];
function detectLanguage(filePath: string): Language | null;
```

### ParserRegistry

```typescript
class ParserRegistry {
  static registerParser(language: Language, parser: TreeSitterParser): void;
  static getParser(language: Language): TreeSitterParser | null;
  static parseFile(filePath: string, content: string): ParseResult;
}

interface ParseResult {
  components: Component[];
  edges: Edge[];
  errors: ParseError[];
  metadata: {
    language: Language;
    parseTime: number;
    loc: number;
  };
}

interface ParseError {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}
```

---

## Error Handling

### CPGError

```typescript
class CPGError extends Error {
  code: string;
  details?: any;
}

class ParseError extends CPGError {
  filePath: string;
  line: number;
  column: number;
}

class ComponentNotFoundError extends CPGError {
  componentId: string;
}

class UnsupportedLanguageError extends CPGError {
  language: string;
  supportedLanguages: Language[];
}
```

---

## Performance Characteristics

| Operation | Python (baseline) | TypeScript (target) | Notes |
|-----------|-------------------|---------------------|-------|
| Parse file (1000 LOC) | ~50ms | <50ms | Tree-sitter binding overhead |
| Update file (CPG merge) | ~100ms | <100ms | Graph mutation |
| Impact analysis (depth 3) | ~10ms | <15ms | Traversal + JSON serialization |
| Embedding generation | ~5ms | <10ms | ONNX.js overhead |
| FAISS search (10K index) | ~2ms | <5ms | Node.js binding overhead |
| Predict co-changes | ~30ms | <40ms | Embedding + search combined |

---

## Translation Checklist

Python `repos/cpg-inference` → TypeScript `cpg-inference-ts`

### Core Components

- [ ] `CoChangePredictor` class
  - [ ] `add_file()` → `addFile()`
  - [ ] `update_file()` → `updateFile()`
  - [ ] `delete_file()` → `deleteFile()`
  - [ ] `analyze_change_impact()` → `analyzeChangeImpact()`
  - [ ] `predict_cochanges()` → `predictCochanges()`
  - [ ] `query_graph()` → `queryGraph()`

- [ ] `GraphQueryEngine` class
  - [ ] All traversal methods
  - [ ] Search methods
  - [ ] Impact set computation

- [ ] `CodePropertyGraph` class
  - [ ] Node/edge operations
  - [ ] Traversal algorithm
  - [ ] Serialization

### Dependencies

- [ ] tree-sitter → `@tree-sitter/node` (TypeScript bindings)
- [ ] onnxruntime → `onnxruntime-node` (JavaScript ONNX)
- [ ] faiss-cpu → `faiss-node` (Node.js bindings)
- [ ] numpy → Native TypeScript arrays
- [ ] sqlite3 → `better-sqlite3` (Bun native also works)

### Language Parsers

- [ ] tree-sitter-typescript
- [ ] tree-sitter-javascript
- [ ] tree-sitter-python
- [ ] tree-sitter-java
- [ ] tree-sitter-cpp
- [ ] tree-sitter-c

### Bundled Model

- [ ] Copy `default.onnx` (69KB GCN model)
- [ ] Update path resolution for Bun/Node
- [ ] Verify ONNX runtime compatibility

---

## Usage Example

```typescript
import { CoChangePredictor, InferenceConfig, getModelPath } from 'cpg-inference-ts';

// Initialize
const config: InferenceConfig = {
  modelPath: getModelPath('default'),
  embeddingDim: 32,
};

const predictor = new CoChangePredictor(config, './src');

// Progressive file operations
await predictor.addFile('auth/login.ts', loginCode);
await predictor.addFile('auth/session.ts', sessionCode);
await predictor.updateFile('auth/login.ts', updatedLoginCode);

// Analysis
const impact = await predictor.analyzeChangeImpact(
  ['auth/login.ts::login'],
  3 // max depth
);

console.log(`Direct deps: ${impact.graphForward.length}`);
console.log(`Affected by: ${impact.graphBackward.length}`);
console.log(`Similar: ${impact.embeddingSimilar.length}`);

// Co-change prediction
const predictions = await predictor.predictCochanges(
  ['auth/login.ts'],
  { 'auth/login.ts': updatedLoginCode },
  10 // top-k
);

predictions.forEach(p => {
  console.log(`${p.filePath}: ${p.confidence.toFixed(2)}`);
});

// Graph queries
const engine = predictor.queryGraph();
const callers = await engine.findCallers('auth/login.ts::login');
const path = await engine.findPath('auth/login.ts::login', 'db/query.ts::execute', 5);
```

---

## Testing Strategy

- [ ] Unit tests for each class/method
- [ ] Integration tests with real code samples
- [ ] Performance benchmarks vs Python baseline
- [ ] Multi-language parser tests (TypeScript, Python, Java, C++)
- [ ] Edge case handling (malformed code, large files, cycles)
- [ ] Memory leak tests (progressive updates)

---

## Next Steps

With this CPG library spec defined, we can now "turn around" and work forward from:
1. **Data Schemas** - SurrealDB table definitions
2. **API Implementation** - Connecting CPG library to HTTP endpoints
3. **MCP Implementation** - Connecting API to MCP tools

# CPG Library API Contract

**Version:** 1.0.0
**Provider:** cpg-inference-ts
**Consumers:** metabob-analysis-api
**Status:** Draft (to be implemented)

## Overview

The Code Property Graph (CPG) library provides TypeScript-native code analysis capabilities:
- **Tree-sitter Parsing** - Extract AST from TypeScript, JavaScript, Python source files
- **Graph Construction** - Build component-level dependency graphs
- **ONNX Embeddings** - Generate semantic embeddings for code components
- **FAISS Search** - Similarity search over code embeddings
- **Incremental Updates** - Efficiently update graphs when files change

**Translation From:** `repos/cpg-inference` (Python implementation)

**Performance Targets:**
- Parse speed: Within 2x of Python baseline
- Query speed: Within 1.5x of Python baseline
- Memory usage: < Python baseline

---

## Installation

```bash
npm install @metabob/cpg-inference
# or
bun add @metabob/cpg-inference
```

---

## Core API

### CodePropertyGraph

Main entry point for building and querying code graphs.

```typescript
import { CodePropertyGraph } from '@metabob/cpg-inference';

const cpg = new CodePropertyGraph({
  rootPath: '/path/to/codebase',
  languages: ['typescript', 'javascript', 'python'],
  embeddingModel: 'path/to/model.onnx',
  indexType: 'IVFFlat',  // FAISS index type
  indexParams: { nlist: 100 }
});
```

**Configuration Options:**
```typescript
interface CPGConfig {
  rootPath: string;              // Root directory to analyze
  languages: Language[];          // Languages to parse
  embeddingModel: string;         // Path to ONNX model file
  indexType?: FAISSIndexType;     // Index type (default: 'Flat')
  indexParams?: Record<string, any>; // Index-specific params
  maxFileSize?: number;           // Skip files larger than this (bytes)
  excludePatterns?: string[];     // Glob patterns to exclude
}

type Language = 'typescript' | 'javascript' | 'python' | 'go' | 'rust';
type FAISSIndexType = 'Flat' | 'IVFFlat' | 'HNSW';
```

---

### Building the Graph

#### buildFromDirectory()

Recursively parse all files in directory and build CPG.

```typescript
const result = await cpg.buildFromDirectory({
  parallel: true,        // Parse files in parallel (default: true)
  maxConcurrency: 4,     // Max parallel parsers (default: CPUs)
  progressCallback: (progress) => {
    console.log(`Parsed ${progress.filesProcessed}/${progress.totalFiles} files`);
  }
});

console.log(`Built CPG with ${result.componentCount} components`);
```

**Return Type:**
```typescript
interface BuildResult {
  componentCount: number;
  fileCount: number;
  parseErrors: Array<{
    filePath: string;
    error: string;
    line?: number;
  }>;
  duration: number;  // milliseconds
}
```

---

#### buildFromFile()

Parse single file and add to graph.

```typescript
const result = await cpg.buildFromFile('/path/to/file.ts');

console.log(`Added ${result.componentsAdded} components`);
```

**Return Type:**
```typescript
interface FileParseResult {
  filePath: string;
  componentsAdded: number;
  parseSuccess: boolean;
  error?: string;
}
```

---

#### updateFile()

Incrementally update graph when file changes.

```typescript
const result = await cpg.updateFile({
  filePath: '/path/to/file.ts',
  content: newFileContent,
  diffMode: 'smart'  // 'smart' | 'full' | 'minimal'
});

console.log(`Updated ${result.componentsModified} components`);
```

**Diff Modes:**
- `'smart'`: Detect changes via AST diff (fastest)
- `'full'`: Rebuild all components in file
- `'minimal'`: Only update changed functions/classes

**Return Type:**
```typescript
interface UpdateResult {
  componentsAdded: number;
  componentsModified: number;
  componentsDeleted: number;
  duration: number;
}
```

---

### Querying Components

#### getComponent()

Retrieve component by ID.

```typescript
const component = cpg.getComponent('file.ts:ClassName:methodName');

console.log(component);
```

**Component Structure:**
```typescript
interface CodeComponent {
  id: string;              // Unique identifier
  name: string;            // Component name
  type: ComponentType;     // function | class | method | variable | import
  filePath: string;        // Source file path
  startLine: number;       // Starting line number
  endLine: number;         // Ending line number
  signature?: string;      // Function/method signature
  docstring?: string;      // Documentation comment
  complexity?: number;     // Cyclomatic complexity
  embedding?: Float32Array; // Semantic embedding vector
  metadata: Record<string, any>; // Additional metadata
}

type ComponentType =
  | 'function'
  | 'class'
  | 'method'
  | 'variable'
  | 'import'
  | 'export'
  | 'interface'
  | 'type';
```

---

#### getComponentsByFile()

Get all components in a file.

```typescript
const components = cpg.getComponentsByFile('/path/to/file.ts');

console.log(`Found ${components.length} components in file`);
```

---

#### getComponentsByType()

Filter components by type.

```typescript
const functions = cpg.getComponentsByType('function');
const classes = cpg.getComponentsByType('class');
```

---

### Dependency Queries

#### getDependencies()

Get components that this component depends on.

```typescript
const deps = cpg.getDependencies('file.ts:ClassName');

for (const dep of deps) {
  console.log(`Depends on: ${dep.targetComponent.name}`);
  console.log(`Type: ${dep.dependencyType}`);  // imports | calls | extends | uses
}
```

**Dependency Structure:**
```typescript
interface Dependency {
  sourceComponent: CodeComponent;
  targetComponent: CodeComponent;
  dependencyType: DependencyType;
  count: number;  // How many times dependency occurs
}

type DependencyType =
  | 'imports'    // import statement
  | 'calls'      // function/method call
  | 'extends'    // class inheritance
  | 'implements' // interface implementation
  | 'uses';      // variable usage
```

---

#### getDependents()

Get components that depend on this component.

```typescript
const dependents = cpg.getDependents('file.ts:utilityFunction');

console.log(`${dependents.length} components depend on this function`);
```

---

#### getImpactGraph()

Get full impact graph for a component (recursive dependencies).

```typescript
const impact = cpg.getImpactGraph({
  componentId: 'file.ts:ClassName',
  depth: 3,              // Max recursion depth
  direction: 'downstream' // 'downstream' | 'upstream' | 'both'
});

console.log(`Changing this affects ${impact.affectedComponents.length} components`);
```

**Impact Graph:**
```typescript
interface ImpactGraph {
  rootComponent: CodeComponent;
  affectedComponents: CodeComponent[];
  impactEdges: Array<{
    from: string;  // component ID
    to: string;    // component ID
    type: DependencyType;
    distance: number;  // hops from root
  }>;
  estimatedImpactScore: number;  // 0.0 - 1.0
}
```

---

### Embedding Search

#### generateEmbedding()

Generate embedding vector for code snippet.

```typescript
const embedding = await cpg.generateEmbedding(`
  function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price, 0);
  }
`);

console.log(`Embedding dimensions: ${embedding.length}`);  // e.g., 768
```

---

#### searchSimilar()

Find components similar to given code or embedding.

```typescript
const results = await cpg.searchSimilar({
  query: 'function that sums array elements',
  k: 10,                    // Top-k results
  threshold: 0.7,           // Min similarity score
  componentTypes: ['function', 'method'],
  excludeFiles: ['test/**']
});

for (const result of results) {
  console.log(`${result.component.name}: ${result.similarity.toFixed(3)}`);
}
```

**Search Options:**
```typescript
interface SearchOptions {
  query: string | Float32Array;  // Text query or embedding vector
  k: number;                      // Number of results
  threshold?: number;             // Min similarity (0.0 - 1.0)
  componentTypes?: ComponentType[]; // Filter by type
  excludeFiles?: string[];        // Glob patterns to exclude
  includeFiles?: string[];        // Glob patterns to include
}
```

**Search Result:**
```typescript
interface SearchResult {
  component: CodeComponent;
  similarity: number;  // Cosine similarity (0.0 - 1.0)
  rank: number;        // Result ranking (1-k)
}
```

---

#### searchByEmbedding()

Search using pre-computed embedding vector.

```typescript
const embedding = await cpg.generateEmbedding(codeSnippet);
const results = await cpg.searchByEmbedding(embedding, {
  k: 5,
  threshold: 0.8
});
```

---

### Graph Export/Import

#### exportToJSON()

Export entire graph to JSON format.

```typescript
const graphData = cpg.exportToJSON({
  includeEmbeddings: false,  // Embeddings are large
  prettyPrint: true
});

await Bun.write('cpg-export.json', graphData);
```

---

#### importFromJSON()

Load graph from JSON.

```typescript
const graphData = await Bun.file('cpg-export.json').text();
await cpg.importFromJSON(graphData);
```

---

## Advanced Features

### Custom Parsers

Add support for custom languages.

```typescript
import { registerParser } from '@metabob/cpg-inference';

registerParser({
  language: 'solidity',
  treeSitterGrammar: solidityGrammar,
  extractComponents: (tree) => {
    // Custom extraction logic
    return components;
  }
});
```

---

### Embedding Model Customization

Use custom ONNX model.

```typescript
const cpg = new CodePropertyGraph({
  rootPath: '/project',
  languages: ['typescript'],
  embeddingModel: './models/custom-codebert.onnx',
  embeddingDimensions: 768,
  embeddingNormalize: true
});
```

---

### Performance Optimization

#### Caching

```typescript
const cpg = new CodePropertyGraph({
  rootPath: '/project',
  cache: {
    enabled: true,
    cacheDir: '.cpg-cache',
    ttl: 3600  // seconds
  }
});
```

#### Lazy Loading

```typescript
const cpg = new CodePropertyGraph({
  rootPath: '/project',
  lazyLoad: true,  // Don't load embeddings until needed
  languages: ['typescript']
});

// Embeddings loaded on first search
const results = await cpg.searchSimilar({ query: 'sum array', k: 5 });
```

---

## Performance Benchmarks

**Baseline:** Python implementation (repos/cpg-inference)

**Targets:**

| Operation | Python | TypeScript Target | Status |
|-----------|--------|-------------------|--------|
| Parse 1000 files | 15s | < 30s (2x) | TO MEASURE |
| Build CPG (10K LOC) | 8s | < 16s (2x) | TO MEASURE |
| Query dependencies | 5ms | < 7.5ms (1.5x) | TO MEASURE |
| Similarity search (k=10) | 20ms | < 30ms (1.5x) | TO MEASURE |
| Update single file | 200ms | < 300ms (1.5x) | TO MEASURE |
| Memory usage (10K LOC) | 500MB | < 500MB | TO MEASURE |

**Validation:**
```bash
bun run benchmark.ts --compare-python
```

---

## Error Handling

**Parse Errors:**
```typescript
try {
  await cpg.buildFromFile('/path/to/invalid.ts');
} catch (error) {
  if (error instanceof ParseError) {
    console.error(`Parse failed at line ${error.line}: ${error.message}`);
  }
}
```

**Embedding Errors:**
```typescript
try {
  const embedding = await cpg.generateEmbedding(code);
} catch (error) {
  if (error instanceof EmbeddingError) {
    console.error(`Embedding generation failed: ${error.message}`);
    // Fallback: use text-based search instead
  }
}
```

**Search Errors:**
```typescript
const results = await cpg.searchSimilar({
  query: 'find function',
  k: 10,
  onError: 'skip'  // 'skip' | 'throw' | 'warn'
});
```

---

## TypeScript Types

Full TypeScript support with exported types:

```typescript
import type {
  CodePropertyGraph,
  CodeComponent,
  Dependency,
  SearchResult,
  ImpactGraph,
  ComponentType,
  DependencyType,
  CPGConfig
} from '@metabob/cpg-inference';
```

---

## Testing

**Unit Tests:**
```bash
bun test
```

**Integration Tests:**
```bash
bun run test-integration
```

**Benchmark Tests:**
```bash
bun run benchmark
```

---

## Change Log

**1.0.0** (Planned)
- Initial TypeScript implementation
- Tree-sitter parsing (TS, JS, Python)
- ONNX embedding integration
- FAISS similarity search
- Incremental graph updates
- Full API parity with Python version

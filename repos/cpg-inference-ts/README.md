# @metabob/cpg-inference

Code Property Graph inference with GCN embeddings for similarity search and co-change prediction.

## Features

- **Code Property Graph**: Build and query graphs representing code structure
- **GCN Embeddings**: Pre-trained Graph Convolutional Network model for code similarity
- **Vector Search**: Fast similarity search using USearch
- **Co-Change Prediction**: Find related code components based on learned patterns

## Installation

```bash
npm install @metabob/cpg-inference
# or
bun add @metabob/cpg-inference
```

## Quick Start

```typescript
import { CoChangePredictor } from '@metabob/cpg-inference';

// Initialize predictor
const predictor = new CoChangePredictor();
await predictor.initialize();

// Add files to analyze
await predictor.addFile('src/auth.ts', `
  export function login(user: string) {
    return authenticate(user);
  }
`);

await predictor.addFile('src/session.ts', `
  export function authenticate(user: string) {
    return createSession(user);
  }
`);

// Predict related components
const predictions = await predictor.predictCochanges([
  'src/auth.ts::function::login::2'
], 5);

console.log('Related components:', predictions);
// [
//   {
//     componentId: 'src/session.ts::function::authenticate::2',
//     similarityScore: 0.85,
//     filePath: 'src/session.ts',
//     componentName: 'authenticate',
//     componentType: 'function',
//     startLine: 2
//   }
// ]
```

## API Reference

### CoChangePredictor

Main class for code analysis and co-change prediction.

#### Constructor

```typescript
new CoChangePredictor(config?: PredictorConfig)
```

**Config Options:**
- `modelPath?: string` - Path to ONNX model (default: bundled model)
- `embeddingDim?: number` - Embedding dimension (default: 32)
- `inputDim?: number` - Input feature dimension (default: 128)
- `topK?: number` - Results to return (default: 10)
- `minSimilarity?: number` - Minimum similarity threshold (default: 0.0)

#### Methods

**`async initialize(): Promise<void>`**

Load the ONNX model. Must be called before using the predictor.

**`async addFile(filePath: string, content: string): Promise<AddFileResult>`**

Add a file to the CPG and generate embeddings for its components.

Returns:
```typescript
{
  filePath: string;
  componentsAdded: number;
  duration: number; // ms
}
```

**`async addFiles(files: Record<string, string>): Promise<AddFileResult[]>`**

Add multiple files in batch.

**`async predictCochanges(componentIds: string[], k?: number): Promise<CoChangePrediction[]>`**

Predict which components are likely to change together with the given components.

Returns:
```typescript
{
  componentId: string;
  similarityScore: number; // 0.0 to 1.0
  filePath: string;
  componentName: string;
  componentType: string;
  startLine: number;
}[]
```

**`getCPG(): CodePropertyGraph`**

Get the underlying Code Property Graph for custom queries.

**`getComponent(componentId: string): CPGNode | null`**

Retrieve a specific component by ID.

**`getStats()`**

Get statistics about indexed components.

### Lower-Level APIs

#### CodePropertyGraph

```typescript
import { CodePropertyGraph } from '@metabob/cpg-inference';

const cpg = new CodePropertyGraph();
cpg.addNode(node);
cpg.addEdge(edge);
const results = cpg.findNodes({ nodeType: 'function', name: 'login' });
```

#### ONNXEmbeddingModel

```typescript
import { ONNXEmbeddingModel } from '@metabob/cpg-inference';

const model = new ONNXEmbeddingModel();
await model.initialize();

const features = new Float32Array(128); // SimHash features
const embedding = await model.infer(features);
```

#### FAISSIndex (USearch)

```typescript
import { FAISSIndex } from '@metabob/cpg-inference';

const index = new FAISSIndex(32, 'flat'); // dimension, type
await index.add('component-id', embedding);
const results = await index.search(queryEmbedding, 10);
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│           CoChangePredictor (Main API)          │
│                                                 │
│  addFile() → predictCochanges() → getStats()   │
└────────────┬──────────────┬─────────────────────┘
             │              │
    ┌────────▼────────┐  ┌──▼──────────────┐
    │ CodePropertyGraph│  │ ONNXEmbeddingModel│
    │                  │  │                  │
    │ • Parser         │  │ • GCN Model      │
    │ • Graph Builder  │  │ • Pre-trained    │
    │ • Query Engine   │  │ • 69KB ONNX      │
    └──────────────────┘  └──────┬───────────┘
                                 │
                          ┌──────▼───────────┐
                          │   FAISSIndex     │
                          │   (USearch)      │
                          │                  │
                          │ • Vector Search  │
                          │ • KNN Queries    │
                          └──────────────────┘
```

## Model Details

The bundled GCN model was trained on git co-change patterns:

- **Architecture**: 2-layer Graph Convolutional Network
- **Input**: 128-bit SimHash features from code structure
- **Output**: 32-dimensional embeddings
- **Training**: Multi-repository co-change dataset
- **Performance**: AUC 0.9999 on test set
- **Size**: 109 KB (69KB model + 40KB data)

## Performance

Targets (P50):
- Parse file (1000 LOC): <50ms
- Generate embedding: <10ms
- Vector search (10K index): <5ms
- Add file to system: <150ms

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build
```

## License

MIT

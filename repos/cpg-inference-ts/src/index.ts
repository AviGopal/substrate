/**
 * cpg-inference-ts - TypeScript implementation of Code Property Graph inference
 *
 * This library provides CPG construction, traversal, and ONNX-based inference
 * for code analysis tasks.
 */

// Export all types
export * from './types.js';
export type {
  CPGNode,
  CPGEdge,
  FileMetadata,
  TreeSitterNode,
  LanguageConfig,
  QueryResult,
  TraversalPath,
  TraversalOptions,
  QueryOptions,
  ICodePropertyGraph,
} from './types.js';

export { NodeType, EdgeType } from './types.js';

// Export parser and graph classes
export * from './parser.js';
export * from './graph.js';
export * from './graph-builder.js';
export * from './embedding-model.js';
export * from './faiss-index.js';
export * from './predictor.js';

// Re-export main classes for convenience
export { CodePropertyGraph } from './graph.js';
export { SourceParser } from './parser.js';
export { GraphBuilder } from './graph-builder.js';
export { ONNXEmbeddingModel, BUNDLED_MODELS } from './embedding-model.js';
export { FAISSIndex } from './faiss-index.js';
export type { SimilarityResult } from './faiss-index.js';
export { CoChangePredictor } from './predictor.js';
export type { CoChangePrediction, PredictorConfig, AddFileResult } from './predictor.js';

/**
 * Co-Change Predictor - Main API for code similarity search
 *
 * Matches Python implementation: cpg_inference/service.py::CoChangePredictor
 *
 * The GCN model was trained on git co-change patterns, so embeddings capture
 * learned similarity from historical code changes. This enables predicting
 * which components are likely to change together based on past patterns.
 */

import { CodePropertyGraph } from './graph.js';
import { GraphBuilder } from './graph-builder.js';
import { ONNXEmbeddingModel } from './embedding-model.js';
import { FAISSIndex } from './faiss-index.js';
import type { CPGNode } from './types.js';

export interface PredictorConfig {
  modelPath?: string; // Path to ONNX model
  embeddingDim?: number; // Embedding dimension (default: 32)
  inputDim?: number; // Input feature dimension (default: 128)
  topK?: number; // Number of results to return (default: 10)
  minSimilarity?: number; // Minimum similarity threshold (default: 0.0)
}

export interface CoChangePrediction {
  componentId: string;
  similarityScore: number;
  filePath: string;
  componentName: string;
  componentType: string;
  startLine: number;
}

export interface AddFileResult {
  filePath: string;
  componentsAdded: number;
  duration: number;
}

export class CoChangePredictor {
  private cpg: CodePropertyGraph;
  private builder: GraphBuilder;
  private embeddingModel: ONNXEmbeddingModel;
  private index: FAISSIndex;
  private config: Required<Omit<PredictorConfig, 'modelPath'>> & { modelPath?: string };
  componentMap: Map<string, CPGNode>; // component ID → node (public for example access)

  constructor(config: PredictorConfig = {}) {
    // Default configuration matching Python implementation
    this.config = {
      modelPath: config.modelPath,
      embeddingDim: config.embeddingDim ?? 32,
      inputDim: config.inputDim ?? 128,
      topK: config.topK ?? 10,
      minSimilarity: config.minSimilarity ?? 0.0,
    };

    // Initialize components
    this.cpg = new CodePropertyGraph();
    this.builder = new GraphBuilder(this.cpg);
    this.embeddingModel = new ONNXEmbeddingModel({
      modelPath: this.config.modelPath,
      embeddingDim: this.config.embeddingDim,
      inputDim: this.config.inputDim,
    });
    this.index = new FAISSIndex(this.config.embeddingDim, 'flat');
    this.componentMap = new Map();
  }

  /**
   * Initialize the predictor (loads ONNX model)
   */
  async initialize(): Promise<void> {
    await this.embeddingModel.initialize();
  }

  /**
   * Add a file to the CPG and index its components
   */
  async addFile(filePath: string, content: string): Promise<AddFileResult> {
    const startTime = performance.now();

    // Add file to CPG (builds graph automatically)
    this.builder.addFile(filePath, content);

    let componentsAdded = 0;

    // Get all nodes from the CPG
    // Note: GraphBuilder doesn't set filePath on nodes, but node IDs contain the file path
    const allNodes = Array.from(this.cpg.nodes.values());

    // For each node, generate embedding and add to index
    // In production, we'd extract SimHash features first
    // For now, use simplified approach: hash node properties
    for (const node of allNodes) {
      // Only index functions, methods, and classes
      // Check if node ID starts with the filePath (since filePath isn't set on nodes)
      if (
        node.id.startsWith(filePath) &&
        (node.type === 'function' || node.type === 'method' || node.type === 'class')
      ) {
        // Generate component ID
        const componentId = this.generateComponentId(node, filePath);

        // Skip if already indexed
        if (this.componentMap.has(componentId)) {
          continue;
        }

        // Store component (set filePath since GraphBuilder doesn't)
        const nodeWithFilePath = { ...node, filePath };
        this.componentMap.set(componentId, nodeWithFilePath);

        // Generate features (simplified: just hash the source text)
        const features = this.generateSimpleFeatures(nodeWithFilePath);

        // Generate embedding
        const embedding = await this.embeddingModel.infer(features);

        // Add to index
        await this.index.add(componentId, embedding);

        componentsAdded++;
      }
    }

    const duration = performance.now() - startTime;

    return {
      filePath,
      componentsAdded,
      duration,
    };
  }

  /**
   * Add multiple files in batch
   */
  async addFiles(files: Record<string, string>): Promise<AddFileResult[]> {
    const results: AddFileResult[] = [];

    for (const [filePath, content] of Object.entries(files)) {
      const result = await this.addFile(filePath, content);
      results.push(result);
    }

    return results;
  }

  /**
   * Predict which components are likely to co-change with the given components
   */
  async predictCochanges(
    componentIds: string[],
    k?: number
  ): Promise<CoChangePrediction[]> {
    const actualK = k ?? this.config.topK;

    // Get embeddings for input components
    const embeddings: Float32Array[] = [];

    for (const componentId of componentIds) {
      const node = this.componentMap.get(componentId);
      if (!node) {
        console.warn(`Component ${componentId} not found`);
        continue;
      }

      // Re-generate features and embedding
      const features = this.generateSimpleFeatures(node);
      const embedding = await this.embeddingModel.infer(features);
      embeddings.push(embedding);
    }

    if (embeddings.length === 0) {
      return [];
    }

    // Average embeddings
    const queryEmbedding = this.embeddingModel.averageEmbeddings(embeddings);

    // Search for similar components
    const results = await this.index.search(queryEmbedding, actualK);

    // Filter by minimum similarity and convert to predictions
    const predictions: CoChangePrediction[] = [];

    for (const result of results) {
      if (result.similarity < this.config.minSimilarity) {
        continue;
      }

      // Skip input components
      if (componentIds.includes(result.id)) {
        continue;
      }

      const node = this.componentMap.get(result.id);
      if (!node) {
        continue;
      }

      // Type guard: filePath might not be set by GraphBuilder, but we set it when adding
      const filePath = (node as any).filePath || '';

      predictions.push({
        componentId: result.id,
        similarityScore: result.similarity,
        filePath,
        componentName: node.name,
        componentType: node.type,
        startLine: node.startLine,
      });
    }

    return predictions;
  }

  /**
   * Search for components similar to a query
   */
  async searchSimilar(_query: string, _k?: number): Promise<CoChangePrediction[]> {
    // For a text query, we'd need to parse it first
    // For now, just return empty (not implemented in Python either)
    return [];
  }

  /**
   * Get the CPG instance
   */
  getCPG(): CodePropertyGraph {
    return this.cpg;
  }

  /**
   * Get a component by ID
   */
  getComponent(componentId: string): CPGNode | null {
    return this.componentMap.get(componentId) || null;
  }

  /**
   * Get statistics about the predictor
   */
  getStats(): {
    componentsIndexed: number;
    filesAdded: number;
    embeddingDim: number;
  } {
    // Approximate files by counting unique file paths
    const filePaths = new Set(
      Array.from(this.componentMap.values())
        .map((n) => (n as any).filePath)
        .filter((fp): fp is string => fp !== undefined)
    );

    return {
      componentsIndexed: this.componentMap.size,
      filesAdded: filePaths.size,
      embeddingDim: this.config.embeddingDim,
    };
  }

  /**
   * Generate component ID (matches Python implementation)
   */
  private generateComponentId(node: CPGNode, filePath: string): string {
    return `${filePath}::${node.type}::${node.name}::${node.startLine}`;
  }

  /**
   * Generate simple features from a node
   *
   * In the Python implementation, this would be SimHash features from k-hop neighborhood.
   * For now, we use a simplified approach: hash the source text into a feature vector.
   */
  private generateSimpleFeatures(node: CPGNode): Float32Array {
    const features = new Float32Array(this.config.inputDim);

    // Simple hash function: convert text to numbers
    const text = node.name;

    for (let i = 0; i < Math.min(text.length, this.config.inputDim); i++) {
      features[i] = text.charCodeAt(i) / 255.0; // Normalize to [0, 1]
    }

    return features;
  }
}

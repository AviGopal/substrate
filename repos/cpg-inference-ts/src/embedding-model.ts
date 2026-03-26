/**
 * ONNX Embedding Model - Loads and executes ONNX GCN model for code embeddings
 *
 * Based on Python implementation: cpg_inference/model_wrapper.py
 */

import * as onnx from 'onnxruntime-node';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface EmbeddingModelConfig {
  modelPath?: string;
  embeddingDim?: number;
  inputDim?: number;
  batchSize?: number;
  intraOpThreads?: number;
}

/**
 * Model metadata matching Python bundled_models registry
 */
export const BUNDLED_MODELS = {
  default: {
    filename: 'auc_0.9999_gcn_bce_all_h64_l2_d1_b128_fp32.onnx',
    description: 'GCN model (AUC 0.9999) trained with BCE loss on multi-repo dataset',
    architecture: 'GCN',
    layers: 2,
    hiddenDim: 64,
    embeddingDim: 32,
    inputDim: 128, // SimHash bits
    neighborhoodDepth: 1,
    edgeFilter: 'all',
    sizeKb: 109,
  },
};

export class ONNXEmbeddingModel {
  private session: onnx.InferenceSession | null = null;
  private embeddingDim: number;
  private inputDim: number;
  private batchSize: number;
  private modelPath: string;
  private initialized = false;
  private inputNames: string[] = [];
  private outputNames: string[] = [];

  constructor(config: EmbeddingModelConfig = {}) {
    // Defaults match Python implementation
    this.embeddingDim = config.embeddingDim ?? 32;
    this.inputDim = config.inputDim ?? 128;
    this.batchSize = config.batchSize ?? 32;

    // Default to bundled model (use full filename, not symlink)
    this.modelPath =
      config.modelPath ?? join(__dirname, '../include', BUNDLED_MODELS.default.filename);
  }

  /**
   * Initialize the ONNX model session with multi-threading support
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Check if model exists
      if (!readFileSync) {
        throw new Error('File system access not available');
      }

      // Configure session options (matching Python implementation)
      const sessionOptions: onnx.InferenceSession.SessionOptions = {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
        // Multi-threading configuration
        // intraOpNumThreads: 0 means use default (usually CPU cores)
        // interOpNumThreads: 1 for sequential execution across nodes
      };

      // IMPORTANT: ONNX Runtime looks for external data files (.data) relative to CWD
      // We need to use the file path directly, and ensure the .data file is in the same directory
      // The model path must be absolute
      const { resolve } = await import('path');
      const absoluteModelPath = resolve(this.modelPath);

      // Create inference session from file path (not buffer)
      // This allows ONNX Runtime to find the .data file in the same directory
      this.session = await onnx.InferenceSession.create(absoluteModelPath, sessionOptions);

      // Get input/output names (readonly, so copy to mutable array)
      this.inputNames = [...this.session.inputNames];
      this.outputNames = [...this.session.outputNames];

      this.initialized = true;
      console.log(`ONNX model loaded successfully from ${absoluteModelPath}`);
      console.log(`  Inputs: ${this.inputNames.join(', ')}`);
      console.log(`  Outputs: ${this.outputNames.join(', ')}`);
    } catch (error) {
      throw new Error(
        `Failed to initialize ONNX model: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Run inference on node features (matches Python model_wrapper.infer)
   *
   * @param nodeFeatures - Node feature matrix [numNodes, inputDim]
   * @returns Node embeddings [numNodes, embeddingDim]
   */
  async infer(nodeFeatures: Float32Array): Promise<Float32Array> {
    if (!this.initialized || !this.session) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    // Calculate number of nodes
    const numNodes = nodeFeatures.length / this.inputDim;

    if (numNodes === 0) {
      // Empty input
      return new Float32Array(0);
    }

    // Build edge index (star graph structure)
    const edgeIndex = this.buildEdgeIndex(numNodes);

    try {
      // Create input tensors
      const nodeFeaturesTensor = new onnx.Tensor('float32', nodeFeatures, [
        numNodes,
        this.inputDim,
      ]);

      const edgeIndexTensor = new onnx.Tensor('int64', edgeIndex, [2, edgeIndex.length / 2]);

      // Run inference
      const feeds = {
        node_features: nodeFeaturesTensor,
        edge_index: edgeIndexTensor,
      };

      const results = await this.session.run(feeds);

      // Extract embeddings from first output
      const outputName = this.outputNames[0];
      if (!outputName) {
        throw new Error('No output names found in model');
      }
      const outputTensor = results[outputName];
      if (!outputTensor) {
        throw new Error(`Output tensor '${outputName}' not found in results`);
      }
      const embeddings = new Float32Array(outputTensor.data as ArrayLike<number>);

      // Normalize embeddings (L2 normalization)
      return this.normalizeEmbeddings(embeddings, numNodes);
    } catch (error) {
      throw new Error(
        `Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Run inference on multiple feature matrices in batches
   * (matches Python model_wrapper.infer_batch)
   *
   * @param featuresList - List of feature matrices
   * @param batchSize - Batch size for processing
   * @returns Concatenated embeddings
   */
  async inferBatch(featuresList: Float32Array[], batchSize?: number): Promise<Float32Array> {
    if (!this.initialized) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    const actualBatchSize = batchSize ?? this.batchSize;
    const allEmbeddings: Float32Array[] = [];

    // Process in batches
    for (let i = 0; i < featuresList.length; i += actualBatchSize) {
      const batch = featuresList.slice(i, i + actualBatchSize);

      if (batch.length > 0) {
        // Concatenate batch features
        const totalLength = batch.reduce((sum, features) => sum + features.length, 0);
        const batchFeatures = new Float32Array(totalLength);

        let offset = 0;
        for (const features of batch) {
          batchFeatures.set(features, offset);
          offset += features.length;
        }

        // Run inference on batch
        const batchEmbeddings = await this.infer(batchFeatures);
        allEmbeddings.push(batchEmbeddings);
      }
    }

    // Concatenate all embeddings
    if (allEmbeddings.length > 0) {
      const totalLength = allEmbeddings.reduce((sum, embeddings) => sum + embeddings.length, 0);
      const result = new Float32Array(totalLength);

      let offset = 0;
      for (const embeddings of allEmbeddings) {
        result.set(embeddings, offset);
        offset += embeddings.length;
      }

      return result;
    } else {
      return new Float32Array(0);
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];
      if (aVal !== undefined && bVal !== undefined) {
        dotProduct += aVal * bVal;
        normA += aVal * aVal;
        normB += bVal * bVal;
      }
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Average multiple embeddings
   */
  averageEmbeddings(embeddings: Float32Array[]): Float32Array {
    if (embeddings.length === 0) {
      throw new Error('Cannot average empty embeddings array');
    }

    const firstEmbedding = embeddings[0];
    if (!firstEmbedding) {
      throw new Error('First embedding is undefined');
    }

    const dim = firstEmbedding.length;
    const result = new Float32Array(dim);

    for (const embedding of embeddings) {
      if (embedding.length !== dim) {
        throw new Error('All embeddings must have same dimension');
      }
      for (let i = 0; i < dim; i++) {
        const val = embedding[i];
        if (val !== undefined) {
          const current = result[i];
          if (current !== undefined) {
            result[i] = current + val;
          }
        }
      }
    }

    // Average
    for (let i = 0; i < dim; i++) {
      const val = result[i];
      if (val !== undefined) {
        result[i] = val / embeddings.length;
      }
    }

    // Normalize the averaged embedding
    return this.normalizeEmbeddings(result, 1);
  }

  /**
   * Get embedding dimension
   */
  getEmbeddingDim(): number {
    return this.embeddingDim;
  }

  /**
   * Check if model is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Build edge index for graph (matches Python _build_edge_index)
   *
   * Creates a star graph where all nodes connect to node 0.
   * This is sufficient for the GNN to aggregate information.
   *
   * @param numNodes - Number of nodes
   * @returns Edge index in COO format [2, numEdges]
   */
  private buildEdgeIndex(numNodes: number): BigInt64Array {
    if (numNodes <= 1) {
      // No edges for single node
      return new BigInt64Array(0);
    }

    // Create star graph: all nodes connect to node 0 (bidirectional)
    const edges: bigint[] = [];
    for (let i = 1; i < numNodes; i++) {
      // Bidirectional edges
      edges.push(BigInt(0), BigInt(i)); // 0 -> i
      edges.push(BigInt(i), BigInt(0)); // i -> 0
    }

    return BigInt64Array.from(edges);
  }

  /**
   * L2 normalize embeddings (matches Python _normalize_embeddings)
   *
   * @param embeddings - Embedding matrix [numNodes * embeddingDim]
   * @param numNodes - Number of nodes
   * @returns Normalized embeddings
   */
  private normalizeEmbeddings(embeddings: Float32Array, numNodes: number): Float32Array {
    const normalized = new Float32Array(embeddings.length);

    // Normalize each node's embedding separately
    for (let i = 0; i < numNodes; i++) {
      const offset = i * this.embeddingDim;

      // Compute L2 norm for this node
      let norm = 0;
      for (let j = 0; j < this.embeddingDim; j++) {
        const val = embeddings[offset + j];
        if (val !== undefined) {
          norm += val * val;
        }
      }
      norm = Math.sqrt(norm);

      // Avoid division by zero
      norm = Math.max(norm, 1e-8);

      // Normalize
      for (let j = 0; j < this.embeddingDim; j++) {
        const val = embeddings[offset + j];
        if (val !== undefined) {
          normalized[offset + j] = val / norm;
        }
      }
    }

    return normalized;
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.session) {
      // ONNX Runtime doesn't have explicit dispose in Node.js binding
      this.session = null;
    }
    this.initialized = false;
  }
}

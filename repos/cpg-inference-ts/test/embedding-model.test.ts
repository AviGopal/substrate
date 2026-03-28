/**
 * Tests for ONNX Embedding Model
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { ONNXEmbeddingModel, BUNDLED_MODELS } from '../src/embedding-model.js';

describe('ONNXEmbeddingModel', () => {
  let model: ONNXEmbeddingModel;

  beforeAll(async () => {
    model = new ONNXEmbeddingModel();
    await model.initialize();
  });

  test('should initialize model successfully', () => {
    expect(model.isInitialized()).toBe(true);
  });

  test('should have correct embedding dimension', () => {
    expect(model.getEmbeddingDim()).toBe(BUNDLED_MODELS.default.embeddingDim);
  });

  test('should generate embeddings for node features', async () => {
    // Create sample node features (2 nodes, 128-dim SimHash)
    const nodeFeatures = new Float32Array(2 * 128);
    for (let i = 0; i < nodeFeatures.length; i++) {
      nodeFeatures[i] = Math.random();
    }

    const embeddings = await model.infer(nodeFeatures);

    // Should return embeddings for 2 nodes (2 * 32 = 64 values)
    expect(embeddings.length).toBe(2 * 32);

    // Check that embeddings are normalized (L2 norm ≈ 1)
    const norm1 = Math.sqrt(
      Array.from(embeddings.slice(0, 32))
        .map(v => v * v)
        .reduce((a, b) => a + b, 0)
    );
    expect(Math.abs(norm1 - 1.0)).toBeLessThan(0.01);
  });

  test('should handle empty input', async () => {
    const emptyFeatures = new Float32Array(0);
    const embeddings = await model.infer(emptyFeatures);

    expect(embeddings.length).toBe(0);
  });

  test('should handle single node', async () => {
    const singleNodeFeatures = new Float32Array(128);
    for (let i = 0; i < 128; i++) {
      singleNodeFeatures[i] = Math.random();
    }

    const embeddings = await model.infer(singleNodeFeatures);

    // Should return embeddings for 1 node (32 values)
    expect(embeddings.length).toBe(32);
  });

  test('should calculate cosine similarity correctly', () => {
    const emb1 = new Float32Array([1, 0, 0, 0]);
    const emb2 = new Float32Array([1, 0, 0, 0]);
    const emb3 = new Float32Array([0, 1, 0, 0]);

    // Identical embeddings should have similarity 1.0
    const sim1 = model.cosineSimilarity(emb1, emb2);
    expect(Math.abs(sim1 - 1.0)).toBeLessThan(0.01);

    // Orthogonal embeddings should have similarity 0.0
    const sim2 = model.cosineSimilarity(emb1, emb3);
    expect(Math.abs(sim2 - 0.0)).toBeLessThan(0.01);
  });

  test('should average embeddings correctly', () => {
    const emb1 = new Float32Array(32).fill(1.0);
    const emb2 = new Float32Array(32).fill(0.5);

    const avg = model.averageEmbeddings([emb1, emb2]);

    // Average should be normalized
    const norm = Math.sqrt(
      Array.from(avg)
        .map(v => v * v)
        .reduce((a, b) => a + b, 0)
    );
    expect(Math.abs(norm - 1.0)).toBeLessThan(0.01);
  });

  test('should process batches correctly', async () => {
    const features1 = new Float32Array(128).map(() => Math.random());
    const features2 = new Float32Array(128).map(() => Math.random());
    const features3 = new Float32Array(128).map(() => Math.random());

    const allEmbeddings = await model.inferBatch([features1, features2, features3], 2);

    // Should have embeddings for 3 nodes (3 * 32 = 96)
    expect(allEmbeddings.length).toBe(3 * 32);
  });
});

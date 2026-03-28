/**
 * Tests for FAISS Index
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { FAISSIndex, type SimilarityResult } from '../src/faiss-index.js';

describe('FAISSIndex', () => {
  const dimension = 32;
  let index: FAISSIndex;

  beforeEach(() => {
    index = new FAISSIndex(dimension, 'flat');
  });

  test('should create index with correct dimension', () => {
    expect(index.getDimension()).toBe(dimension);
    expect(index.size()).toBe(0);
  });

  test('should add single embedding', async () => {
    const embedding = new Float32Array(dimension).map(() => Math.random());
    await index.add('component1', embedding);

    expect(index.size()).toBe(1);
    expect(index.has('component1')).toBe(true);
  });

  test('should add multiple embeddings in batch', async () => {
    const embeddings = [
      new Float32Array(dimension).map(() => Math.random()),
      new Float32Array(dimension).map(() => Math.random()),
      new Float32Array(dimension).map(() => Math.random()),
    ];
    const ids = ['comp1', 'comp2', 'comp3'];

    await index.addBatch(ids, embeddings);

    expect(index.size()).toBe(3);
    expect(index.has('comp1')).toBe(true);
    expect(index.has('comp2')).toBe(true);
    expect(index.has('comp3')).toBe(true);
  });

  test('should throw on duplicate component ID', async () => {
    const embedding = new Float32Array(dimension).fill(1.0);
    await index.add('comp1', embedding);

    await expect(index.add('comp1', embedding)).rejects.toThrow('already exists');
  });

  test('should throw on dimension mismatch', async () => {
    const wrongDim = new Float32Array(16).fill(1.0);

    await expect(index.add('comp1', wrongDim)).rejects.toThrow('dimension mismatch');
  });

  test('should search and return similar vectors', async () => {
    // Create some test embeddings
    const emb1 = new Float32Array(dimension).fill(1.0);
    const emb2 = new Float32Array(dimension).fill(0.5);
    const emb3 = new Float32Array(dimension).fill(0.0);

    await index.add('similar', emb1);
    await index.add('medium', emb2);
    await index.add('different', emb3);

    // Search with query similar to emb1
    const query = new Float32Array(dimension).fill(0.9);
    const results = await index.search(query, 3);

    expect(results.length).toBe(3);

    // First result should be 'similar' (closest to query)
    expect(results[0].id).toBe('similar');

    // All results should have distance and similarity values
    for (const result of results) {
      expect(result.distance).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
    }

    // Results should be ordered by distance (ascending)
    for (let i = 1; i < results.length; i++) {
      expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
    }
  });

  test('should handle k larger than index size', async () => {
    const emb1 = new Float32Array(dimension).map(() => Math.random());
    const emb2 = new Float32Array(dimension).map(() => Math.random());

    await index.add('comp1', emb1);
    await index.add('comp2', emb2);

    const query = new Float32Array(dimension).map(() => Math.random());
    const results = await index.search(query, 10);

    // Should return only 2 results even though k=10
    expect(results.length).toBe(2);
  });

  test('should return empty array for empty index', async () => {
    const query = new Float32Array(dimension).map(() => Math.random());
    const results = await index.search(query, 5);

    expect(results.length).toBe(0);
  });

  test('should remove component', async () => {
    const embedding = new Float32Array(dimension).map(() => Math.random());
    await index.add('comp1', embedding);

    expect(index.has('comp1')).toBe(true);

    await index.remove('comp1');

    expect(index.has('comp1')).toBe(false);
    expect(index.size()).toBe(0);
  });

  test('should throw when removing non-existent component', async () => {
    await expect(index.remove('nonexistent')).rejects.toThrow('not found');
  });

  test('should clear all vectors', async () => {
    const embeddings = [
      new Float32Array(dimension).map(() => Math.random()),
      new Float32Array(dimension).map(() => Math.random()),
    ];

    await index.add('comp1', embeddings[0]);
    await index.add('comp2', embeddings[1]);

    expect(index.size()).toBe(2);

    index.clear();

    expect(index.size()).toBe(0);
    expect(index.has('comp1')).toBe(false);
    expect(index.has('comp2')).toBe(false);
  });

  test('should serialize and deserialize metadata', () => {
    const serialized = index.serialize();
    expect(serialized).toBeInstanceOf(Buffer);

    const deserialized = FAISSIndex.deserialize(serialized, dimension, 'flat');
    expect(deserialized.getDimension()).toBe(dimension);
    expect(deserialized.size()).toBe(0);
  });

  test('should find exact match with high similarity', async () => {
    const embedding = new Float32Array(dimension);
    for (let i = 0; i < dimension; i++) {
      embedding[i] = Math.sin(i); // Deterministic pattern
    }

    await index.add('exact', embedding);

    // Search with identical embedding
    const results = await index.search(embedding, 1);

    expect(results.length).toBe(1);
    expect(results[0].id).toBe('exact');
    expect(results[0].distance).toBeLessThan(0.01); // Nearly zero distance
    expect(results[0].similarity).toBeGreaterThan(0.99); // Nearly 1.0 similarity
  });
});

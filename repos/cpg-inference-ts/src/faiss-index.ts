/**
 * Vector Similarity Search Index - Using USearch for code embeddings
 *
 * USearch provides fast, efficient nearest neighbor search without complex dependencies
 */

import { Index } from 'usearch';

export interface SimilarityResult {
  id: string; // Component ID
  distance: number; // L2 distance
  similarity: number; // Cosine similarity (1 - distance/2)
}

export type IndexType = 'flat' | 'ivf';

export class FAISSIndex {
  private index: Index;
  private idMap: Map<number, string>; // Internal ID → component ID
  private reverseIdMap: Map<string, number>; // component ID → internal ID
  private dimension: number;
  private indexType: IndexType;
  private nextId: number;

  constructor(dimension: number, indexType: IndexType = 'flat') {
    this.dimension = dimension;
    this.indexType = indexType;
    this.idMap = new Map();
    this.reverseIdMap = new Map();
    this.nextId = 0;

    // Create USearch index
    // USearch automatically handles both exact and approximate search
    this.index = new Index({
      // @ts-ignore - USearch types are incomplete
      metric: 'l2sq', // L2 squared distance (matching FAISS behavior)
      dimensions: dimension,
      connectivity: indexType === 'flat' ? 0 : 16, // 0 = exact, >0 = HNSW approximate
    });
  }

  /**
   * Add a single embedding to the index
   */
  async add(componentId: string, embedding: Float32Array): Promise<void> {
    if (embedding.length !== this.dimension) {
      throw new Error(
        `Embedding dimension mismatch: expected ${this.dimension}, got ${embedding.length}`
      );
    }

    // Check if already exists
    if (this.reverseIdMap.has(componentId)) {
      throw new Error(`Component ${componentId} already exists in index`);
    }

    // Assign internal ID
    const internalId = this.nextId++;
    this.idMap.set(internalId, componentId);
    this.reverseIdMap.set(componentId, internalId);

    // Add to USearch index
    // @ts-ignore - USearch types are incomplete
    this.index.add(BigInt(internalId), embedding);
  }

  /**
   * Add multiple embeddings in batch
   */
  async addBatch(componentIds: string[], embeddings: Float32Array[]): Promise<void> {
    if (componentIds.length !== embeddings.length) {
      throw new Error('Number of IDs must match number of embeddings');
    }

    // Add each embedding
    for (let i = 0; i < componentIds.length; i++) {
      const componentId = componentIds[i];
      const embedding = embeddings[i];

      if (!componentId) {
        throw new Error(`Component ID at index ${i} is undefined`);
      }

      if (!embedding) {
        throw new Error(`Embedding at index ${i} is undefined`);
      }

      if (this.reverseIdMap.has(componentId)) {
        throw new Error(`Component ${componentId} already exists in index`);
      }

      const internalId = this.nextId++;
      this.idMap.set(internalId, componentId);
      this.reverseIdMap.set(componentId, internalId);

      // @ts-ignore - USearch types are incomplete
      this.index.add(BigInt(internalId), embedding);
    }
  }

  /**
   * Search for k nearest neighbors
   */
  async search(query: Float32Array, k: number): Promise<SimilarityResult[]> {
    if (query.length !== this.dimension) {
      throw new Error(
        `Query dimension mismatch: expected ${this.dimension}, got ${query.length}`
      );
    }

    if (this.idMap.size === 0) {
      return [];
    }

    // Limit k to index size
    const actualK = Math.min(k, this.idMap.size);

    // Perform search with USearch
    // @ts-ignore - USearch types are incomplete
    const results = this.index.search(query, actualK);

    // Convert to SimilarityResult format
    const output: SimilarityResult[] = [];

    for (let i = 0; i < results.keys.length; i++) {
      const key = results.keys[i];
      const dist = results.distances[i];

      if (key === undefined || dist === undefined) {
        console.warn(`Undefined key or distance at index ${i}`);
        continue;
      }

      const internalId = Number(key);
      const distance = Math.sqrt(dist); // USearch returns squared distance

      const componentId = this.idMap.get(internalId);
      if (!componentId) {
        console.warn(`Internal ID ${internalId} not found in ID map`);
        continue;
      }

      // Convert L2 distance to cosine similarity approximation
      // For normalized vectors: cosine_sim ≈ 1 - distance²/2
      const similarity = Math.max(0, 1 - (distance * distance) / 2);

      output.push({
        id: componentId,
        distance,
        similarity,
      });
    }

    return output;
  }

  /**
   * Remove a component from the index
   */
  async remove(componentId: string): Promise<void> {
    if (!this.reverseIdMap.has(componentId)) {
      throw new Error(`Component ${componentId} not found in index`);
    }

    const internalId = this.reverseIdMap.get(componentId)!;

    // USearch supports deletion
    this.index.remove(BigInt(internalId));

    // Update mappings
    this.reverseIdMap.delete(componentId);
    this.idMap.delete(internalId);
  }

  /**
   * Get the number of vectors in the index
   */
  size(): number {
    return this.idMap.size;
  }

  /**
   * Get the dimension of vectors
   */
  getDimension(): number {
    return this.dimension;
  }

  /**
   * Check if a component exists in the index
   */
  has(componentId: string): boolean {
    return this.reverseIdMap.has(componentId);
  }

  /**
   * Clear all vectors from the index
   */
  clear(): void {
    // Create a new USearch index
    this.index = new Index({
      // @ts-ignore - USearch types are incomplete
      metric: 'l2sq',
      dimensions: this.dimension,
      connectivity: this.indexType === 'flat' ? 0 : 16,
    });

    this.idMap.clear();
    this.reverseIdMap.clear();
    this.nextId = 0;
  }

  /**
   * Serialize the index to a buffer (for persistence)
   */
  serialize(): Buffer {
    const state = {
      dimension: this.dimension,
      indexType: this.indexType,
      idMap: Array.from(this.idMap.entries()),
      reverseIdMap: Array.from(this.reverseIdMap.entries()),
      nextId: this.nextId,
      // USearch index is saved separately via save() method
    };

    return Buffer.from(JSON.stringify(state), 'utf-8');
  }

  /**
   * Deserialize an index from a buffer
   */
  static deserialize(data: Buffer, dimension: number, indexType: IndexType): FAISSIndex {
    const state = JSON.parse(data.toString('utf-8'));

    const index = new FAISSIndex(dimension, indexType);
    index.idMap = new Map(state.idMap);
    index.reverseIdMap = new Map(state.reverseIdMap);
    index.nextId = state.nextId;

    // Note: USearch index data needs to be loaded separately via load() method
    return index;
  }

  /**
   * Save index to file (USearch native format)
   */
  save(filepath: string): void {
    this.index.save(filepath);
  }

  /**
   * Load index from file (USearch native format)
   */
  load(filepath: string): void {
    this.index.load(filepath);
  }
}

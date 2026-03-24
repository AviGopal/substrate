/**
 * Code Property Graph implementation
 *
 * Unified graph representation of code structure spanning entire codebase.
 */

import type {
  CPGNode,
  CPGEdge,
  FileMetadata,
  TraversalPath,
  TraversalOptions,
  QueryOptions,
  ICodePropertyGraph,
} from './types.js';
import { EdgeType } from './types.js';

export class CodePropertyGraph implements ICodePropertyGraph {
  language: string;
  nodes: Map<string, CPGNode>;
  edges: CPGEdge[];
  fileIndex: Map<string, FileMetadata>;

  // Adjacency caches for efficient traversal
  private adjacencyCache?: Map<string, Map<EdgeType, string[]>>;
  private reverseAdjacencyCache?: Map<string, Map<EdgeType, string[]>>;

  constructor(language: string = 'typescript') {
    this.language = language;
    this.nodes = new Map();
    this.edges = [];
    this.fileIndex = new Map();
  }

  /**
   * Add a node to the graph
   */
  addNode(node: CPGNode): void {
    this.nodes.set(node.id, node);
    this.clearCache(); // Invalidate caches
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edge: CPGEdge): void {
    this.edges.push(edge);
    this.clearCache(); // Invalidate caches
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): CPGNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Remove a node from the graph
   */
  removeNode(id: string): void {
    this.nodes.delete(id);
    // Remove edges connected to this node
    this.edges = this.edges.filter(
      (e) => e.sourceId !== id && e.targetId !== id
    );
    this.clearCache();
  }

  /**
   * Find nodes matching query options
   */
  findNodes(options: QueryOptions): CPGNode[] {
    let results = Array.from(this.nodes.values());

    if (options.nodeType !== undefined) {
      results = results.filter((n) => n.type === options.nodeType);
    }

    if (options.name !== undefined) {
      if (typeof options.name === 'string') {
        results = results.filter((n) => n.name === options.name);
      } else {
        // RegExp
        results = results.filter((n) => options.name instanceof RegExp && options.name.test(n.name));
      }
    }

    if (options.parentId !== undefined) {
      results = results.filter((n) => n.parentId === options.parentId);
    }

    if (options.limit !== undefined) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Find nodes by name (exact match or substring)
   */
  findByName(name: string): CPGNode[] {
    return Array.from(this.nodes.values()).filter((n) =>
      n.name.includes(name)
    );
  }

  /**
   * Find nodes that call the given node (callers)
   */
  findCallers(nodeId: string): CPGNode[] {
    this.buildAdjacencyCache();
    const callerIds =
      this.reverseAdjacencyCache?.get(nodeId)?.get(EdgeType.CALLS) || [];
    return callerIds.map((id) => this.getNode(id)).filter((n): n is CPGNode => n !== undefined);
  }

  /**
   * Find nodes called by the given node (callees)
   */
  findCallees(nodeId: string): CPGNode[] {
    this.buildAdjacencyCache();
    const calleeIds =
      this.adjacencyCache?.get(nodeId)?.get(EdgeType.CALLS) || [];
    return calleeIds.map((id) => this.getNode(id)).filter((n): n is CPGNode => n !== undefined);
  }

  /**
   * Traverse the graph starting from a node
   */
  traverse(
    startNodeId: string,
    options: TraversalOptions = {}
  ): TraversalPath[] {
    const paths: TraversalPath[] = [];
    const visited = new Set<string>();
    const { maxDepth = Infinity, edgeTypes, visitNode } = options;

    const dfs = (
      nodeId: string,
      path: string[],
      edges: CPGEdge[],
      depth: number
    ): void => {
      if (depth > maxDepth || visited.has(nodeId)) return;

      visited.add(nodeId);
      path.push(nodeId);

      // Call visit callback if provided
      if (visitNode) {
        const shouldContinue = visitNode(nodeId);
        if (shouldContinue === false) return;
      }

      // Find outgoing edges
      const outgoing = this.edges.filter((e) => {
        if (e.sourceId !== nodeId) return false;
        if (edgeTypes && !edgeTypes.includes(e.type)) return false;
        return true;
      });

      if (outgoing.length === 0) {
        // Leaf node - add path
        paths.push({
          nodes: [...path],
          edges: [...edges],
          length: path.length,
        });
      } else {
        // Continue traversal
        for (const edge of outgoing) {
          dfs(edge.targetId, [...path], [...edges, edge], depth + 1);
        }
      }
    };

    dfs(startNodeId, [], [], 0);
    return paths;
  }

  /**
   * Build adjacency caches for efficient lookups
   */
  buildAdjacencyCache(): void {
    if (this.adjacencyCache && this.reverseAdjacencyCache) return;

    this.adjacencyCache = new Map();
    this.reverseAdjacencyCache = new Map();

    for (const edge of this.edges) {
      // Forward adjacency (source -> targets)
      if (!this.adjacencyCache.has(edge.sourceId)) {
        this.adjacencyCache.set(edge.sourceId, new Map());
      }
      const sourceMap = this.adjacencyCache.get(edge.sourceId)!;
      if (!sourceMap.has(edge.type)) {
        sourceMap.set(edge.type, []);
      }
      sourceMap.get(edge.type)!.push(edge.targetId);

      // Reverse adjacency (target -> sources)
      if (!this.reverseAdjacencyCache.has(edge.targetId)) {
        this.reverseAdjacencyCache.set(edge.targetId, new Map());
      }
      const targetMap = this.reverseAdjacencyCache.get(edge.targetId)!;
      if (!targetMap.has(edge.type)) {
        targetMap.set(edge.type, []);
      }
      targetMap.get(edge.type)!.push(edge.sourceId);
    }
  }

  /**
   * Clear adjacency caches
   */
  clearCache(): void {
    this.adjacencyCache = undefined;
    this.reverseAdjacencyCache = undefined;
  }
}

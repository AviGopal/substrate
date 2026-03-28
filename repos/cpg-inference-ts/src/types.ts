/**
 * Core type definitions for CPG inference
 *
 * Language-agnostic representation of code structure and relationships.
 */

/**
 * CPG node types representing code hierarchy
 */
export enum NodeType {
  FILE = 'file',
  CLASS = 'class',
  FUNCTION = 'function',
  METHOD = 'method',
  STATEMENT = 'statement',
  EXPRESSION = 'expression',
}

/**
 * CPG edge types representing relationships
 */
export enum EdgeType {
  CONTAINS = 'contains',      // Parent-child containment
  CALLS = 'calls',             // Function/method call
  DEPENDS = 'depends',         // Data/control dependency
  INHERITS = 'inherits',       // Class inheritance
  IMPORTS = 'imports',         // Module/file imports
}

/**
 * A node in the Code Property Graph
 *
 * Represents a code element (file, class, function, statement, etc.)
 * with associated metadata and metrics.
 */
export interface CPGNode {
  id: string;                   // Unique identifier
  type: NodeType;              // Type of code element
  name: string;                // Name of the element (function name, class name, etc.)
  startLine: number;           // Starting line number (1-indexed)
  endLine: number;             // Ending line number (inclusive)
  startByte?: number;          // Starting byte offset
  endByte?: number;            // Ending byte offset
  sourceText?: string;         // Original source code text
  language?: string;           // Source language (default: typescript)

  // Metadata
  parentId?: string;           // ID of parent node
  childrenIds: string[];       // IDs of child nodes

  // Metrics
  complexity?: number;         // Cyclomatic complexity
  linesOfCode?: number;        // Non-blank, non-comment lines
  numParams?: number;          // Number of parameters (for functions/methods)
  depth?: number;              // Depth in hierarchy (0 = file level)

  // AST metadata (flexible storage for language-specific details)
  astMetadata?: Record<string, unknown>;
}

/**
 * An edge in the Code Property Graph
 *
 * Represents a relationship between two code elements.
 */
export interface CPGEdge {
  sourceId: string;            // ID of source node
  targetId: string;            // ID of target node
  type: EdgeType;              // Type of relationship
  metadata?: Record<string, unknown>;  // Additional info
}

/**
 * Track file state in global CPG
 */
export interface FileMetadata {
  filePath: string;
  contentHash: string;         // Hash of file content for change detection
  nodeIds: Set<string>;        // Nodes from this file
  imports: string[];           // Module names imported
  exports: Set<string>;        // Exported symbol node IDs
  lastUpdated: Date;
}

/**
 * Tree-sitter AST node representation
 */
export interface TreeSitterNode {
  type: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  text: string;
  children?: TreeSitterNode[];
  parent?: TreeSitterNode;
  namedChildren?: TreeSitterNode[];
}

/**
 * Language configuration for parsing
 */
export interface LanguageConfig {
  name: string;
  extensions: string[];
  parser: unknown;             // Tree-sitter parser instance
  parserLanguage?: unknown;    // Tree-sitter language object
}

/**
 * Query result from tree-sitter queries
 */
export interface QueryResult {
  matches: Array<{
    pattern: number;
    captures: Array<{
      name: string;
      node: TreeSitterNode;
    }>;
  }>;
}

/**
 * Traversal path through the graph
 */
export interface TraversalPath {
  nodes: string[];             // Node IDs in path
  edges: CPGEdge[];            // Edges connecting nodes
  length: number;              // Path length
}

/**
 * Options for graph traversal
 */
export interface TraversalOptions {
  maxDepth?: number;           // Maximum traversal depth
  edgeTypes?: EdgeType[];      // Edge types to follow
  visitNode?: (nodeId: string) => boolean | void;  // Visit callback
}

/**
 * Query options for finding nodes
 */
export interface QueryOptions {
  nodeType?: NodeType;         // Filter by node type
  name?: string | RegExp;      // Filter by name
  parentId?: string;           // Filter by parent
  limit?: number;              // Maximum results
}

/**
 * Code Property Graph interface
 *
 * Unified graph representation spanning entire codebase.
 */
export interface ICodePropertyGraph {
  language: string;
  nodes: Map<string, CPGNode>;
  edges: CPGEdge[];
  fileIndex: Map<string, FileMetadata>;

  // Core operations
  addNode(node: CPGNode): void;
  addEdge(edge: CPGEdge): void;
  getNode(id: string): CPGNode | undefined;
  removeNode(id: string): void;

  // Query operations
  findNodes(options: QueryOptions): CPGNode[];
  findByName(name: string): CPGNode[];
  findCallers(nodeId: string): CPGNode[];
  findCallees(nodeId: string): CPGNode[];

  // Traversal operations
  traverse(startNodeId: string, options?: TraversalOptions): TraversalPath[];

  // Cache operations
  buildAdjacencyCache(): void;
  clearCache(): void;
}

/**
 * Graph Builder - Converts tree-sitter AST to Code Property Graph
 *
 * Extracts code elements (functions, classes, variables, imports) and relationships (calls, contains, references).
 */

import { SourceParser } from './parser.js';
import { CodePropertyGraph } from './graph.js';
import { NodeType, EdgeType } from './types.js';
import type { CPGNode, TreeSitterNode, FileMetadata } from './types.js';
import crypto from 'crypto';

/**
 * Graph Builder - Converts AST to CPG
 */
export class GraphBuilder {
  private parser: SourceParser;
  private cpg: CodePropertyGraph;
  private nodeIdCounter: number;
  private currentFile: string;

  constructor(cpg?: CodePropertyGraph) {
    this.parser = new SourceParser();
    this.cpg = cpg || new CodePropertyGraph();
    this.nodeIdCounter = 0;
    this.currentFile = '';
  }

  /**
   * Add a file to the graph
   */
  addFile(filePath: string, sourceCode: string): FileMetadata {
    this.currentFile = filePath;
    this.nodeIdCounter = 0;

    // Parse source code
    const ast = this.parser.parseFile(filePath, sourceCode);

    // Extract nodes and edges
    const fileNodeId = this.generateNodeId('file');
    const fileNode: CPGNode = {
      id: fileNodeId,
      type: NodeType.FILE,
      name: filePath,
      startLine: 0,
      endLine: ast.endPosition.row + 1,
      childrenIds: [],
    };

    this.cpg.addNode(fileNode);

    // Process AST recursively
    this.processNode(ast, fileNodeId);

    // Create file metadata
    const contentHash = crypto.createHash('sha256').update(sourceCode).digest('hex');
    const nodeIds = Array.from(this.cpg.nodes.values())
      .filter(n => n.name.startsWith(filePath) || n.id.startsWith(fileNodeId))
      .map(n => n.id);

    const metadata: FileMetadata = {
      filePath,
      contentHash,
      nodeIds: new Set(nodeIds),
      imports: this.extractImports(ast),
      exports: new Set(this.extractExports(ast)),
      lastUpdated: new Date(),
    };

    this.cpg.fileIndex.set(filePath, metadata);

    return metadata;
  }

  /**
   * Process AST node recursively
   */
  private processNode(node: TreeSitterNode, parentId: string): void {
    // Extract different node types
    switch (node.type) {
      case 'function_declaration':
      case 'function':
      case 'arrow_function':
      case 'function_expression':
      case 'function_definition':  // Python
        this.processFunctionNode(node, parentId);
        break;

      case 'class_declaration':
      case 'class':
      case 'class_definition':  // Python
        this.processClassNode(node, parentId);
        break;

      case 'method_definition':
        this.processMethodNode(node, parentId);
        break;

      case 'lexical_declaration':
      case 'variable_declaration':
        this.processVariableNode(node, parentId);
        break;

      case 'import_statement':
      case 'import_from_statement':
        this.processImportNode(node, parentId);
        break;

      default:
        // Recursively process children
        if (node.namedChildren) {
          for (const child of node.namedChildren) {
            this.processNode(child, parentId);
          }
        }
        break;
    }
  }

  /**
   * Process function node
   */
  private processFunctionNode(node: TreeSitterNode, parentId: string): void {
    const name = this.extractName(node) || '<anonymous>';
    const nodeId = this.generateNodeId('function', name);

    const cpgNode: CPGNode = {
      id: nodeId,
      type: NodeType.FUNCTION,
      name,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      parentId,
      childrenIds: [],
      sourceText: node.text,
    };

    this.cpg.addNode(cpgNode);

    // Add containment edge
    this.cpg.addEdge({
      sourceId: parentId,
      targetId: nodeId,
      type: EdgeType.CONTAINS,
    });

    // Update parent's children
    const parent = this.cpg.getNode(parentId);
    if (parent) {
      parent.childrenIds.push(nodeId);
    }

    // Process function body for calls and references
    this.processCalls(node, nodeId);

    // Process children
    if (node.namedChildren) {
      for (const child of node.namedChildren) {
        this.processNode(child, nodeId);
      }
    }
  }

  /**
   * Process class node
   */
  private processClassNode(node: TreeSitterNode, parentId: string): void {
    const name = this.extractName(node) || '<anonymous>';
    const nodeId = this.generateNodeId('class', name);

    const cpgNode: CPGNode = {
      id: nodeId,
      type: NodeType.CLASS,
      name,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      parentId,
      childrenIds: [],
      sourceText: node.text,
    };

    this.cpg.addNode(cpgNode);

    // Add containment edge
    this.cpg.addEdge({
      sourceId: parentId,
      targetId: nodeId,
      type: EdgeType.CONTAINS,
    });

    // Update parent's children
    const parent = this.cpg.getNode(parentId);
    if (parent) {
      parent.childrenIds.push(nodeId);
    }

    // Process class body
    if (node.namedChildren) {
      for (const child of node.namedChildren) {
        this.processNode(child, nodeId);
      }
    }
  }

  /**
   * Process method node
   */
  private processMethodNode(node: TreeSitterNode, parentId: string): void {
    const name = this.extractName(node) || '<anonymous>';
    const nodeId = this.generateNodeId('method', name);

    const cpgNode: CPGNode = {
      id: nodeId,
      type: NodeType.METHOD,
      name,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      parentId,
      childrenIds: [],
      sourceText: node.text,
    };

    this.cpg.addNode(cpgNode);

    // Add containment edge
    this.cpg.addEdge({
      sourceId: parentId,
      targetId: nodeId,
      type: EdgeType.CONTAINS,
    });

    // Update parent's children
    const parent = this.cpg.getNode(parentId);
    if (parent) {
      parent.childrenIds.push(nodeId);
    }

    // Process method body for calls
    this.processCalls(node, nodeId);

    // Process children
    if (node.namedChildren) {
      for (const child of node.namedChildren) {
        this.processNode(child, nodeId);
      }
    }
  }

  /**
   * Process variable node
   */
  private processVariableNode(node: TreeSitterNode, parentId: string): void {
    // Variables are not primary nodes in CPG, but we track them as metadata
    // This could be expanded to create nodes for important variables
    // For now, we just continue processing children
    if (node.namedChildren) {
      for (const child of node.namedChildren) {
        this.processNode(child, parentId);
      }
    }
  }

  /**
   * Process import node
   */
  private processImportNode(node: TreeSitterNode, parentId: string): void {
    // Extract import information and create edges
    // This is a simplified version - real implementation would be more sophisticated
    if (node.namedChildren) {
      for (const child of node.namedChildren) {
        this.processNode(child, parentId);
      }
    }
  }

  /**
   * Process function/method calls
   */
  private processCalls(node: TreeSitterNode, callerId: string): void {
    // Recursively find call expressions
    this.findCallExpressions(node, callerId);
  }

  /**
   * Find call expressions in AST
   */
  private findCallExpressions(node: TreeSitterNode, callerId: string): void {
    if (node.type === 'call_expression' || node.type === 'call') {
      // Extract callee name
      const calleeName = this.extractCallName(node);
      if (calleeName) {
        // Find target node (simplified - real implementation would resolve scope)
        const targetNodes = this.cpg.findByName(calleeName);

        // Create call edge if target found
        if (targetNodes.length > 0) {
          for (const target of targetNodes) {
            // Avoid self-loops
            if (target.id !== callerId) {
              this.cpg.addEdge({
                sourceId: callerId,
                targetId: target.id,
                type: EdgeType.CALLS,
              });
            }
          }
        } else {
          // Target not in CPG yet - create a placeholder edge
          // Real implementation would handle external/library calls
        }
      }
    }

    // Recursively process children
    if (node.children) {
      for (const child of node.children) {
        this.findCallExpressions(child, callerId);
      }
    }
  }

  /**
   * Extract name from AST node
   */
  private extractName(node: TreeSitterNode): string | null {
    // Look for identifier nodes
    if (node.namedChildren) {
      for (const child of node.namedChildren) {
        if (child.type === 'identifier' || child.type === 'property_identifier') {
          return child.text;
        }
      }
    }
    return null;
  }

  /**
   * Extract call name from call expression
   */
  private extractCallName(node: TreeSitterNode): string | null {
    // Try to find the function being called
    if (node.children && node.children.length > 0) {
      // First child is usually the callee
      const callee = node.children[0];

      if (!callee) {
        return null;
      }

      if (callee.type === 'identifier') {
        return callee.text;
      }

      if (callee.type === 'member_expression') {
        // For member expressions like obj.method(), extract method name
        const name = this.extractName(callee);
        if (name) return name;

        // Try to extract from property
        if (callee.namedChildren) {
          for (const child of callee.namedChildren) {
            if (child.type === 'property_identifier') {
              return child.text;
            }
          }
        }
      }
    }

    // Fallback to named children
    if (node.namedChildren && node.namedChildren.length > 0) {
      const callee = node.namedChildren[0];
      if (!callee) {
        return null;
      }
      if (callee.type === 'identifier') {
        return callee.text;
      }
    }

    return null;
  }

  /**
   * Extract imports from AST
   */
  private extractImports(node: TreeSitterNode): string[] {
    const imports: string[] = [];

    const findImports = (n: TreeSitterNode) => {
      if (n.type === 'import_statement' || n.type === 'import_from_statement') {
        // Extract module name
        if (n.namedChildren) {
          for (const child of n.namedChildren) {
            if (child.type === 'string') {
              // Remove quotes
              const moduleName = child.text.replace(/['"]/g, '');
              imports.push(moduleName);
            }
          }
        }
      }

      if (n.children) {
        for (const child of n.children) {
          findImports(child);
        }
      }
    };

    findImports(node);
    return imports;
  }

  /**
   * Extract exports from AST
   */
  private extractExports(node: TreeSitterNode): string[] {
    const exports: string[] = [];

    const findExports = (n: TreeSitterNode) => {
      if (n.type === 'export_statement') {
        const name = this.extractName(n);
        if (name) {
          exports.push(name);
        }
      }

      if (n.children) {
        for (const child of n.children) {
          findExports(child);
        }
      }
    };

    findExports(node);
    return exports;
  }

  /**
   * Generate unique node ID
   */
  private generateNodeId(type: string, name?: string): string {
    const id = `${this.currentFile}::${type}-${this.nodeIdCounter++}`;
    return name ? `${id}::${name}` : id;
  }

  /**
   * Get the built graph
   */
  getGraph(): CodePropertyGraph {
    return this.cpg;
  }
}

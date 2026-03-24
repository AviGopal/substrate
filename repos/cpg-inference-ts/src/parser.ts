/**
 * Tree-sitter parser for source code
 *
 * Provides language-agnostic AST parsing using tree-sitter.
 */

import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import type { TreeSitterNode, LanguageConfig } from './types.js';

/**
 * Language parser with tree-sitter support
 */
export class SourceParser {
  private parser: Parser;
  private languages: Map<string, LanguageConfig>;

  constructor() {
    this.parser = new Parser();
    this.languages = new Map();

    // Initialize supported languages
    this.registerLanguage({
      name: 'typescript',
      extensions: ['.ts', '.tsx'],
      parser: this.parser,
      parserLanguage: TypeScript.typescript,
    });

    this.registerLanguage({
      name: 'javascript',
      extensions: ['.js', '.jsx', '.mjs', '.cjs'],
      parser: this.parser,
      parserLanguage: JavaScript,
    });

    this.registerLanguage({
      name: 'python',
      extensions: ['.py', '.pyi'],
      parser: this.parser,
      parserLanguage: Python,
    });
  }

  /**
   * Register a new language configuration
   */
  registerLanguage(config: LanguageConfig): void {
    this.languages.set(config.name, config);
  }

  /**
   * Get language config by file extension
   */
  private getLanguageByExtension(filePath: string): LanguageConfig | null {
    for (const config of this.languages.values()) {
      if (config.extensions.some(ext => filePath.endsWith(ext))) {
        return config;
      }
    }
    return null;
  }

  /**
   * Parse source code and return normalized AST
   */
  parse(sourceCode: string, languageOrPath: string): TreeSitterNode {
    // Determine language
    let language: LanguageConfig | null = null;

    if (languageOrPath.includes('.')) {
      // Looks like a file path
      language = this.getLanguageByExtension(languageOrPath);
    } else {
      // Language name
      language = this.languages.get(languageOrPath) || null;
    }

    if (!language) {
      throw new Error(`Unsupported language: ${languageOrPath}`);
    }

    // Set parser language
    this.parser.setLanguage(language.parserLanguage);

    // Parse source code
    const tree = this.parser.parse(sourceCode);
    const rootNode = tree.rootNode;

    // Convert to normalized AST
    return this.normalizeNode(rootNode);
  }

  /**
   * Parse a file by path
   */
  parseFile(filePath: string, sourceCode: string): TreeSitterNode {
    return this.parse(sourceCode, filePath);
  }

  /**
   * Convert tree-sitter node to normalized AST node
   */
  private normalizeNode(node: Parser.SyntaxNode): TreeSitterNode {
    return {
      type: node.type,
      startPosition: {
        row: node.startPosition.row,
        column: node.startPosition.column,
      },
      endPosition: {
        row: node.endPosition.row,
        column: node.endPosition.column,
      },
      text: node.text,
      children: node.children.map(child => this.normalizeNode(child)),
      namedChildren: node.namedChildren.map(child => this.normalizeNode(child)),
    };
  }

  /**
   * Get list of supported languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.languages.keys());
  }

  /**
   * Get list of supported file extensions
   */
  getSupportedExtensions(): string[] {
    const extensions: string[] = [];
    for (const config of this.languages.values()) {
      extensions.push(...config.extensions);
    }
    return extensions;
  }
}

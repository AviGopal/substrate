"""Code Property Graph generation and manipulation.

This module provides a two-stage parsing pipeline:
1. Language-specific parser: Text → tree-sitter AST
2. Generic converter: tree-sitter AST → CPG

The CPG is a language-agnostic representation suitable for analysis.
"""

from cpg_inference.cpg.converter import ASTToCPGConverter
from cpg_inference.cpg.models import (
    CPGEdge,
    CPGNode,
    CodePropertyGraph,
    EdgeType,
    NodeType,
)
from cpg_inference.cpg.parsers import (
    ParseError,
    get_parser,
    get_parser_by_extension,
    list_supported_languages,
)
from cpg_inference.cpg.symbol_table import Symbol, SymbolTable


def parse_code(source_code: str, language: str = "python", filename: str | None = None) -> CodePropertyGraph:
    """Parse source code into a Code Property Graph.

    This is the main entry point for CPG generation.
    It orchestrates: Parser → tree-sitter AST → CPG

    Args:
        source_code: Source code as string
        language: Language name (default: 'python')
        filename: Optional filename (for language detection)

    Returns:
        CodePropertyGraph

    Raises:
        ParseError: If parsing fails
        ValueError: If language not supported

    Example:
        >>> code = '''
        ... def hello(name):
        ...     return f"Hello {name}"
        ... '''
        >>> cpg = parse_code(code, language='python')
        >>> print(cpg)
        CodePropertyGraph(language=python, nodes=2, edges=1)
    """
    # Get appropriate parser
    if filename:
        parser = get_parser_by_extension(filename)
        language = parser.language_name
    else:
        parser = get_parser(language)

    # Stage 1: Parse to tree-sitter AST
    tree = parser.parse(source_code)

    # Stage 2: Convert AST to CPG
    converter = ASTToCPGConverter(language=language)
    cpg = converter.convert(tree, source_code)

    return cpg


def parse_file(filepath: str, language: str | None = None) -> CodePropertyGraph:
    """Parse a source file into a Code Property Graph.

    Args:
        filepath: Path to source file
        language: Optional language override (auto-detected from extension)

    Returns:
        CodePropertyGraph

    Raises:
        ParseError: If parsing fails
        ValueError: If language not supported
        FileNotFoundError: If file doesn't exist
    """
    # Read file
    with open(filepath, encoding="utf-8") as f:
        source_code = f.read()

    # Parse (language auto-detected from filename)
    return parse_code(source_code, language=language or "python", filename=filepath)


__all__ = [
    # Main API
    "parse_code",
    "parse_file",
    # Models
    "CPGNode",
    "CPGEdge",
    "CodePropertyGraph",
    "NodeType",
    "EdgeType",
    # Parser utilities
    "ParseError",
    "get_parser",
    "list_supported_languages",
    # Converter
    "ASTToCPGConverter",
    # Symbol table
    "Symbol",
    "SymbolTable",
]


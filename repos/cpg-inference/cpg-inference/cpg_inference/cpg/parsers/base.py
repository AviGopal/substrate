"""Base class for language-specific parsers."""

from abc import ABC, abstractmethod

from tree_sitter import Language, Parser, Tree


class ParseError(Exception):
    """Raised when parsing fails."""

    pass


class LanguageParser(ABC):
    """Abstract base class for language-specific parsers.

    Subclasses implement language-specific parsing using tree-sitter.
    All parsers convert source code text → tree-sitter AST.
    """

    def __init__(self) -> None:
        """Initialize parser."""
        self.parser = Parser()
        self.language = self._get_language()
        self.parser.language = self.language

    @abstractmethod
    def _get_language(self) -> Language:
        """Get tree-sitter Language object for this parser.

        Returns:
            Language object

        Raises:
            ParseError: If language cannot be loaded
        """
        pass

    @property
    @abstractmethod
    def language_name(self) -> str:
        """Get name of the language this parser handles.

        Returns:
            Language name (e.g., 'python', 'java', 'javascript')
        """
        pass

    @property
    @abstractmethod
    def file_extensions(self) -> list[str]:
        """Get file extensions this parser handles.

        Returns:
            List of extensions (e.g., ['.py', '.pyw'])
        """
        pass

    def parse(self, source_code: str) -> Tree:
        """Parse source code into tree-sitter AST.

        Args:
            source_code: Source code as string

        Returns:
            tree-sitter Tree object

        Raises:
            ParseError: If parsing fails
        """
        if not isinstance(source_code, str):
            raise ParseError("Source code must be a string")

        try:
            # Convert to bytes for tree-sitter
            source_bytes = source_code.encode("utf-8")
            tree = self.parser.parse(source_bytes)

            if tree.root_node is None:
                raise ParseError("Failed to parse: root node is None")

            # Check for parse errors
            if tree.root_node.has_error:
                raise ParseError(f"Parse tree contains errors at {self._find_error_location(tree)}")

            return tree

        except Exception as e:
            if isinstance(e, ParseError):
                raise
            raise ParseError(f"Parsing failed: {e}") from e

    def _find_error_location(self, tree: Tree) -> str:
        """Find location of first parse error.

        Args:
            tree: Tree to search

        Returns:
            Human-readable error location
        """
        # Traverse tree to find ERROR nodes
        def find_error(node):  # type: ignore
            if node.type == "ERROR":
                return f"line {node.start_point[0] + 1}, col {node.start_point[1] + 1}"
            for child in node.children:
                result = find_error(child)
                if result:
                    return result
            return None

        error_loc = find_error(tree.root_node)
        return error_loc or "unknown location"

    def can_parse(self, filename: str) -> bool:
        """Check if this parser can handle a file.

        Args:
            filename: File name or path

        Returns:
            True if file extension matches
        """
        return any(filename.endswith(ext) for ext in self.file_extensions)


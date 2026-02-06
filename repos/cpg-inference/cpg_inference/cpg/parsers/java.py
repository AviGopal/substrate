"""Java language parser using tree-sitter."""

from tree_sitter import Language

try:
    from tree_sitter_java import language as java_language
except ImportError as e:
    raise ImportError(
        "tree-sitter-java not installed. Install with: pip install tree-sitter-java"
    ) from e

from cpg_inference.cpg.parsers.base import LanguageParser, ParseError


class JavaParser(LanguageParser):
    """Parser for Java source code.

    Uses tree-sitter-java to parse Java code into AST.
    """

    def _get_language(self) -> Language:
        """Get Java Language object.

        Returns:
            Java Language object

        Raises:
            ParseError: If Java language cannot be loaded
        """
        try:
            # java_language() returns a PyCapsule, wrap it in Language
            return Language(java_language())
        except Exception as e:
            raise ParseError(f"Failed to load Java language: {e}") from e

    @property
    def language_name(self) -> str:
        """Get language name.

        Returns:
            'java'
        """
        return "java"

    @property
    def file_extensions(self) -> list[str]:
        """Get Java file extensions.

        Returns:
            List of Java extensions
        """
        return [".java"]


"""Python language parser using tree-sitter."""

from tree_sitter import Language

try:
    from tree_sitter_python import language as python_language
except ImportError as e:
    raise ImportError(
        "tree-sitter-python not installed. Install with: pip install tree-sitter-python"
    ) from e

from cpg_inference.cpg.parsers.base import LanguageParser, ParseError


class PythonParser(LanguageParser):
    """Parser for Python source code.

    Uses tree-sitter-python to parse Python code into AST.
    """

    def _get_language(self) -> Language:
        """Get Python Language object.

        Returns:
            Python Language object

        Raises:
            ParseError: If Python language cannot be loaded
        """
        try:
            # python_language() returns a PyCapsule, wrap it in Language
            return Language(python_language())
        except Exception as e:
            raise ParseError(f"Failed to load Python language: {e}") from e

    @property
    def language_name(self) -> str:
        """Get language name.

        Returns:
            'python'
        """
        return "python"

    @property
    def file_extensions(self) -> list[str]:
        """Get Python file extensions.

        Returns:
            List of Python extensions
        """
        return [".py", ".pyw", ".pyi"]


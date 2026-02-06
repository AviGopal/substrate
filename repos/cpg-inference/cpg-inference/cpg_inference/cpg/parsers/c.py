"""C parser using tree-sitter.

Provides parser for C that works with the CPG converter infrastructure.
"""

from tree_sitter import Language

from cpg_inference.cpg.parsers.base import LanguageParser, ParseError


class CParser(LanguageParser):
    """Parser for C code using tree-sitter."""

    def _get_language(self) -> Language:
        """Get C Language object.

        Returns:
            C Language object

        Raises:
            ParseError: If C language cannot be loaded
        """
        try:
            import tree_sitter_c as tsc

            return Language(tsc.language())
        except ImportError as e:
            raise ParseError(
                "tree-sitter-c not installed. "
                "Install with: pip install tree-sitter-c"
            ) from e
        except Exception as e:
            raise ParseError(f"Failed to load C language: {e}") from e

    @property
    def language_name(self) -> str:
        """Get language name.

        Returns:
            'c'
        """
        return "c"

    @property
    def file_extensions(self) -> list[str]:
        """Get C file extensions.

        Returns:
            List of C extensions
        """
        return [".c", ".h"]


"""PHP parser using tree-sitter.

Provides parser for PHP that works with the CPG converter infrastructure.
"""

from tree_sitter import Language

from cpg_inference.cpg.parsers.base import LanguageParser, ParseError


class PHPParser(LanguageParser):
    """Parser for PHP code using tree-sitter."""

    def _get_language(self) -> Language:
        """Get PHP Language object.

        Returns:
            PHP Language object

        Raises:
            ParseError: If PHP language cannot be loaded
        """
        try:
            import tree_sitter_php as tsphp

            return Language(tsphp.language())
        except ImportError as e:
            raise ParseError(
                "tree-sitter-php not installed. "
                "Install with: pip install tree-sitter-php"
            ) from e
        except Exception as e:
            raise ParseError(f"Failed to load PHP language: {e}") from e

    @property
    def language_name(self) -> str:
        """Get language name.

        Returns:
            'php'
        """
        return "php"

    @property
    def file_extensions(self) -> list[str]:
        """Get PHP file extensions.

        Returns:
            List of PHP extensions
        """
        return [".php"]


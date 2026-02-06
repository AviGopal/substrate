"""JavaScript/TypeScript parser using tree-sitter.

Provides parsers for JavaScript and TypeScript that work with the
CPG converter infrastructure.
"""

from tree_sitter import Language

from cpg_inference.cpg.parsers.base import LanguageParser, ParseError


class JavaScriptParser(LanguageParser):
    """Parser for JavaScript code using tree-sitter."""

    def _get_language(self) -> Language:
        """Get JavaScript Language object.

        Returns:
            JavaScript Language object

        Raises:
            ParseError: If JavaScript language cannot be loaded
        """
        try:
            import tree_sitter_javascript as tsjs

            return Language(tsjs.language())
        except ImportError as e:
            raise ParseError(
                "tree-sitter-javascript not installed. "
                "Install with: pip install tree-sitter-javascript"
            ) from e
        except Exception as e:
            raise ParseError(f"Failed to load JavaScript language: {e}") from e

    @property
    def language_name(self) -> str:
        """Get language name.

        Returns:
            'javascript'
        """
        return "javascript"

    @property
    def file_extensions(self) -> list[str]:
        """Get JavaScript file extensions.

        Returns:
            List of JavaScript extensions
        """
        return [".js", ".jsx", ".mjs"]


class TypeScriptParser(LanguageParser):
    """Parser for TypeScript code using tree-sitter."""

    def _get_language(self) -> Language:
        """Get TypeScript Language object.

        Returns:
            TypeScript Language object

        Raises:
            ParseError: If TypeScript language cannot be loaded
        """
        try:
            import tree_sitter_typescript as tsts

            return Language(tsts.language_typescript())
        except ImportError as e:
            raise ParseError(
                "tree-sitter-typescript not installed. "
                "Install with: pip install tree-sitter-typescript"
            ) from e
        except Exception as e:
            raise ParseError(f"Failed to load TypeScript language: {e}") from e

    @property
    def language_name(self) -> str:
        """Get language name.

        Returns:
            'typescript'
        """
        return "typescript"

    @property
    def file_extensions(self) -> list[str]:
        """Get TypeScript file extensions.

        Returns:
            List of TypeScript extensions
        """
        return [".ts", ".tsx"]

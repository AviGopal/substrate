"""Ruby parser using tree-sitter.

Provides parser for Ruby that works with the CPG converter infrastructure.
"""

from tree_sitter import Language

from cpg_inference.cpg.parsers.base import LanguageParser, ParseError


class RubyParser(LanguageParser):
    """Parser for Ruby code using tree-sitter."""

    def _get_language(self) -> Language:
        """Get Ruby Language object.

        Returns:
            Ruby Language object

        Raises:
            ParseError: If Ruby language cannot be loaded
        """
        try:
            import tree_sitter_ruby as tsruby

            return Language(tsruby.language())
        except ImportError as e:
            raise ParseError(
                "tree-sitter-ruby not installed. "
                "Install with: pip install tree-sitter-ruby"
            ) from e
        except Exception as e:
            raise ParseError(f"Failed to load Ruby language: {e}") from e

    @property
    def language_name(self) -> str:
        """Get language name.

        Returns:
            'ruby'
        """
        return "ruby"

    @property
    def file_extensions(self) -> list[str]:
        """Get Ruby file extensions.

        Returns:
            List of Ruby extensions
        """
        return [".rb"]


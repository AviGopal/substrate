"""Language parser registry and factory."""

from cpg_inference.cpg.parsers.base import LanguageParser, ParseError
from cpg_inference.cpg.parsers.c import CParser
from cpg_inference.cpg.parsers.cpp import CppParser
from cpg_inference.cpg.parsers.java import JavaParser
from cpg_inference.cpg.parsers.javascript import JavaScriptParser, TypeScriptParser
from cpg_inference.cpg.parsers.php import PHPParser
from cpg_inference.cpg.parsers.python import PythonParser
from cpg_inference.cpg.parsers.ruby import RubyParser

# Registry of available parsers
_PARSER_REGISTRY: dict[str, type[LanguageParser]] = {
    "python": PythonParser,
    "java": JavaParser,
    "javascript": JavaScriptParser,
    "typescript": TypeScriptParser,
    "c": CParser,
    "cpp": CppParser,
    "php": PHPParser,
    "ruby": RubyParser,
}


def get_parser(language: str) -> LanguageParser:
    """Get parser for a specific language.

    Args:
        language: Language name (e.g., 'python', 'java')

    Returns:
        Parser instance

    Raises:
        ValueError: If language not supported
    """
    language = language.lower()
    parser_class = _PARSER_REGISTRY.get(language)

    if parser_class is None:
        supported = ", ".join(_PARSER_REGISTRY.keys())
        raise ValueError(f"Language '{language}' not supported. Supported: {supported}")

    return parser_class()


def get_parser_by_extension(filename: str) -> LanguageParser:
    """Get parser based on file extension.

    Args:
        filename: File name or path

    Returns:
        Parser instance

    Raises:
        ValueError: If no parser found for extension
    """
    # Try each parser to see if it can handle this file
    for parser_class in _PARSER_REGISTRY.values():
        parser = parser_class()
        if parser.can_parse(filename):
            return parser

    raise ValueError(f"No parser found for file: {filename}")


def register_parser(language: str, parser_class: type[LanguageParser]) -> None:
    """Register a new language parser.

    Args:
        language: Language name
        parser_class: Parser class to register
    """
    _PARSER_REGISTRY[language.lower()] = parser_class


def list_supported_languages() -> list[str]:
    """Get list of supported languages.

    Returns:
        List of language names
    """
    return list(_PARSER_REGISTRY.keys())


__all__ = [
    "LanguageParser",
    "ParseError",
    "PythonParser",
    "JavaParser",
    "JavaScriptParser",
    "TypeScriptParser",
    "CParser",
    "CppParser",
    "PHPParser",
    "RubyParser",
    "get_parser",
    "get_parser_by_extension",
    "register_parser",
    "list_supported_languages",
]


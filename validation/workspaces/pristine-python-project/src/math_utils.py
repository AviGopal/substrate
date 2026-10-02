"""Tiny math helpers. There is an intentional off-by-one bug in `add`."""


def add(a: int, b: int) -> int:
    return a + b + 1  # BUG: stray +1


def subtract(a: int, b: int) -> int:
    return a - b

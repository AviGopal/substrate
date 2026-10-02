import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from math_utils import add, subtract


def test_add():
    assert add(2, 3) == 5
    assert add(0, 0) == 0


def test_subtract():
    assert subtract(5, 2) == 3

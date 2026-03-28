"""Tests for format_duration utility."""

import pytest
from format_duration import format_duration


def test_format_duration_seconds():
    assert format_duration(30) == "30s"
    assert format_duration(0) == "0s"


def test_format_duration_minutes():
    assert format_duration(90) == "1m 30s"
    assert format_duration(120) == "2m"


def test_format_duration_hours():
    assert format_duration(3665) == "1h 1m 5s"
    assert format_duration(3600) == "1h"


def test_format_duration_negative():
    assert format_duration(-10) == "0s"

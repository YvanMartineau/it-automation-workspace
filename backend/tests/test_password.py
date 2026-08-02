"""Tests for services/password_policy.py."""
import secrets

import pytest

from services.password_policy import (
    ALL_CHARS,
    DIGITS,
    LOWER,
    SYMBOLS,
    UPPER,
    generate_secure_password,
    validate_password_policy,
)


def test_password_uses_secrets_module(monkeypatch):
    """
    Verifies generation is backed by the `secrets` CSPRNG, not `random`.
    We spy on secrets.choice rather than mocking it away entirely, so the
    real generation logic still runs end-to-end.
    """
    call_count = 0
    original_choice = secrets.choice

    def spy_choice(seq):
        nonlocal call_count
        call_count += 1
        return original_choice(seq)

    monkeypatch.setattr(secrets, "choice", spy_choice)
    generate_secure_password()

    assert call_count > 0, "generate_secure_password() must call secrets.choice()"


def test_password_entropy_1000_iterations():
    """All 1000 generated passwords must independently pass policy validation."""
    for _ in range(1000):
        password = generate_secure_password()
        validate_password_policy(password)  # raises on any failure


def test_password_length_minimum():
    for _ in range(100):
        assert len(generate_secure_password()) >= 16


def test_password_complexity():
    for _ in range(100):
        password = generate_secure_password()
        assert any(c in UPPER for c in password)
        assert any(c in LOWER for c in password)
        assert any(c in DIGITS for c in password)
        assert any(c in SYMBOLS for c in password)


def test_generate_rejects_short_length():
    with pytest.raises(ValueError, match="at least 16"):
        generate_secure_password(length=8)


@pytest.mark.parametrize(
    "bad_password,expected_message",
    [
        ("Short1!", "16 characters"),
        ("nouppercase123!!!!", "uppercase"),
        ("NOLOWERCASE123!!!!", "lowercase"),
        ("NoDigitsHereAtAll!!!", "digit"),
        ("NoSymbolsHere12345678", "symbol"),
    ],
)
def test_validate_rejects_policy_violations(bad_password, expected_message):
    with pytest.raises(ValueError, match=expected_message):
        validate_password_policy(bad_password)


def test_no_char_outside_defined_pools():
    """Guards against accidental inclusion of ambiguous/unintended characters."""
    password = generate_secure_password()
    assert all(c in ALL_CHARS for c in password)
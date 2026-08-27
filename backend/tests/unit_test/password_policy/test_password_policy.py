import re
import pytest

from services.password_policy import (
    generate_secure_password,
    validate_password_policy,
    UPPER,
    LOWER,
    DIGITS,
    SYMBOLS,
    MIN_LENGTH,
    DEFAULT_LENGTH,
)


class TestGenerateSecurePassword:
    def test_default_length(self):
        password = generate_secure_password()
        assert len(password) == DEFAULT_LENGTH

    def test_custom_length(self):
        password = generate_secure_password(length=24)
        assert len(password) == 24

    def test_contains_required_character_classes(self):
        password = generate_secure_password()
        # at least 2 from each class
        assert sum(c in UPPER for c in password) >= 2
        assert sum(c in LOWER for c in password) >= 2
        assert sum(c in DIGITS for c in password) >= 2
        assert sum(c in SYMBOLS for c in password) >= 2

    def test_length_below_min_raises(self):
        with pytest.raises(ValueError):
            generate_secure_password(length=MIN_LENGTH - 1)

    def test_uses_secrets_choice(self, monkeypatch):
        import secrets

        called = False

        def fake_choice(pool):
            nonlocal called
            called = True
            return pool[0]

        monkeypatch.setattr(secrets, "choice", fake_choice)
        generate_secure_password()
        assert called


class TestValidatePasswordPolicy:
    def test_valid_password(self):
        validate_password_policy("Aa1!Aa1!Aa1!Aa1!")  # 16 chars, all classes

    def test_too_short(self):
        with pytest.raises(ValueError, match="at least"):
            validate_password_policy("Aa1!Aa1!")  # 8 chars

    def test_no_uppercase(self):
        with pytest.raises(ValueError, match="uppercase"):
            validate_password_policy("aa1!aa1!aa1!aa1!")

    def test_no_lowercase(self):
        with pytest.raises(ValueError, match="lowercase"):
            validate_password_policy("AA1!AA1!AA1!AA1!")

    def test_no_digit(self):
        with pytest.raises(ValueError, match="digit"):
            validate_password_policy("Aa!Aa!Aa!Aa!Aa!")

    def test_no_symbol(self):
        with pytest.raises(ValueError, match="symbol"):
            validate_password_policy("Aa1Aa1Aa1Aa1Aa1")
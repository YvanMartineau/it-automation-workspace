"""
Secure password generation and policy validation.
Uses the `secrets` module exclusively — a CSPRNG seeded from OS entropy.
NEVER use `random` here: it is not cryptographically secure and is
predictable given enough output, which is disqualifying for credential
generation in any security-conscious review.
"""

import secrets
import string

UPPER = string.ascii_uppercase
LOWER = string.ascii_lowercase
DIGITS = string.digits
SYMBOLS = "!@#$%^&*()-_=+[]{}"
ALL_CHARS = UPPER + LOWER + DIGITS + SYMBOLS

MIN_LENGTH = 16
DEFAULT_LENGTH = 20


def generate_secure_password(length: int = DEFAULT_LENGTH) -> str:
    """
    Generates a password guaranteed to contain at least 2 characters from
    each of: uppercase, lowercase, digits, symbols. Remaining length is
    filled from the full pool, then the whole sequence is shuffled so
    character-class positions aren't predictable (e.g. always
    "UUllDDss...").
    """
    if length < MIN_LENGTH:
        raise ValueError(f"Password length must be at least {MIN_LENGTH} characters")

    password_chars = []
    for pool in (UPPER, LOWER, DIGITS, SYMBOLS):
        password_chars.extend(secrets.choice(pool) for _ in range(2))

    remaining = length - len(password_chars)
    password_chars.extend(secrets.choice(ALL_CHARS) for _ in range(remaining))

    secrets.SystemRandom().shuffle(password_chars)
    return "".join(password_chars)


def validate_password_policy(password: str) -> None:
    """Raises ValueError with a specific message on the first unmet requirement."""
    if len(password) < MIN_LENGTH:
        raise ValueError(f"Password must be at least {MIN_LENGTH} characters long")
    if not any(c in UPPER for c in password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not any(c in LOWER for c in password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not any(c in DIGITS for c in password):
        raise ValueError("Password must contain at least one digit")
    if not any(c in SYMBOLS for c in password):
        raise ValueError("Password must contain at least one symbol")

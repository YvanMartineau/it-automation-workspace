"""
Password hashing and verification via passlib/bcrypt.
Separate from services/password_policy.py, which handles generation
of temporary passwords for onboarding — this file only hashes/verifies
credentials for login.
"""

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

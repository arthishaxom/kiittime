from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using pwdlib's recommended Argon2 config."""
    return password_hash.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored hash."""
    return password_hash.verify(plain_password, hashed_password)

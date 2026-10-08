from __future__ import annotations

import hashlib
import hmac
import secrets

from cryptography.fernet import Fernet, InvalidToken


SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1


def hash_password(password: str) -> dict[str, str | int]:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P)
    return {"algorithm": "scrypt", "n": SCRYPT_N, "r": SCRYPT_R, "p": SCRYPT_P,
            "salt": salt.hex(), "hash": digest.hex()}


def verify_password(password: str, stored: dict) -> bool:
    try:
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(stored["salt"]),
                                n=int(stored["n"]), r=int(stored["r"]), p=int(stored["p"]))
        return hmac.compare_digest(digest.hex(), stored["hash"])
    except (KeyError, ValueError, TypeError):
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def make_fernet(key: str) -> Fernet:
    if not key:
        raise ValueError("RAG_ENCRYPTION_KEY must be set")
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError) as exc:
        raise ValueError("RAG_ENCRYPTION_KEY must be a valid Fernet key") from exc


def encrypt_secret(key: str, value: str) -> str:
    return make_fernet(key).encrypt(value.encode()).decode()


def decrypt_secret(key: str, value: str) -> str:
    try:
        return make_fernet(key).decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Stored API key cannot be decrypted; re-enter it") from exc

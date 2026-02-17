from pathlib import Path
import os
from cryptography.fernet import Fernet
from django.conf import settings


def _ensure_key_file(path: Path) -> bytes:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        key = Fernet.generate_key()
        with open(path, 'wb') as f:
            f.write(key)
        os.chmod(path, 0o600)
        return key
    return path.read_bytes()


def get_cipher() -> Fernet:
    key = _ensure_key_file(settings.ENCRYPTION_KEY_FILE)
    return Fernet(key)


def encrypt_password(raw_password: str) -> bytes:
    return get_cipher().encrypt(raw_password.encode('utf-8'))


def decrypt_password(enc_password: bytes) -> str:
    return get_cipher().decrypt(enc_password).decode('utf-8')

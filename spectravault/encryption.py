"""AES-256-GCM encryption with PBKDF2 key derivation."""

import base64

from Crypto.Cipher import AES
from Crypto.Protocol.KDF import PBKDF2
from Crypto.Random import get_random_bytes


class MediGuardEncryptor:
    """AES-256-GCM with PBKDF2 key derivation. Password set at runtime."""

    def __init__(self, password: str):
        self._pw = password.encode()

    def encrypt(self, plaintext: str) -> str:
        salt = get_random_bytes(16)
        nonce = get_random_bytes(16)
        key = PBKDF2(self._pw, salt, dkLen=32, count=100_000)
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        ct, tag = cipher.encrypt_and_digest(plaintext.encode())
        return base64.b64encode(salt + nonce + tag + ct).decode()

    def decrypt(self, b64: str) -> str:
        raw = base64.b64decode(b64)
        salt, nonce, tag, ct = raw[:16], raw[16:32], raw[32:48], raw[48:]
        key = PBKDF2(self._pw, salt, dkLen=32, count=100_000)
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        return cipher.decrypt_and_verify(ct, tag).decode()

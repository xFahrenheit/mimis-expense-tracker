import hashlib
import secrets
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import json

class SecureDataManager:
    @staticmethod
    def derive_key_from_password(password: str, salt: bytes) -> bytes:
        """Derive encryption key from user password"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key

    @staticmethod
    def generate_salt() -> bytes:
        """Generate random salt for key derivation"""
        return secrets.token_bytes(32)

    @staticmethod
    def encrypt_data(data: dict, encryption_key: bytes) -> str:
        """Encrypt dictionary data and return base64 string"""
        fernet = Fernet(encryption_key)
        json_data = json.dumps(data).encode()
        encrypted_data = fernet.encrypt(json_data)
        return base64.urlsafe_b64encode(encrypted_data).decode()

    @staticmethod
    def decrypt_data(encrypted_data: str, encryption_key: bytes) -> dict:
        """Decrypt base64 string back to dictionary"""
        fernet = Fernet(encryption_key)
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
        decrypted_data = fernet.decrypt(encrypted_bytes)
        return json.loads(decrypted_data.decode())

def create_user_encryption_keys(password: str) -> tuple:
    """Create encryption keys for a new user"""
    salt = SecureDataManager.generate_salt()
    encryption_key = SecureDataManager.derive_key_from_password(password, salt)
    return encryption_key, salt

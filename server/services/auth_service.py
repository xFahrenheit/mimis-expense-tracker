import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta
from flask import jsonify, request, session
from .database_service import get_db_connection
from .encryption_service import create_user_encryption_keys, SecureDataManager
import base64

def hash_password(password):
    """Hash password with salt for security"""
    salt = secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}:{password_hash.hex()}"

def verify_password(password, stored_hash):
    """Verify password against stored hash"""
    try:
        salt, hash_hex = stored_hash.split(':')
        password_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return password_hash.hex() == hash_hex
    except:
        return False

def generate_session_token():
    """Generate secure session token"""
    return secrets.token_urlsafe(32)

def register_user(email, password, full_name):
    """Register a new user with encryption setup"""
    if len(password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters'})
    
    if not email or '@' not in email:
        return jsonify({'success': False, 'error': 'Valid email required'})
    
    if not full_name or len(full_name.strip()) < 2:
        return jsonify({'success': False, 'error': 'Full name required'})
    
    password_hash = hash_password(password)
    encryption_key, salt = create_user_encryption_keys(password)
    
    try:
        with get_db_connection() as conn:
            conn.execute('''
                INSERT INTO users (email, password_hash, full_name, encryption_salt)
                VALUES (?, ?, ?, ?)
            ''', (email.lower().strip(), password_hash, full_name.strip(), salt))
            conn.commit()
        return jsonify({'success': True, 'message': 'Account created successfully'})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Email already registered'})

def login_user(email, password):
    """Login user and create session"""
    with get_db_connection() as conn:
        cur = conn.execute('''
            SELECT id, password_hash, full_name, is_active, encryption_salt
            FROM users WHERE email = ?
        ''', (email.lower().strip(),))
        user = cur.fetchone()
        
        if not user or not user[3]:  # Check if user exists and is active
            return jsonify({'success': False, 'error': 'Invalid email or password'})
        
        if not verify_password(password, user[1]):
            return jsonify({'success': False, 'error': 'Invalid email or password'})
        
        # Create session
        session_token = generate_session_token()
        expires_at = datetime.now() + timedelta(days=30)  # 30 day session
        
        # Generate encryption key for this session
        encryption_key = SecureDataManager.derive_key_from_password(password, user[4])
        
        conn.execute('''
            INSERT INTO user_sessions (user_id, session_token, expires_at)
            VALUES (?, ?, ?)
        ''', (user[0], session_token, expires_at))
        conn.commit()
        
        return jsonify({
            'success': True,
            'user': {
                'id': user[0],
                'email': email.lower().strip(),
                'full_name': user[2]
            },
            'session_token': session_token,
            'encryption_key': base64.urlsafe_b64encode(encryption_key).decode()
        })

def logout_user(session_token):
    """Logout user by invalidating session"""
    with get_db_connection() as conn:
        conn.execute('DELETE FROM user_sessions WHERE session_token = ?', (session_token,))
        conn.commit()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

def verify_session(session_token):
    """Verify if session token is valid"""
    if not session_token:
        return None
    
    with get_db_connection() as conn:
        cur = conn.execute('''
            SELECT u.id, u.email, u.full_name, s.expires_at
            FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.session_token = ? AND s.expires_at > ?
        ''', (session_token, datetime.now()))
        user = cur.fetchone()
        
        if user:
            return {
                'id': user[0],
                'email': user[1],
                'full_name': user[2]
            }
    return None

def get_current_user():
    """Get current user from session"""
    session_token = request.headers.get('Authorization')
    if session_token and session_token.startswith('Bearer '):
        session_token = session_token[7:]  # Remove 'Bearer ' prefix
        return verify_session(session_token)
    return None

def require_auth(f):
    """Decorator to require authentication"""
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        request.current_user = user
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

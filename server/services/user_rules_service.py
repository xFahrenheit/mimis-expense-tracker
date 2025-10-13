import sqlite3
from flask import jsonify
from .database_service import get_db_connection

def get_all_user_rules():
    """Get all user override rules from the database."""
    try:
        with get_db_connection() as conn:
            cursor = conn.execute('''
                SELECT description, category, need_category 
                FROM user_overrides 
                ORDER BY description
            ''')
            user_rules = []
            for row in cursor.fetchall():
                user_rules.append({
                    'description': row[0],
                    'category': row[1] if row[1] else '',
                    'need_category': row[2] if row[2] else ''
                })
            return jsonify({'success': True, 'user_rules': user_rules})
    except Exception as e:
        print(f"Error fetching user rules: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def add_user_rule(description, category=None, need_category=None):
    """Add a new user override rule."""
    if not description or not description.strip():
        return jsonify({'success': False, 'error': 'Description is required'}), 400
    
    description = description.strip().lower()
    
    try:
        with get_db_connection() as conn:
            # Check if rule already exists
            existing = conn.execute(
                'SELECT description FROM user_overrides WHERE description = ?', 
                (description,)
            ).fetchone()
            
            if existing:
                return jsonify({'success': False, 'error': 'User rule already exists for this description'}), 409
            
            # Insert new rule
            conn.execute('''
                INSERT INTO user_overrides (description, category, need_category) 
                VALUES (?, ?, ?)
            ''', (description, category if category else None, need_category if need_category else None))
            
            conn.commit()
            
            return jsonify({
                'success': True, 
                'message': f'User rule added successfully for "{description}"'
            })
            
    except Exception as e:
        print(f"Error adding user rule: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def update_user_rule(description, category=None, need_category=None):
    """Update an existing user override rule."""
    if not description or not description.strip():
        return jsonify({'success': False, 'error': 'Description is required'}), 400
    
    description = description.strip().lower()
    
    try:
        with get_db_connection() as conn:
            # Check if rule exists
            existing = conn.execute(
                'SELECT description FROM user_overrides WHERE description = ?', 
                (description,)
            ).fetchone()
            
            if not existing:
                return jsonify({'success': False, 'error': 'User rule not found'}), 404
            
            # Update rule
            conn.execute('''
                UPDATE user_overrides 
                SET category = ?, need_category = ? 
                WHERE description = ?
            ''', (category if category else None, need_category if need_category else None, description))
            
            conn.commit()
            
            return jsonify({
                'success': True, 
                'message': f'User rule updated successfully for "{description}"'
            })
            
    except Exception as e:
        print(f"Error updating user rule: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def delete_user_rule(description):
    """Delete a user override rule."""
    if not description or not description.strip():
        return jsonify({'success': False, 'error': 'Description is required'}), 400
    
    description = description.strip().lower()
    
    try:
        with get_db_connection() as conn:
            # Check if rule exists
            existing = conn.execute(
                'SELECT description FROM user_overrides WHERE description = ?', 
                (description,)
            ).fetchone()
            
            if not existing:
                return jsonify({'success': False, 'error': 'User rule not found'}), 404
            
            # Delete rule
            conn.execute('DELETE FROM user_overrides WHERE description = ?', (description,))
            conn.commit()
            
            return jsonify({
                'success': True, 
                'message': f'User rule deleted successfully for "{description}"'
            })
            
    except Exception as e:
        print(f"Error deleting user rule: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def search_user_rules(search_term):
    """Search user override rules by description."""
    if not search_term:
        return get_all_user_rules()
    
    search_term = f"%{search_term.strip().lower()}%"
    
    try:
        with get_db_connection() as conn:
            cursor = conn.execute('''
                SELECT description, category, need_category 
                FROM user_overrides 
                WHERE description LIKE ?
                ORDER BY description
            ''', (search_term,))
            
            user_rules = []
            for row in cursor.fetchall():
                user_rules.append({
                    'description': row[0],
                    'category': row[1] if row[1] else '',
                    'need_category': row[2] if row[2] else ''
                })
            
            return jsonify({'success': True, 'user_rules': user_rules})
            
    except Exception as e:
        print(f"Error searching user rules: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
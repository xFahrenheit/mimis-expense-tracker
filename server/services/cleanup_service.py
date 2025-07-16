from services.database_service import get_db_connection

def cleanup_null_rows():
    with get_db_connection() as conn:
        cur = conn.execute('''
            DELETE FROM expenses
            WHERE date IS NULL OR date = ''
               OR description IS NULL OR description = ''
               OR amount IS NULL OR amount = ''
        ''')
        conn.commit()
    return {'success': True, 'message': 'Null/empty/zero rows deleted.'}

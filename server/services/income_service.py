import sqlite3
import json
from datetime import datetime, date
from flask import jsonify
from .database_service import get_db_connection

def add_monthly_offset(date_obj, months):
    """Add months to a date object"""
    month = date_obj.month - 1 + months
    year = date_obj.year + month // 12
    month = month % 12 + 1
    day = min(date_obj.day, [31,
        29 if year % 4 == 0 and not year % 100 == 0 or year % 400 == 0 else 28,
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)

def add_income_record(data):
    """Add a new income record"""
    try:
        with get_db_connection() as conn:
            conn.execute('''
                INSERT INTO income_records (amount, source, user, start_date, end_date, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                data['amount'],
                data['source'],
                data['user'],
                data['start_date'],
                data.get('end_date'),
                data.get('notes', ''),
                datetime.now().isoformat()
            ))
            conn.commit()
            return jsonify({'success': True, 'message': 'Income record added successfully'})
    except Exception as e:
        print(f"Error adding income record: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_all_income_records():
    """Get all income records"""
    try:
        with get_db_connection() as conn:
            cursor = conn.execute('''
                SELECT id, amount, source, user, start_date, end_date, notes, created_at
                FROM income_records
                ORDER BY start_date DESC
            ''')
            records = cursor.fetchall()
            
            income_records = []
            for record in records:
                income_records.append({
                    'id': record[0],
                    'amount': record[1],
                    'source': record[2],
                    'user': record[3],
                    'start_date': record[4],
                    'end_date': record[5],
                    'notes': record[6],
                    'created_at': record[7]
                })
            
            return jsonify({'success': True, 'income_records': income_records})
    except Exception as e:
        print(f"Error getting income records: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def update_income_record(record_id, data):
    """Update an existing income record"""
    try:
        with get_db_connection() as conn:
            conn.execute('''
                UPDATE income_records 
                SET amount = ?, source = ?, user = ?, start_date = ?, end_date = ?, notes = ?
                WHERE id = ?
            ''', (
                data['amount'],
                data['source'],
                data['user'],
                data['start_date'],
                data.get('end_date'),
                data.get('notes', ''),
                record_id
            ))
            conn.commit()
            
            if conn.total_changes == 0:
                return jsonify({'success': False, 'error': 'Income record not found'}), 404
            
            return jsonify({'success': True, 'message': 'Income record updated successfully'})
    except Exception as e:
        print(f"Error updating income record: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def delete_income_record(record_id):
    """Delete an income record"""
    try:
        with get_db_connection() as conn:
            conn.execute('DELETE FROM income_records WHERE id = ?', (record_id,))
            conn.commit()
            
            if conn.total_changes == 0:
                return jsonify({'success': False, 'error': 'Income record not found'}), 404
            
            return jsonify({'success': True, 'message': 'Income record deleted successfully'})
    except Exception as e:
        print(f"Error deleting income record: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_monthly_income(year, month):
    """Get the total monthly income for a specific month/year"""
    try:
        target_date = date(year, month, 1)
        
        with get_db_connection() as conn:
            cursor = conn.execute('''
                SELECT amount, start_date, end_date
                FROM income_records
                WHERE start_date <= ? AND (end_date IS NULL OR end_date >= ?)
            ''', (target_date.isoformat(), target_date.isoformat()))
            
            records = cursor.fetchall()
            total_income = 0
            
            for record in records:
                amount = record[0]
                start_date = datetime.fromisoformat(record[1]).date()
                end_date = datetime.fromisoformat(record[2]).date() if record[2] else None
                
                # Check if this income record applies to the target month
                if start_date <= target_date and (end_date is None or end_date >= target_date):
                    total_income += amount
            
            return jsonify({
                'success': True, 
                'year': year,
                'month': month,
                'total_income': total_income
            })
    except Exception as e:
        print(f"Error getting monthly income: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_income_distribution(start_date=None, end_date=None):
    """Get income distribution data for charts/analytics"""
    try:
        with get_db_connection() as conn:
            # Get all income records
            cursor = conn.execute('''
                SELECT amount, source, start_date, end_date
                FROM income_records
                ORDER BY start_date
            ''')
            records = cursor.fetchall()
            
            if not records:
                return jsonify({
                    'success': True,
                    'monthly_data': [],
                    'source_breakdown': [],
                    'total_income': 0
                })
            
            # Determine date range
            if not start_date:
                start_date = datetime.fromisoformat(records[0][2]).date()
            else:
                start_date = datetime.fromisoformat(start_date).date()
                
            if not end_date:
                end_date = date.today()
            else:
                end_date = datetime.fromisoformat(end_date).date()
            
            # Generate monthly data
            monthly_data = []
            source_totals = {}
            total_income = 0
            
            current_date = start_date.replace(day=1)  # Start from first of month
            
            while current_date <= end_date:
                month_income = 0
                month_sources = {}
                is_override = False
                override_notes = None
                
                # First check for manual override for this month
                cursor = conn.execute('''
                    SELECT amount, notes FROM monthly_income_overrides 
                    WHERE year = ? AND month = ?
                ''', (current_date.year, current_date.month))
                
                override = cursor.fetchone()
                
                if override:
                    # Use override values
                    month_income = override[0]
                    override_notes = override[1]
                    is_override = True
                    # Don't calculate from records when override exists
                else:
                    # Calculate from regular records
                    for record in records:
                        amount = record[0]
                        source = record[1]
                        record_start = datetime.fromisoformat(record[2]).date()
                        record_end = datetime.fromisoformat(record[3]).date() if record[3] else None
                        
                        # Check if this record applies to current month
                        if record_start <= current_date and (record_end is None or record_end >= current_date):
                            month_income += amount
                            month_sources[source] = month_sources.get(source, 0) + amount
                            source_totals[source] = source_totals.get(source, 0) + amount

                month_data = {
                    'year': current_date.year,
                    'month': current_date.month,
                    'month_name': current_date.strftime('%B %Y'),
                    'total_income': month_income,
                    'sources': month_sources,
                    'is_override': is_override
                }
                
                if override_notes:
                    month_data['notes'] = override_notes
                    
                monthly_data.append(month_data)
                
                total_income += month_income
                
                # Move to next month
                current_date = add_monthly_offset(current_date, 1)
            
            # Prepare source breakdown
            source_breakdown = [
                {'source': source, 'total': total}
                for source, total in source_totals.items()
            ]
            
            return jsonify({
                'success': True,
                'monthly_data': monthly_data,
                'source_breakdown': source_breakdown,
                'total_income': total_income,
                'date_range': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat()
                }
            })
            
    except Exception as e:
        print(f"Error getting income distribution: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def add_monthly_income_override(year, month, user, amount, notes=''):
    """Add a monthly income override for a specific month (retroactive changes)"""
    try:
        with get_db_connection() as conn:
            # Check if override already exists
            cursor = conn.execute('''
                SELECT id FROM monthly_income_overrides 
                WHERE year = ? AND month = ? AND user = ?
            ''', (year, month, user))
            
            existing = cursor.fetchone()
            
            if existing:
                # Update existing override
                conn.execute('''
                    UPDATE monthly_income_overrides 
                    SET amount = ?, notes = ?, updated_at = ?
                    WHERE year = ? AND month = ? AND user = ?
                ''', (amount, notes, datetime.now().isoformat(), year, month, user))
            else:
                # Create new override
                conn.execute('''
                    INSERT INTO monthly_income_overrides (year, month, user, amount, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (year, month, user, amount, notes, datetime.now().isoformat()))
            
            conn.commit()
            return jsonify({'success': True, 'message': f'Monthly income override set for {user} in {month}/{year}'})
            
    except Exception as e:
        print(f"Error adding monthly income override: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_monthly_income_with_overrides(year, month):
    """Get monthly income considering both regular records and manual overrides"""
    try:
        target_date = date(year, month, 1)
        
        with get_db_connection() as conn:
            # First check for manual override
            cursor = conn.execute('''
                SELECT amount, notes FROM monthly_income_overrides 
                WHERE year = ? AND month = ?
            ''', (year, month))
            
            override = cursor.fetchone()
            
            if override:
                return jsonify({
                    'success': True,
                    'year': year,
                    'month': month,
                    'total_income': override[0],
                    'notes': override[1],
                    'is_override': True
                })
            
            # No override, calculate from regular records
            cursor = conn.execute('''
                SELECT amount, source, start_date, end_date
                FROM income_records
                WHERE start_date <= ? AND (end_date IS NULL OR end_date >= ?)
            ''', (target_date.isoformat(), target_date.isoformat()))
            
            records = cursor.fetchall()
            total_income = 0
            sources = []
            
            for record in records:
                amount = record[0]
                source = record[1]
                start_date = datetime.fromisoformat(record[2]).date()
                end_date = datetime.fromisoformat(record[3]).date() if record[3] else None
                
                # Check if this income record applies to the target month
                if start_date <= target_date and (end_date is None or end_date >= target_date):
                    total_income += amount
                    sources.append({'source': source, 'amount': amount})
            
            return jsonify({
                'success': True,
                'year': year,
                'month': month,
                'total_income': total_income,
                'sources': sources,
                'is_override': False
            })
            
    except Exception as e:
        print(f"Error getting monthly income with overrides: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def delete_monthly_income_override(year, month):
    """Delete a monthly income override"""
    try:
        with get_db_connection() as conn:
            conn.execute('''
                DELETE FROM monthly_income_overrides 
                WHERE year = ? AND month = ?
            ''', (year, month))
            conn.commit()
            
            if conn.total_changes == 0:
                return jsonify({'success': False, 'error': 'Override not found'}), 404
            
            return jsonify({'success': True, 'message': f'Override for {month}/{year} deleted'})
            
    except Exception as e:
        print(f"Error deleting monthly income override: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
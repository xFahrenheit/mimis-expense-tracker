"""
Indian Bank Statement Parser
Handles various Indian bank statement formats including UPI payments, NEFT, IMPS, etc.
"""

import pandas as pd
import re
from datetime import datetime
import logging

class IndianBankParser:
    def __init__(self):
        self.date_patterns = [
            r'(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})',  # "19 Jul, 2025" or "19 Jul 2025"
            r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})',       # "19/07/2025" or "19-07-2025"
            r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})',       # "2025/07/19" or "2025-07-19"
            r'(\d{1,2})[/-](\d{1,2})[/-](\d{2})',       # "19/07/25" or "19-07-25"
        ]
        
        self.amount_patterns = [
            r'₹\s?([0-9,]+\.?\d*)',                     # "₹1000.00" or "₹ 1,000.00"
            r'Rs\.?\s?([0-9,]+\.?\d*)',                 # "Rs.1000.00" or "Rs 1000"
            r'INR\s?([0-9,]+\.?\d*)',                   # "INR 1000.00"
            r'([0-9,]+\.?\d*)\s?(?:INR|Rs\.?|₹)',       # "1000.00 INR"
        ]
        
        # Common Indian payment types
        self.payment_types = [
            'UPI payment', 'UPI', 'NEFT', 'IMPS', 'RTGS', 
            'Debit Card', 'Credit Card', 'ATM Withdrawal',
            'Net Banking', 'Mobile Banking', 'Online Transfer',
            'Cash Deposit', 'Cheque', 'DD', 'POS'
        ]
        
        # Month name mappings
        self.month_map = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
            'january': 1, 'february': 2, 'march': 3, 'april': 4,
            'june': 6, 'july': 7, 'august': 8, 'september': 9,
            'october': 10, 'november': 11, 'december': 12
        }

    def parse_date(self, date_str):
        """Parse various Indian date formats"""
        if pd.isna(date_str) or not date_str:
            return None
            
        date_str = str(date_str).strip()
        
        for pattern in self.date_patterns:
            match = re.search(pattern, date_str, re.IGNORECASE)
            if match:
                groups = match.groups()
                
                if len(groups) == 3:
                    if groups[1].isalpha():  # Month name format like "19 Jul, 2025"
                        day, month_name, year = groups
                        month = self.month_map.get(month_name.lower()[:3])
                        if month:
                            try:
                                return datetime(int(year), month, int(day)).strftime('%Y-%m-%d')
                            except ValueError:
                                continue
                    else:  # Numeric format
                        # Try different interpretations
                        try:
                            if len(groups[2]) == 4:  # Full year
                                if int(groups[1]) > 12:  # DD/MM/YYYY
                                    return datetime(int(groups[2]), int(groups[1]), int(groups[0])).strftime('%Y-%m-%d')
                                else:  # MM/DD/YYYY or DD/MM/YYYY - assume DD/MM/YYYY for Indian format
                                    return datetime(int(groups[2]), int(groups[1]), int(groups[0])).strftime('%Y-%m-%d')
                            else:  # 2-digit year
                                year = 2000 + int(groups[2]) if int(groups[2]) < 50 else 1900 + int(groups[2])
                                return datetime(year, int(groups[1]), int(groups[0])).strftime('%Y-%m-%d')
                        except ValueError:
                            continue
        
        return None

    def parse_amount(self, amount_str):
        """Parse Indian currency amounts"""
        if pd.isna(amount_str) or not amount_str:
            return 0.0
            
        amount_str = str(amount_str).strip()
        
        for pattern in self.amount_patterns:
            match = re.search(pattern, amount_str)
            if match:
                amount = match.group(1).replace(',', '')
                try:
                    return float(amount)
                except ValueError:
                    continue
        
        # Try to extract just numbers
        numbers = re.findall(r'([0-9,]+\.?\d*)', amount_str)
        if numbers:
            try:
                return float(numbers[0].replace(',', ''))
            except ValueError:
                pass
                
        return 0.0

    def categorize_transaction(self, description, payment_type=None):
        """Categorize transactions based on Indian context"""
        if not description:
            return "Other"
            
        description = str(description).lower()
        payment_type = str(payment_type).lower() if payment_type else ""
        
        # Food and dining
        if any(word in description for word in ['food', 'restaurant', 'cafe', 'hotel', 'dining', 'swiggy', 'zomato', 'dominos', 'pizza', 'junction']):
            return "Food & Dining"
            
        # Groceries and shopping
        if any(word in description for word in ['grocery', 'supermarket', 'store', 'mart', 'bazaar', 'shopping', 'meesho', 'amazon', 'flipkart']):
            return "Groceries"
            
        # Transportation
        if any(word in description for word in ['uber', 'ola', 'taxi', 'auto', 'bus', 'metro', 'petrol', 'fuel', 'parking']):
            return "Transportation"
            
        # Utilities
        if any(word in description for word in ['electricity', 'water', 'gas', 'internet', 'mobile', 'recharge', 'broadband', 'wifi']):
            return "Utilities"
            
        # Healthcare
        if any(word in description for word in ['hospital', 'clinic', 'doctor', 'pharmacy', 'medical', 'health', 'medicine']):
            return "Healthcare"
            
        # Entertainment
        if any(word in description for word in ['movie', 'cinema', 'entertainment', 'game', 'netflix', 'spotify', 'youtube']):
            return "Entertainment"
            
        # UPI to person (likely personal transfer)
        if 'upi' in payment_type and any(char.isupper() for char in str(description)):
            return "Personal Transfer"
            
        return "Other"

    def detect_columns(self, df):
        """Detect column mappings for Indian bank statements"""
        columns = [col.lower().strip() for col in df.columns]
        mapping = {}
        
        # Date column detection
        date_keywords = ['date', 'transaction date', 'value date', 'posting date']
        for col in columns:
            if any(keyword in col for keyword in date_keywords):
                mapping['date'] = df.columns[columns.index(col)]
                break
        
        # Description/Transaction name
        desc_keywords = ['description', 'transaction name', 'particulars', 'narration', 'details']
        for col in columns:
            if any(keyword in col for keyword in desc_keywords):
                mapping['description'] = df.columns[columns.index(col)]
                break
        
        # Amount
        amount_keywords = ['amount', 'debit', 'credit', 'transaction amount']
        for col in columns:
            if any(keyword in col for keyword in amount_keywords):
                mapping['amount'] = df.columns[columns.index(col)]
                break
        
        # Payment type
        type_keywords = ['payment type', 'transaction type', 'mode', 'type']
        for col in columns:
            if any(keyword in col for keyword in type_keywords):
                mapping['payment_type'] = df.columns[columns.index(col)]
                break
        
        # Category (if already present)
        cat_keywords = ['category', 'merchant category']
        for col in columns:
            if any(keyword in col for keyword in cat_keywords):
                mapping['category'] = df.columns[columns.index(col)]
                break
        
        return mapping

    def parse_statement(self, df):
        """Main parsing function for Indian bank statements"""
        if df.empty:
            return df
            
        # Detect column mappings
        column_mapping = self.detect_columns(df)
        
        # Create standardized dataframe
        parsed_data = []
        
        for _, row in df.iterrows():
            parsed_row = {}
            
            # Parse date
            if 'date' in column_mapping:
                parsed_row['date'] = self.parse_date(row[column_mapping['date']])
            
            # Parse description
            if 'description' in column_mapping:
                parsed_row['description'] = str(row[column_mapping['description']]).strip()
            
            # Parse amount
            if 'amount' in column_mapping:
                parsed_row['amount'] = self.parse_amount(row[column_mapping['amount']])
            
            # Get payment type
            payment_type = ""
            if 'payment_type' in column_mapping:
                payment_type = str(row[column_mapping['payment_type']]).strip()
                parsed_row['notes'] = f"Payment Type: {payment_type}"
            
            # Parse or generate category
            if 'category' in column_mapping and pd.notna(row[column_mapping['category']]):
                parsed_row['category'] = str(row[column_mapping['category']]).strip()
            else:
                parsed_row['category'] = self.categorize_transaction(
                    parsed_row.get('description', ''), 
                    payment_type
                )
            
            # Set default values
            parsed_row['card'] = 'Indian Bank'
            parsed_row['who'] = 'Member 1'  # Will be overridden by household config
            parsed_row['split_cost'] = False
            parsed_row['outlier'] = False
            parsed_row['need_category'] = 'Need'  # Will be auto-categorized later
            
            # Only add row if we have essential data
            if parsed_row.get('date') and parsed_row.get('amount', 0) > 0:
                parsed_data.append(parsed_row)
        
        return pd.DataFrame(parsed_data)

def parse_indian_bank_statement(filepath):
    """Main function to parse Indian bank statements"""
    try:
        # Try reading with different encodings
        encodings = ['utf-8', 'utf-8-sig', 'iso-8859-1', 'cp1252']
        df = None
        
        for encoding in encodings:
            try:
                df = pd.read_csv(filepath, encoding=encoding)
                break
            except UnicodeDecodeError:
                continue
        
        if df is None:
            raise ValueError("Could not read file with any supported encoding")
        
        # Remove empty rows
        df = df.dropna(how='all')
        
        # Initialize parser
        parser = IndianBankParser()
        
        # Parse the statement
        parsed_df = parser.parse_statement(df)
        
        logging.info(f"Successfully parsed {len(parsed_df)} transactions from Indian bank statement")
        
        return parsed_df
        
    except Exception as e:
        logging.error(f"Error parsing Indian bank statement: {str(e)}")
        raise ValueError(f"Failed to parse Indian bank statement: {str(e)}")

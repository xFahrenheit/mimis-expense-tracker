import pdfplumber
import re
import pandas as pd
from datetime import datetime

def parse_pdf(filepath, bank_type='generic'):
    """
    Parse PDF based on bank type
    """
    bank_parsers = {
        'chase': parse_chase_statement,
        'bofa': parse_bank_of_america_statement,
        'wells_fargo': parse_wells_fargo_statement,
        'discover': parse_discover_statement,
        'amex': parse_amex_statement,
        'citi': parse_citi_statement,
        'indian': parse_indian_bank_statement,
        'indian_bank': parse_indian_bank_statement,
        'generic': parse_generic_statement
    }
    
    parser = bank_parsers.get(bank_type, parse_generic_statement)
    print(f"Using {parser.__name__} for bank type: {bank_type}")
    
    try:
        result = parser(filepath)
        if result is not None and len(result) > 0:
            print(f"Successfully parsed {len(result)} transactions using {parser.__name__}")
            return result
        else:
            print(f"{parser.__name__} failed, checking if this might be an Indian bank statement")
            # Try to detect if this is an Indian bank statement
            if bank_type == 'generic' and is_indian_bank_pdf(filepath):
                print("Detected Indian bank format, trying Indian parser")
                indian_result = parse_indian_bank_statement(filepath)
                if indian_result is not None and len(indian_result) > 0:
                    print(f"Successfully parsed {len(indian_result)} transactions using Indian parser")
                    return indian_result
            print(f"Falling back to generic parser")
            return parse_generic_statement(filepath)
    except Exception as e:
        print(f"Error parsing with {parser.__name__}: {e}")
        # Try Indian parser if generic failed
        if bank_type == 'generic':
            try:
                print("Trying Indian bank parser as fallback")
                indian_result = parse_indian_bank_statement(filepath)
                if indian_result is not None and len(indian_result) > 0:
                    print(f"Successfully parsed {len(indian_result)} transactions using Indian parser fallback")
                    return indian_result
            except Exception as indian_e:
                print(f"Indian parser also failed: {indian_e}")
        print("Falling back to generic parser")
        return parse_generic_statement(filepath)

def is_indian_bank_pdf(filepath):
    """Detect if a PDF is from an Indian bank"""
    try:
        with pdfplumber.open(filepath) as pdf:
            # Check first few pages for Indian bank indicators
            text_sample = ""
            for page in pdf.pages[:3]:  # Check first 3 pages
                page_text = page.extract_text()
                if page_text:
                    text_sample += page_text
                    if len(text_sample) > 5000:  # Limit text sample size
                        break
            
            if not text_sample:
                return False
                
            text_lower = text_sample.lower()
            
            # Indian bank indicators
            indian_indicators = [
                '₹' in text_sample,  # Rupee symbol
                'upi' in text_lower,
                'neft' in text_lower,
                'imps' in text_lower,
                'rtgs' in text_lower,
                'ifsc' in text_lower,
                'pune' in text_lower,
                'mumbai' in text_lower,
                'delhi' in text_lower,
                'bangalore' in text_lower,
                'chennai' in text_lower,
                'hyderabad' in text_lower,
                'kolkata' in text_lower,
                'maharashtra' in text_lower,
                'india' in text_lower,
                any(bank in text_lower for bank in [
                    'sbi', 'state bank', 'hdfc', 'icici', 'axis', 'kotak',
                    'pnb', 'punjab national', 'bank of baroda', 'canara',
                    'union bank', 'indian bank', 'central bank', 'idfc'
                ])
            ]
            
            # Need at least 3 indicators to be confident it's Indian
            return sum(indian_indicators) >= 3
            
    except Exception as e:
        print(f"Error detecting Indian bank format: {e}")
        return False

def parse_chase_statement(filepath):
    """
    Parse Chase credit card statements
    Common formats:
    - MM/DD DESCRIPTION CATEGORY TYPE AMOUNT
    - Transaction Date Post Date Description Category Amount
    """
    rows = []
    
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
                
            lines = text.splitlines()
            print(f"Chase parser processing {len(lines)} lines")
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Pattern 1: MM/DD DESCRIPTION AMOUNT (most common)
                pattern1 = r'^(\d{2}/\d{2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$'
                match = re.match(pattern1, line)
                
                if match:
                    date_str, description, amount_str = match.groups()
                    try:
                        # Convert MM/DD to current year
                        month, day = date_str.split('/')
                        current_year = datetime.now().year
                        date = f"{current_year}-{month.zfill(2)}-{day.zfill(2)}"
                        
                        # Clean amount
                        amount = float(re.sub(r'[^\d.-]', '', amount_str))
                        amount = abs(amount)  # Make positive
                        
                        rows.append({
                            'date': date,
                            'description': description.strip(),
                            'amount': amount,
                            'card': 'Chase',
                            'currency': 'USD'
                        })
                        continue
                    except Exception as e:
                        print(f"Error parsing Chase pattern 1: {line}, Error: {e}")
                
                # Pattern 2: MM/DD/YYYY DESCRIPTION AMOUNT
                pattern2 = r'^(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$'
                match = re.match(pattern2, line)
                
                if match:
                    date_str, description, amount_str = match.groups()
                    try:
                        # Convert MM/DD/YY or MM/DD/YYYY
                        month, day, year = date_str.split('/')
                        if len(year) == 2:
                            year = f"20{year}"
                        date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                        
                        amount = float(re.sub(r'[^\d.-]', '', amount_str))
                        amount = abs(amount)
                        
                        rows.append({
                            'date': date,
                            'description': description.strip(),
                            'amount': amount,
                            'card': 'Chase',
                            'currency': 'USD'
                        })
                    except Exception as e:
                        print(f"Error parsing Chase pattern 2: {line}, Error: {e}")
    
    print(f"Chase parser found {len(rows)} transactions")
    return pd.DataFrame(rows) if rows else None

def parse_bank_of_america_statement(filepath):
    """
    Parse Bank of America statements
    Common format: Date Description Amount
    """
    rows = []
    
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
                
            lines = text.splitlines()
            print(f"Bank of America parser processing {len(lines)} lines")
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # BofA Pattern: MM/DD/YY Description Amount
                pattern = r'^(\d{1,2}/\d{1,2}/\d{2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$'
                match = re.match(pattern, line)
                
                if match:
                    date_str, description, amount_str = match.groups()
                    try:
                        month, day, year = date_str.split('/')
                        year = f"20{year}"
                        date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                        
                        amount = float(re.sub(r'[^\d.-]', '', amount_str))
                        amount = abs(amount)
                        
                        rows.append({
                            'date': date,
                            'description': description.strip(),
                            'amount': amount,
                            'card': 'Bank of America'
                        })
                    except Exception as e:
                        print(f"Error parsing BofA line: {line}, Error: {e}")
    
    print(f"Bank of America parser found {len(rows)} transactions")
    return pd.DataFrame(rows) if rows else None

def parse_wells_fargo_statement(filepath):
    """
    Parse Wells Fargo statements
    """
    rows = []
    
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
                
            lines = text.splitlines()
            print(f"Wells Fargo parser processing {len(lines)} lines")
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Wells Fargo Pattern: MM/DD Description Amount
                pattern = r'^(\d{1,2}/\d{1,2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$'
                match = re.match(pattern, line)
                
                if match:
                    date_str, description, amount_str = match.groups()
                    try:
                        month, day = date_str.split('/')
                        current_year = datetime.now().year
                        date = f"{current_year}-{month.zfill(2)}-{day.zfill(2)}"
                        
                        amount = float(re.sub(r'[^\d.-]', '', amount_str))
                        amount = abs(amount)
                        
                        rows.append({
                            'date': date,
                            'description': description.strip(),
                            'amount': amount,
                            'card': 'Wells Fargo'
                        })
                    except Exception as e:
                        print(f"Error parsing Wells Fargo line: {line}, Error: {e}")
    
    print(f"Wells Fargo parser found {len(rows)} transactions")
    return pd.DataFrame(rows) if rows else None

def parse_discover_statement(filepath):
    """
    Parse Discover statements
    """
    rows = []
    
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
                
            lines = text.splitlines()
            print(f"Discover parser processing {len(lines)} lines")
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Discover Pattern: MM/DD/YYYY Description Amount
                pattern = r'^(\d{1,2}/\d{1,2}/\d{4})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$'
                match = re.match(pattern, line)
                
                if match:
                    date_str, description, amount_str = match.groups()
                    try:
                        month, day, year = date_str.split('/')
                        date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                        
                        amount = float(re.sub(r'[^\d.-]', '', amount_str))
                        amount = abs(amount)
                        
                        rows.append({
                            'date': date,
                            'description': description.strip(),
                            'amount': amount,
                            'card': 'Discover'
                        })
                    except Exception as e:
                        print(f"Error parsing Discover line: {line}, Error: {e}")
    
    print(f"Discover parser found {len(rows)} transactions")
    return pd.DataFrame(rows) if rows else None

def parse_amex_statement(filepath):
    """
    Parse American Express statements
    """
    rows = []
    
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
                
            lines = text.splitlines()
            print(f"American Express parser processing {len(lines)} lines")
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Amex Pattern: MMM DD Description Amount
                pattern = r'^([A-Z]{3} \d{1,2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$'
                match = re.match(pattern, line)
                
                if match:
                    date_str, description, amount_str = match.groups()
                    try:
                        # Convert "JAN 15" to current year
                        current_year = datetime.now().year
                        date = datetime.strptime(f"{date_str} {current_year}", "%b %d %Y").strftime("%Y-%m-%d")
                        
                        amount = float(re.sub(r'[^\d.-]', '', amount_str))
                        amount = abs(amount)
                        
                        rows.append({
                            'date': date,
                            'description': description.strip(),
                            'amount': amount,
                            'card': 'American Express'
                        })
                    except Exception as e:
                        print(f"Error parsing Amex line: {line}, Error: {e}")
    
    print(f"American Express parser found {len(rows)} transactions")
    return pd.DataFrame(rows) if rows else None

def parse_citi_statement(filepath):
    """
    Parse Citi statements
    """
    rows = []
    
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
                
            lines = text.splitlines()
            print(f"Citi parser processing {len(lines)} lines")
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Citi Pattern: MM/DD Description Amount
                pattern = r'^(\d{1,2}/\d{1,2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$'
                match = re.match(pattern, line)
                
                if match:
                    date_str, description, amount_str = match.groups()
                    try:
                        month, day = date_str.split('/')
                        current_year = datetime.now().year
                        date = f"{current_year}-{month.zfill(2)}-{day.zfill(2)}"
                        
                        amount = float(re.sub(r'[^\d.-]', '', amount_str))
                        amount = abs(amount)
                        
                        rows.append({
                            'date': date,
                            'description': description.strip(),
                            'amount': amount,
                            'card': 'Citi'
                        })
                    except Exception as e:
                        print(f"Error parsing Citi line: {line}, Error: {e}")
    
    print(f"Citi parser found {len(rows)} transactions")
    return pd.DataFrame(rows) if rows else None

def parse_generic_statement(filepath):
    """
    Generic parser for unknown formats - uses table extraction and regex fallback
    """
    # First try table extraction
    rows = []
    
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue
                    
                # Look for header row
                header_row = None
                for i, row in enumerate(table[:3]):
                    if any(re.search(r'date|desc|amount|debit|credit', str(cell or '').lower()) for cell in row):
                        header_row = i
                        break
                
                if header_row is None:
                    continue
                
                headers = [str(h or '').lower().strip() for h in table[header_row]]
                
                # Find column indices
                date_idx = next((i for i, h in enumerate(headers) if 'date' in h), None)
                desc_idx = next((i for i, h in enumerate(headers) if any(word in h for word in ['desc', 'merchant', 'detail'])), None)
                amount_idx = next((i for i, h in enumerate(headers) if any(word in h for word in ['amount', 'debit', 'credit'])), None)
                
                if all(idx is not None for idx in [date_idx, desc_idx, amount_idx]):
                    for row in table[header_row+1:]:
                        if len(row) > max(date_idx, desc_idx, amount_idx):
                            try:
                                date_val = str(row[date_idx] or '').strip()
                                desc_val = str(row[desc_idx] or '').strip()
                                amount_val = str(row[amount_idx] or '').strip()
                                
                                if date_val and desc_val and amount_val:
                                    # Parse amount
                                    amount = float(re.sub(r'[^\d.-]', '', amount_val))
                                    amount = abs(amount)
                                    
                                    # Parse date (try multiple formats)
                                    date = parse_flexible_date(date_val)
                                    
                                    if date:
                                        rows.append({
                                            'date': date,
                                            'description': desc_val,
                                            'amount': amount,
                                            'card': 'Unknown',
                                            'currency': 'USD'
                                        })
                            except Exception as e:
                                print(f"Error parsing table row: {row}, Error: {e}")
                                continue
    
    if rows:
        print(f"Generic table parser found {len(rows)} transactions")
        return pd.DataFrame(rows)
    
    # Fallback to regex parsing
    print("Table parsing failed, trying regex fallback")
    return parse_regex_fallback(filepath)

def parse_flexible_date(date_str):
    """
    Parse various date formats
    """
    date_formats = [
        "%m/%d/%Y", "%m/%d/%y", "%m/%d",
        "%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y",
        "%b %d, %Y", "%b %d %Y", "%B %d, %Y",
        "%b %d", "%B %d"
    ]
    
    for fmt in date_formats:
        try:
            parsed = datetime.strptime(date_str, fmt)
            if parsed.year == 1900:  # No year provided, use current year
                parsed = parsed.replace(year=datetime.now().year)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue
    
    return None

def parse_regex_fallback(filepath):
    """
    Last resort regex parsing
    """
    rows = []
    
    with pdfplumber.open(filepath) as pdf:
        all_text = "\n".join(page.extract_text() or '' for page in pdf.pages)
        lines = all_text.splitlines()
        
        print('--- Generic regex fallback (first 10 lines) ---')
        for l in lines[:10]:
            print(l)
        print('--- End of Sample ---')
        
        # Try various patterns
        patterns = [
            r'^(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$',
            r'^(\d{1,2}/\d{1,2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$',
            r'^([A-Z]{3} \d{1,2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$',
            r'^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$'
        ]
        
        for pattern in patterns:
            for line in lines:
                match = re.match(pattern, line.strip())
                if match:
                    date_str, description, amount_str = match.groups()
                    try:
                        date = parse_flexible_date(date_str)
                        if date:
                            amount = float(re.sub(r'[^\d.-]', '', amount_str))
                            amount = abs(amount)
                            
                            rows.append({
                                'date': date,
                                'description': description.strip(),
                                'amount': amount,
                                'card': 'Unknown',
                                'currency': 'USD'
                            })
                    except Exception:
                        continue
            
            if rows:
                break
    
    print(f"Regex fallback found {len(rows)} transactions")
    return pd.DataFrame(rows) if rows else pd.DataFrame()

def map_idfc_category_to_standard(idfc_category):
    """Map IDFC bank categories to standard category names"""
    if not idfc_category:
        return "shopping"
        
    category_mapping = {
        "Digital Payments": "shopping",
        "Food and Drinks": "food", 
        "Grocery": "groceries",
        "Shopping": "shopping",
        "Insurance": "utilities",
        "Home expenses": "utilities",
        "Donations": "charity",
        "Others (Out)": "shopping",
        "Others (In)": "gifts",
        "Investment": "shopping",
        "Lifestyle and Travel": "travel"
    }
    
    return category_mapping.get(idfc_category, "shopping")

def parse_indian_bank_statement(filepath):
    """
    Parse Indian bank statements with support for:
    - Indian currency (₹)
    - Indian date formats
    - UPI transactions
    - Common Indian banks (HDFC, SBI, ICICI, Axis, etc.)
    - Transaction types common in India
    """
    rows = []
    
    # Indian date patterns
    indian_date_patterns = [
        r'(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})',  # "19 Jul, 2025"
        r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})',       # "19/07/2025"
        r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})',       # "2025/07/19"
    ]
    
    # Indian amount patterns
    indian_amount_patterns = [
        r'₹\s?([0-9,]+\.?\d*)',           # "₹1000.00"
        r'Rs\.?\s?([0-9,]+\.?\d*)',       # "Rs.1000.00"
        r'INR\s?([0-9,]+\.?\d*)',         # "INR 1000.00"
    ]
    
    # Month mapping
    month_map = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    
    def parse_indian_date(date_str):
        """Parse Indian date formats"""
        if not date_str:
            return None
            
        for pattern in indian_date_patterns:
            match = re.search(pattern, date_str, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 3:
                    if groups[1].isalpha():  # Month name format
                        day, month_name, year = groups
                        month = month_map.get(month_name.lower()[:3])
                        if month:
                            try:
                                return datetime(int(year), month, int(day)).strftime('%Y-%m-%d')
                            except ValueError:
                                continue
                    else:  # Numeric format - assume DD/MM/YYYY for Indian format
                        try:
                            if len(groups[2]) == 4:  # Full year
                                return datetime(int(groups[2]), int(groups[1]), int(groups[0])).strftime('%Y-%m-%d')
                            else:  # 2-digit year
                                year = 2000 + int(groups[2]) if int(groups[2]) < 50 else 1900 + int(groups[2])
                                return datetime(year, int(groups[1]), int(groups[0])).strftime('%Y-%m-%d')
                        except ValueError:
                            continue
        return None
    
    def parse_indian_amount(amount_str):
        """Parse Indian currency amounts"""
        if not amount_str:
            return 0.0
            
        for pattern in indian_amount_patterns:
            match = re.search(pattern, amount_str)
            if match:
                amount = match.group(1).replace(',', '')
                try:
                    return float(amount)
                except ValueError:
                    continue
        
        # Fallback to extract numbers
        numbers = re.findall(r'([0-9,]+\.?\d*)', amount_str)
        if numbers:
            try:
                return float(numbers[0].replace(',', ''))
            except ValueError:
                pass
        return 0.0
    
    def categorize_indian_transaction(description, payment_type=""):
        """Categorize based on Indian transaction patterns"""
        if not description:
            return "shopping"
            
        desc_lower = description.lower()
        payment_lower = payment_type.lower()
        
        # Food and dining
        if any(word in desc_lower for word in ['food', 'restaurant', 'cafe', 'hotel', 'dining', 'swiggy', 'zomato', 'dominos', 'pizza', 'junction', 'canteen']):
            return "food"
            
        # Groceries and shopping
        if any(word in desc_lower for word in ['grocery', 'supermarket', 'store', 'mart', 'bazaar', 'shopping', 'meesho', 'amazon', 'flipkart', 'myntra', 'ajio']):
            return "groceries"
            
        # Transportation
        if any(word in desc_lower for word in ['uber', 'ola', 'taxi', 'auto', 'bus', 'metro', 'petrol', 'fuel', 'parking', 'rapido', 'train']):
            return "travel"
            
        # Utilities and bills
        if any(word in desc_lower for word in ['electricity', 'water', 'gas', 'internet', 'mobile', 'recharge', 'broadband', 'wifi', 'jio', 'airtel', 'vodafone', 'bsnl']):
            return "utilities"
            
        # Healthcare
        if any(word in desc_lower for word in ['hospital', 'clinic', 'doctor', 'pharmacy', 'medical', 'health', 'medicine', 'apollo', 'fortis']):
            return "medicines"
            
        # Entertainment
        if any(word in desc_lower for word in ['movie', 'cinema', 'entertainment', 'game', 'netflix', 'spotify', 'youtube', 'hotstar', 'prime']):
            return "entertainment"
            
        # Personal transfers (UPI to individuals)
        if 'upi' in payment_lower and any(char.isupper() for char in description):
            return "gifts"
            
        # Digital payments/wallet
        if any(word in desc_lower for word in ['paytm', 'phonepe', 'gpay', 'wallet', 'digital']):
            return "shopping"
            
        return "shopping"
    
    with pdfplumber.open(filepath) as pdf:
        print(f"Processing {len(pdf.pages)} pages for Indian bank statement")
        
        for page_num, page in enumerate(pdf.pages):
            # Reduce debug output for performance
            if page_num % 20 == 0:  # Only print every 20th page
                print(f"Processing page {page_num + 1}")
            
            text = page.extract_text()
            if not text:
                continue
            
            lines = text.split('\n')
            
            # First, try to extract tables using pdfplumber
            tables = page.extract_tables()
            if tables:
                for table_num, table in enumerate(tables):
                    # Try to parse each row as a transaction
                    for row_num, row in enumerate(table):
                        if not row or len(row) < 3:  # Need at least date, description, amount
                            continue
                            
                        # Skip header rows
                        row_text = ' '.join([cell or '' for cell in row]).lower()
                        if any(header in row_text for header in ['date', 'transaction', 'amount', 'balance', 'description', 'particulars']):
                            continue
                        
                        # Try to parse this row as a transaction
                        parsed_transaction = parse_table_row(row, parse_indian_date, parse_indian_amount, categorize_indian_transaction)
                        if parsed_transaction:
                            rows.append(parsed_transaction)
            
            # If no tables found or tables didn't yield results, try line-by-line parsing
            if not tables:
                # Look for transaction patterns in text lines
                for i, line in enumerate(lines):
                    # Skip empty lines
                    if not line.strip():
                        continue
                    
                    # Skip specific headers and metadata lines (be more specific)
                    line_lower = line.lower()
                    if any(header in line_lower for header in [
                        'date payment type transaction name category amount',  # Exact header
                        'smart summary', 'customer id', 'address', 'filter / search',
                        'accounts idfc', 'date range', 'transactions based on',
                        'upto 2000 transactions'
                    ]):
                        continue
                    
                    # Try to parse as transaction
                    transaction = parse_line_transaction(line, parse_indian_date, parse_indian_amount, categorize_indian_transaction)
                    if transaction:
                        rows.append(transaction)
    
    print(f"Indian bank parser found {len(rows)} transactions")
    return pd.DataFrame(rows) if rows else pd.DataFrame()

def parse_table_row(row, date_parser, amount_parser, categorizer):
    """Parse a table row as a transaction"""
    try:
        # Common table formats:
        # [Date, Description, Debit, Credit, Balance]
        # [Date, Particulars, Amount, Balance]
        # [Transaction Date, Description, Amount, Type]
        
        date_str = None
        description = None
        amount_str = None
        payment_type = ""
        
        # Try to identify columns
        for i, cell in enumerate(row):
            if not cell:
                continue
                
            cell = str(cell).strip()
            
            # Check if this looks like a date
            if date_parser(cell):
                date_str = cell
                continue
                
            # Check if this looks like an amount
            if amount_parser(cell) > 0:
                amount_str = cell
                continue
                
            # Check if this looks like a transaction type
            if any(word in cell.lower() for word in ['upi', 'neft', 'imps', 'rtgs', 'debit', 'credit', 'atm']):
                payment_type = cell
                continue
                
            # If it's not date/amount/type, it's probably description
            if len(cell) > 5 and not cell.replace(',', '').replace('.', '').isdigit():
                description = cell
        
        # Validate we have minimum required fields
        if date_str and description and amount_str:
            parsed_date = date_parser(date_str)
            parsed_amount = amount_parser(amount_str)
            
            if parsed_date and parsed_amount > 0:
                category = categorizer(description, payment_type)
                
                return {
                    'date': parsed_date,
                    'description': description,
                    'amount': parsed_amount,
                    'category': category,
                    'who': 'Member 1',
                    'card': 'Indian Bank',
                    'currency': 'INR',
                    'notes': f"Payment Type: {payment_type}" if payment_type else "",
                    'split_cost': False,
                    'outlier': False,
                    'need_category': 'Need'
                }
                
    except Exception as e:
        print(f"Error parsing table row: {e}")
        
    return None

def parse_line_transaction(line, date_parser, amount_parser, categorizer):
    """Parse a text line as a transaction"""
    try:
        # IDFC Bank specific parsing approach
        # Format: "Date Payment_Type Transaction_Name_and_Category Amount"
        # Example: "19 Jul, 2025 UPI payment More Mangesh Sadashiv Digital Payments ₹1000.00"
        
        # First, check if line contains a date and amount (basic transaction indicators)
        date_match = re.search(r'(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})', line)
        amount_match = re.search(r'(₹\s?[0-9,]+\.?\d*)', line)
        
        if date_match and amount_match:
            date_str = date_match.group(1)
            amount_str = amount_match.group(1)
            
            # Check if this is an incoming transaction (receipt/credit)
            is_incoming = '+' in line and ('UPI receipt' in line or 'receipt' in line.lower())
            
            # Parse date and amount
            parsed_date = date_parser(date_str)
            parsed_amount = amount_parser(amount_str)
            
            if not parsed_date or parsed_amount <= 0:
                return None
            
            # For incoming transactions, make amount negative to indicate it's a credit
            if is_incoming:
                parsed_amount = -parsed_amount  # Negative amount for income/receipts
            
            # Extract payment type
            payment_type_match = re.search(r'(UPI\s+payment|UPI\s+receipt|NEFT|IMPS|RTGS|Debit\s+Card|Credit\s+Card|ATM|Net\s+Banking|Scheduled\s+transfer)', line, re.IGNORECASE)
            payment_type = payment_type_match.group(1) if payment_type_match else ""
            
            # Extract everything between payment type and amount
            # Remove date and payment type from beginning
            remaining = line
            remaining = re.sub(r'^\d{1,2}\s+[A-Za-z]{3},?\s+\d{4}\s+', '', remaining)
            if payment_type:
                remaining = re.sub(re.escape(payment_type) + r'\s+', '', remaining, flags=re.IGNORECASE)
            
            # Remove amount and + sign from end
            remaining = re.sub(r'\s*\+?\s*₹\s?[0-9,]+\.?\d*\s*$', '', remaining)
            
            # Clean up the description
            description = remaining.strip()
            
            # For IDFC statements, the description often contains both merchant name and category
            # We'll use the full description as transaction name and let the categorizer handle it
            if description:
                # Try to identify if there's a clear category at the end
                # Common IDFC categories
                category_patterns = [
                    r'(Digital Payments|Food and Drinks|Grocery|Shopping|Insurance|Home expenses|Donations|Others?\s*\((?:Out|In)\)|Investment|Lifestyle and Travel)$',
                ]
                
                extracted_category = None
                clean_description = description
                
                for pattern in category_patterns:
                    cat_match = re.search(pattern, description, re.IGNORECASE)
                    if cat_match:
                        extracted_category = cat_match.group(1)
                        # Remove the category from description to get cleaner merchant name
                        clean_description = re.sub(pattern, '', description, flags=re.IGNORECASE).strip()
                        break
                
                # Special handling for incoming transactions
                if is_incoming:
                    # For receipts, use "Income" category unless specific category is found
                    if not extracted_category or 'Others (In)' in extracted_category:
                        final_category = "gifts"  # Use standard category name for income
                    else:
                        final_category = map_idfc_category_to_standard(extracted_category)
                    final_description = clean_description if clean_description else description
                    # Add note about it being a receipt
                    payment_type = f"{payment_type} (Credit)" if payment_type else "Credit"
                else:
                    # For payments, use extracted category or auto-categorize
                    if extracted_category and 'Others (Out)' not in extracted_category:
                        final_category = map_idfc_category_to_standard(extracted_category)
                        final_description = clean_description if clean_description else description
                    else:
                        final_category = categorizer(description, payment_type)
                        final_description = clean_description if clean_description else description
                
                return {
                    'date': parsed_date,
                    'description': final_description,
                    'amount': parsed_amount,
                    'category': final_category,
                    'who': 'Member 1',
                    'card': 'IDFC Bank',
                    'currency': 'INR',
                    'notes': f"Payment Type: {payment_type}" if payment_type else "",
                    'split_cost': False,
                    'outlier': False,
                    'need_category': 'Need' if not is_incoming else 'Income'
                }
        
        # Fallback to previous patterns if IDFC approach doesn't work
        # Pattern 1: Date Payment_Type Description Category Amount
        transaction_match = re.search(
            r'(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})\s+(UPI payment|NEFT|IMPS|RTGS|Debit Card|Credit Card|ATM|Net Banking)\s+(.+?)\s+(.*?)\s+(₹\s?[0-9,]+\.?\d*)',
            line
        )
        
        if transaction_match:
            date_str, payment_type, description, category, amount_str = transaction_match.groups()
            
            parsed_date = date_parser(date_str)
            parsed_amount = amount_parser(amount_str)
            
            if parsed_date and parsed_amount > 0:
                description = description.strip()
                existing_category = category.strip() if category.strip() else None
                final_category = existing_category if existing_category and existing_category != '' else categorizer(description, payment_type)
                
                return {
                    'date': parsed_date,
                    'description': description,
                    'amount': parsed_amount,
                    'category': final_category,
                    'who': 'Member 1',
                    'card': 'Indian Bank',
                    'currency': 'INR',
                    'notes': f"Payment Type: {payment_type}",
                    'split_cost': False,
                    'outlier': False,
                    'need_category': 'Need'
                }
                            
    except Exception as e:
        print(f"Error parsing line transaction: {e}")
        
    return None

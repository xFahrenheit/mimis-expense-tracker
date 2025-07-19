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
        'venturex': parse_venturex_statement,
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
            print(f"{parser.__name__} failed, falling back to generic parser")
            return parse_generic_statement(filepath)
    except Exception as e:
        print(f"Error parsing with {parser.__name__}: {e}")
        print("Falling back to generic parser")
        return parse_generic_statement(filepath)

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
                            'card': 'Chase'
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
                            'card': 'Chase'
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

def parse_venturex_statement(filepath):
    """
    Parse Capital One Venture X statements
    VentureX typically has transactions in a specific format:
    - Multiple cardholders (AMEYA GODBOLE #1646, GAUTAMI LANGARKANDE #1153)
    - Trans Date | Post Date | Description | Amount format
    - Separate sections for each cardholder
    """
    rows = []
    
    with pdfplumber.open(filepath) as pdf:
        all_text = "\n".join(page.extract_text() or '' for page in pdf.pages)
        lines = all_text.splitlines()
        
        print(f"VentureX parser processing {len(lines)} lines")
        print('--- VentureX sample (first 30 lines) ---')
        for i, l in enumerate(lines[:30]):
            print(f"{i:2d}: {repr(l)}")
        print('--- End of VentureX Sample ---')
        
        # Track current cardholder and transaction state
        current_cardholder = None
        in_transaction_section = False
        current_section_type = None  # Track if we're in 'transactions' or 'payments'
        
        # Patterns for detecting cardholder sections
        cardholder_pattern = r'([A-Z][A-Z\s]+[A-Z])\s*#\d+:\s*(Transactions|Payments|Credits)'
        
        # VentureX transaction patterns - handle both positive and negative amounts
        transaction_patterns = [
            # VentureX multi-column format: Trans Date Post Date Description Amount (with optional negative sign)
            r'^([A-Z][a-z]{2} \d{1,2})\s+([A-Z][a-z]{2} \d{1,2})\s+(.+?)\s+([-]?\s*\$?[\d,]+\.?\d{2})$',
            # Standard date formats as fallback
            r'^(\d{1,2}/\d{1,2}/\d{4})\s+(.+?)\s+([-]?\s*\$?[\d,]+\.?\d{2})$',
            r'^(\d{1,2}/\d{1,2})\s+(.+?)\s+([-]?\s*\$?[\d,]+\.?\d{2})$',
        ]
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            # Check for cardholder section headers
            cardholder_match = re.search(cardholder_pattern, line, re.IGNORECASE)
            if cardholder_match:
                cardholder_name = cardholder_match.group(1).strip()
                section_type = cardholder_match.group(2).lower()
                
                # Extract just the first name (first word of the name)
                first_name = cardholder_name.split()[0].title()
                
                if 'transaction' in section_type:
                    current_cardholder = first_name
                    current_section_type = 'transactions'
                    in_transaction_section = True
                    print(f"Found cardholder transaction section: {first_name}")
                elif 'payment' in section_type or 'credit' in section_type:
                    current_cardholder = first_name
                    current_section_type = 'payments'
                    in_transaction_section = True
                    print(f"Found cardholder payments/credits section: {first_name}")
                continue
            
            # Check for transaction table headers
            if 'trans date' in line.lower() and 'post date' in line.lower():
                in_transaction_section = True
                print(f"Found transaction table header at line {i}")
                continue
            
            # Skip if we're not in a transaction section
            if not in_transaction_section:
                continue
            
            # Skip obvious non-transaction lines
            skip_patterns = [
                r'account summary|payment information|balance|payment due',
                r'late payment warning|minimum payment warning',
                r'fees charged|interest charged|cash advances',
                r'trans date|post date|description|amount',  # Header lines
                r'^\s*$|^-+$|^\*+$',  # Empty/separator lines
            ]
            
            if any(re.search(pattern, line, re.IGNORECASE) for pattern in skip_patterns):
                continue
            
            # Try to match transaction patterns
            transaction_found = False
            for pattern_idx, pattern in enumerate(transaction_patterns):
                match = re.match(pattern, line)
                if match:
                    try:
                        groups = match.groups()
                        
                        if pattern_idx == 0 and len(groups) == 4:
                            # VentureX format: Trans Date, Post Date, Description, Amount
                            trans_date, post_date, description, amount_str = groups
                            date_str = trans_date  # Use transaction date
                        elif len(groups) == 3:
                            # Standard format: Date, Description, Amount
                            date_str, description, amount_str = groups
                        else:
                            continue
                        
                        # Parse date
                        date = parse_flexible_date(date_str)
                        if not date:
                            continue
                        
                        # Parse amount - handle negative values properly
                        amount_str_clean = re.sub(r'[^\d.-]', '', amount_str.replace(' ', ''))
                        amount = float(amount_str_clean)
                        
                        # Determine if this is a credit or debit based on section and amount sign
                        is_credit = False
                        if current_section_type == 'payments':
                            # In payments section, negative amounts are credits (payments made)
                            if amount < 0:
                                is_credit = True
                                amount = abs(amount)  # Store as positive, but mark as credit
                            else:
                                # Positive amounts in payments section are unusual but could be fees
                                pass
                        else:
                            # In transactions section, all amounts are spending (positive)
                            amount = abs(amount)
                        
                        # Skip zero amounts or invalid descriptions
                        if amount <= 0 or len(description.strip()) < 3:
                            continue
                        
                        # Create transaction record
                        transaction = {
                            'date': date,
                            'description': description.strip(),
                            'amount': amount,
                            'card': 'Venture X'
                        }
                        
                        # Add cardholder info if available
                        if current_cardholder:
                            transaction['who'] = current_cardholder
                        
                        # Add notes for credits/payments
                        if is_credit:
                            transaction['notes'] = 'Credit/Payment'
                            transaction['amount'] = -amount  # Store as negative for credits
                        
                        rows.append(transaction)
                        
                        credit_indicator = " (CREDIT)" if is_credit else ""
                        print(f"Found transaction: {date} | {current_cardholder or 'Unknown'} | {description.strip()[:30]}... | ${amount}{credit_indicator}")
                        transaction_found = True
                        break
                        
                    except Exception as e:
                        print(f"Error parsing transaction line: {line}, Error: {e}")
                        continue
            
            # Handle multi-line transactions (like Turkish Airlines example)
            if not transaction_found and current_cardholder and in_transaction_section:
                # Check if this might be a continuation line
                if i > 0 and len(line) > 10 and not re.match(r'^[A-Z][a-z]{2} \d{1,2}', line):
                    # This might be a continuation of the previous transaction
                    # For now, we'll skip these, but they could be handled by looking back
                    pass
    
    print(f"VentureX parser found {len(rows)} transactions")
    return pd.DataFrame(rows) if rows else None

def parse_generic_statement(filepath):
    """
    Generic parser for unknown formats - uses table extraction and regex fallback
    """
    # First try table extraction
    rows = []
    
    with pdfplumber.open(filepath) as pdf:
        print(f"PDF has {len(pdf.pages)} pages")
        
        for page_num, page in enumerate(pdf.pages):
            print(f"Processing page {page_num + 1}")
            tables = page.extract_tables()
            print(f"Found {len(tables)} tables on page {page_num + 1}")
            
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
                print(f"Table headers: {headers}")
                
                # Find column indices
                date_idx = next((i for i, h in enumerate(headers) if 'date' in h), None)
                desc_idx = next((i for i, h in enumerate(headers) if any(word in h for word in ['desc', 'merchant', 'detail'])), None)
                amount_idx = next((i for i, h in enumerate(headers) if any(word in h for word in ['amount', 'debit', 'credit'])), None)
                
                print(f"Column indices - Date: {date_idx}, Description: {desc_idx}, Amount: {amount_idx}")
                
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
                                            'card': 'Unknown'
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
        
        print('--- Generic regex fallback (first 15 lines) ---')
        for l in lines[:15]:
            print(repr(l))
        print('--- End of Sample ---')
        
        # Try various patterns - improved for VentureX and other formats
        patterns = [
            # Standard patterns
            r'^(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$',
            r'^(\d{1,2}/\d{1,2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$',
            r'^([A-Z]{3} \d{1,2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$',
            r'^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$',
            # Patterns with more flexible spacing
            r'^(\d{1,2}/\d{1,2}/\d{2,4})\s{2,}(.+?)\s{2,}([-+]?\$?[\d,]+\.?\d{2})$',
            r'^(\d{1,2}/\d{1,2})\s{2,}(.+?)\s{2,}([-+]?\$?[\d,]+\.?\d{2})$',
            # Capital One/VentureX specific patterns
            r'^(\d{1,2}/\d{1,2}/\d{4})\s+(.+?)\s+\$?([\d,]+\.?\d{2})\s*$',
            r'^(\d{1,2}/\d{1,2})\s+(.+?)\s+\$?([\d,]+\.?\d{2})\s*$',
            # Patterns for amounts without $ sign
            r'^(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+([\d,]+\.?\d{2})\s*$',
            r'^(\d{1,2}/\d{1,2})\s+(.+?)\s+([\d,]+\.?\d{2})\s*$'
        ]
        
        # Skip lines that are clearly headers or summary info
        skip_patterns = [
            r'account summary|payment information|previous balance|new balance|minimum payment',
            r'payment due|deadline|total|balance|summary|statement',
            r'^\s*$|^-+$|^\*+$',  # Empty lines, dashes, asterisks
            r'^\d+\s*$'  # Lines with just numbers
        ]
        
        for pattern in patterns:
            for line in lines:
                line_stripped = line.strip()
                
                # Skip lines that match skip patterns
                if any(re.search(skip_pattern, line_stripped, re.IGNORECASE) for skip_pattern in skip_patterns):
                    continue
                
                match = re.match(pattern, line_stripped)
                if match:
                    date_str, description, amount_str = match.groups()
                    try:
                        date = parse_flexible_date(date_str)
                        if date:
                            amount = float(re.sub(r'[^\d.-]', '', amount_str))
                            amount = abs(amount)
                            
                            # Additional validation - skip if description is too short or looks like header
                            if len(description.strip()) > 3 and not re.match(r'^(date|desc|amount|transaction)', description.lower()):
                                rows.append({
                                    'date': date,
                                    'description': description.strip(),
                                    'amount': amount,
                                    'card': 'Unknown'
                                })
                    except Exception as e:
                        print(f"Error parsing regex line: {line_stripped}, Error: {e}")
                        continue
            
            if rows:
                print(f"Found {len(rows)} transactions with pattern: {pattern}")
                break  # Stop at first successful pattern
    
    print(f"Regex fallback found {len(rows)} transactions")
    return pd.DataFrame(rows) if rows else pd.DataFrame()

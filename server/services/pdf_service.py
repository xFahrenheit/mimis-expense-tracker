import pdfplumber
import re
import pandas as pd
from datetime import datetime

def parse_pdf(filepath, bank_type='generic'):
    """
    Parse PDF based on bank type
    """
    # Add debug output to see what we're working with
    print(f"\n=== DEBUGGING PDF PARSING ===")
    print(f"File: {filepath}")
    print(f"Bank type: {bank_type}")
    
    # Show first few lines of extracted text for debugging
    try:
        with pdfplumber.open(filepath) as pdf:
            if pdf.pages:
                first_page_text = pdf.pages[0].extract_text()
                if first_page_text:
                    lines = first_page_text.splitlines()[:15]  # First 15 lines
                    print(f"First 15 lines from PDF:")
                    for i, line in enumerate(lines, 1):
                        print(f"  {i}: '{line.strip()}'")
                    
                    # Detect if this might be a bank account vs credit card statement
                    text_lower = first_page_text.lower()
                    if any(keyword in text_lower for keyword in ['checking', 'savings', 'deposit', 'payroll', 'zelle', 'wire transfer', 'account summary']):
                        print("\n⚠️  WARNING: This appears to be a BANK ACCOUNT statement, not a credit card statement!")
                        print("   Bank account transactions include deposits, transfers, and large amounts.")
                        print("   Make sure you're uploading a CREDIT CARD statement for expense tracking.")
                        
                else:
                    print("No text extracted from first page")
    except Exception as e:
        print(f"Error extracting debug text: {e}")
    
    print(f"=== END DEBUG INFO ===\n")
    
    bank_parsers = {
        'chase': parse_chase_statement,
        'bofa': parse_bank_of_america_statement,
        'wells_fargo': parse_wells_fargo_statement,
        'discover': parse_discover_statement,
        'amex': parse_amex_statement,
        'citi': parse_citi_statement,
        'venturex': parse_venturex_statement,
        'amazon_visa': parse_amazon_visa_statement,
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
    Format examples:
    04/27 AUTOMATIC PAYMENT - THANK YOU -384.80
    04/02 DD *DOORDASH DAVESHOTC 855-431-0459 CA 28.20
    04/10 PENN MED PRINCETON MED PLAINSBORO NJ 352.75
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
                
                # Skip header lines and non-transaction lines
                skip_patterns = [
                    'account activity', 'date of', 'transaction', 'merchant name', 'description',
                    'amount', 'statement', 'account', 'balance', 'total', 'page', 'previous',
                    'payment due', 'minimum payment'
                ]
                if any(skip_word in line.lower() for skip_word in skip_patterns):
                    continue
                
                # Debug: Print lines that might be transactions
                if re.search(r'\d{2}/\d{2}', line) and re.search(r'[-+]?[\d,]+\.?\d{2}$', line):
                    print(f"Chase debug - potential transaction line: '{line}'")
                
                # Pattern 1: MM/DD DESCRIPTION AMOUNT (Chase format)
                # Examples:
                # 04/02 DD *DOORDASH DAVESHOTC 855-431-0459 CA 28.20
                # 04/27 AUTOMATIC PAYMENT - THANK YOU -384.80
                pattern1 = r'^(\d{2}/\d{2})\s+(.+?)\s+([-+]?[\d,]+\.?\d{2})$'
                match = re.match(pattern1, line)
                
                if match:
                    date_str, description, amount_str = match.groups()
                    print(f"Chase Pattern 1 matched: {date_str} | {description} | {amount_str}")
                    try:
                        # Convert MM/DD to current year
                        month, day = date_str.split('/')
                        current_year = datetime.now().year
                        date = f"{current_year}-{month.zfill(2)}-{day.zfill(2)}"
                        
                        print(f"Chase date conversion: {date_str} -> {date}")
                        
                        # Clean amount - handle negative amounts (payments)
                        amount = float(re.sub(r'[^\d.-]', '', amount_str))
                        
                        # Skip payments (negative amounts)
                        if amount < 0:
                            print(f"Skipping payment: {description.strip()}")
                            continue
                        
                        amount = abs(amount)  # Ensure positive
                        
                        # Clean description - remove extra spaces
                        description_clean = re.sub(r'\s+', ' ', description.strip())
                        
                        rows.append({
                            'date': date,
                            'description': description_clean,
                            'amount': amount,
                            'card': 'Chase'
                        })
                        continue
                    except Exception as e:
                        print(f"Error parsing Chase pattern 1: {line}, Error: {e}")
                
                # Pattern 2: MM/DD DESCRIPTION $AMOUNT (with dollar sign)
                pattern2 = r'^(\d{2}/\d{2})\s+(.+?)\s+([-+]?\$[\d,]+\.?\d{2})$'
                match = re.match(pattern2, line)
                
                if match:
                    date_str, description, amount_str = match.groups()
                    print(f"Chase Pattern 2 matched: {date_str} | {description} | {amount_str}")
                    try:
                        month, day = date_str.split('/')
                        current_year = datetime.now().year
                        date = f"{current_year}-{month.zfill(2)}-{day.zfill(2)}"
                        
                        amount = float(re.sub(r'[^\d.-]', '', amount_str))
                        
                        # Skip payments
                        if amount < 0:
                            print(f"Skipping payment: {description.strip()}")
                            continue
                        
                        amount = abs(amount)
                        description_clean = re.sub(r'\s+', ' ', description.strip())
                        
                        rows.append({
                            'date': date,
                            'description': description_clean,
                            'amount': amount,
                            'card': 'Chase'
                        })
                    except Exception as e:
                        print(f"Error parsing Chase pattern 2: {line}, Error: {e}")
                
                # Pattern 3: MM/DD/YYYY format (fallback)
                pattern3 = r'^(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+([-+]?[\d,]+\.?\d{2})$'
                match = re.match(pattern3, line)
                
                if match:
                    date_str, description, amount_str = match.groups()
                    print(f"Chase Pattern 3 matched: {date_str} | {description} | {amount_str}")
                    try:
                        month, day, year = date_str.split('/')
                        if len(year) == 2:
                            year = f"20{year}"
                        date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                        
                        amount = float(re.sub(r'[^\d.-]', '', amount_str))
                        
                        if amount < 0:
                            print(f"Skipping payment: {description.strip()}")
                            continue
                        
                        amount = abs(amount)
                        description_clean = re.sub(r'\s+', ' ', description.strip())
                        
                        rows.append({
                            'date': date,
                            'description': description_clean,
                            'amount': amount,
                            'card': 'Chase'
                        })
                    except Exception as e:
                        print(f"Error parsing Chase pattern 3: {line}, Error: {e}")
    
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
    Format:
    TRANS.
    DATE PURCHASES MERCHANT CATEGORY AMOUNT
    06/24 BIG BAZAAR PLAINSBORO NJ Supermarkets $59.35
    APPLE PAY ENDING IN 5377
    """
    rows = []
    
    with pdfplumber.open(filepath) as pdf:
        print(f"Discover PDF has {len(pdf.pages)} pages")
        
        # Try text extraction from ALL pages
        all_text = ""
        for page_num, page in enumerate(pdf.pages):
            print(f"--- Checking page {page_num + 1} ---")
            text = page.extract_text()
            if text:
                all_text += text + "\n"
                lines = text.splitlines()
                print(f"Page {page_num + 1} has {len(lines)} lines")
                # Show first few lines that contain dates or dollar signs
                for i, line in enumerate(lines[:20]):
                    if line.strip() and (re.search(r'\d{2}/\d{2}', line) or '$' in line):
                        print(f"  Line {i}: '{line.strip()}'")
            
            # Also try table extraction
            tables = page.extract_tables()
            if tables:
                print(f"Page {page_num + 1} has {len(tables)} tables")
                for table_num, table in enumerate(tables):
                    print(f"  Table {table_num + 1}: {len(table)} rows")
                    # Look for transaction-like data in tables
                    for row_num, row in enumerate(table[:10]):  # First 10 rows
                        if row and any(cell and re.search(r'\d{2}/\d{2}', str(cell)) for cell in row):
                            print(f"    Row {row_num}: {row}")
        
        # Now process the combined text
        if not all_text.strip():
            print("No text extracted from any page")
            return None
            
        lines = all_text.splitlines()
        print(f"\nProcessing combined text: {len(lines)} total lines")
        
        current_section = None
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            # Track which section we're in
            if 'PAYMENTS AND CREDITS' in line.upper():
                current_section = 'PAYMENTS'
                print(f">>> Entering PAYMENTS section at line {i}")
                continue
            elif 'PURCHASES' in line.upper() and ('MERCHANT' in line.upper() or 'AMOUNT' in line.upper()):
                current_section = 'PURCHASES'
                print(f">>> Entering PURCHASES section at line {i}")
                continue
            
            # Look for transaction patterns
            if re.match(r'^\d{2}/\d{2}', line):
                print(f"\nFound date line {i}: '{line}'")
                print(f"Current section: {current_section}")

                # Find all $AMOUNTs in the line
                amounts = re.findall(r'\$(\d+\.?\d{2})', line)
                if amounts:
                    # Only use the first amount as the purchase
                    amount_str = amounts[0]
                    # Extract date and description up to the first $AMOUNT
                    pattern = r'^(\d{2}/\d{2})\s+(.+?)\s+\$' + re.escape(amount_str)
                    match = re.match(pattern, line)
                    if match:
                        date_str, description_full = match.groups()
                        print(f">>> Pattern matched: Date='{date_str}' | Full='{description_full}' | Amount='${amount_str}'")

                        # Clean the description - remove category and extra info
                        description = description_full.strip()
                        # Remove category words at the end
                        description = re.sub(r'\s+(Supermarkets|Gas Stations|Restaurants|Department Stores|Entertainment|Travel|Online Services).*$', '', description)
                        # Remove redemption/cashback text (but only at the end)
                        description = re.sub(r'\s+(REDEEMEDTHISPERIOD|CASHBACK BONUS REDEMPTION|BONUSBALANCE|CASHBACK BONUS).*$', '', description, flags=re.IGNORECASE)
                        description = re.sub(r'\s+', ' ', description).strip()

                        print(f">>> Cleaned description: '{description}'")

                        # Skip payments/credits section entirely
                        if current_section == 'PAYMENTS':
                            print(f">>> SKIPPING - In PAYMENTS section: {description}")
                            return

                        # Skip payment keywords in description
                        skip_keywords = ['payment', 'credit', 'redemption', 'thank you']
                        if any(keyword in description.lower() for keyword in skip_keywords):
                            print(f">>> SKIPPING - Contains payment keyword: {description}")
                            return

                        # If the description is empty after cleaning, skip
                        if not description or len(description) < 3:
                            print(f">>> SKIPPING - Description too short after cleaning: '{description}'")
                            return

                        try:
                            # Convert MM/DD to current year
                            month, day = date_str.split('/')
                            current_year = datetime.now().year
                            date = f"{current_year}-{month.zfill(2)}-{day.zfill(2)}"

                            amount = float(amount_str)

                            rows.append({
                                'date': date,
                                'description': description,
                                'amount': amount,
                                'card': 'Discover'
                            })
                            print(f">>> ADDED TRANSACTION: {date} | '{description}' | ${amount}")

                        except Exception as e:
                            print(f">>> ERROR parsing transaction: {line}, Error: {e}")
                    else:
                        print(f">>> No regex match for date/description in line: '{line}'")
    
    print(f"\nDiscover parser found {len(rows)} transactions")
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
                            trans_date, _, description, amount_str = groups
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
                        amount_str_clean = re.sub(r'[^\d.-]', '', amount_str.replace(',', '').replace(' ', ''))
                        amount = float(amount_str_clean)
                        
                        # Determine if this is a credit or debit based on section and amount sign
                        is_credit = False
                        if current_section_type == 'payments' or amount < 0:
                            # In payments section or negative amount, treat as credit/payment and skip from spending
                            is_credit = True
                            amount = abs(amount)
                        else:
                            # In transactions section, only positive amounts are spending
                            amount = abs(amount)

                        # Skip zero amounts or invalid descriptions
                        if amount <= 0 or len(description.strip()) < 3:
                            continue

                        # Only add to spending if not a credit/payment
                        transaction = {
                            'date': date,
                            'description': description.strip(),
                            'amount': amount,
                            'card': 'Venture X'
                        }

                        if current_cardholder:
                            transaction['who'] = current_cardholder

                        if is_credit:
                            transaction['notes'] = 'Credit/Payment'
                            transaction['amount'] = -amount  # Store as negative for credits
                            # Do not count this in spending
                        else:
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


def parse_amazon_visa_statement(filepath):
    """
    Parse Amazon Visa statements
    Format:
    - Date Description Amount
    - Multiple transactions per line
    """
    rows = []
    
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
                
            lines = text.splitlines()
            print(f"Amazon Visa parser processing {len(lines)} lines")
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Amazon Visa Pattern: MM/DD/YYYY Description Amount
                pattern = r'^(\d{1,2}/\d{1,2}/\d{4})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$'
                match = re.match(pattern, line)
                
                if match:
                    date_str, description, amount_str = match.groups()
                    try:
                        date = datetime.strptime(date_str, "%m/%d/%Y").strftime("%Y-%m-%d")
                        amount = float(re.sub(r'[^\d.-]', '', amount_str))
                        amount = abs(amount)
                        
                        rows.append({
                            'date': date,
                            'description': description.strip(),
                            'amount': amount,
                            'card': 'Amazon Visa'
                        })
                    except Exception as e:
                        print(f"Error parsing Amazon Visa line: {line}, Error: {e}")
                        continue        
                
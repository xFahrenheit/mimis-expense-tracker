import pdfplumber
import re
import pandas as pd
from datetime import datetime
from typing import Optional, List, Dict, Any
import logging
from dataclasses import dataclass
from abc import ABC, abstractmethod

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class Transaction:
    """Data class for representing a transaction"""
    date: str
    description: str
    amount: float
    card: str
    who: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if v is not None}

class StatementDetector:
    """Detects the type of statement and potential issues"""
    
    BANK_ACCOUNT_KEYWORDS = [
        'checking', 'savings', 'deposit', 'payroll', 'zelle', 'wire transfer', 
        'account summary', 'ending balance', 'beginning balance', 'direct deposit'
    ]
    
    CREDIT_CARD_KEYWORDS = [
        'credit card', 'previous balance', 'new balance', 'minimum payment',
        'payment due date', 'available credit', 'credit limit'
    ]
    
    @classmethod
    def detect_statement_type(cls, text: str) -> str:
        """Detect if this is a bank account or credit card statement"""
        text_lower = text.lower()
        
        bank_score = sum(1 for keyword in cls.BANK_ACCOUNT_KEYWORDS if keyword in text_lower)
        credit_score = sum(1 for keyword in cls.CREDIT_CARD_KEYWORDS if keyword in text_lower)
        
        if bank_score > credit_score:
            return 'bank_account'
        elif credit_score > bank_score:
            return 'credit_card'
        else:
            return 'unknown'
    
    @classmethod
    def detect_bank(cls, text: str) -> str:
        """Detect the bank from statement text"""
        text_lower = text.lower()
        
        bank_patterns = {
            'chase': ['chase', 'jpmorgan chase'],
            'bofa': ['bank of america', 'bankofamerica'],
            'wells_fargo': ['wells fargo', 'wellsfargo'],
            'discover': ['discover', 'discover card'],
            'amex': ['american express', 'amex'],
            'citi': ['citi', 'citibank', 'citicorp'],
            'venturex': ['venture x', 'capital one venture'],
            'amazon': ['amazon', 'amazon prime rewards']
        }
        
        for bank_type, patterns in bank_patterns.items():
            if any(pattern in text_lower for pattern in patterns):
                return bank_type
        
        return 'generic'

class DateParser:
    """Utility class for parsing various date formats"""
    
    DATE_FORMATS = [
        "%m/%d/%Y", "%m/%d/%y", "%m/%d",
        "%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y",
        "%b %d, %Y", "%b %d %Y", "%B %d, %Y",
        "%b %d", "%B %d"
    ]
    
    @classmethod
    def parse_flexible_date(cls, date_str: str) -> Optional[str]:
        """Parse various date formats and return YYYY-MM-DD format"""
        if not date_str:
            return None
            
        date_str = date_str.strip()
        
        for fmt in cls.DATE_FORMATS:
            try:
                parsed = datetime.strptime(date_str, fmt)
                if parsed.year == 1900:  # No year provided, use current year
                    parsed = parsed.replace(year=datetime.now().year)
                return parsed.strftime("%Y-%m-%d")
            except ValueError:
                continue
        
        logger.warning(f"Could not parse date: {date_str}")
        return None

class BaseParser(ABC):
    """Abstract base class for statement parsers"""
    
    def __init__(self, filepath: str):
        self.filepath = filepath
        self.transactions: List[Transaction] = []
    
    @abstractmethod
    def parse(self) -> pd.DataFrame:
        """Parse the statement and return a DataFrame"""
        pass
    
    def _extract_text(self) -> str:
        """Extract all text from PDF"""
        try:
            with pdfplumber.open(self.filepath) as pdf:
                return "\n".join(page.extract_text() or '' for page in pdf.pages)
        except Exception as e:
            logger.error(f"Error extracting text from {self.filepath}: {e}")
            return ""
    
    def _clean_amount(self, amount_str: str) -> float:
        """Clean and parse amount string"""
        if not amount_str:
            return 0.0
        
        # Remove all non-digit characters except decimal point and minus sign
        clean_amount = re.sub(r'[^\d.-]', '', amount_str.replace(',', ''))
        
        try:
            return float(clean_amount)
        except ValueError:
            logger.warning(f"Could not parse amount: {amount_str}")
            return 0.0
    
    def _clean_description(self, description: str) -> str:
        """Clean transaction description"""
        if not description:
            return ""
        
        # Remove extra whitespace and clean up
        description = re.sub(r'\s+', ' ', description.strip())
        
        # Remove common suffixes that aren't useful
        description = re.sub(r'\s+(REDEEMEDTHISPERIOD|CASHBACK BONUS|BONUSBALANCE).*$', '', description, flags=re.IGNORECASE)
        
        return description
    
    def _is_payment_or_credit(self, description: str, amount: float) -> bool:
        """Determine if transaction is a payment or credit"""
        payment_keywords = ['payment', 'credit', 'redemption', 'thank you', 'autopay', 'online payment']
        return amount < 0 or any(keyword in description.lower() for keyword in payment_keywords)
    
    def _should_skip_line(self, line: str) -> bool:
        """Determine if line should be skipped"""
        skip_patterns = [
            r'account activity|statement|balance|payment due|minimum payment',
            r'date of|transaction|merchant name|description|amount',
            r'^\s*$|^-+$|^\*+$',  # Empty lines, separators
            r'page \d+|total|subtotal|previous balance|new balance'
        ]
        
        return any(re.search(pattern, line, re.IGNORECASE) for pattern in skip_patterns)

class ChaseParser(BaseParser):
    """Parser for Chase credit card statements"""
    
    def parse(self) -> pd.DataFrame:
        text = self._extract_text()
        if not text:
            return pd.DataFrame()
        
        lines = text.splitlines()
        logger.info(f"Chase parser processing {len(lines)} lines")
        
        patterns = [
            r'^(\d{2}/\d{2})\s+(.+?)\s+([-+]?[\d,]+\.?\d{2})$',
            r'^(\d{2}/\d{2})\s+(.+?)\s+([-+]?\$[\d,]+\.?\d{2})$',
            r'^(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+([-+]?[\d,]+\.?\d{2})$'
        ]
        
        for line in lines:
            line = line.strip()
            if not line or self._should_skip_line(line):
                continue
            
            for pattern in patterns:
                match = re.match(pattern, line)
                if match:
                    date_str, description, amount_str = match.groups()
                    
                    # Parse date
                    if '/' in date_str and len(date_str.split('/')) == 2:
                        month, day = date_str.split('/')
                        date = f"{datetime.now().year}-{month.zfill(2)}-{day.zfill(2)}"
                    else:
                        date = DateParser.parse_flexible_date(date_str)
                    
                    if not date:
                        continue
                    
                    amount = self._clean_amount(amount_str)
                    description = self._clean_description(description)
                    
                    # Skip payments and credits
                    if self._is_payment_or_credit(description, amount):
                        logger.debug(f"Skipping payment/credit: {description}")
                        continue
                    
                    amount = abs(amount)  # Ensure positive for expenses
                    
                    if amount > 0 and len(description) > 2:
                        transaction = Transaction(
                            date=date,
                            description=description,
                            amount=amount,
                            card='Chase'
                        )
                        self.transactions.append(transaction)
                    break
        
        logger.info(f"Chase parser found {len(self.transactions)} transactions")
        return pd.DataFrame([t.to_dict() for t in self.transactions])

class DiscoverParser(BaseParser):
    """Parser for Discover credit card statements"""
    
    def parse(self) -> pd.DataFrame:
        text = self._extract_text()
        if not text:
            return pd.DataFrame()
        
        lines = text.splitlines()
        logger.info(f"Discover parser processing {len(lines)} lines")
        
        current_section = None
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            # Track sections
            if 'PAYMENTS AND CREDITS' in line.upper():
                current_section = 'PAYMENTS'
                continue
            elif 'PURCHASES' in line.upper() and ('MERCHANT' in line.upper() or 'AMOUNT' in line.upper()):
                current_section = 'PURCHASES'
                continue
            
            # Look for transaction patterns
            date_pattern = r'^(\d{2}/\d{2})'
            amount_pattern = r'\$(\d+\.?\d{2})'
            
            if re.match(date_pattern, line):
                amounts = re.findall(amount_pattern, line)
                if amounts:
                    # Use first amount as the transaction amount
                    amount_str = amounts[0]
                    pattern = r'^(\d{2}/\d{2})\s+(.+?)\s+\$' + re.escape(amount_str)
                    match = re.match(pattern, line)
                    
                    if match:
                        date_str, description_full = match.groups()
                        
                        # Skip if in payments section
                        if current_section == 'PAYMENTS':
                            continue
                        
                        # Parse date
                        month, day = date_str.split('/')
                        date = f"{datetime.now().year}-{month.zfill(2)}-{day.zfill(2)}"
                        
                        # Clean description
                        description = self._clean_description(description_full)
                        description = re.sub(r'\s+(Supermarkets|Gas Stations|Restaurants|Department Stores|Entertainment|Travel|Online Services).*$', '', description)
                        
                        # Skip if description contains payment keywords
                        if self._is_payment_or_credit(description, float(amount_str)):
                            continue
                        
                        if len(description) > 2:
                            transaction = Transaction(
                                date=date,
                                description=description,
                                amount=float(amount_str),
                                card='Discover'
                            )
                            self.transactions.append(transaction)
        
        logger.info(f"Discover parser found {len(self.transactions)} transactions")
        return pd.DataFrame([t.to_dict() for t in self.transactions])

class VentureXParser(BaseParser):
    """Parser for Capital One Venture X statements"""
    
    def parse(self) -> pd.DataFrame:
        text = self._extract_text()
        if not text:
            return pd.DataFrame()
        
        lines = text.splitlines()
        logger.info(f"VentureX parser processing {len(lines)} lines")
        
        current_cardholder = None
        current_section_type = None
        cardholder_pattern = r'([A-Z][A-Z\s]+[A-Z])\s*#\d+:\s*(Transactions|Payments|Credits)'
        
        transaction_patterns = [
            r'^([A-Z][a-z]{2} \d{1,2})\s+([A-Z][a-z]{2} \d{1,2})\s+(.+?)\s+([-]?\s*\$?[\d,]+\.?\d{2})$',
            r'^(\d{1,2}/\d{1,2}/\d{4})\s+(.+?)\s+([-]?\s*\$?[\d,]+\.?\d{2})$',
            r'^(\d{1,2}/\d{1,2})\s+(.+?)\s+([-]?\s*\$?[\d,]+\.?\d{2})$',
        ]
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Check for cardholder sections
            cardholder_match = re.search(cardholder_pattern, line, re.IGNORECASE)
            if cardholder_match:
                cardholder_name = cardholder_match.group(1).strip()
                section_type = cardholder_match.group(2).lower()
                
                current_cardholder = cardholder_name.split()[0].title()  # First name only
                current_section_type = 'transactions' if 'transaction' in section_type else 'payments'
                logger.debug(f"Found {current_cardholder} {current_section_type} section")
                continue
            
            # Skip non-transaction lines
            if self._should_skip_line(line):
                continue
            
            # Try transaction patterns
            for pattern_idx, pattern in enumerate(transaction_patterns):
                match = re.match(pattern, line)
                if match:
                    groups = match.groups()
                    
                    if pattern_idx == 0 and len(groups) == 4:
                        # VentureX format with trans/post dates
                        trans_date, _, description, amount_str = groups
                        date_str = trans_date
                    elif len(groups) == 3:
                        date_str, description, amount_str = groups
                    else:
                        continue
                    
                    date = DateParser.parse_flexible_date(date_str)
                    if not date:
                        continue
                    
                    amount = self._clean_amount(amount_str)
                    description = self._clean_description(description)
                    
                    # Skip payments/credits or transactions in payment section
                    is_credit = current_section_type == 'payments' or amount < 0
                    if is_credit or self._is_payment_or_credit(description, amount):
                        continue
                    
                    amount = abs(amount)
                    
                    if amount > 0 and len(description) > 2:
                        transaction = Transaction(
                            date=date,
                            description=description,
                            amount=amount,
                            card='Venture X',
                            who=current_cardholder
                        )
                        self.transactions.append(transaction)
                    break
        
        logger.info(f"VentureX parser found {len(self.transactions)} transactions")
        return pd.DataFrame([t.to_dict() for t in self.transactions])

class GenericParser(BaseParser):
    """Generic parser using table extraction and regex patterns"""
    
    def parse(self) -> pd.DataFrame:
        # Try table extraction first
        df = self._parse_tables()
        if not df.empty:
            return df
        
        # Fallback to regex parsing
        return self._parse_regex()
    
    def _parse_tables(self) -> pd.DataFrame:
        """Extract transactions from PDF tables"""
        try:
            with pdfplumber.open(self.filepath) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    
                    for table in tables:
                        if not table or len(table) < 2:
                            continue
                        
                        # Find header row
                        header_row_idx = None
                        for i, row in enumerate(table[:3]):
                            if any(re.search(r'date|desc|amount|debit|credit', str(cell or '').lower()) for cell in row):
                                header_row_idx = i
                                break
                        
                        if header_row_idx is None:
                            continue
                        
                        headers = [str(h or '').lower().strip() for h in table[header_row_idx]]
                        
                        # Find column indices
                        date_idx = next((i for i, h in enumerate(headers) if 'date' in h), None)
                        desc_idx = next((i for i, h in enumerate(headers) if any(word in h for word in ['desc', 'merchant', 'detail'])), None)
                        amount_idx = next((i for i, h in enumerate(headers) if any(word in h for word in ['amount', 'debit', 'credit'])), None)
                        
                        if all(idx is not None for idx in [date_idx, desc_idx, amount_idx]):
                            for row in table[header_row_idx+1:]:
                                if len(row) > max(date_idx, desc_idx, amount_idx):
                                    try:
                                        date_val = str(row[date_idx] or '').strip()
                                        desc_val = str(row[desc_idx] or '').strip()
                                        amount_val = str(row[amount_idx] or '').strip()
                                        
                                        if date_val and desc_val and amount_val:
                                            date = DateParser.parse_flexible_date(date_val)
                                            amount = self._clean_amount(amount_val)
                                            description = self._clean_description(desc_val)
                                            
                                            if date and amount > 0 and len(description) > 2:
                                                transaction = Transaction(
                                                    date=date,
                                                    description=description,
                                                    amount=abs(amount),
                                                    card='Unknown'
                                                )
                                                self.transactions.append(transaction)
                                    except Exception as e:
                                        logger.debug(f"Error parsing table row: {e}")
                                        continue
        except Exception as e:
            logger.error(f"Error parsing tables: {e}")
        
        return pd.DataFrame([t.to_dict() for t in self.transactions])
    
    def _parse_regex(self) -> pd.DataFrame:
        """Parse using regex patterns as fallback"""
        text = self._extract_text()
        if not text:
            return pd.DataFrame()
        
        lines = text.splitlines()
        
        patterns = [
            r'^(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$',
            r'^(\d{1,2}/\d{1,2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$',
            r'^([A-Z]{3} \d{1,2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$',
            r'^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([-+]?\$?[\d,]+\.?\d{2})$',
        ]
        
        for pattern in patterns:
            for line in lines:
                line = line.strip()
                
                if self._should_skip_line(line):
                    continue
                
                match = re.match(pattern, line)
                if match:
                    date_str, description, amount_str = match.groups()
                    
                    date = DateParser.parse_flexible_date(date_str)
                    if not date:
                        continue
                    
                    amount = self._clean_amount(amount_str)
                    description = self._clean_description(description)
                    
                    # Skip payments/credits
                    if self._is_payment_or_credit(description, amount):
                        continue
                    
                    amount = abs(amount)
                    
                    if amount > 0 and len(description) > 2:
                        transaction = Transaction(
                            date=date,
                            description=description,
                            amount=amount,
                            card='Unknown'
                        )
                        self.transactions.append(transaction)
            
            if self.transactions:
                break  # Stop at first successful pattern
        
        logger.info(f"Generic parser found {len(self.transactions)} transactions")
        return pd.DataFrame([t.to_dict() for t in self.transactions])

class StatementParser:
    """Main parser class that orchestrates the parsing process"""
    
    PARSER_MAP = {
        'chase': ChaseParser,
        'discover': DiscoverParser,
        'venturex': VentureXParser,
        'bofa': GenericParser,  # Use generic for now
        'wells_fargo': GenericParser,
        'amex': GenericParser,
        'citi': GenericParser,
        'amazon': GenericParser,
        'generic': GenericParser
    }
    
    def __init__(self, filepath: str, bank_type: Optional[str] = None):
        self.filepath = filepath
        self.bank_type = bank_type
    
    def parse(self) -> pd.DataFrame:
        """Parse the PDF statement and return a DataFrame of transactions"""
        logger.info(f"=== PARSING PDF: {self.filepath} ===")
        
        # Auto-detect bank type if not provided
        if not self.bank_type:
            self.bank_type = self._auto_detect_bank()
        
        logger.info(f"Using bank type: {self.bank_type}")
        
        # Check for potential issues
        self._validate_statement()
        
        # Get the appropriate parser
        parser_class = self.PARSER_MAP.get(self.bank_type, GenericParser)
        parser = parser_class(self.filepath)
        
        try:
            df = parser.parse()
            
            if df.empty:
                logger.warning(f"No transactions found with {parser_class.__name__}, trying generic parser")
                generic_parser = GenericParser(self.filepath)
                df = generic_parser.parse()
            
            logger.info(f"Successfully parsed {len(df)} transactions")
            if not df.empty:
                logger.info(f"Total amount: ${df['amount'].sum():.2f}")
            
            return df
            
        except Exception as e:
            logger.error(f"Error parsing with {parser_class.__name__}: {e}")
            logger.info("Falling back to generic parser")
            generic_parser = GenericParser(self.filepath)
            return generic_parser.parse()
    
    def _auto_detect_bank(self) -> str:
        """Auto-detect the bank from the PDF content"""
        try:
            with pdfplumber.open(self.filepath) as pdf:
                if pdf.pages:
                    first_page_text = pdf.pages[0].extract_text() or ""
                    return StatementDetector.detect_bank(first_page_text)
        except Exception as e:
            logger.error(f"Error detecting bank type: {e}")
        
        return 'generic'
    
    def _validate_statement(self):
        """Validate the statement and warn about potential issues"""
        try:
            with pdfplumber.open(self.filepath) as pdf:
                if pdf.pages:
                    first_page_text = pdf.pages[0].extract_text() or ""
                    
                    # Show debug info
                    lines = first_page_text.splitlines()[:10]
                    logger.debug("First 10 lines from PDF:")
                    for i, line in enumerate(lines, 1):
                        logger.debug(f"  {i}: '{line.strip()}'")
                    
                    # Check statement type
                    statement_type = StatementDetector.detect_statement_type(first_page_text)
                    if statement_type == 'bank_account':
                        logger.warning("⚠️  WARNING: This appears to be a BANK ACCOUNT statement, not a credit card statement!")
                        logger.warning("   Bank account transactions include deposits, transfers, and large amounts.")
                        logger.warning("   Make sure you're uploading a CREDIT CARD statement for expense tracking.")
                    
        except Exception as e:
            logger.error(f"Error validating statement: {e}")

# Main function for backward compatibility
def parse_pdf(filepath: str, bank_type: str = 'generic') -> pd.DataFrame:
    """
    Parse PDF based on bank type - main entry point for backward compatibility
    
    Args:
        filepath: Path to the PDF file
        bank_type: Type of bank ('chase', 'discover', 'venturex', etc.)
    
    Returns:
        DataFrame with parsed transactions
    """
    parser = StatementParser(filepath, bank_type)
    return parser.parse()

# Example usage
if __name__ == "__main__":
    # Example of how to use the enhanced parser
    filepath = "statement.pdf"
    
    # Auto-detect bank type
    parser = StatementParser(filepath)
    df = parser.parse()
    
    # Or specify bank type
    # parser = StatementParser(filepath, 'chase')
    # df = parser.parse()
    
    if not df.empty:
        print(f"Found {len(df)} transactions:")
        print(df.head())
        print(f"Total amount: ${df['amount'].sum():.2f}")
    else:
        print("No transactions found")
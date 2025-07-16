import pdfplumber
import re
import pandas as pd
from datetime import datetime

def parse_pdf(filepath):
    FIELD_MAP = {
        'date': ['date', 'transaction date', 'trans date', 'posting date', 'post date', 'posted date'],
        'description': ['description', 'transaction description', 'details', 'merchant', 'narration'],
        'amount': ['amount', 'transaction amount', 'debit', 'credit', 'amt'],
        'category': ['category', 'type'],
        'card': ['card', 'account', 'card number'],
        'who': ['who', 'spender', 'user'],
        'notes': ['notes', 'memo', 'remarks'],
    }
    def map_header(header):
        h = header.strip().lower()
        for field, options in FIELD_MAP.items():
            if any(opt in h for opt in options):
                return field
        return h
    def parse_month_day(md_str, year=None):
        try:
            if not year:
                year = datetime.now().year
            return datetime.strptime(f"{md_str} {year}", "%b %d %Y").strftime("%Y-%m-%d")
        except Exception:
            return md_str
    rows = []
    found_table = False
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue
                header_row = None
                for i, row in enumerate(table[:3]):
                    if any(re.search(r'date|desc|amount|debit|credit', str(cell or '').lower()) for cell in row):
                        header_row = i
                        break
                if header_row is None:
                    continue
                headers = [map_header(str(h or '')) for h in table[header_row]]
                for row in table[header_row+1:]:
                    print(f"DEBUG: Full extracted row: {row}")
                    if not any(row):
                        continue
                    record = dict(zip(headers, row))
                    date_val = record.get('date') or record.get('trans date')
                    if date_val and re.match(r'^[A-Za-z]{3} \d{1,2}$', date_val.strip()):
                        date_val = parse_month_day(date_val.strip())
                    record['date'] = date_val
                    if record.get('date') and record.get('description') and record.get('amount'):
                        amt = str(record['amount']).replace('$','').replace('(','-').replace(')','').strip()
                        print(f"DEBUG: Raw extracted amount for row: '{amt}' | Full row: {row}")
                        # Only handle US format: $1,002.32, $1,000, $1.00, etc.
                        # Remove $ and spaces
                        try:
                            record['amount'] = float(amt.replace(',', ''))
                        except Exception:
                            continue
                        rows.append(record)
                found_table = True
    if rows:
        print('PDF Table Headers:', list(rows[0].keys()))
        print('Sample rows:', rows[:3])
    if not found_table or not rows:
        print('No valid tables found, falling back to regex line extraction.')
        all_text = "\n".join(page.extract_text() or '' for page in pdf.pages)
        lines = all_text.splitlines()
        print('--- PDF Extracted Text Sample (first 20 lines) ---')
        for l in lines[:20]:
            print(l)
        print('--- End of Sample ---')
        # More robust regex: allow for any whitespace, tabs, and greedy description, and match $amount at end
        line_re = re.compile(r"([A-Za-z]{3} \d{1,2})\s+([A-Za-z]{3} \d{1,2})\s+(.+?)\s*\$([\d,]+\.\d{2})$")
        for line in lines:
            m = line_re.search(line)
            if m:
                date1, date2, desc, amt = m.groups()
                date = parse_month_day(date1)
                try:
                    amt = float(amt.replace(',', ''))
                except Exception:
                    continue
                rows.append({'date': date, 'description': desc, 'amount': amt})
        print('Regex fallback found rows:', rows[:3])
    return pd.DataFrame(rows)

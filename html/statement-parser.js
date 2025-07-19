// Client-side file parsing for bank statements
export class StatementParser {
    static async parseFile(file, cardType) {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        
        if (fileExtension === 'csv') {
            return await this.parseCSV(file, cardType);
        } else if (fileExtension === 'pdf') {
            throw new Error('PDF parsing requires server-side processing. Please use CSV files for now.');
        } else {
            throw new Error('Unsupported file format. Please use CSV files.');
        }
    }

    static async parseCSV(file, cardType) {
        const text = await file.text();
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        
        if (lines.length < 2) {
            throw new Error('File appears to be empty or invalid');
        }

        // Remove BOM if present
        const cleanedText = text.replace(/^\uFEFF/, '');
        const cleanedLines = cleanedText.split('\n').map(line => line.trim()).filter(line => line);

        switch (cardType.toLowerCase()) {
            case 'chase sapphire':
            case 'chase':
                return this.parseChaseCSV(cleanedLines);
            case 'discover':
                return this.parseDiscoverCSV(cleanedLines);
            case 'amex':
            case 'american express':
                return this.parseAmexCSV(cleanedLines);
            case 'sbi':
            case 'hdfc bank':
            case 'icici bank':
            case 'axis bank':
            case 'kotak mahindra':
            case 'pnb':
            case 'bank of baroda':
            case 'idfc first bank':
            case 'indian bank':
                return this.parseIndianBankCSV(cleanedLines, cardType);
            default:
                return this.parseGenericCSV(cleanedLines);
        }
    }

    static parseChaseCSV(lines) {
        const expenses = [];
        
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            
            // Parse CSV with proper quote handling
            const columns = this.parseCSVLine(line);
            
            if (columns.length >= 5) {
                const amount = parseFloat(columns[5]) || 0;
                if (amount > 0) { // Only positive amounts (expenses)
                    expenses.push({
                        date: this.parseDate(columns[0]),
                        description: columns[2] || '',
                        amount: amount,
                        category: 'Uncategorized',
                        card: 'Chase Sapphire'
                    });
                }
            }
        }
        
        return expenses;
    }

    static parseDiscoverCSV(lines) {
        const expenses = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            
            const columns = this.parseCSVLine(line);
            
            if (columns.length >= 4) {
                const amount = Math.abs(parseFloat(columns[3]) || 0);
                if (amount > 0) {
                    expenses.push({
                        date: this.parseDate(columns[0]),
                        description: columns[1] || '',
                        amount: amount,
                        category: 'Uncategorized',
                        card: 'Discover'
                    });
                }
            }
        }
        
        return expenses;
    }

    static parseAmexCSV(lines) {
        const expenses = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            
            const columns = this.parseCSVLine(line);
            
            if (columns.length >= 3) {
                const amount = parseFloat(columns[2]) || 0;
                if (amount > 0) {
                    expenses.push({
                        date: this.parseDate(columns[0]),
                        description: columns[1] || '',
                        amount: amount,
                        category: 'Uncategorized',
                        card: 'American Express'
                    });
                }
            }
        }
        
        return expenses;
    }

    static parseIndianBankCSV(lines, bankName) {
        const expenses = [];
        
        // Try to detect the format by examining headers
        const headerLine = lines[0].toLowerCase();
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            
            const columns = this.parseCSVLine(line);
            
            if (columns.length >= 4) {
                let date, description, amount;
                
                // Common Indian bank formats
                if (headerLine.includes('transaction date') || headerLine.includes('date')) {
                    date = this.parseDate(columns[0]);
                    description = columns[2] || columns[1] || '';
                    // Look for debit amount (expenses)
                    amount = this.extractDebitAmount(columns);
                } else {
                    // Generic fallback
                    date = this.parseDate(columns[0]);
                    description = columns[1] || '';
                    amount = Math.abs(parseFloat(columns[2]) || parseFloat(columns[3]) || 0);
                }
                
                if (amount > 0) {
                    expenses.push({
                        date: date,
                        description: description,
                        amount: amount,
                        category: 'Uncategorized',
                        card: bankName
                    });
                }
            }
        }
        
        return expenses;
    }

    static parseGenericCSV(lines) {
        const expenses = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            
            const columns = this.parseCSVLine(line);
            
            if (columns.length >= 3) {
                const amount = Math.abs(parseFloat(columns[2]) || parseFloat(columns[1]) || 0);
                if (amount > 0) {
                    expenses.push({
                        date: this.parseDate(columns[0]),
                        description: columns[1] || columns[0] || '',
                        amount: amount,
                        category: 'Uncategorized',
                        card: 'Unknown'
                    });
                }
            }
        }
        
        return expenses;
    }

    static parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    static parseDate(dateString) {
        if (!dateString) return '';
        
        // Clean the date string
        const cleaned = dateString.replace(/['"]/g, '').trim();
        
        // Try different date formats
        const formats = [
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
            /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
            /(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY or MM-DD-YYYY
        ];
        
        for (const format of formats) {
            const match = cleaned.match(format);
            if (match) {
                const [, p1, p2, p3] = match;
                
                // Assume YYYY-MM-DD format if year is first
                if (p1.length === 4) {
                    return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
                } else {
                    // For ambiguous formats, assume MM/DD/YYYY (US format)
                    const month = p1.padStart(2, '0');
                    const day = p2.padStart(2, '0');
                    const year = p3;
                    return `${year}-${month}-${day}`;
                }
            }
        }
        
        // Fallback: try to parse as Date and format
        const date = new Date(cleaned);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
        
        return cleaned; // Return as-is if can't parse
    }

    static extractDebitAmount(columns) {
        // Look for debit amount in various columns
        for (let i = 2; i < columns.length; i++) {
            const value = parseFloat(columns[i]);
            if (!isNaN(value) && value > 0) {
                // Check if this might be a debit (expense)
                const columnText = columns[i].toLowerCase();
                if (!columnText.includes('credit') && !columnText.includes('+')) {
                    return value;
                }
            }
        }
        
        // Fallback to any positive number
        for (let i = 2; i < columns.length; i++) {
            const value = Math.abs(parseFloat(columns[i]) || 0);
            if (value > 0) return value;
        }
        
        return 0;
    }
}

export { StatementParser };

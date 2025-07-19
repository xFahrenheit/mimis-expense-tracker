# Expense Tracker

A comprehensive web application for tracking and analyzing personal expenses with support for bank statement uploads, intelligent categorization, and detailed analytics.

![Expense Tracker](logo.jpg)

## 🚀 Features

### Core Functionality
- **📊 Multi-view Dashboard**: Expenses, Analytics, and Income Distribution tabs
- **📁 Statement Upload**: Support for CSV and PDF bank statements from major banks
- **🏷️ Smart Categorization**: Automatic expense categorization with manual override
- **✏️ Inline Editing**: Click-to-edit any expense field with real-time updates
- **🔍 Advanced Filtering**: Filter by category, card, spender, date range, and more
- **📈 Visual Analytics**: Interactive charts for spending patterns and trends
- **🔐 Secure Sharing**: Encrypted database sharing for couples/families

### Bank Support
- Chase Sapphire
- Capital One Venture X
- Discover Card
- Bank of America Credit
- Wells Fargo Credit
- American Express
- Citi Credit Card
- Auto-detection for unknown formats

### Analytics & Insights
- **📊 Spending Breakdown**: By category, time period, and person
- **📅 Time Period Analysis**: Daily, weekly, monthly views
- **💰 Split Cost Tracking**: Shared expenses between multiple people
- **🏷️ Need vs Luxury**: Categorize expenses by necessity
- **📈 Trend Analysis**: Spending patterns over time

## 🛠️ Technology Stack

### Frontend
- **HTML5** with modern CSS (Tailwind CSS)
- **Vanilla JavaScript** with ES6 modules
- **Chart.js** for data visualization
- **Responsive design** for mobile and desktop

### Backend
- **Python Flask** REST API
- **SQLite** database
- **Pandas** for data processing
- **PDFplumber** for PDF statement parsing
- **Flask-CORS** for cross-origin requests

## 📁 Project Structure

```
expense_tracker/
├── html/                    # Frontend files
│   ├── index.html          # Main application
│   ├── main.js             # Application entry point
│   ├── render.js           # Table rendering and inline editing
│   ├── api.js              # API communication
│   ├── categories.js       # Category management
│   ├── filters.js          # Filtering and sorting
│   ├── charts.js           # Data visualization
│   ├── time_periods.js     # Time period handling
│   ├── helpers.js          # Utility functions
│   ├── config.js           # Configuration and state
│   └── styles.css          # Custom styling
├── server/                 # Backend files
│   ├── app.py              # Flask application
│   ├── requirements.txt    # Python dependencies
│   ├── services/           # Modular services
│   │   ├── database_service.py
│   │   ├── expense_service.py
│   │   ├── category_service.py
│   │   ├── pdf_service.py
│   │   ├── statement_service.py
│   │   └── cleanup_service.py
│   └── uploads/            # Uploaded statements
├── security/               # Database security tools
│   ├── db_manager.sh       # Database encryption/decryption
│   ├── DATABASE_SECURITY.md # Security documentation
│   └── db_backups/         # Automatic backups (local only)
└── logo/                   # Application assets
```

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Modern web browser
- Bank statements in CSV or PDF format

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/xFahrenheit/mimis-expense-tracker.git
   cd mimis-expense-tracker
   ```

2. **Set up Python environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   cd server
   pip install -r requirements.txt
   ```

4. **Start the Flask server**
   ```bash
   python app.py
   ```

5. **Open the application**
   Open `html/index.html` in your web browser or serve it through a local server.

## 🔐 Secure Multi-User Setup

### For Couples/Families: Encrypted Database Sharing

This expense tracker includes a secure system for sharing your financial data between trusted users (like spouses) without exposing it to GitHub or other third parties.

#### Security Features
- ✅ **AES-256 Encryption**: Military-grade encryption for your financial data
- ✅ **Zero GitHub Access**: GitHub only sees encrypted files, never your actual data
- ✅ **Automatic Backups**: Timestamped backups prevent data loss
- ✅ **Conflict Detection**: Warns before overwriting changes

#### Setup for Multiple Users

1. **First User Setup** (you've already done this)
   ```bash
   # Your database is already created and working
   ./db_manager.sh encrypt  # Create first encrypted version
   git add expense_tracker_encrypted.db .gitignore db_manager.sh DATABASE_SECURITY.md
   git commit -m "Add secure database sharing"
   git push
   ```

2. **Second User Setup** (your husband)
   ```bash
   git clone https://github.com/xFahrenheit/mimis-expense-tracker.git
   cd mimis-expense-tracker
   python -m venv .venv
   source .venv/bin/activate
   cd server && pip install -r requirements.txt
   cd ..
   ./db_manager.sh decrypt  # Enter the shared password
   ./setup_password.sh      # Set up backup button password
   ```

#### Daily Workflow

**To start your session:**
```bash
./db_manager.sh sync  # Pull latest + start server automatically
```

**To end your session:**
```bash
# Stop Flask server (Ctrl+C)
./db_manager.sh upload  # Encrypt + commit + push automatically
```

#### Database Manager Commands
- `./db_manager.sh sync` - Pull latest changes and start server
- `./db_manager.sh upload` - Encrypt and upload your changes
- `./db_manager.sh status` - Show database information  
- `./db_manager.sh backup` - Create manual backup

📖 **See `DATABASE_SECURITY.md` for detailed security documentation**

### Quick Start
1. Upload a bank statement (CSV or PDF)
2. Select your bank/card type
3. Review and adjust automatic categorization
4. Explore your spending patterns in the Analytics tab

## 📊 Usage

### Uploading Statements
1. Click the **Upload Statement** button
2. Select your bank statement file (CSV or PDF)
3. Choose your bank/card type from the dropdown
4. The system will automatically parse and categorize expenses

### Managing Expenses
- **Inline Editing**: Click any cell to edit expense details
- **Categorization**: Use the category dropdown or let the system auto-categorize
- **Filtering**: Use the filter chips or dropdown menus to view specific expenses
- **Sorting**: Click column headers to sort by date, amount, category, etc.

### Analytics
- Switch to the **Analytics** tab for detailed spending insights
- View spending by category, time period, and person
- Analyze trends with interactive charts
- Track shared expenses with split cost features

## 🔧 Configuration

### Adding New Categories
Edit `html/categories.js` to add new expense categories:

```javascript
const CATEGORY_META = {
    'new_category': {
        icon: '🆕',
        color: '#FF6B6B',
        keywords: ['keyword1', 'keyword2']
    }
};
```

### Bank Statement Formats
The system supports multiple bank statement formats. To add support for a new bank, modify the parsing logic in `server/services/statement_service.py`.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Chart.js for beautiful data visualizations
- Tailwind CSS for utility-first styling
- Flask community for excellent documentation
- PDFplumber for robust PDF parsing

## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

**Made with ❤️ for personal finance management**

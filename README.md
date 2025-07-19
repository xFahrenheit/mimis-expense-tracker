# 💰 Expense Tracker

A beautiful, secure expense tracking application with multi-user support and bank statement automation.

![Expense Tracker](logo/Expense%20Tracker%20logo%20pixel%20art%20style%20girly.jpg)

## 🚀 Quick Start

### Prerequisites
- Python 3.8+ with pip
- Git (for sharing between users)
- OpenSSL (for encryption)

### Installation
```bash
# Clone the repository
git clone https://github.com/xFahrenheit/mimis-expense-tracker.git
cd expense_tracker

# Install dependencies
pip install -r server/requirements.txt

# Start the application
python server/app.py
# OR use the sync command (pulls updates and starts server)
./db_manager.sh sync
```

Open `http://localhost:5000` in your browser and start tracking expenses!

## 🔐 Multi-User Setup (Couples/Families)

### Initial Setup (First User)
```bash
# Set up encryption password
./setup_password.sh

# Encrypt and sync to shared repository
./db_manager.sh sync
```

### Second User Setup
```bash
# Clone the shared repository
git clone https://github.com/xFahrenheit/mimis-expense-tracker.git
cd expense_tracker

# Install dependencies
pip install -r server/requirements.txt

# Set up the same encryption password
./setup_password.sh

# Download and decrypt database
./db_manager.sh sync
```

### Daily Workflow
- **Starting session:** Run `./db_manager.sh sync` (pulls updates and starts server)
- **Adding expenses:** Use web interface normally
- **Sharing changes:** Click "Save & Push" backup button in web interface (encrypts and uploads to shared repo)
- **Getting updates:** Run `./db_manager.sh sync`

## ✨ Key Features

- **📊 Smart Analytics** - Interactive charts and spending insights
- **🏷️ Auto-Categorization** - AI-powered expense categorization with custom keywords
- **📁 Bank Statement Import** - Support for Chase, Capital One Venture X, Discover, BofA, Wells Fargo, Amex, Citi
- **✏️ Inline Editing** - Click any expense field to edit
- **🔍 Advanced Filtering** - Filter by date, category, amount, person with saved presets
- **🔐 Secure Sharing** - AES-256 encryption for couples/families with zero GitHub exposure
- **💾 One-Click Backup** - Beautiful backup button in web interface
- **📤 Export Tools** - CSV export with custom date ranges

## 🏦 Bank Statement Import

1. Click **"Upload Statement"** button
2. Select your bank/card type from dropdown
3. Choose CSV or PDF file
4. System automatically parses, categorizes, and handles multiple cardholders

**Supported Banks:** Chase Sapphire, Capital One Venture X, Discover, Bank of America, Wells Fargo, American Express, Citi, plus auto-detection for unknown formats.


## 🛡️ Security & Privacy

- **AES-256-CBC encryption** for all financial data
- **Environment variable passwords** - no interactive prompts
- **Git-based sharing** - your data never touches third-party services
- **Local-first** - works completely offline

## 📈 Analytics Features

- **Category breakdown** with interactive charts
- **Time period analysis** (monthly, yearly trends)
- **Need vs Luxury** spending categorization
- **Multi-person expense tracking** for shared households
- **Custom date ranges** and filtering

## 🔧 Advanced Configuration

### Custom Categories
- Use **"Manage Categories"** button for full control
- Add custom icons, colors, and auto-categorization keywords
- Bulk recategorization tools

### Environment Variables
```bash
# Set encryption password (optional, for automation)
export EXPENSE_DB_PASSWORD="your-secure-password"
```

## 📁 Project Structure

```
expense_tracker/
├── server/
│   ├── app.py              # Flask web server
│   ├── services/           # Modular services
│   │   ├── pdf_service.py  # Bank statement parsing
│   │   ├── database_service.py
│   │   └── ...
│   └── requirements.txt
├── html/
│   ├── index.html          # Web interface
│   ├── main.js            # Frontend logic
│   └── styles.css         # Beautiful styling
├── db_manager.sh          # Encryption/sync tool
└── setup_password.sh      # Password configuration
```

## 🆘 Troubleshooting

**Backup button not working?**
- Ensure `EXPENSE_DB_PASSWORD` environment variable is set
- Check that git repository is properly configured

**PDF parsing failed?**
- Verify bank type selection matches your statement
- Check PDF isn't password-protected or image-only

**Encryption issues?**
- Run `./setup_password.sh` to reset password
- Ensure OpenSSL is installed

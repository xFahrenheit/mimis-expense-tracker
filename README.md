## 🚀 Quick Start

### Prerequisites
- Python 3.8+ with pip
- Git (for sharing between users)
- OpenSSL (for encryption)

### Installation
```bash
# Clone the repository
git clone https://github.com/xFahrenheit/mimis-expense-tracker.git
cd mimis_expense_tracker

# Install dependencies
pip install -r server/requirements.txt

# Start the application
cd server && python app.py
```

Open `http://127.0.0.1:3001/` in your browser and start tracking expenses!

## 🔐 Multi-User Setup (Couples/Families)

### Initial Setup (First User)
```bash
# 1. Start server and add some expenses first
cd server && python app.py
# (Use web interface to add data, then stop server with Ctrl+C)

# 2. Set up encryption password
./setup_password.sh

# 3. Encrypt and upload to shared repository
./db_manager.sh upload
```

### Second User Setup
```bash
# Clone the shared repository
git clone https://github.com/xFahrenheit/mimis-expense-tracker.git
cd mimis_expense_tracker

# (Optional) Create a Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Or, create a Conda environment
conda create -n expense-tracker python=3.8
conda activate expense-tracker

# (Optional) Create a `.env` file for environment variables
echo 'EXPENSE_DB_PASSWORD=your-secure-password' > .env

# Install dependencies
pip install -r server/requirements.txt

# Set up the same encryption password
./setup_password.sh

# Download, decrypt database and start server
./db_manager.sh sync
```

### Daily Workflow
- **Starting session:** Run `./db_manager.sh sync` (pulls updates and starts server)
- **Adding expenses:** Use web interface normally  
- **Sharing changes:** Click "Save & Push" backup button in web interface (encrypts and uploads to shared repo)

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

**Forgot your encryption password?**
- If you have local backups: Check `db_backups/` folder for unencrypted database backups
- If your partner/family member has access: They can share an unencrypted backup with you
- Last resort: Start fresh with a new database (you'll lose transaction history)

**Backup button not working?**
- Ensure `EXPENSE_DB_PASSWORD` environment variable is set
- Check that git repository is properly configured

**PDF parsing failed?**
- Verify bank type selection matches your statement
- Check PDF isn't password-protected or image-only

**Encryption issues?**
- Run `./setup_password.sh` to reset password
- Ensure OpenSSL is installed

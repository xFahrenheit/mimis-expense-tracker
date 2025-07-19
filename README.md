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


#!/bin/bash

# Database Repository Setup Script
# This script helps set up a private repository for storing encrypted database files

echo "🔐 Expense Tracker Database Repository Setup"
echo "============================================"
echo ""

# Check if EXPENSE_DB_REPO is already set
if [ -n "$EXPENSE_DB_REPO" ]; then
    echo "✅ EXPENSE_DB_REPO is already set to: $EXPENSE_DB_REPO"
else
    echo "📝 You need to create a private repository for storing your encrypted database."
    echo ""
    echo "1. Go to GitHub, GitLab, or your preferred Git hosting service"
    echo "2. Create a new PRIVATE repository (e.g., 'my-expense-db')"
    echo "3. Copy the repository URL (SSH or HTTPS)"
    echo ""
    read -p "Enter your database repository URL: " repo_url
    
    if [ -z "$repo_url" ]; then
        echo "❌ No repository URL provided. Exiting."
        exit 1
    fi
    
    echo ""
    echo "🔧 Setting up environment variable..."
    
    # Determine shell configuration file
    if [ -f ~/.bashrc ]; then
        shell_file="$HOME/.bashrc"
    elif [ -f ~/.zshrc ]; then
        shell_file="$HOME/.zshrc"
    elif [ -f ~/.profile ]; then
        shell_file="$HOME/.profile"
    else
        shell_file="$HOME/.bashrc"
        touch "$shell_file"
    fi
    
    # Add environment variable to shell configuration
    echo "" >> "$shell_file"
    echo "# Expense Tracker Database Repository" >> "$shell_file"
    echo "export EXPENSE_DB_REPO=\"$repo_url\"" >> "$shell_file"
    
    echo "✅ Added EXPENSE_DB_REPO to $shell_file"
    
    # Set for current session
    export EXPENSE_DB_REPO="$repo_url"
    
    echo ""
    echo "🎯 Next steps:"
    echo "1. Restart your terminal or run: source $shell_file"
    echo "2. Set your encryption password: ./setup_password.sh"
    echo "3. Upload your first database: ./db_manager.sh upload"
    echo ""
fi

echo "🚀 You're ready to use the database sync system!"
echo "💡 Usage:"
echo "   ./db_manager.sh sync   - Download latest database and start server"
echo "   ./db_manager.sh upload - Encrypt and upload your changes"
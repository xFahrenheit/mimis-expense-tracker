#!/bin/bash

# Setup script for expense tracker environment variable
# This sets the encryption password for the backup button

echo "🔐 Expense Tracker Password Setup"
echo "================================="
echo ""
echo "The backup button needs an encryption password to work."
echo "This password will be stored as an environment variable."
echo ""

# Prompt for password
read -s -p "Enter your encryption password: " password
echo ""
read -s -p "Confirm password: " password_confirm
echo ""

if [ "$password" != "$password_confirm" ]; then
    echo "❌ Passwords don't match. Please try again."
    exit 1
fi

if [ -z "$password" ]; then
    echo "❌ Password cannot be empty."
    exit 1
fi

echo ""
echo "✅ Password set for this session."
echo ""
echo "To make this permanent, add this line to your shell profile:"
echo "export EXPENSE_DB_PASSWORD='$password'"
echo ""
echo "Shell profile locations:"
echo "• ~/.bashrc (for bash)"
echo "• ~/.zshrc (for zsh)"
echo "• ~/.profile (universal)"
echo ""

# Set for current session
export EXPENSE_DB_PASSWORD="$password"

echo "🚀 You can now use the backup button in the web interface!"
echo "💡 Or run: ./db_manager.sh upload"

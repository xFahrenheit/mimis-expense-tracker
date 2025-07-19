#!/bin/bash

# Expense Tracker Database Manager
# Usage: ./db_manager.sh [sync|upload|status|backup]

DB_FILE="server/expense_tracker.db"
ENCRYPTED_FILE="expense_tracker_encrypted.db"
BACKUP_DIR="db_backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to create a timestamped backup
create_backup() {
    if [ -f "$DB_FILE" ]; then
        timestamp=$(date +"%Y%m%d_%H%M%S")
        backup_file="$BACKUP_DIR/expense_tracker_backup_$timestamp.db"
        cp "$DB_FILE" "$backup_file"
        echo "📁 Backup created: $backup_file"
    fi
}

# Clean up any stray database files
cleanup() {
    if [ -f "expense_tracker.db" ]; then
        rm "expense_tracker.db"
    fi
    if [ -f "$DB_FILE.remote" ]; then
        rm "$DB_FILE.remote"
    fi
}

if [ "$1" = "sync" ]; then
    echo "🔄 Syncing and starting server..."
    cleanup
    
    # Pull latest changes
    echo "📥 Pulling latest from GitHub..."
    git pull
    
    if [ -f "$ENCRYPTED_FILE" ]; then
        # Backup current database if it exists
        if [ -f "$DB_FILE" ]; then
            create_backup
        fi
        
        # Decrypt the latest database
        echo "🔓 Decrypting database..."
        
        # Check if password is provided via environment variable
        if [ -n "$EXPENSE_DB_PASSWORD" ]; then
            # Use password from environment variable (non-interactive)
            echo "$EXPENSE_DB_PASSWORD" | openssl enc -aes-256-cbc -d -in "$ENCRYPTED_FILE" -out "$DB_FILE" -pass stdin
        else
            # Interactive password prompt (for manual use)
            openssl enc -aes-256-cbc -d -in "$ENCRYPTED_FILE" -out "$DB_FILE"
        fi
        
        if [ $? -eq 0 ]; then
            echo "✅ Database ready!"
            echo "🚀 Starting Flask server..."
            cd server && python app.py
        else
            echo "❌ Failed to decrypt database. Check password."
            exit 1
        fi
    else
        echo "❌ No encrypted database found. Run 'upload' first."
        exit 1
    fi

elif [ "$1" = "upload" ]; then
    echo "📤 Uploading your changes..."
    cleanup
    
    if [ ! -f "$DB_FILE" ]; then
        echo "❌ No database found. Run 'sync' first."
        exit 1
    fi
    
    # Create backup before uploading
    create_backup
    
    # Check for remote changes
    git fetch
    if ! git diff --quiet HEAD origin/main -- "$ENCRYPTED_FILE" 2>/dev/null; then
        echo "⚠️  WARNING: Remote database has been updated!"
        echo "   Your upload will overwrite those changes."
        read -p "   Continue? (y/N): " confirm
        if [[ $confirm != [yY] ]]; then
            echo "❌ Upload cancelled. Use 'sync' to get latest changes first."
            exit 1
        fi
    fi
    
    # Encrypt the database
    echo "🔒 Encrypting database..."
    
    # Check if password is provided via environment variable
    if [ -n "$EXPENSE_DB_PASSWORD" ]; then
        # Use password from environment variable (non-interactive)
        echo "$EXPENSE_DB_PASSWORD" | openssl enc -aes-256-cbc -salt -in "$DB_FILE" -out "$ENCRYPTED_FILE" -pass stdin
    else
        # Interactive password prompt (for manual use)
        openssl enc -aes-256-cbc -salt -in "$DB_FILE" -out "$ENCRYPTED_FILE"
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Database encrypted!"
        echo "📤 Committing to git..."
        git add "$ENCRYPTED_FILE"
        git commit -m "Update expenses $(date +%Y-%m-%d)"
        git push
        echo "🎉 Upload complete!"
    else
        echo "❌ Failed to encrypt database."
        exit 1
    fi

elif [ "$1" = "status" ]; then
    echo "📊 Database Status"
    echo "=================="
    
    if [ -f "$DB_FILE" ]; then
        size=$(du -h "$DB_FILE" | cut -f1)
        count=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM expenses;" 2>/dev/null || echo "?")
        echo "✅ Working database: $DB_FILE ($size, $count expenses)"
    else
        echo "❌ Working database: $DB_FILE (missing - run 'sync')"
    fi
    
    if [ -f "$ENCRYPTED_FILE" ]; then
        size=$(du -h "$ENCRYPTED_FILE" | cut -f1)
        echo "✅ Encrypted version: $ENCRYPTED_FILE ($size)"
    else
        echo "❌ Encrypted version: $ENCRYPTED_FILE (missing)"
    fi
    
    backup_count=$(ls -1 "$BACKUP_DIR"/*.db 2>/dev/null | wc -l)
    echo "📁 Backups: $backup_count files in $BACKUP_DIR/"
    
    # Check git status
    if git status --porcelain | grep -q "$ENCRYPTED_FILE"; then
        echo "⚠️  Uncommitted changes detected"
    fi

elif [ "$1" = "backup" ]; then
    echo "📁 Creating manual backup..."
    create_backup
    echo "✅ Backup complete"

else
    echo "Expense Tracker Database Manager"
    echo "==============================="
    echo ""
    echo "Usage: $0 [sync|upload|status|backup]"
    echo ""
    echo "🔄 sync    - Pull latest changes and start server"
    echo "📤 upload  - Encrypt and upload your changes"  
    echo "📊 status  - Show database information"
    echo "📁 backup  - Create manual backup"
    echo ""
    echo "💡 Daily workflow:"
    echo "   './db_manager.sh sync'   - Start your session"
    echo "   './db_manager.sh upload' - End your session"
    exit 1
fi

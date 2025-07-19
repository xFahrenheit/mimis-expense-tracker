#!/bin/bash

# Expense Tracker Database Encryption/Decryption Tool
# Usage: ./db_manager.sh [encrypt|decrypt|sync|backup]

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

# Clean up any stray database files in root directory
cleanup_root_db() {
    if [ -f "expense_tracker.db" ]; then
        echo "🧹 Cleaning up stray database file in root directory"
        rm "expense_tracker.db"
    fi
}

if [ "$1" = "encrypt" ]; then
    echo "🔒 Encrypting database for upload..."
    cleanup_root_db  # Clean up any stray files
    
    if [ -f "$DB_FILE" ]; then
        # Create backup before encrypting
        create_backup
        
        # Check if there are uncommitted changes
        git fetch origin main
        if ! git diff --quiet HEAD origin/main -- "$ENCRYPTED_FILE" 2>/dev/null; then
            echo "⚠️  WARNING: Remote database has been updated since your last sync!"
            echo "   This will overwrite remote changes with your local version."
            read -p "   Continue? (y/N): " confirm
            if [[ $confirm != [yY] ]]; then
                echo "❌ Cancelled. Use 'sync' command to merge changes first."
                exit 1
            fi
        fi
        
        openssl enc -aes-256-cbc -salt -in "$DB_FILE" -out "$ENCRYPTED_FILE"
        echo "✅ Database encrypted to $ENCRYPTED_FILE"
        echo "💡 Next steps:"
        echo "   git add $ENCRYPTED_FILE"
        echo "   git commit -m 'Update expenses $(date +%Y-%m-%d)'"
        echo "   git push"
    else
        echo "❌ Database file not found: $DB_FILE"
        exit 1
    fi

elif [ "$1" = "decrypt" ]; then
    echo "🔓 Decrypting database..."
    if [ -f "$ENCRYPTED_FILE" ]; then
        # Backup existing database if it exists
        if [ -f "$DB_FILE" ]; then
            create_backup
        fi
        
        openssl enc -aes-256-cbc -d -in "$ENCRYPTED_FILE" -out "$DB_FILE"
        echo "✅ Database decrypted to $DB_FILE"
        echo "🚀 You can now run the Flask server"
    else
        echo "❌ Encrypted file not found: $ENCRYPTED_FILE"
        echo "💡 Make sure you've pulled the latest changes: git pull"
        exit 1
    fi

elif [ "$1" = "sync" ]; then
    echo "🔄 Syncing with remote database..."
    cleanup_root_db  # Clean up any stray files
    
    # Pull latest changes
    echo "📥 Pulling latest changes..."
    git pull
    
    if [ -f "$ENCRYPTED_FILE" ]; then
        # Backup current database
        create_backup
        
        # Decrypt the remote version to a temporary file
        temp_remote="$DB_FILE.remote.tmp"
        openssl enc -aes-256-cbc -d -in "$ENCRYPTED_FILE" -out "$temp_remote"
        
        if [ -f "$temp_remote" ]; then
            # Move to proper location
            mv "$temp_remote" "$DB_FILE.remote"
            echo "✅ Remote database downloaded as $DB_FILE.remote"
            echo "💡 You now have:"
            echo "   - Your version: $DB_FILE"
            echo "   - Remote version: $DB_FILE.remote"
            echo "   - Backups in: $BACKUP_DIR/"
            echo ""
            echo "🔧 To merge manually:"
            echo "   1. Open both databases in SQLite browser"
            echo "   2. Export/import the data you want to keep"
            echo "   3. Delete $DB_FILE.remote when done"
            echo "   4. Run './db_manager.sh encrypt' to upload your merged version"
        else
            echo "❌ Failed to decrypt remote database"
            exit 1
        fi
    else
        echo "❌ No encrypted database found after pull"
    fi

elif [ "$1" = "backup" ]; then
    echo "📁 Creating manual backup..."
    create_backup
    echo "✅ Backup complete"

elif [ "$1" = "status" ]; then
    echo "📊 Database Status Report"
    echo "========================"
    
    if [ -f "$DB_FILE" ]; then
        size=$(du -h "$DB_FILE" | cut -f1)
        echo "✅ Working database: $DB_FILE ($size)"
    else
        echo "❌ Working database: $DB_FILE (missing)"
    fi
    
    if [ -f "$ENCRYPTED_FILE" ]; then
        size=$(du -h "$ENCRYPTED_FILE" | cut -f1)
        echo "✅ Encrypted version: $ENCRYPTED_FILE ($size)"
    else
        echo "❌ Encrypted version: $ENCRYPTED_FILE (missing)"
    fi
    
    if [ -f "$DB_FILE.remote" ]; then
        size=$(du -h "$DB_FILE.remote" | cut -f1)
        echo "⚠️  Remote version: $DB_FILE.remote ($size) - cleanup needed"
    fi
    
    backup_count=$(ls -1 "$BACKUP_DIR"/*.db 2>/dev/null | wc -l)
    echo "📁 Backups available: $backup_count in $BACKUP_DIR/"
    
    if [ -f "expense_tracker.db" ]; then
        echo "🧹 Stray file detected: expense_tracker.db (will be cleaned up)"
    fi

else
    echo "Usage: $0 [encrypt|decrypt|sync|backup|status]"
    echo ""
    echo "🔒 encrypt  - Encrypt local database for git upload"
    echo "🔓 decrypt  - Decrypt remote database for local use"
    echo "🔄 sync     - Download remote version for manual merging"
    echo "📁 backup   - Create a timestamped backup"
    echo "📊 status   - Show current database file status"
    echo ""
    echo "📖 Workflow:"
    echo "  1. 'sync' - Get latest remote changes"
    echo "  2. Work with expenses locally"
    echo "  3. 'encrypt' - Upload your changes"
    exit 1
fi

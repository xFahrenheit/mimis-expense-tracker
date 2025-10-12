#!/bin/bash

# Expense Tracker Database Manager
# Usage: ./db_manager.sh [sync|upload|status|backup]

DB_FILE="server/expense_tracker.db"
ENCRYPTED_FILE="expense_tracker_encrypted.db"
BACKUP_DIR="db_backups"
DB_REPO_DIR=".db_repo"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to check if EXPENSE_DB_REPO is set
check_db_repo_env() {
    if [ -z "$EXPENSE_DB_REPO" ]; then
        echo "❌ EXPENSE_DB_REPO environment variable not set"
        echo "   Please set it to your private database repository URL"
        echo "   Example: export EXPENSE_DB_REPO='git@github.com:username/private-expense-db.git'"
        exit 1
    fi
}

# Function to setup or update the database repository
setup_db_repo() {
    if [ ! -d "$DB_REPO_DIR" ]; then
        echo "📥 Cloning database repository..."
        git clone "$EXPENSE_DB_REPO" "$DB_REPO_DIR"
        if [ $? -ne 0 ]; then
            echo "❌ Failed to clone database repository: $EXPENSE_DB_REPO"
            exit 1
        fi
    else
        echo "📥 Updating database repository..."
        cd "$DB_REPO_DIR"
        git fetch origin
        git reset --hard origin/main
        cd ..
    fi
}

# Function to delete old backups, keeping only the 7 most recent
delete_old_backups() {
    backups=( $(ls -1t "$BACKUP_DIR"/expense_tracker_backup_*.db 2>/dev/null) )
    count=${#backups[@]}
    if [ $count -gt 7 ]; then
        for ((i=7; i<$count; i++)); do
            rm -f "${backups[$i]}"
            echo "🗑️ Deleted old backup: ${backups[$i]}"
        done
    fi
}

# Function to create a timestamped backup
create_backup() {
    if [ -f "$DB_FILE" ]; then
        timestamp=$(date +"%Y%m%d_%H%M%S")
        backup_file="$BACKUP_DIR/expense_tracker_backup_$timestamp.db"
        cp "$DB_FILE" "$backup_file"
        echo "📁 Backup created: $backup_file"
        delete_old_backups
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
    # Clean up local encrypted file (will be copied from repo)
    if [ -f "$ENCRYPTED_FILE" ]; then
        rm "$ENCRYPTED_FILE"
    fi
}

if [ "$1" = "sync" ]; then
    echo "🔄 Syncing and starting server..."
    cleanup
    
    # Check environment variable
    check_db_repo_env
    
    # Setup/update database repository
    setup_db_repo
    
    # Pull latest changes from main repository (code changes)
    echo "📥 Pulling latest code from GitHub..."
    git pull origin main
    
    if [ -f "$DB_REPO_DIR/$ENCRYPTED_FILE" ]; then
        # Copy encrypted database from db repository
        cp "$DB_REPO_DIR/$ENCRYPTED_FILE" "$ENCRYPTED_FILE"
        
        # Backup current database if it exists
        if [ -f "$DB_FILE" ]; then
            create_backup
        fi
        
        # Decrypt the latest database
        echo "🔓 Decrypting database..."
        
        # Check if password is provided via environment variable
        if [ -n "$EXPENSE_DB_PASSWORD" ]; then
            # Use password from environment variable (non-interactive)
            echo "$EXPENSE_DB_PASSWORD" | openssl enc -aes-256-cbc -d -pbkdf2 -in "$ENCRYPTED_FILE" -out "$DB_FILE" -pass stdin
        else
            # Interactive password prompt (for manual use)
            openssl enc -aes-256-cbc -d -pbkdf2 -in "$ENCRYPTED_FILE" -out "$DB_FILE"
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
        echo "❌ No encrypted database found in repository. Run 'upload' first."
        exit 1
    fi

elif [ "$1" = "upload" ]; then
    echo "📤 Uploading your changes..."
    cleanup
    
    if [ ! -f "$DB_FILE" ]; then
        echo "❌ No database found. Run 'sync' first."
        exit 1
    fi
    
    # Check environment variable
    check_db_repo_env
    
    # Setup/update database repository
    setup_db_repo
    
    # Create backup before uploading
    create_backup
    
    # Check for remote changes in database repository
    cd "$DB_REPO_DIR"
    git fetch origin main
    if ! git diff --quiet HEAD origin/main -- "$ENCRYPTED_FILE" 2>/dev/null; then
        echo "⚠️  WARNING: Remote database has been updated!"
        echo "   Your upload will overwrite those changes."
        read -p "   Continue? (y/N): " confirm
        if [[ $confirm != [yY] ]]; then
            echo "❌ Upload cancelled. Use 'sync' to get latest changes first."
            cd ..
            exit 1
        fi
    fi
    cd ..
    
    # Encrypt the database
    echo "🔒 Encrypting database..."
    
    # Check if password is provided via environment variable
    if [ -n "$EXPENSE_DB_PASSWORD" ]; then
        # Use password from environment variable (non-interactive)
        echo "$EXPENSE_DB_PASSWORD" | openssl enc -aes-256-cbc -salt -pbkdf2 -in "$DB_FILE" -out "$ENCRYPTED_FILE" -pass stdin
    else
        # Interactive password prompt (for manual use)
        openssl enc -aes-256-cbc -salt -pbkdf2 -in "$DB_FILE" -out "$ENCRYPTED_FILE"
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Database encrypted!"
        echo "📤 Committing to database repository..."
        
        # Copy encrypted file to database repository
        cp "$ENCRYPTED_FILE" "$DB_REPO_DIR/$ENCRYPTED_FILE"
        
        # Commit and push to database repository
        cd "$DB_REPO_DIR"
        git add "$ENCRYPTED_FILE"
        git commit -m "Update expenses $(date +%Y-%m-%d)"
        git push origin main
        cd ..
        
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
        echo "✅ Local encrypted version: $ENCRYPTED_FILE ($size)"
    else
        echo "❌ Local encrypted version: $ENCRYPTED_FILE (missing)"
    fi
    
    # Check database repository status
    if [ -n "$EXPENSE_DB_REPO" ]; then
        echo "�️  Database repository: $EXPENSE_DB_REPO"
        if [ -d "$DB_REPO_DIR" ]; then
            if [ -f "$DB_REPO_DIR/$ENCRYPTED_FILE" ]; then
                size=$(du -h "$DB_REPO_DIR/$ENCRYPTED_FILE" | cut -f1)
                echo "✅ Repository encrypted version: $size"
            else
                echo "❌ Repository encrypted version: (missing)"
            fi
        else
            echo "❌ Database repository: (not cloned - run 'sync')"
        fi
    else
        echo "❌ EXPENSE_DB_REPO environment variable not set"
    fi
    
    backup_count=$(ls -1 "$BACKUP_DIR"/*.db 2>/dev/null | wc -l)
    echo "📁 Backups: $backup_count files in $BACKUP_DIR/"

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
    echo "� Required Environment Variables:"
    echo "   EXPENSE_DB_REPO     - Private repository URL for encrypted database"
    echo "   EXPENSE_DB_PASSWORD - Encryption password"
    echo ""
    echo "�💡 Daily workflow:"
    echo "   './db_manager.sh sync'   - Start your session"
    echo "   './db_manager.sh upload' - End your session"
    exit 1
fi

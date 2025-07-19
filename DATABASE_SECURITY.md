# 🔐 Secure Database Sharing Workflow

## Overview
This expense tracker uses encrypted database sharing to ensure maximum security. GitHub never sees your actual financial data - only encrypted files.

## Setup for Each User

### First Time Setup
1. Clone the repository
2. Run: `./db_manager.sh decrypt` (enter the shared password)
3. Start the Flask server normally

### Daily Workflow

#### When you want to upload your changes:
```bash
# 1. Stop the Flask server
# 2. Sync and encrypt your database
./db_manager.sh encrypt

# 3. Commit and push (follow the prompts)
git add expense_tracker_encrypted.db
git commit -m "Update expenses $(date +%Y-%m-%d)"
git push
```

#### When you want to get updates:
```bash
# 1. Sync with remote
./db_manager.sh sync

# 2. Start the Flask server
cd server && python app.py
```

#### If both of you edited simultaneously:
```bash
# 1. Use sync to get both versions
./db_manager.sh sync

# 2. You'll have:
#    - server/expense_tracker.db (your version)
#    - server/expense_tracker.db.remote (their version)
#    - Automatic backups in db_backups/

# 3. Manually merge the data you want to keep
#    (Use SQLite browser or the web interface)

# 4. Upload your merged version
./db_manager.sh encrypt
git add expense_tracker_encrypted.db
git commit -m "Merge expenses"
git push
```

## Security Features

✅ **AES-256 Encryption**: Military-grade encryption  
✅ **Zero GitHub Access**: GitHub only sees encrypted data  
✅ **Password Protected**: Only you and your husband know the password  
✅ **Local Decryption**: Database is only decrypted on your machines  

## Important Notes

- **Never commit the unencrypted database** (`server/expense_tracker.db`)
- **Always encrypt before pushing** to git
- **Share the encryption password securely** (not in git/email)
- **Keep the password safe** - lost password = lost data

## Alternative: Cloud Storage Sync

If you prefer, you can also:
1. Keep the database completely out of git
2. Use a secure cloud service (iCloud, Dropbox, etc.) to sync just the database file
3. Both point your Flask servers to the shared cloud folder

## Conflict Resolution

When both users edit the database simultaneously, the script will help you merge changes:

1. **Automatic Backups**: Every operation creates timestamped backups
2. **Warning System**: Alerts you if remote changes exist before overwriting
3. **Manual Merge**: Downloads both versions for comparison
4. **Last-Writer-Wins**: Simple model where the last person to upload wins (with backups)

### Merge Strategies

**Option A: Use Web Interface**
- Start Flask server with your version
- Use the expense tracker web interface to manually add missing entries from the other version

**Option B: SQLite Tools**
- Use DB Browser for SQLite to compare and merge databases
- Export/import specific tables or records

**Option C: Coordinate Timing**
- Agree on who edits when (e.g., weekdays vs weekends)
- Use a shared calendar or messaging to coordinate

## Troubleshooting

**"Database file not found"** - Run `./db_manager.sh decrypt` first  
**"Encrypted file not found"** - Run `git pull` to get latest version  
**"Bad decrypt"** - Check if you entered the correct password  
**"Merge conflicts"** - Use `./db_manager.sh sync` to resolve manually

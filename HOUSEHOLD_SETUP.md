# Household Expense Tracker - Setup Guide

Welcome to your customizable Household Expense Tracker! This application is designed to be easily configured for any household, whether you're a couple, roommates, family, or friends sharing expenses.

## 🚀 Quick Start (No Coding Required!)

### Method 1: Use the Web Interface (Recommended)

1. **Start the Application:**
   ```bash
   cd server
   python app.py
   ```
   Then open `html/index.html` in your browser.

2. **Click "👥 Manage Household"** button in the top right corner

3. **Add Your Household Members:**
   - Enter member names (e.g., "John", "Sarah", "Kids")
   - Choose emojis (👨, 👩, 👶, 🏠, etc.)
   - Pick colors for charts
   - Click "Add Member"

4. **Use Quick Presets:**
   - Click preset buttons for common setups:
     - 👫 Couple
     - 🏠 Roommates  
     - 👨‍👩‍👧‍👦 Family
     - 👫 Siblings
     - 👥 Friends

5. **Remove Members:** Click "Remove" next to any member (must keep at least 1)

6. **Edit Names:** Click "Edit" to change member names

**That's it! Your interface automatically updates with your household members.**

### Method 2: Edit Configuration File (Advanced)

If you prefer to edit code, modify `html/household-setup.js`:

**Example for a couple named John and Sarah:**
```javascript
setupHousehold('John', 'Sarah', '👨', '👩');
```

**Example for roommates:**
```javascript
setupHousehold('Alex', 'Sam', '🏠', '🏠');
```

**Example for a family with kids:**
```javascript
setupHousehold('Mom', 'Dad', '👩', '👨');
addHouseholdMember('Kids', '👶', '#f4acb7');
```

## 📊 Features That Automatically Adapt

Once you configure your household, these features automatically work with your member names:

- **Individual Spending Totals**: Each member gets their own spending summary
- **Spender Charts**: Pie charts showing expense distribution by member
- **Expense Assignment**: Dropdowns populated with your member names
- **Split Costs**: Automatically divides shared expenses among members
- **Filtering**: Filter expenses by any household member

## 👥 Managing Your Household

### Adding Members
1. Click "👥 Manage Household"
2. Enter member name
3. Choose emoji and color
4. Click "Add Member"
5. New member immediately appears in all dropdowns and charts!

### Removing Members
1. Click "� Manage Household"
2. Click "Remove" next to member name
3. Confirm deletion
4. Member is removed from all interfaces

### Quick Setup Presets
Choose from common household types:
- **👫 Couple**: Partner 1 & Partner 2 with heart emojis
- **🏠 Roommates**: Roommate 1 & Roommate 2 with house emojis
- **👨‍👩‍👧‍👦 Family**: Mom, Dad & Kids with family emojis
- **👫 Siblings**: Sibling 1 & Sibling 2 
- **👥 Friends**: Friend 1 & Friend 2 with friend emojis

### Member Management Features
- **Edit Names**: Change any member's name instantly
- **Primary Member**: First member is marked as "Primary" (default for new expenses)
- **Visual Indicators**: Each member has their own emoji and color
- **Minimum Requirement**: Must have at least 1 household member

## 📱 Using the Expense Tracker

### Adding Expenses
1. Click "Add Expense" 
2. Choose the household member from the "Who" dropdown (automatically populated with your members)
3. Check "Split Cost" for shared expenses (rent, groceries, utilities, etc.)
4. Categorize your expense
5. Mark as "Need" or "Luxury"

### Split Costs
When you check "Split Cost":
- Expense is automatically divided equally among all household members
- Each member's total includes their share
- Great for rent, utilities, groceries, shared meals

### Uploading Bank Statements
1. Export your bank statement as CSV
2. Click "Upload Statement" 
3. The system will automatically categorize transactions
4. Review and adjust member assignments as needed

### Viewing Analytics
- **Individual Totals**: See each member's spending at the top
- **Time Periods**: View expenses by month, year, or all time
- **Charts**: Category breakdown, spending trends, member comparison
- **Filtering**: Filter by category, card, member, or need/luxury
- **Export**: Download filtered data as CSV

## 🎨 Customization Options

### Emoji Ideas
- **Family**: 👨 👩 👶 👧 👦 👴 👵 👨‍👩‍👧‍👦
- **Couples**: ❤️ 💑 👫 👬 👭  
- **Roommates**: 🏠 👥 👤 🤝
- **Friends**: 👫 👬 👭 👥 🤝
- **Generic**: 👤 🙂 😊 ⭐
- **Professional**: 💼 👔 👗 💻

### Color Options
- Mint Green (`#6cbda0`)
- Dark Mint (`#3da07f`) 
- Pink (`#f4acb7`)
- Purple Gray (`#9d8189`)
- Dusty Rose (`#d99da2`)
- Gray (`#5e5e5d`)
- Light Gray (`#717274`)

## 🏠 Common Household Scenarios

### Scenario 1: Young Couple
```
👥 Manage Household → Add Members:
- John (👨, Mint Green)
- Sarah (👩, Pink)
```

### Scenario 2: College Roommates
```
👥 Manage Household → Use Preset: "🏠 Roommates"
Then edit names to actual roommate names
```

### Scenario 3: Family with Kids
```
👥 Manage Household → Use Preset: "👨‍👩‍👧‍👦 Family"
Result: Mom, Dad, Kids automatically set up
```

### Scenario 4: Three Friends
```
👥 Manage Household → Add Members:
- Alex (👥, Mint Green)  
- Sam (👥, Dark Mint)
- Jordan (👥, Pink)
```

### Scenario 5: Extended Family
```
👥 Manage Household → Add Members:
- Parents (👨‍👩‍👧‍👦, Mint Green)
- Grandparents (👴, Purple Gray)
- Kids (�, Pink)
```

## 🔄 Making Changes

### Adding New Members Later
1. Click "👥 Manage Household"
2. Add new member
3. All existing expenses remain unchanged
4. New member appears in all future dropdowns

### Removing Members
1. Click "👥 Manage Household"  
2. Remove unwanted member
3. Their expenses remain in the system
4. They're removed from future dropdowns

### Changing Names
1. Click "👥 Manage Household"
2. Click "Edit" next to member
3. Enter new name
4. All existing expenses with old name automatically update

## ❓ Frequently Asked Questions

**Q: Can I have more than 2 household members?**
A: Yes! Add as many as you need using "👥 Manage Household"

**Q: What happens to existing expenses when I change member names?**
A: Existing expenses keep their original member assignments. Only the interface updates.

**Q: Can I change the setup later?**
A: Absolutely! Use "👥 Manage Household" anytime to modify your setup.

**Q: Do I need to know how to code?**
A: No! Use the "👥 Manage Household" button - no coding required.

**Q: Can I have different household setups for different periods?**
A: The interface adapts to your current setup, but expense data remains the same regardless of interface changes.

**Q: What if I make a mistake?**
A: Just click "👥 Manage Household" and fix it! You can add, remove, or edit members anytime.

---

Your expense tracker is now ready for your household! Click "👥 Manage Household" to get started. 💰✨

/*
 * HOUSEHOLD SETUP CONFIGURATION
 * 
 * *** CUSTOMIZE THIS FILE FOR YOUR HOUSEHOLD ***
 * 
 * This is the only file you need to modify to customize the expense tracker
 * for your household members. You can also use the "Manage Household" button
 * in the web interface to make changes without editing this file!
 */

import { setupHousehold, addHouseholdMember, HOUSEHOLD_PRESETS } from './user-config.js';

/*
 * OPTION 1: Quick Setup with Presets
 * Uncomment one of the lines below for common household types:
 */

// For couples:
// HOUSEHOLD_PRESETS.couple();

// For roommates:
// HOUSEHOLD_PRESETS.roommates();

// For parents:
// HOUSEHOLD_PRESETS.family_parents();

// For siblings:
// HOUSEHOLD_PRESETS.siblings();

// For friends sharing expenses:
// HOUSEHOLD_PRESETS.friends();

/*
 * OPTION 2: Custom Setup (Default)
 * Replace the names and emojis below with your household members:
 */

// Default setup - customize these names for your household:
setupHousehold('Member 1', 'Member 2', '�', '�');

// Example setups (uncomment and modify as needed):
// setupHousehold('John', 'Sarah', '👨', '👩');
// setupHousehold('Alex', 'Sam', '🏠', '🏠');
// setupHousehold('Mom', 'Dad', '👩', '👨');

/*
 * OPTION 3: Adding More Members (for households with 3+ people)
 * Uncomment and customize the lines below to add additional members:
 */

// Add children to a family:
// addHouseholdMember('Kids', '👶', '#f4acb7');

// Add a third roommate:
// addHouseholdMember('Chris', '🏠', '#9d8189');

// Add extended family:
// addHouseholdMember('Grandparents', '👴', '#d99da2');

/*
 * 💡 TIP: You can also manage your household members using the 
 * "👥 Manage Household" button in the web interface! 
 * No coding required - just click and configure!
 */

/*
 * COMMON EMOJI OPTIONS:
 * 
 * Family: 👨 👩 👶 👧 👦 👴 👵 👨‍👩‍👧‍👦
 * Couples: ❤️ 💑 👫 👬 👭
 * Roommates/Friends: 🏠 👥 👤 🤝
 * Generic: 👤 🙂 😊 ⭐
 * 
 * COLORS (for additional members):
 * '#6cbda0' (mint green), '#3da07f' (dark mint), '#f4acb7' (pink),
 * '#9d8189' (purple-gray), '#d99da2' (dusty rose)
 */

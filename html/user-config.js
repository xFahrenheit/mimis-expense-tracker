// User Configuration
// This file contains customizable settings for household expense tracking

export const USER_CONFIG = {
    // Default household members (customize these with your family/household names)
    defaultUsers: ['Member 1', 'Member 2', 'Other'],
    
    // User spending display configuration
    spendingBlocks: [
        {
            id: 'user1SpendingValue',
            label: 'Member 1\'s Spending',
            userKey: 'Member 1',
            emoji: '👤'
        },
        {
            id: 'user2SpendingValue', 
            label: 'Member 2\'s Spending',
            userKey: 'Member 2',
            emoji: '👤'
        }
    ],
    
    // Chart configuration
    spenderChart: {
        users: [
            { key: 'Member 1', label: '👤 Member 1', color: '#6cbda0' },
            { key: 'Member 2', label: '👤 Member 2', color: '#3da07f' }
        ]
    },
    
    // Default settings
    defaultSpender: 'Member 1', // Used when no spender is specified
    
    // Application settings
    appTitle: 'Household Expense Tracker',
    currency: '$', // Default currency
    
    // Currency mapping based on bank/region
    currencyMap: {
        'USD': '$',
        'INR': '₹',
        'EUR': '€',
        'GBP': '£'
    },
    
    // Database path (for backend)
    dbPath: './expense_tracker.db'
};

// Load household configuration from backend
export async function loadHouseholdConfig() {
    try {
        const response = await fetch('/household/config');
        if (response.ok) {
            const config = await response.json();
            
            // Update USER_CONFIG with loaded configuration
            if (config.members && config.members.length > 0) {
                USER_CONFIG.defaultUsers = config.members.map(member => member.name).concat(['Other']);
                USER_CONFIG.defaultSpender = config.defaultSpender || config.members[0].name;
                
                // Update spending blocks based on members
                USER_CONFIG.spendingBlocks = config.members.map(member => ({
                    id: `${member.userKey}SpendingValue`,
                    label: `${member.name}'s Spending`,
                    userKey: member.userKey,
                    memberName: member.name,
                    emoji: member.emoji,
                    color: member.color
                }));
                
                // Update app title if provided
                if (config.appTitle) {
                    USER_CONFIG.appTitle = config.appTitle;
                }
            }
            
            return config;
        }
    } catch (error) {
        console.warn('Failed to load household config, using defaults:', error);
    }
    
    // Return default configuration if loading fails
    return {
        members: [
            {name: "Member 1", emoji: "👤", color: "#6cbda0", userKey: "member1"},
            {name: "Member 2", emoji: "👤", color: "#f4acb7", userKey: "member2"}
        ],
        defaultSpender: "Member 1",
        appTitle: "Household Expense Tracker"
    };
}

// Save household configuration to backend
export async function saveHouseholdConfig(config) {
    try {
        const response = await fetch('/household/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('Failed to save household config:', error);
        return false;
    }
}

// Function to detect primary currency from expenses
export function detectPrimaryCurrency(expenses) {
    if (!expenses || expenses.length === 0) {
        return '$'; // Default fallback
    }
    
    // Count currency occurrences
    const currencyCount = {};
    expenses.forEach(expense => {
        const currency = expense.currency || 'USD';
        currencyCount[currency] = (currencyCount[currency] || 0) + 1;
    });
    
    // Find most common currency
    const primaryCurrency = Object.keys(currencyCount).reduce((a, b) => 
        currencyCount[a] > currencyCount[b] ? a : b
    );
    
    return USER_CONFIG.currencyMap[primaryCurrency] || '$';
}

// Function to customize the app for your household members
export async function setupHousehold(member1Name, member2Name, member1Emoji = '👤', member2Emoji = '👤') {
    // Update local configuration
    USER_CONFIG.defaultUsers = [member1Name, member2Name, 'Other'];
    USER_CONFIG.defaultSpender = member1Name;
    
    USER_CONFIG.spendingBlocks = [
        {
            id: 'user1SpendingValue',
            label: `${member1Name}'s Spending`,
            userKey: member1Name,
            emoji: member1Emoji
        },
        {
            id: 'user2SpendingValue',
            label: `${member2Name}'s Spending`, 
            userKey: member2Name,
            emoji: member2Emoji
        }
    ];
    
    USER_CONFIG.spenderChart.users = [
        { key: member1Name, label: `${member1Emoji} ${member1Name}`, color: '#6cbda0' },
        { key: member2Name, label: `${member2Emoji} ${member2Name}`, color: '#3da07f' }
    ];
    
    // Create configuration object for backend
    const config = {
        members: [
            {name: member1Name, emoji: member1Emoji, color: '#6cbda0', userKey: member1Name},
            {name: member2Name, emoji: member2Emoji, color: '#3da07f', userKey: member2Name}
        ],
        defaultSpender: member1Name,
        appTitle: USER_CONFIG.appTitle
    };
    
    // Save to backend
    const saved = await saveHouseholdConfig(config);
    if (!saved) {
        console.warn('Failed to save household configuration to backend');
    }
    
    return saved;
}

// Function to add more household members (for larger families/households)
export function addHouseholdMember(memberName, emoji = '👤', color = '#9d8189') {
    if (!USER_CONFIG.defaultUsers.includes(memberName)) {
        // Insert before 'Other'
        const otherIndex = USER_CONFIG.defaultUsers.indexOf('Other');
        if (otherIndex > -1) {
            USER_CONFIG.defaultUsers.splice(otherIndex, 0, memberName);
        } else {
            USER_CONFIG.defaultUsers.push(memberName);
            USER_CONFIG.defaultUsers.push('Other'); // Ensure 'Other' is always last
        }
    }
    
    // Add spending block - make sure we don't duplicate
    const existingBlock = USER_CONFIG.spendingBlocks.find(block => block.userKey === memberName);
    if (!existingBlock) {
        const memberId = `user${USER_CONFIG.spendingBlocks.length + 1}SpendingValue`;
        USER_CONFIG.spendingBlocks.push({
            id: memberId,
            label: `${memberName}'s Spending`,
            userKey: memberName,
            emoji: emoji
        });
    }
    
    // Add to chart configuration - make sure we don't duplicate
    const existingChartUser = USER_CONFIG.spenderChart.users.find(user => user.key === memberName);
    if (!existingChartUser) {
        USER_CONFIG.spenderChart.users.push({
            key: memberName,
            label: `${emoji} ${memberName}`,
            color: color
        });
    }
}

// Preset configurations for common household types
export const HOUSEHOLD_PRESETS = {
    couple: () => setupHousehold('Partner 1', 'Partner 2', '❤️', '❤️'),
    roommates: () => setupHousehold('Roommate 1', 'Roommate 2', '🏠', '🏠'),
    family_parents: () => setupHousehold('Parent 1', 'Parent 2', '👨‍👩‍👧‍👦', '👨‍👩‍👧‍�'),
    siblings: () => setupHousehold('Sibling 1', 'Sibling 2', '👫', '👫'),
    friends: () => setupHousehold('Friend 1', 'Friend 2', '👥', '👥'),
    generic: () => setupHousehold('Member 1', 'Member 2', '👤', '👤')
};

// Example usage for clients:
// To set up for a couple named John and Jane:
// setupHousehold('John', 'Jane', '👨', '👩');
//
// To set up for roommates:
// setupHousehold('Alex', 'Sam', '🏠', '🏠');
//
// To add a third member to a household:
// addHouseholdMember('Kids', '👶', '#f4acb7');

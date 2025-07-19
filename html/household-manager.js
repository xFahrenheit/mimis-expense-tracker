// Household Member Management
// This module handles adding/removing household members through the UI

import { USER_CONFIG, addHouseholdMember } from './user-config.js';

// Show the household management modal
export function showHouseholdModal() {
    const modalHTML = `
        <div class="modal-overlay" id="householdModalOverlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>👥 Manage Household Members</h2>
                    <span class="modal-close" onclick="closeHouseholdModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <!-- Current Members List -->
                    <div class="section">
                        <h3>Current Household Members</h3>
                        <div id="currentMembersList" class="member-list">
                            <!-- Members will be populated here -->
                        </div>
                    </div>
                    
                    <div class="divider"></div>
                    
                    <!-- Add New Member Section -->
                    <div class="add-member-section">
                        <h3>Add New Member</h3>
                        <div class="add-member-form">
                            <input type="text" id="newMemberName" placeholder="Enter member name" maxlength="20" />
                            <input type="text" id="newMemberEmoji" placeholder="👤" maxlength="2" value="👤" />
                            <select id="newMemberColor">
                                <option value="#6cbda0">Mint Green</option>
                                <option value="#3da07f">Dark Mint</option>
                                <option value="#f4acb7">Pink</option>
                                <option value="#9d8189">Purple Gray</option>
                                <option value="#d99da2">Dusty Rose</option>
                                <option value="#5e5e5d">Gray</option>
                                <option value="#717274">Light Gray</option>
                            </select>
                            <button id="addMemberBtn" class="btn-primary">Add Member</button>
                        </div>
                        <div class="emoji-suggestions">
                            <small>💡 Emoji suggestions: 👤 👨 👩 👶 👧 👦 👴 👵 🏠 ❤️ 👥 🤝</small>
                        </div>
                    </div>
                    
                    <div class="divider"></div>
                    
                    <!-- Quick Setup Section -->
                    <div class="preset-section">
                        <h3>Quick Setup Presets</h3>
                        <div class="preset-buttons">
                            <button class="btn-small" onclick="applyPreset('couple')">👫 Couple</button>
                            <button class="btn-small" onclick="applyPreset('roommates')">🏠 Roommates</button>
                            <button class="btn-small" onclick="applyPreset('family')">👨‍👩‍👧‍👦 Family</button>
                            <button class="btn-small" onclick="applyPreset('siblings')">👫 Siblings</button>
                            <button class="btn-small" onclick="applyPreset('friends')">👥 Friends</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('householdModalOverlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Populate current members
    refreshMembersList();
    
    // Add event listeners
    setupModalEventListeners();
}

function refreshMembersList() {
    const membersList = document.getElementById('currentMembersList');
    if (!membersList) return;
    
    const members = USER_CONFIG.defaultUsers.filter(user => user !== 'Other');
    
    membersList.innerHTML = members.map((member, index) => {
        const spendingBlock = USER_CONFIG.spendingBlocks.find(block => block.userKey === member);
        const emoji = spendingBlock?.emoji || '👤';
        const canDelete = members.length > 1; // Must have at least 1 member
        
        return `
            <div class="member-item">
                <div class="member-info">
                    <span class="member-emoji">${emoji}</span>
                    <span class="member-name">${member}</span>
                    ${index === 0 ? '<span class="default-badge">Primary</span>' : ''}
                </div>
                <div class="member-actions">
                    <button class="btn-small btn-edit" onclick="editMemberName('${member}')">Edit</button>
                    ${canDelete ? `<button class="btn-small btn-delete" onclick="deleteMember('${member}')">Remove</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function setupModalEventListeners() {
    const addMemberBtn = document.getElementById('addMemberBtn');
    const nameInput = document.getElementById('newMemberName');
    
    if (addMemberBtn) {
        addMemberBtn.addEventListener('click', addNewMember);
    }
    
    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addNewMember();
            }
        });
    }
}

async function addNewMember() {
    const nameInput = document.getElementById('newMemberName');
    const emojiInput = document.getElementById('newMemberEmoji');
    const colorSelect = document.getElementById('newMemberColor');
    
    const name = nameInput.value.trim();
    const emoji = emojiInput.value.trim() || '👤';
    const color = colorSelect.value;
    
    if (!name) {
        alert('Please enter a member name');
        return;
    }
    
    if (USER_CONFIG.defaultUsers.includes(name)) {
        alert('A member with this name already exists');
        return;
    }
    
    // Add the member via API
    try {
        const response = await fetch('/household/member', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, emoji, color })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update local configuration
            addHouseholdMember(name, emoji, color);
            
            // Clear form
            nameInput.value = '';
            emojiInput.value = '👤';
            colorSelect.selectedIndex = 0;
            
            // Refresh the display
            refreshMembersList();
            updateUIForNewMember();
            
            alert(`${emoji} ${name} has been added to your household!`);
        } else {
            alert(`Failed to add member: ${result.message}`);
        }
    } catch (error) {
        console.error('Error adding member:', error);
        alert('Failed to add member. Please try again.');
    }
}

// Delete a household member
window.deleteMember = async function(memberName) {
    const members = USER_CONFIG.defaultUsers.filter(user => user !== 'Other');
    
    if (members.length <= 1) {
        alert('You must have at least one household member');
        return;
    }
    
    if (confirm(`Are you sure you want to remove ${memberName} from your household?`)) {
        try {
            const response = await fetch(`/household/member/${encodeURIComponent(memberName)}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Remove from defaultUsers
                const userIndex = USER_CONFIG.defaultUsers.indexOf(memberName);
                if (userIndex > -1) {
                    USER_CONFIG.defaultUsers.splice(userIndex, 1);
                }
                
                // Remove from spendingBlocks
                USER_CONFIG.spendingBlocks = USER_CONFIG.spendingBlocks.filter(
                    block => block.userKey !== memberName
                );
                
                // Remove from spenderChart
                USER_CONFIG.spenderChart.users = USER_CONFIG.spenderChart.users.filter(
                    user => user.key !== memberName
                );
                
                // If this was the default spender, set a new one
                if (USER_CONFIG.defaultSpender === memberName) {
                    USER_CONFIG.defaultSpender = USER_CONFIG.defaultUsers[0];
                }
                
                // Refresh UI
                refreshMembersList();
                updateUIAfterMemberRemoval();
                
                alert(`${memberName} has been removed from your household`);
            } else {
                alert(`Failed to remove member: ${result.message}`);
            }
        } catch (error) {
            console.error('Error removing member:', error);
            alert('Failed to remove member. Please try again.');
        }
    }
};

// Edit member name
window.editMemberName = function(currentName) {
    const newName = prompt(`Enter new name for ${currentName}:`, currentName);
    
    if (!newName || newName.trim() === '' || newName.trim() === currentName) {
        return;
    }
    
    const trimmedName = newName.trim();
    
    if (USER_CONFIG.defaultUsers.includes(trimmedName)) {
        alert('A member with this name already exists');
        return;
    }
    
    // Update defaultUsers
    const userIndex = USER_CONFIG.defaultUsers.indexOf(currentName);
    if (userIndex > -1) {
        USER_CONFIG.defaultUsers[userIndex] = trimmedName;
    }
    
    // Update spendingBlocks
    const spendingBlock = USER_CONFIG.spendingBlocks.find(block => block.userKey === currentName);
    if (spendingBlock) {
        spendingBlock.userKey = trimmedName;
        spendingBlock.label = `${trimmedName}'s Spending`;
    }
    
    // Update spenderChart
    const chartUser = USER_CONFIG.spenderChart.users.find(user => user.key === currentName);
    if (chartUser) {
        chartUser.key = trimmedName;
        chartUser.label = `${chartUser.label.split(' ')[0]} ${trimmedName}`;
    }
    
    // Update default spender if needed
    if (USER_CONFIG.defaultSpender === currentName) {
        USER_CONFIG.defaultSpender = trimmedName;
    }
    
    // Refresh UI
    refreshMembersList();
    updateUIAfterNameChange();
    
    alert(`Member name updated from ${currentName} to ${trimmedName}`);
};

// Apply preset configurations
window.applyPreset = function(presetType) {
    if (!confirm('This will replace your current household setup. Continue?')) {
        return;
    }
    
    // Clear current configuration
    USER_CONFIG.defaultUsers = ['Member 1', 'Member 2', 'Other'];
    USER_CONFIG.spendingBlocks = [];
    USER_CONFIG.spenderChart.users = [];
    
    // Apply preset
    switch (presetType) {
        case 'couple':
            addHouseholdMember('Partner 1', '❤️', '#6cbda0');
            addHouseholdMember('Partner 2', '❤️', '#3da07f');
            break;
        case 'roommates':
            addHouseholdMember('Roommate 1', '🏠', '#6cbda0');
            addHouseholdMember('Roommate 2', '🏠', '#3da07f');
            break;
        case 'family':
            addHouseholdMember('Mom', '👩', '#6cbda0');
            addHouseholdMember('Dad', '👨', '#3da07f');
            addHouseholdMember('Kids', '👶', '#f4acb7');
            break;
        case 'siblings':
            addHouseholdMember('Sibling 1', '👫', '#6cbda0');
            addHouseholdMember('Sibling 2', '👫', '#3da07f');
            break;
        case 'friends':
            addHouseholdMember('Friend 1', '👥', '#6cbda0');
            addHouseholdMember('Friend 2', '👥', '#3da07f');
            break;
    }
    
    USER_CONFIG.defaultSpender = USER_CONFIG.defaultUsers[0];
    
    // Refresh UI
    refreshMembersList();
    updateUIAfterPresetApply();
    
    alert(`${presetType.charAt(0).toUpperCase() + presetType.slice(1)} preset applied!`);
};

// Close the modal
window.closeHouseholdModal = function() {
    const modal = document.getElementById('householdModalOverlay');
    if (modal) {
        modal.remove();
    }
};

// Update UI functions
function updateUIForNewMember() {
    // Refresh spending blocks
    if (window.initializeSpendingBlocks) {
        window.initializeSpendingBlocks();
    }
    
    // Refresh filters if expenses are loaded
    if (window.allExpenses && window.renderFilters) {
        window.renderFilters(window.allExpenses);
    }
    
    // Refresh charts if expenses are loaded
    if (window.filteredExpenses && window.renderCharts) {
        window.renderCharts(window.filteredExpenses);
    }
    
    // Update spending displays
    if (window.filteredExpenses && window.updateAllSpendingDisplays) {
        window.updateAllSpendingDisplays(window.filteredExpenses);
    }
}

function updateUIAfterMemberRemoval() {
    updateUIForNewMember(); // Same updates needed
}

function updateUIAfterNameChange() {
    updateUIForNewMember(); // Same updates needed
}

function updateUIAfterPresetApply() {
    updateUIForNewMember(); // Same updates needed
}

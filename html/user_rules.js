import { API_URL } from './config.js';
import { CATEGORY_LIST, CATEGORY_META } from './config.js';

let allUserRules = [];

// Show user rules management modal
export async function showUserRulesModal() {
    const modal = document.getElementById('userRulesModal');
    if (!modal) return;
    
    await populateUserRulesModal();
    modal.style.display = 'flex';
}

// Close user rules management modal
export function closeUserRulesModal() {
    const modal = document.getElementById('userRulesModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Populate the user rules modal with data
async function populateUserRulesModal() {
    await loadUserRules();
    populateCategorySelect();
    setupUserRulesSearch();
    renderUserRulesList();
}

// Load all user rules from the backend
async function loadUserRules() {
    try {
        const response = await fetch(`${API_URL}/user_rules`);
        const data = await response.json();
        
        if (data.success) {
            allUserRules = data.user_rules || [];
        } else {
            console.error('Failed to load user rules:', data.error);
            allUserRules = [];
        }
    } catch (error) {
        console.error('Error loading user rules:', error);
        allUserRules = [];
    }
}

// Populate category select dropdown
function populateCategorySelect() {
    const categorySelect = document.getElementById('newUserRuleCategory');
    if (!categorySelect) return;
    
    // Clear existing options except the first one
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    
    // Add categories
    CATEGORY_LIST.forEach(category => {
        const meta = CATEGORY_META[category];
        const option = document.createElement('option');
        option.value = category;
        option.textContent = `${meta.icon} ${category.charAt(0).toUpperCase() + category.slice(1)}`;
        categorySelect.appendChild(option);
    });
}

// Setup search functionality
function setupUserRulesSearch() {
    const searchInput = document.getElementById('userRulesSearchInput');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', debounce(async (event) => {
        const searchTerm = event.target.value.trim();
        if (searchTerm) {
            await searchUserRules(searchTerm);
        } else {
            await loadUserRules();
        }
        renderUserRulesList();
    }, 300));
}

// Search user rules
async function searchUserRules(searchTerm) {
    try {
        const response = await fetch(`${API_URL}/user_rules?search=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        
        if (data.success) {
            allUserRules = data.user_rules || [];
        } else {
            console.error('Failed to search user rules:', data.error);
        }
    } catch (error) {
        console.error('Error searching user rules:', error);
    }
}

// Render the user rules list
function renderUserRulesList() {
    const userRulesList = document.getElementById('userRulesList');
    if (!userRulesList) return;
    
    if (allUserRules.length === 0) {
        userRulesList.innerHTML = '<div class="text-gray-500 text-center py-4">No user rules found</div>';
        return;
    }
    
    userRulesList.innerHTML = allUserRules.map(userRule => `
        <div class="user-rule-item bg-gray-50 border rounded p-3 mb-2">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="font-medium text-sm text-gray-900">${escapeHtml(userRule.description)}</div>
                    <div class="text-xs text-gray-600 mt-1">
                        ${userRule.category ? `Category: ${getCategoryDisplay(userRule.category)}` : ''}
                        ${userRule.category && userRule.need_category ? ' • ' : ''}
                        ${userRule.need_category ? `Need: ${userRule.need_category}` : ''}
                    </div>
                </div>
                <div class="flex gap-1 ml-2">
                    <button onclick="editUserRule('${escapeHtml(userRule.description)}')" 
                            class="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded border">
                        Edit
                    </button>
                    <button onclick="deleteUserRuleConfirm('${escapeHtml(userRule.description)}')" 
                            class="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded border">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Get category display with icon
function getCategoryDisplay(categoryName) {
    const meta = CATEGORY_META[categoryName];
    if (meta) {
        return `${meta.icon} ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}`;
    }
    return categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
}

// Add a new user rule
export async function addNewUserRule() {
    const descriptionInput = document.getElementById('newUserRuleDescription');
    const categorySelect = document.getElementById('newUserRuleCategory');
    const needCategorySelect = document.getElementById('newUserRuleNeedCategory');
    
    if (!descriptionInput || !categorySelect || !needCategorySelect) return;
    
    const description = descriptionInput.value.trim();
    const category = categorySelect.value;
    const needCategory = needCategorySelect.value;
    
    if (!description) {
        alert('Please enter a transaction description');
        return;
    }
    
    if (!category && !needCategory) {
        alert('Please select at least a category or need category');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/user_rules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                description,
                category: category || null,
                need_category: needCategory || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Clear form
            descriptionInput.value = '';
            categorySelect.value = '';
            needCategorySelect.value = '';
            
            // Reload and refresh user rules list
            await loadUserRules();
            renderUserRulesList();
            
            // Show success message
            showNotification(data.message, 'success');
        } else {
            showNotification(data.error || 'Failed to add user rule', 'error');
        }
    } catch (error) {
        console.error('Error adding user rule:', error);
        showNotification('Failed to add user rule. Please try again.', 'error');
    }
}

// Edit a user rule
export async function editUserRule(description) {
    const userRule = allUserRules.find(r => r.description === description);
    if (!userRule) return;
    
    // Create edit form modal
    const editModal = document.createElement('div');
    editModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
    editModal.style.zIndex = '1001';
    editModal.innerHTML = `
        <div class="bg-white rounded-lg p-6 w-96 max-w-full">
            <h3 class="text-lg font-semibold mb-4">Edit User Rule</h3>
            <div class="mb-3">
                <label class="block text-sm font-medium mb-1">Description</label>
                <input type="text" id="editDescription" value="${escapeHtml(userRule.description)}" 
                       class="w-full px-2 py-1 border rounded text-sm" readonly style="background-color: #f5f5f5;">
            </div>
            <div class="mb-3">
                <label class="block text-sm font-medium mb-1">Category</label>
                <select id="editCategory" class="w-full px-2 py-1 border rounded text-sm">
                    <option value="">Select Category</option>
                    ${CATEGORY_LIST.map(cat => {
                        const meta = CATEGORY_META[cat];
                        const selected = cat === userRule.category ? 'selected' : '';
                        return `<option value="${cat}" ${selected}>${meta.icon} ${cat.charAt(0).toUpperCase() + cat.slice(1)}</option>`;
                    }).join('')}
                </select>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium mb-1">Need Category</label>
                <select id="editNeedCategory" class="w-full px-2 py-1 border rounded text-sm">
                    <option value="">Auto</option>
                    <option value="Need" ${userRule.need_category === 'Need' ? 'selected' : ''}>Need</option>
                    <option value="Luxury" ${userRule.need_category === 'Luxury' ? 'selected' : ''}>Luxury</option>
                </select>
            </div>
            <div class="flex gap-2 justify-end">
                <button onclick="this.closest('.fixed').remove()" 
                        class="px-4 py-2 text-gray-600 border rounded hover:bg-gray-50">
                    Cancel
                </button>
                <button onclick="saveUserRuleEdit('${escapeHtml(userRule.description)}', this)" 
                        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Save
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(editModal);
}

// Save user rule edit
export async function saveUserRuleEdit(originalDescription, button) {
    const modal = button.closest('.fixed');
    const categorySelect = modal.querySelector('#editCategory');
    const needCategorySelect = modal.querySelector('#editNeedCategory');
    
    const category = categorySelect.value;
    const needCategory = needCategorySelect.value;
    
    if (!category && !needCategory) {
        alert('Please select at least a category or need category');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/user_rules/${encodeURIComponent(originalDescription)}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                category: category || null,
                need_category: needCategory || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            modal.remove();
            await loadUserRules();
            renderUserRulesList();
            showNotification(data.message, 'success');
        } else {
            showNotification(data.error || 'Failed to update user rule', 'error');
        }
    } catch (error) {
        console.error('Error updating user rule:', error);
        showNotification('Failed to update user rule. Please try again.', 'error');
    }
}

// Delete user rule with confirmation
export async function deleteUserRuleConfirm(description) {
    if (!confirm(`Are you sure you want to delete the user rule for "${description}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/user_rules/${encodeURIComponent(description)}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadUserRules();
            renderUserRulesList();
            showNotification(data.message, 'success');
        } else {
            showNotification(data.error || 'Failed to delete user rule', 'error');
        }
    } catch (error) {
        console.error('Error deleting user rule:', error);
        showNotification('Failed to delete user rule. Please try again.', 'error');
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-100 border-green-400 text-green-700' : 
                   type === 'error' ? 'bg-red-100 border-red-400 text-red-700' : 
                   'bg-blue-100 border-blue-400 text-blue-700';
    
    notification.className = `fixed top-4 right-4 ${bgColor} px-4 py-3 rounded border z-50`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Make functions available globally for onclick handlers
window.editUserRule = editUserRule;
window.saveUserRuleEdit = saveUserRuleEdit;
window.deleteUserRuleConfirm = deleteUserRuleConfirm;
window.addNewUserRule = addNewUserRule;
window.closeUserRulesModal = closeUserRulesModal;
import { CATEGORY_META, CATEGORY_LIST, addCategory, loadCategoriesFromBackend, API_URL } from './config.js';
import { addCategory as addCategoryAPI } from './api.js';

// Load categories from backend on initialization
export async function initializeCategories() {
    await loadCategoriesFromBackend();
}

// Create category dropdown with "Add Category" option
export function createCategoryDropdown(currentCategory = '') {
    const select = document.createElement('select');
    select.className = 'w-full px-1 py-1 rounded text-xs border';
    
    // Add existing categories
    CATEGORY_LIST.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        const meta = CATEGORY_META[cat];
        option.textContent = `${meta.icon} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`;
        if (cat === currentCategory) option.selected = true;
        select.appendChild(option);
    });
    
    // Add "Add Category" option
    const addOption = document.createElement('option');
    addOption.value = '__ADD_NEW__';
    addOption.textContent = '+ Add Category';
    addOption.style.fontStyle = 'italic';
    addOption.style.color = '#666';
    select.appendChild(addOption);
    
    return select;
}

// Handle category selection/addition
export async function handleCategorySelection(select, onCategorySelected) {
    if (select.value === '__ADD_NEW__') {
        // Show custom input for new category
        await showAddCategoryDialog(onCategorySelected);
    } else {
        // Use existing category
        if (onCategorySelected) {
            onCategorySelected(select.value);
        }
    }
}

// Show dialog for adding new category
async function showAddCategoryDialog(onCategorySelected) {
    const name = prompt('Enter category name:');
    if (!name) return;
    
    const cleanName = name.trim().toLowerCase();
    if (!cleanName) {
        alert('Please enter a valid category name');
        return;
    }
    
    if (CATEGORY_LIST.includes(cleanName)) {
        alert('Category already exists');
        return;
    }
    
    // Ask for icon (optional)
    const icon = prompt('Enter category icon (optional):', '🏷️') || '🏷️';
    
    try {
        const result = await addCategoryAPI(cleanName, icon);
        if (result.success) {
            // Update local state
            addCategory(cleanName, { icon, color: '#818cf8' });
            
            // Notify that category was added
            if (onCategorySelected) {
                onCategorySelected(cleanName);
            }
            
            // Refresh the page data to include new category in all dropdowns
            if (window.loadExpenses) {
                await window.loadExpenses();
            }
            
            alert(`Category "${cleanName}" added successfully!`);
        } else {
            alert(result.error || 'Failed to add category');
        }
    } catch (error) {
        console.error('Error adding category:', error);
        alert('Failed to add category. Please try again.');
    }
}

// Show category management modal
export async function showCategoryModal() {
    const modal = document.getElementById('categoryModal');
    if (!modal) return;
    
    await populateCategoryList();
    modal.style.display = 'flex';
}

// Close category management modal
export function closeCategoryModal() {
    const modal = document.getElementById('categoryModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Populate the category list in the modal
async function populateCategoryList() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        const data = await response.json();
        const categories = data.categories || [];
        const metadata = data.metadata || {};
        
        const categoryList = document.getElementById('categoryList');
        if (!categoryList) return;
        
        categoryList.innerHTML = '';
        
        categories.forEach(categoryName => {
            const meta = metadata[categoryName] || { icon: '🏷️', color: '#818cf8' };
            const categoryItem = createCategoryItem(categoryName, meta.icon, meta.color);
            categoryList.appendChild(categoryItem);
        });
        
    } catch (error) {
        console.error('Failed to load categories:', error);
        alert('Failed to load categories. Please try again.');
    }
}

// Create a category item element
function createCategoryItem(name, icon, color) {
    const item = document.createElement('div');
    item.className = 'category-item';
    
    const isDefault = ['food', 'groceries', 'entertainment', 'travel', 'utilities', 'shopping', 'gifts', 'medicines', 'charity', 'school'].includes(name.toLowerCase());
    
    item.innerHTML = `
        <div class="category-info">
            <span class="category-emoji" title="Click to change emoji">${icon}</span>
            <span class="category-name" title="Click to edit name">${name.charAt(0).toUpperCase() + name.slice(1)}</span>
            ${isDefault ? '<span class="default-badge">Default</span>' : ''}
        </div>
        <div class="category-actions">
            <button class="btn-small btn-edit" onclick="editCategoryEmoji('${name}', '${icon}')">
                Edit Emoji
            </button>
            ${!isDefault ? `
                <button class="btn-small btn-edit" onclick="editCategoryName('${name}')">
                    Rename
                </button>
                <button class="btn-small btn-delete" onclick="deleteCategoryConfirm('${name}')">
                    Delete
                </button>
            ` : ''}
        </div>
    `;
    
    return item;
}

// Edit category emoji
export async function editCategoryEmoji(categoryName, currentEmoji) {
    const newEmoji = prompt(`Enter new emoji for "${categoryName}" category:`, currentEmoji);
    
    if (newEmoji === null) return; // User cancelled
    
    if (!newEmoji.trim()) {
        alert('Emoji cannot be empty!');
        return;
    }
    
    try {
        const { updateCategory } = await import('./api.js');
        const result = await updateCategory(categoryName, newEmoji.trim());
        
        if (result.success) {
            alert(`Category "${categoryName}" updated successfully!`);
            await populateCategoryList(); // Refresh the list
            
            // Reload categories in the app
            await loadCategoriesFromBackend();
            
            // Refresh the page to update all dropdowns
            window.location.reload();
        } else {
            alert(result.error || 'Failed to update category');
        }
    } catch (error) {
        console.error('Error updating category:', error);
        alert('Failed to update category. Please try again.');
    }
}

// Add new category from modal
export async function addNewCategoryFromModal() {
    const nameInput = document.getElementById('newCategoryName');
    const emojiInput = document.getElementById('newCategoryEmoji');
    
    if (!nameInput || !emojiInput) return;
    
    const name = nameInput.value.trim();
    const emoji = emojiInput.value.trim();
    
    if (!name) {
        alert('Category name is required!');
        return;
    }
    
    if (!emoji) {
        alert('Emoji is required!');
        return;
    }
    
    try {
        const { addCategory: addCategoryAPI } = await import('./api.js');
        const result = await addCategoryAPI(name, emoji);
        
        if (result.success) {
            // Clear inputs
            nameInput.value = '';
            emojiInput.value = '';
            
            // Refresh the list
            await populateCategoryList();
            await loadCategoriesFromBackend();
            
            alert(`Category "${name}" added successfully!`);
        } else {
            alert(result.error || 'Failed to add category');
        }
    } catch (error) {
        console.error('Error adding category:', error);
        alert('Failed to add category. Please try again.');
    }
}

// Edit category name
export async function editCategoryName(categoryName) {
    const newName = prompt(`Enter new name for "${categoryName}" category:`, categoryName);
    
    if (newName === null) return; // User cancelled
    
    if (!newName.trim()) {
        alert('Category name cannot be empty!');
        return;
    }
    
    if (newName.trim().toLowerCase() === categoryName.toLowerCase()) {
        return; // No change
    }
    
    try {
        const { renameCategory } = await import('./api.js');
        const result = await renameCategory(categoryName, newName.trim());
        
        if (result.success) {
            alert(`Category "${categoryName}" renamed to "${newName.trim()}" successfully!`);
            await populateCategoryList(); // Refresh the list
            await loadCategoriesFromBackend();
            
            // Refresh the page to update all dropdowns and data
            if (window.loadExpenses) {
                await window.loadExpenses();
            }
        } else {
            alert(result.error || 'Failed to rename category');
        }
    } catch (error) {
        console.error('Error renaming category:', error);
        alert('Failed to rename category. Please try again.');
    }
}

// Delete category with confirmation
export async function deleteCategoryConfirm(categoryName) {
    const confirmed = confirm(`Are you sure you want to delete the category "${categoryName}"?\n\nThis action cannot be undone and will remove the category from all existing expenses.`);
    
    if (!confirmed) return;
    
    try {
        const { deleteCategory } = await import('./api.js');
        const result = await deleteCategory(categoryName);
        
        if (result.success) {
            alert(`Category "${categoryName}" deleted successfully!`);
            await populateCategoryList(); // Refresh the list
            await loadCategoriesFromBackend();
            
            // Refresh the page to update all dropdowns and data
            if (window.loadExpenses) {
                await window.loadExpenses();
            }
        } else {
            alert(result.error || 'Failed to delete category');
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        alert('Failed to delete category. Please try again.');
    }
}

// Get category metadata for a given category
export function getCategoryMeta(category) {
    let cat = (category || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!CATEGORY_META[cat]) cat = 'shopping';
    return CATEGORY_META[cat];
}

// Get formatted category display with icon
export function getCategoryDisplay(category) {
    const meta = getCategoryMeta(category);
    const catName = category.charAt(0).toUpperCase() + category.slice(1);
    return `<span style="font-size:1.2em;vertical-align:middle;margin-right:4px;color:${meta.color};">${meta.icon}</span>${catName}`;
}
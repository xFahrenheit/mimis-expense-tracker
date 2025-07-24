// Add this to your main JavaScript file or create a new undo.js file

import { performUndo } from './api.js';

// Client-side undo state management (fallback if server doesn't support undo)
let undoHistory = [];
let isUndoing = false; // Flag to prevent undo loops

// Push current state to undo history
window.pushUndoState = function() {
    if (isUndoing) return; // Don't push state during undo operations
    
    // Capture current state before making changes
    const currentState = {
        timestamp: Date.now(),
        expenses: JSON.parse(JSON.stringify(window.allExpenses || [])),
        filteredExpenses: JSON.parse(JSON.stringify(window.filteredExpenses || []))
    };
    
    undoHistory.push(currentState);
    
    // Keep only last 10 undo states to prevent memory issues
    if (undoHistory.length > 10) {
        undoHistory.shift();
    }
    
    console.log(`Undo state pushed. History length: ${undoHistory.length}`);
};

// Perform undo operation
async function performUndoOperation() {
    if (isUndoing) {
        console.log('Undo already in progress, ignoring...');
        return;
    }
    
    isUndoing = true;
    
    try {
        // First try server-side undo if available
        try {
            console.log('Attempting server-side undo...');
            const result = await performUndo();
            
            if (result && result.success !== false) {
                console.log('Server-side undo successful');
                
                // Reload data from server to get the undone state
                if (window.loadExpenses) {
                    await window.loadExpenses();
                }
                if (window.applyColumnFilters) {
                    window.applyColumnFilters();
                }
                
                // Remove the last state from local history since server handled it
                if (undoHistory.length > 0) {
                    undoHistory.pop();
                }
                
                // Show success feedback
                showUndoFeedback('Undo successful');
                return;
            }
        } catch (serverError) {
            console.log('Server-side undo failed, trying client-side fallback:', serverError.message);
        }
        
        // Fallback to client-side undo
        if (undoHistory.length === 0) {
            showUndoFeedback('Nothing to undo');
            return;
        }
        
        console.log('Performing client-side undo...');
        const lastState = undoHistory.pop();
        
        if (lastState && lastState.expenses) {
            // Restore the previous state
            window.allExpenses = [...lastState.expenses];
            window.filteredExpenses = [...(lastState.filteredExpenses || lastState.expenses)];
            
            // Re-render the table
            if (window.applyColumnFilters) {
                window.applyColumnFilters();
            } else if (window.renderExpenses) {
                window.renderExpenses(window.filteredExpenses);
            }
            
            showUndoFeedback('Undo successful (client-side)');
        }
        
    } catch (error) {
        console.error('Undo operation failed:', error);
        showUndoFeedback('Undo failed');
    } finally {
        isUndoing = false;
    }
}

// Show visual feedback for undo operations
function showUndoFeedback(message) {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #333;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 10000;
        font-size: 14px;
        transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 2 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 2000);
}

// Setup Ctrl+Z keyboard shortcut
document.addEventListener('keydown', function(e) {
    // Check for Ctrl+Z (Cmd+Z on Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Only trigger if not in an input field (to allow normal text undo)
        const activeElement = document.activeElement;
        const isInputField = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.contentEditable === 'true'
        );
        
        if (!isInputField) {
            e.preventDefault();
            console.log('Ctrl+Z pressed, performing undo...');
            performUndoOperation();
        }
    }
});

// Enhanced version of pushUndoState that's more selective about when to save state
window.pushUndoStateSelective = function(actionType) {
    if (isUndoing) return;
    
    // Only push state for significant actions
    const significantActions = ['delete', 'bulk_delete', 'edit', 'add', 'import'];
    if (actionType && !significantActions.includes(actionType)) {
        return;
    }
    
    window.pushUndoState();
};

// Export for global access
window.performUndoOperation = performUndoOperation;

console.log('Ctrl+Z undo functionality initialized');
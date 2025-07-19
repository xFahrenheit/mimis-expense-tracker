import { API_URL } from './config.js';
import { deleteAllExpenses, uploadFile, recategorizeAll } from './api.js';
import { genColors } from './helpers.js';

// Attach delete all button listener
export function attachDeleteAllBtnListener() {
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    if (!deleteAllBtn) {
        console.warn('[ExpenseTracker] Delete All Expenses button not found in DOM when attaching listener.');
        return;
    }
    
    deleteAllBtn.onclick = async () => {
        console.log('[ExpenseTracker] Delete All Expenses button clicked.');
        if (!confirm('Delete ALL expenses, statements, and overrides? This cannot be undone.')) return;
        
        deleteAllBtn.disabled = true;
        deleteAllBtn.textContent = 'Deleting...';
        
        try {
            const res = await deleteAllExpenses();
            if (res.ok) {
                deleteAllBtn.textContent = 'Deleted!';
                await window.loadStatements();
                await window.loadExpenses();
                if (window.renderFilters) window.renderFilters([]);
                if (window.renderCharts) window.renderCharts([]);
            } else {
                let msg = 'Error!';
                try {
                    const data = await res.json();
                    if (data && data.error) msg = data.error;
                } catch {}
                deleteAllBtn.textContent = msg;
            }
        } catch (e) {
            deleteAllBtn.textContent = 'Error!';
        }
        
        setTimeout(() => {
            deleteAllBtn.textContent = 'Delete All Expenses';
            deleteAllBtn.disabled = false;
        }, 1200);
    };
}

// Setup tab switching functionality
export function setupTabSwitching() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
            document.getElementById('tab-' + tab).style.display = '';
        });
    });
    
    // Set default tab
    const defaultTabBtn = document.querySelector('.tab-btn[data-tab="expenses"]');
    if (defaultTabBtn) defaultTabBtn.classList.add('active');
    const defaultTab = document.getElementById('tab-expenses');
    if (defaultTab) defaultTab.style.display = '';
}

// Setup upload form
export function setupUploadForm() {
    const uploadForm = document.getElementById('uploadForm');
    if (!uploadForm) return;
    
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(uploadForm);
        
        // Extract bank type from selected card option
        const cardSelect = document.getElementById('cardSelect');
        if (cardSelect && cardSelect.selectedOptions.length > 0) {
            const selectedOption = cardSelect.selectedOptions[0];
            const bankType = selectedOption.getAttribute('data-bank') || 'generic';
            formData.set('bank_type', bankType);
        }
        
        const res = await uploadFile(formData);
        
        if (res.ok) {
            uploadForm.reset();
            if (window.loadStatements) await window.loadStatements();
            if (window.loadExpenses) await window.loadExpenses();
            
            // Refresh time period tabs after successful upload
            setTimeout(async () => {
                try {
                    if (window.createTimePeriodTabs) {
                        await window.createTimePeriodTabs();
                        console.log('Time period tabs refreshed after upload');
                    }
                } catch (error) {
                    console.error('Error refreshing time period tabs:', error);
                }
            }, 1500);
        } else {
            alert('Upload failed. Please try again.');
        }
    });
    
    // Setup recategorize button
    const recategorizeBtn = document.getElementById('recategorizeBtn');
    if (recategorizeBtn) {
        recategorizeBtn.addEventListener('click', async () => {
            recategorizeBtn.disabled = true;
            recategorizeBtn.textContent = 'Processing...';
            
            try {
                const res = await recategorizeAll();
                if (res.ok) {
                    recategorizeBtn.textContent = 'Done!';
                    if (window.loadExpenses) await window.loadExpenses();
                } else {
                    recategorizeBtn.textContent = 'Error!';
                }
            } catch (e) {
                recategorizeBtn.textContent = 'Error!';
            }
            
            setTimeout(() => {
                recategorizeBtn.textContent = 'Re-categorize All';
                recategorizeBtn.disabled = false;
            }, 2000);
        });
    }
}
import { API_URL } from './config.js';
import { deleteAllExpenses, uploadFile, recategorizeAll, textToSqlQuery } from './api.js';
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

// Setup text to SQL functionality
export function setupTextToSql() {
    const textToSqlForm = document.getElementById('textToSqlForm');
    if (!textToSqlForm) return;
    
    textToSqlForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('textToSqlInput');
        const resultDiv = document.getElementById('textToSqlResult');
        const question = input.value.trim();
        
        if (!question) return;
        
        resultDiv.innerHTML = '<span class="text-purple-300">Analyzing...</span>';
        
        try {
            const data = await textToSqlQuery(question);
            
            if (data.error) {
                resultDiv.innerHTML = `<span class="text-red-400">${data.error}</span>`;
                return;
            }
            
            // Render chart or table based on response
            if (data.chartType && data.labels && data.values) {
                const chartId = 'textToSqlChart';
                resultDiv.innerHTML = `<div style="max-width:800px;margin:0 auto;"><canvas id="${chartId}" width="800" height="480"></canvas></div>`;
                const ctx = document.getElementById(chartId).getContext('2d');
                
                if (window.textToSqlChart) window.textToSqlChart.destroy();
                window.textToSqlChart = new Chart(ctx, {
                    type: data.chartType,
                    data: {
                        labels: data.labels,
                        datasets: [{ data: data.values, backgroundColor: genColors(data.labels.length) }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                labels: { color: '#fff', font: { size: 16, family: 'Inter, Segoe UI, Arial, sans-serif', weight: '500' } }
                            },
                            title: {
                                color: '#fff', display: false, font: { family: 'Inter, Segoe UI, Arial, sans-serif', weight: '600' }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed || 0;
                                        const total = context.chart._metasets[0].total || context.dataset.data.reduce((a,b)=>a+b,0);
                                        const percent = total ? ((value/total)*100).toFixed(1) : '0.0';
                                        return `${label}: $${value.toLocaleString()} (${percent}%)`;
                                    }
                                }
                            },
                            datalabels: {
                                color: '#fff',
                                font: { size: 16, family: 'Inter, Segoe UI, Arial, sans-serif', weight: '600' },
                                formatter: function(value, context) {
                                    const total = context.chart._metasets[0].total || context.dataset.data.reduce((a,b)=>a+b,0);
                                    const percent = total ? ((value/total)*100).toFixed(1) : '0.0';
                                    return percent + '%';
                                }
                            }
                        },
                        layout: { padding: 0 },
                    }
                });
            } else if (data.rows && data.columns) {
                // Render as table
                let html = '<div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr>';
                data.columns.forEach(col => { html += `<th class="px-2 py-1 border-b">${col}</th>`; });
                html += '</tr></thead><tbody>';
                data.rows.forEach(row => {
                    html += '<tr>' + row.map(cell => `<td class="px-2 py-1">${cell}</td>`).join('') + '</tr>';
                });
                html += '</tbody></table></div>';
                resultDiv.innerHTML = html;
            } else {
                resultDiv.innerHTML = '<span class="text-purple-300">No data.</span>';
            }
        } catch (err) {
            resultDiv.innerHTML = `<span class="text-red-400">Error: ${err.message}</span>`;
        }
    });
}
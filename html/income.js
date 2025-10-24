// Income management functionality

let incomeData = {
    records: [],
    monthlyData: [],
    sourceBreakdown: [],
    overrides: new Map()
};

// API functions
export async function loadIncomeRecords() {
    try {
        const response = await fetch('/income');
        const data = await response.json();
        
        if (data.success) {
            incomeData.records = data.income_records;
            return data.income_records;
        } else {
            console.error('Failed to load income records:', data.error);
            return [];
        }
    } catch (error) {
        console.error('Error loading income records:', error);
        return [];
    }
}

export async function addIncomeRecord(recordData) {
    try {
        const response = await fetch('/income', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(recordData)
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error adding income record:', error);
        return { success: false, error: 'Network error' };
    }
}

export async function updateIncomeRecord(recordId, recordData) {
    try {
        const response = await fetch(`/income/${recordId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(recordData)
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error updating income record:', error);
        return { success: false, error: 'Network error' };
    }
}

export async function deleteIncomeRecord(recordId) {
    try {
        const response = await fetch(`/income/${recordId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error deleting income record:', error);
        return { success: false, error: 'Network error' };
    }
}

export async function getMonthlyIncome(year, month) {
    try {
        const response = await fetch(`/income/monthly/${year}/${month}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting monthly income:', error);
        return { success: false, error: 'Network error' };
    }
}

export async function loadIncomeDistribution(startDate = null, endDate = null) {
    try {
        let url = '/income/distribution';
        const params = new URLSearchParams();
        
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            incomeData.monthlyData = data.monthly_data;
            incomeData.sourceBreakdown = data.source_breakdown;
            return data;
        } else {
            console.error('Failed to load income distribution:', data.error);
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Error loading income distribution:', error);
        return { success: false, error: 'Network error' };
    }
}

export async function addMonthlyIncomeOverride(year, month, user, amount, notes = '') {
    try {
        const response = await fetch('/income/monthly_override', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ year, month, user, amount, notes })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error adding monthly income override:', error);
        return { success: false, error: 'Network error' };
    }
}

export async function deleteMonthlyIncomeOverride(year, month) {
    try {
        const response = await fetch(`/income/monthly_override/${year}/${month}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error deleting monthly income override:', error);
        return { success: false, error: 'Network error' };
    }
}

// UI rendering functions
export function renderIncomeRecords(records = incomeData.records) {
    const container = document.getElementById('incomeRecordsContainer');
    if (!container) return;
    
    if (records.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p class="text-lg mb-2">No income records found</p>
                <p class="text-sm">Add your first income record to get started</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="space-y-3">
            ${records.map(record => renderIncomeRecordCard(record)).join('')}
        </div>
    `;
}

function renderIncomeRecordCard(record) {
    const startDate = new Date(record.start_date).toLocaleDateString();
    const endDate = record.end_date ? new Date(record.end_date).toLocaleDateString() : 'Ongoing';
    const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(record.amount);
    
    // Color coding for users
    const userColor = record.user === 'Ameya' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800';
    
    return `
        <div class="income-record-card glass-block p-4 flex items-center justify-between">
            <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                    <h3 class="font-semibold text-lg text-purple-200">${record.source}</h3>
                    <span class="text-2xl font-bold text-green-400">${amount}</span>
                    <span class="${userColor} px-2 py-1 rounded text-xs font-medium">${record.user}</span>
                </div>
                <div class="text-sm text-gray-300">
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2">
                        ${startDate} → ${endDate}
                    </span>
                    ${record.notes ? `<span class="text-gray-400">${record.notes}</span>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="editIncomeRecord(${record.id})" class="btn-pastel text-xs px-3 py-1">
                    ✏️ Edit
                </button>
                <button onclick="deleteIncomeRecordConfirm(${record.id})" class="btn-pastel-red text-xs px-3 py-1">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `;
}

export function renderIncomeCharts(distributionData = incomeData) {
    renderIncomeSourceChart(distributionData.sourceBreakdown);
    renderMonthlyIncomeChart(distributionData.monthlyData);
}

function renderIncomeSourceChart(sourceBreakdown) {
    const canvas = document.getElementById('incomeSourceChart');
    if (!canvas || !sourceBreakdown || sourceBreakdown.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.incomeSourceChart) {
        window.incomeSourceChart.destroy();
    }
    
    const colors = [
        '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b',
        '#ef4444', '#06b6d4', '#84cc16', '#f97316'
    ];
    
    window.incomeSourceChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: sourceBreakdown.map(item => item.source),
            datasets: [{
                data: sourceBreakdown.map(item => item.total),
                backgroundColor: colors.slice(0, sourceBreakdown.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        color: '#e5e7eb'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = new Intl.NumberFormat('en-US', { 
                                style: 'currency', 
                                currency: 'USD' 
                            }).format(context.raw);
                            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                },
                datalabels: {
                    color: '#ffffff',
                    font: {
                        weight: 'bold',
                        size: 12
                    },
                    formatter: (value, context) => {
                        const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return percentage > 5 ? `${percentage}%` : '';
                    }
                }
            }
        },
        plugins: [window.ChartDataLabels]
    });
}

function renderMonthlyIncomeChart(monthlyData) {
    const canvas = document.getElementById('monthlyIncomeChart');
    if (!canvas || !monthlyData || monthlyData.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.monthlyIncomeChart) {
        window.monthlyIncomeChart.destroy();
    }
    
    window.monthlyIncomeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthlyData.map(item => item.month_name),
            datasets: [{
                label: 'Monthly Income',
                data: monthlyData.map(item => item.total_income),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return new Intl.NumberFormat('en-US', { 
                                style: 'currency', 
                                currency: 'USD',
                                minimumFractionDigits: 0
                            }).format(value);
                        },
                        color: '#e5e7eb'
                    },
                    grid: {
                        color: 'rgba(229, 231, 235, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#e5e7eb'
                    },
                    grid: {
                        color: 'rgba(229, 231, 235, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e5e7eb'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Income: ${new Intl.NumberFormat('en-US', { 
                                style: 'currency', 
                                currency: 'USD' 
                            }).format(context.raw)}`;
                        }
                    }
                }
            }
        }
    });
}

export function renderMonthlyIncomeTable(monthlyData = incomeData.monthlyData) {
    const container = document.getElementById('monthlyIncomeTableContainer');
    if (!container) return;
    
    if (monthlyData.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>No monthly income data available</p>
            </div>
        `;
        return;
    }
    
    // Sort by year and month (newest first)
    const sortedData = [...monthlyData].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
    });
    
    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead>
                    <tr class="border-b border-gray-300">
                        <th class="text-left py-3 px-4 font-semibold text-purple-200">Month</th>
                        <th class="text-right py-3 px-4 font-semibold text-purple-200">Income</th>
                        <th class="text-center py-3 px-4 font-semibold text-purple-200">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedData.map(item => renderMonthlyIncomeRow(item)).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderMonthlyIncomeRow(monthData) {
    const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(monthData.total_income);
    const isCurrentMonth = new Date().getFullYear() === monthData.year && (new Date().getMonth() + 1) === monthData.month;
    const isOverride = monthData.is_override || false;
    
    return `
        <tr class="border-b border-gray-200 hover:bg-gray-50 ${isCurrentMonth ? 'bg-green-50' : ''} ${isOverride ? 'bg-yellow-50' : ''}">
            <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                    <span class="font-medium">${monthData.month_name}</span>
                    ${isCurrentMonth ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Current</span>' : ''}
                    ${isOverride ? '<span class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded" title="Manually overridden">✏️ Override</span>' : ''}
                </div>
                ${isOverride && monthData.notes ? `<div class="text-xs text-gray-500 mt-1">${monthData.notes}</div>` : ''}
            </td>
            <td class="text-right py-3 px-4 font-bold text-lg ${isOverride ? 'text-orange-600' : 'text-green-600'}">
                ${amount}
                ${isOverride ? '<span class="text-xs text-orange-500 ml-1">*</span>' : ''}
            </td>
            <td class="text-center py-3 px-4">
                <button onclick="editMonthlyIncome(${monthData.year}, ${monthData.month})" 
                        class="btn-pastel text-xs px-3 py-1 mr-2">
                    ✏️ Edit
                </button>
                ${isOverride ? `
                    <button onclick="deleteMonthlyOverride(${monthData.year}, ${monthData.month})" 
                            class="btn-pastel-red text-xs px-2 py-1" title="Remove override">
                        🗑️
                    </button>
                ` : ''}
            </td>
        </tr>
    `;
}

// Modal functions
export function showAddIncomeModal() {
    const modal = document.getElementById('addIncomeModal');
    if (modal) {
        modal.style.display = 'block';
        
        // Set default start date to current month
        const today = new Date();
        const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM format
        document.getElementById('incomeStartDate').value = currentMonth + '-01';
    }
}

export function hideAddIncomeModal() {
    const modal = document.getElementById('addIncomeModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Reset form
        document.getElementById('addIncomeForm').reset();
    }
}

export function showEditMonthlyIncomeModal(year, month, user = 'Ameya', currentAmount = 0, notes = '') {
    const modal = document.getElementById('editMonthlyIncomeModal');
    if (modal) {
        document.getElementById('editMonthYear').value = year;
        document.getElementById('editMonthMonth').value = month;
        document.getElementById('editMonthUser').value = user;
        document.getElementById('editMonthAmount').value = currentAmount;
        document.getElementById('editMonthNotes').value = notes;
        
        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        document.getElementById('editMonthTitle').textContent = `Edit Income for ${monthName}`;
        
        modal.style.display = 'block';
    }
}

export function hideEditMonthlyIncomeModal() {
    const modal = document.getElementById('editMonthlyIncomeModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Event handlers
export async function handleAddIncomeForm(event) {
    event.preventDefault();
    
    const form = event.target;
    const editId = form.getAttribute('data-edit-id');
    const formData = new FormData(form);
    const recordData = {
        amount: parseFloat(formData.get('amount')),
        source: formData.get('source').trim(),
        user: formData.get('user'),
        start_date: formData.get('start_date'),
        end_date: formData.get('end_date') || null,
        notes: formData.get('notes').trim()
    };
    
    let result;
    if (editId) {
        // Update existing record
        result = await updateIncomeRecord(parseInt(editId), recordData);
    } else {
        // Add new record
        result = await addIncomeRecord(recordData);
    }
    
    if (result.success) {
        hideAddIncomeModal();
        // Reset form to add mode
        form.removeAttribute('data-edit-id');
        document.querySelector('#addIncomeModal .modal-header h2').textContent = 'Add Income Record';
        document.querySelector('#addIncomeModal button[type="submit"]').textContent = 'Add Income Record';
        
        await refreshIncomeData();
        showNotification(editId ? 'Income record updated successfully!' : 'Income record added successfully!', 'success');
    } else {
        showNotification(result.error || 'Failed to save income record', 'error');
    }
}

export async function handleEditMonthlyIncomeForm(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const year = parseInt(formData.get('year'));
    const month = parseInt(formData.get('month'));
    const user = formData.get('user');
    const amount = parseFloat(formData.get('amount'));
    const notes = formData.get('notes').trim();
    
    const result = await addMonthlyIncomeOverride(year, month, user, amount, notes);
    
    if (result.success) {
        hideEditMonthlyIncomeModal();
        await refreshIncomeData();
        showNotification(`Monthly income updated for ${month}/${year}`, 'success');
    } else {
        showNotification(result.error || 'Failed to update monthly income', 'error');
    }
}

export async function editIncomeRecord(recordId) {
    const record = incomeData.records.find(r => r.id === recordId);
    if (!record) return;
    
    // Pre-fill modal with record data
    const modal = document.getElementById('addIncomeModal');
    document.getElementById('incomeAmount').value = record.amount;
    document.getElementById('incomeSource').value = record.source;
    document.getElementById('incomeUser').value = record.user;
    document.getElementById('incomeStartDate').value = record.start_date;
    document.getElementById('incomeEndDate').value = record.end_date || '';
    document.getElementById('incomeNotes').value = record.notes;
    
    // Change form to edit mode
    const form = document.getElementById('addIncomeForm');
    form.setAttribute('data-edit-id', recordId);
    document.querySelector('#addIncomeModal .modal-header h2').textContent = 'Edit Income Record';
    document.querySelector('#addIncomeModal button[type="submit"]').textContent = 'Update Record';
    
    showAddIncomeModal();
}

export async function deleteIncomeRecordConfirm(recordId) {
    const record = incomeData.records.find(r => r.id === recordId);
    if (!record) return;
    
    if (confirm(`Are you sure you want to delete the income record "${record.source}"?`)) {
        const result = await deleteIncomeRecord(recordId);
        
        if (result.success) {
            await refreshIncomeData();
            showNotification('Income record deleted successfully!', 'success');
        } else {
            showNotification(result.error || 'Failed to delete income record', 'error');
        }
    }
}

export async function editMonthlyIncome(year, month) {
    // For now, default to Ameya, but this could be enhanced to show a user selection
    const user = 'Ameya'; // You could prompt for this or use a default
    const monthData = await getMonthlyIncome(year, month);
    
    if (monthData.success) {
        showEditMonthlyIncomeModal(
            year, 
            month, 
            user,
            monthData.total_income, 
            monthData.notes || ''
        );
    } else {
        showNotification('Failed to load monthly income data', 'error');
    }
}

export async function deleteMonthlyOverride(year, month) {
    if (!confirm(`Are you sure you want to remove the override for ${month}/${year}? This will revert to the automatically calculated income.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/income/monthly_override/${year}/${month}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Monthly override removed successfully', 'success');
            await refreshIncomeData();
        } else {
            showNotification(result.message || 'Failed to remove override', 'error');
        }
    } catch (error) {
        console.error('Error removing monthly override:', error);
        showNotification('Failed to remove override', 'error');
    }
}

// Utility functions
export async function refreshIncomeData() {
    await loadIncomeRecords();
    const distributionData = await loadIncomeDistribution();
    
    if (distributionData.success) {
        renderIncomeRecords();
        renderIncomeCharts(distributionData);
        renderMonthlyIncomeTable(distributionData.monthly_data);
        updateIncomeSummaryCards(distributionData);
    }
}

function updateIncomeSummaryCards(distributionData) {
    // Update total monthly income
    const totalMonthlyIncome = distributionData.source_breakdown.reduce((sum, source) => sum + source.total, 0);
    const totalMonthlyIncomeElement = document.getElementById('totalMonthlyIncome');
    if (totalMonthlyIncomeElement) {
        totalMonthlyIncomeElement.textContent = new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD' 
        }).format(totalMonthlyIncome);
    }
    
    // Update source count
    const incomeSourceCountElement = document.getElementById('incomeSourceCount');
    if (incomeSourceCountElement) {
        const sourceCount = distributionData.source_breakdown.length;
        incomeSourceCountElement.textContent = `${sourceCount} source${sourceCount !== 1 ? 's' : ''}`;
    }
    
    // Update current month income
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const currentMonthData = distributionData.monthly_data.find(
        item => item.month === currentMonth && item.year === currentYear
    );
    
    const currentMonthIncomeElement = document.getElementById('currentMonthIncome');
    if (currentMonthIncomeElement) {
        const currentMonthAmount = currentMonthData ? currentMonthData.total_income : 0;
        currentMonthIncomeElement.textContent = new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD' 
        }).format(currentMonthAmount);
    }
    
    // Update primary source
    const primaryIncomeSourceElement = document.getElementById('primaryIncomeSource');
    const primarySourceAmountElement = document.getElementById('primarySourceAmount');
    
    if (primaryIncomeSourceElement && primarySourceAmountElement) {
        if (distributionData.source_breakdown.length > 0) {
            const primarySource = distributionData.source_breakdown.reduce((max, source) => 
                source.total > max.total ? source : max
            );
            primaryIncomeSourceElement.textContent = primarySource.source;
            primarySourceAmountElement.textContent = new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD' 
            }).format(primarySource.total);
        } else {
            primaryIncomeSourceElement.textContent = '--';
            primarySourceAmountElement.textContent = '$0';
        }
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-3 rounded z-50 ${
        type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' :
        type === 'error' ? 'bg-red-100 border border-red-400 text-red-700' :
        'bg-blue-100 border border-blue-400 text-blue-700'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Make functions available globally
window.showAddIncomeModal = showAddIncomeModal;
window.hideAddIncomeModal = hideAddIncomeModal;
window.hideEditMonthlyIncomeModal = hideEditMonthlyIncomeModal;
window.editIncomeRecord = editIncomeRecord;
window.deleteIncomeRecordConfirm = deleteIncomeRecordConfirm;
window.editMonthlyIncome = editMonthlyIncome;
window.deleteMonthlyOverride = deleteMonthlyOverride;
window.handleAddIncomeForm = handleAddIncomeForm;
window.handleEditMonthlyIncomeForm = handleEditMonthlyIncomeForm;
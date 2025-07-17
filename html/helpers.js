import { CHART_COLORS } from './config.js';

// Generate colors for charts
export function genColors(n) {
    return Array.from({length: n}, (_,i) => CHART_COLORS[i % CHART_COLORS.length]);
}

// Get CSS colors for charts (alias for genColors with default count)
export function getCSSColors(count = 20) {
    return genColors(count);
}

// Get pie chart options
export function getPieChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 15,
                    usePointStyle: true,
                    font: {
                        family: "'Montserrat', 'Segoe UI', sans-serif",
                        size: 12,
                        weight: '600'
                    },
                    color: '#333'
                }
            },
            datalabels: {
                color: '#fff',
                font: {
                    family: "'Montserrat', 'Segoe UI', sans-serif",
                    weight: 'bold',
                    size: 11
                },
                formatter: (value, ctx) => {
                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                    const percentage = ((value / total) * 100).toFixed(1);
                    return percentage > 8 ? `${percentage}%` : '';
                },
                textShadowColor: 'rgba(0, 0, 0, 0.7)',
                textShadowBlur: 3
            }
        }
    };
}

// Get bar chart options
export function getBarChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.2,
        plugins: {
            legend: { display: false },
            datalabels: {
                color: '#333',
                font: {
                    family: "'Montserrat', 'Segoe UI', sans-serif",
                    weight: 'bold',
                    size: 10
                },
                formatter: (value) => `$${value.toFixed(0)}`,
                anchor: 'end',
                align: 'top'
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    font: {
                        family: "'Montserrat', 'Segoe UI', sans-serif",
                        size: 11
                    },
                    callback: function(value) {
                        return '$' + value.toFixed(0);
                    }
                }
            },
            x: {
                ticks: {
                    font: {
                        family: "'Montserrat', 'Segoe UI', sans-serif",
                        size: 11
                    }
                }
            }
        }
    };
}

// Get last N months as YYYY-MM strings
export function getLastNMonths(n) {
    const months = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(date.toISOString().slice(0, 7));
    }
    return months.reverse();
}

// Export filtered table to CSV
export function exportFilteredToCSV(filteredExpenses) {
    if (!filteredExpenses.length) return;
    const headers = ["Date","Description","Amount","Category","Need","Card","Who","Split","Outlier","Notes"];
    const rows = filteredExpenses.map(e => [
        e.date, e.description, e.amount, e.category, e.need_category, e.card, e.who, e.split_cost ? 'Yes' : '', e.outlier ? 'Yes' : '', e.notes
    ]);
    let csv = headers.join(',') + '\n';
    rows.forEach(r => {
        csv += r.map(x => '"' + (x ? (''+x).replace(/"/g,'""') : '') + '"').join(',') + '\n';
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// Setup dark mode toggle
export function setupDarkModeToggle() {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    function setDark(dark) {
        document.documentElement.classList.toggle('dark-mode', dark);
        localStorage.setItem('darkMode', dark ? '1' : '0');
        btn.textContent = dark ? '☀️ Light Mode' : '🌙 Dark Mode';
    }
    btn.onclick = () => setDark(!document.documentElement.classList.contains('dark-mode'));
    // On load
    setDark(localStorage.getItem('darkMode')==='1');
}

// Setup analytics toggle
export function setupAnalyticsToggle() {
    const toggle = document.getElementById('analyticsToggle');
    if (!toggle) return;
    toggle.onchange = () => {
        // Trigger chart re-render when changed
        if (window.renderCharts && window.filteredExpenses) {
            window.renderCharts(window.filteredExpenses);
        }
    };
}

// Notes area functionality
export function setupNotesArea() {
    const notesArea = document.getElementById('notesArea');
    const saveNotesBtn = document.getElementById('saveNotesBtn');
    if (notesArea) {
        notesArea.value = localStorage.getItem('expenseNotes') || '';
    }
    if (saveNotesBtn && notesArea) {
        saveNotesBtn.addEventListener('click', () => {
            localStorage.setItem('expenseNotes', notesArea.value);
            saveNotesBtn.textContent = 'Saved!';
            setTimeout(() => saveNotesBtn.textContent = 'Save Notes', 1000);
        });
    }
}

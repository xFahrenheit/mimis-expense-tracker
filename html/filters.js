
        'travel': '✈️',
        'utilities': '💡',
        'health': '🩺',
        'entertainment': '🎬',
        'subscriptions': '📦',
        'transport': '🚗',
        'rent': '🏠',
        'other': '❓',
        // Cards
        'chase sapphire': '💳',
        'venture x': '💳',
        'discover': '💳',
        // Spenders
        'Gautami': '👩',
        'Ameya': '👨',
        // Need/Luxury
        'Need': '🟢',
        'Luxury': '💎',
    };
    chips.forEach(chip => {
        const btn = document.createElement('button');
        btn.className = 'quick-chip';
        // Always show emoji for known types, but for custom (like Gautami, Ameya, Venture X), show text
        let lowerLabel = chip.label?.toLowerCase();
        let emoji = emojiMap[lowerLabel] || emojiMap[chip.label] || '';
        let isCustom = ['venture x','gautami','ameya'].includes(lowerLabel);
        btn.textContent = isCustom ? chip.label : (emoji ? `${emoji}` : chip.label);
        btn.title = chip.label;
        // On hover: switch to text, on mouseout: switch back to emoji (unless custom)
        if (!isCustom && emoji) {
            btn.addEventListener('mouseenter', () => { btn.textContent = chip.label; });
            btn.addEventListener('mouseleave', () => { btn.textContent = emoji; });
        }
        btn.onclick = () => {
            if (chip.type==='category') document.getElementById('filter-category').value = chip.label;
            if (chip.type==='card') document.getElementById('filter-card').value = chip.label;
            if (chip.type==='who') document.getElementById('filter-who').value = chip.label;
            if (chip.type==='need_category') document.getElementById('filter-needcat').value = chip.label;
            applyColumnFilters();
            renderQuickFilterChips(allExpenses);

            // --- Update Gautami's and Ameya's spending blocks for filteredExpenses ---
            let gautami = 0, ameya = 0, splitTotal = 0;
            for (const e of filteredExpenses) {
                if (e.split_cost) {
                    splitTotal += Number(e.amount || 0);
                    if (e.who === 'Gautami') {
                        gautami += Number(e.amount || 0) / 2;
                        ameya += Number(e.amount || 0) / 2;
                    } else if (e.who === 'Ameya') {
                        gautami += Number(e.amount || 0) / 2;
                        ameya += Number(e.amount || 0) / 2;
                    } else {
                        gautami += Number(e.amount || 0) / 2;
                        ameya += Number(e.amount || 0) / 2;
                    }
                } else {
                    if (e.who === 'Gautami') gautami += Number(e.amount || 0);
                    if (e.who === 'Ameya') ameya += Number(e.amount || 0);
                }
            }
            document.getElementById('gautamiSpendingValue').textContent = `$${gautami.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
            document.getElementById('ameyaSpendingValue').textContent = `$${ameya.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
        };
        chipDiv.appendChild(btn);
    });
    // Add clear button if any filter is active
    const categoryVal = document.getElementById('filter-category').value;
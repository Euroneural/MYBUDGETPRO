import { localDB } from './local-db.js';

class SearchManager {
    constructor(app) {
        this.app = app;
        this.searchResults = [];
        this.searchStats = {
            transactionCount: 0,
            firstTransactionDate: null,
            lastTransactionDate: null,
            incomeTotal: 0,
            expenseTotal: 0,
            transactionDates: []
        };
        this.searchOptions = {
            exactMatch: false,
            includeNotes: false,
            timeRange: 'all'
        };

        try {
            this.initializeEventListeners();
        } catch (error) {
            console.error('Error initializing SearchManager:', error);
        }
    }

    // Helper method to escape HTML to prevent XSS
    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    initializeEventListeners() {
        try {
            // Store reference to 'this' for use in callbacks
            const self = this;

            // Initialize search button and input
            const searchBtn = document.getElementById('search-btn');
            const searchInput = document.getElementById('transaction-search');

            if (!searchBtn) {
                console.error('Search button not found');
                return;
            }
            if (!searchInput) {
                console.error('Search input not found');
                return;
            }

            // Bind search button click
            searchBtn.addEventListener('click', () => {
                console.log('Search button clicked');
                self.safeSearch();
            });

            // Bind search input keyup
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    console.log('Enter key pressed in search input');
                    self.safeSearch();
                }
            });

            // Initialize event listeners
            const exactMatch = document.getElementById('exact-match');
            const includeNotes = document.getElementById('include-notes');
            const timeRange = document.getElementById('time-range');

            if (!exactMatch) console.warn('Exact match checkbox not found');
            if (!includeNotes) console.warn('Include notes checkbox not found');
            if (!timeRange) console.warn('Time range select not found');

            // Set up event listeners
            if (exactMatch) {
                exactMatch.addEventListener('change', () => {
                    console.log('Exact match changed:', exactMatch.checked);
                    self.safeRenderResults();
                });
            }

            if (includeNotes) {
                includeNotes.addEventListener('change', () => {
                    console.log('Include notes changed:', includeNotes.checked);
                    self.safeSearch();
                });
            }

            if (timeRange) {
                timeRange.addEventListener('change', () => {
                    console.log('Time range changed:', timeRange.value);
                    self.safeSearch();
                });
            }
        } catch (error) {
            console.error('Error initializing event listeners:', error);
        }
    }

    // Helper methods for safe search operations
    safeSearch() {
        try {
            this.performSearch();
        } catch (error) {
            console.error('Error in safeSearch:', error);
        }
    }

    safeRenderResults() {
        try {
            this.renderSearch();
        } catch (error) {
            console.error('Error in safeRenderResults:', error);
        }
    }

    async performSearch() {
        try {
            const searchInput = document.getElementById('transaction-search');
            if (!searchInput) {
                console.error('Search input element not found');
                return [];
            }

            const searchTerm = searchInput.value.trim();
            if (searchTerm.length < 2) {
                console.log('Search term too short');
                this.searchResults = [];
                this.calculateSearchStats();
                return [];
            }

            const searchBtn = document.getElementById('search-btn');
            if (searchBtn) {
                searchBtn.disabled = true;
                searchBtn.innerHTML = '<i class="bi bi-search"></i> Searching...';
            }

            // Get search options
            const exactMatch = document.getElementById('exact-match')?.checked || false;
            const includeNotes = document.getElementById('include-notes')?.checked || false;
            const timeRange = document.getElementById('time-range')?.value || 'all';

            // Get today's date for time range calculations
            const today = new Date();
            let startDate = null;
            let endDate = null;

            switch (timeRange) {
                case 'all':
                    break;
                case 'today':
                    startDate = today.toISOString().split('T')[0];
                    endDate = startDate;
                    break;
                case 'week':
                    today.setDate(today.getDate() - 7);
                    startDate = today.toISOString().split('T')[0];
                    endDate = new Date().toISOString().split('T')[0];
                    break;
                case 'month':
                    today.setMonth(today.getMonth() - 1);
                    startDate = today.toISOString().split('T')[0];
                    endDate = new Date().toISOString().split('T')[0];
                    break;
                case '6months':
                    today.setMonth(today.getMonth() - 5);
                    startDate = today.toISOString().split('T')[0];
                    endDate = new Date().toISOString().split('T')[0];
                    break;
                default:
                    break;
            }

            // Get transactions
            const transactions = this.app.transactions;

            // Process search terms
            const searchTerms = searchTerm.toLowerCase()
                .split(' ')
                .map(term => term.trim())
                .filter(term => term.length > 0);

            // Filter transactions
            let filteredTransactions = transactions;

            // Apply search terms
            if (searchTerms.length > 0) {
                filteredTransactions = filteredTransactions.filter(transaction => {
                    try {
                        if (!transaction) {
                            console.warn('Encountered undefined transaction in search');
                            return false;
                        }

                        const description = transaction.description?.toLowerCase() || '';
                        const notes = transaction.notes?.toLowerCase() || '';

                        // Check description and notes (if included)
                        const matchesDescription = searchTerms.every(term =>
                            exactMatch ? description.includes(term) :
                                description.indexOf(term) >= 0
                        );

                        const matchesNotes = includeNotes && searchTerms.every(term =>
                            exactMatch ? notes.includes(term) :
                                notes.indexOf(term) >= 0
                        );

                        return matchesDescription || (includeNotes && matchesNotes);
                    } catch (filterError) {
                        console.error('Error filtering transaction:', filterError);
                        return false; // Skip this transaction if there's an error
                    }
                });
            }

            // Apply date range filter
            if (startDate && endDate) {
                filteredTransactions = filteredTransactions.filter(transaction => {
                    try {
                        const transactionDate = new Date(transaction.date);
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        return transactionDate >= start && transactionDate <= end;
                    } catch (dateParseError) {
                        console.warn('Error parsing transaction date:', dateParseError);
                        return false; // Skip this transaction if date parsing fails
                    }
                });
            }

            // Update search results
            this.searchResults = filteredTransactions;

            // Calculate statistics
            this.calculateSearchStats();

            // Re-enable search button and update UI
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.innerHTML = '<i class="bi bi-search"></i> Search';
            }

            // Update search results display
            this.renderSearch();

            return filteredTransactions;
        } catch (error) {
            console.error('Error in performSearch:', error);
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.innerHTML = '<i class="bi bi-search"></i> Search';
            }
            return [];
        }
    }

    calculateSearchStats() {
        try {
            // Initialize default stats
            const defaultStats = {
                transactionCount: 0,
                firstTransactionDate: null,
                lastTransactionDate: null,
                incomeTotal: 0,
                expenseTotal: 0,
                transactionDates: []
            };

            if (!Array.isArray(this.searchResults) || this.searchResults.length === 0) {
                this.searchStats = { ...defaultStats };
                return;
            }

            const validTransactions = this.searchResults.filter(t => t.amount && !isNaN(parseFloat(t.amount)));
            if (validTransactions.length === 0) {
                this.searchStats = { ...defaultStats, transactionCount: this.searchResults.length };
                return;
            }

            const amounts = validTransactions.map(t => {
                try {
                    const amount = parseFloat(t.amount);
                    return isNaN(amount) ? 0 : amount;
                } catch (e) {
                    console.error('Error parsing amount:', e);
                    return 0;
                }
            });

            // Calculate totals and dates
            const incomeTotal = amounts.filter(a => a >= 0).reduce((acc, curr) => acc + curr, 0);
            const expenseTotal = Math.abs(amounts.filter(a => a < 0).reduce((acc, curr) => acc + curr, 0));
            const transactionDates = validTransactions.map(t => new Date(t.date));
            const firstTransactionDate = new Date(Math.min(...transactionDates));
            const lastTransactionDate = new Date(Math.max(...transactionDates));

            this.searchStats = {
                transactionCount: this.searchResults.length,
                firstTransactionDate: firstTransactionDate.toISOString().split('T')[0],
                lastTransactionDate: lastTransactionDate.toISOString().split('T')[0],
                incomeTotal: incomeTotal,
                expenseTotal: expenseTotal,
                transactionDates: transactionDates.map(d => d.toISOString().split('T')[0])
            };
        } catch (error) {
            console.error('Error calculating search statistics:', error);
            this.searchStats = {
                transactionCount: this.searchResults ? this.searchResults.length : 0,
                firstTransactionDate: null,
                lastTransactionDate: null,
                incomeTotal: 0,
                expenseTotal: 0,
                transactionDates: []
            };
        }
    }
    determineDateRange() {
        const today = new Date();
        let startDate = null;
        let endDate = null;

        switch (this.searchOptions.timeRange) {
            case 'today':
                startDate = today.toISOString().split('T')[0];
                break;
            case 'month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                break;
            case 'year':
                startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
                break;
            case 'custom':
                const customStartDate = document.getElementById('custom-start-date')?.value;
                const customEndDate = document.getElementById('custom-end-date')?.value;
                if (customStartDate) startDate = customStartDate;
                if (customEndDate) endDate = customEndDate;
                break;
            case '6months':
                startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().split('T')[0];
                break;
            case 'all':
            default:
                startDate = null;
        }

        return { startDate, endDate };
    }

    performSearch() {
        try {
            const transactions = this.app.transactions;
            const { searchTerm, exactMatch, includeNotes } = this.searchOptions;
            
            // Process search terms
            const searchTerms = searchTerm.toLowerCase()
                .split(' ')
                .map(term => term.trim())
                .filter(term => term.length > 0);

            if (searchTerms.length === 0) {
                console.log('No valid search terms after processing');
                this.searchResults = [];
                return;
            }

            console.log(`Searching with terms:`, searchTerms);

            // Filter transactions based on search term with detailed logging
            const filteredTransactions = transactions.filter(transaction => {
                try {
                    if (!transaction) {
                        console.warn('Encountered undefined transaction in search');
                        return false;
                    }

                    // Build searchable text
                    const searchText = [
                        String(transaction.description || '').toLowerCase(),
                        String(transaction.category || '').toLowerCase()
                    ];

                    if (includeNotes && transaction.notes) {
                        searchText.push(String(transaction.notes).toLowerCase());
                    }

                    const searchTextStr = searchText.join(' ');

                    // Apply search logic
                    if (exactMatch) {
                        // All search terms must be present
                        return searchTerms.every(term => searchTextStr.includes(term));
                    } else {
// Any search term can match (OR logic)
return searchTerms.some(term => searchTextStr.includes(term));
}
} catch (error) {
console.error('Error processing transaction during search:', error, transaction);
return false; // Skip this transaction if there's an error
}
});


            // Filter by date range if applicable
            const { startDate, endDate } = this.determineDateRange();
            let finalResults = filteredTransactions;
            if (startDate && endDate) {
                try {
                    finalResults = filteredTransactions.filter(transaction => {
                        const transactionDate = new Date(transaction.date);
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        return transactionDate >= start && transactionDate <= end;
                    });
                } catch (error) {
                    console.error('Error applying date filter:', error);
                }
            }

            // Update search results and stats
            this.searchResults = finalResults;
            this.calculateSearchStats();

            // Update UI
            try {
                const searchBtn = document.getElementById('search-btn');
                if (searchBtn) {
                    searchBtn.disabled = false;
                    searchBtn.innerHTML = '<i class="bi bi-search"></i> Search';
                }
                this.safeRenderResults();
            } catch (error) {
                console.error('Error updating UI:', error);
            }
        } catch (error) {
            console.error('Error in performSearch:', error);
            this.searchResults = [];
            this.searchStats = {
                transactionCount: 0,
                firstTransactionDate: null,
                lastTransactionDate: null,
                incomeTotal: 0,
                expenseTotal: 0,
                transactionDates: []
            };
        }
    }

calculateSearchStats() {
    try {
        // Initialize default stats
        const defaultStats = {
            transactionCount: 0,
            firstTransactionDate: null,
            lastTransactionDate: null,
            incomeTotal: 0,
            expenseTotal: 0,
            transactionDates: []
        };

        if (!Array.isArray(this.searchResults) || this.searchResults.length === 0) {
            this.searchStats = { ...defaultStats };
            return;
        }

        const validTransactions = this.searchResults.filter(t => t.amount && !isNaN(parseFloat(t.amount)));
        if (validTransactions.length === 0) {
            this.searchStats = { ...defaultStats, transactionCount: this.searchResults.length };
            return;
        }

        const amounts = validTransactions.map(t => {
            try {
                const amount = parseFloat(t.amount);
                return isNaN(amount) ? 0 : amount;
            } catch (e) {
                console.error('Error parsing amount:', e);
                return 0;
            }
        });

        // Calculate totals and dates
        const incomeTotal = amounts.filter(a => a >= 0).reduce((acc, curr) => acc + curr, 0);
        const expenseTotal = Math.abs(amounts.filter(a => a < 0).reduce((acc, curr) => acc + curr, 0));
        const transactionDates = validTransactions.map(t => new Date(t.date));
        const firstTransactionDate = new Date(Math.min(...transactionDates));
        const lastTransactionDate = new Date(Math.max(...transactionDates));

        this.searchStats = {
            transactionCount: this.searchResults.length,
            firstTransactionDate: firstTransactionDate.toISOString().split('T')[0],
            lastTransactionDate: lastTransactionDate.toISOString().split('T')[0],
            incomeTotal: incomeTotal,
            expenseTotal: expenseTotal,
            transactionDates: transactionDates.map(d => d.toISOString().split('T')[0])
            isSingleDay: transactionDates.length <= 1 || 
                (transactionDates[0] && transactionDates[transactionDates.length - 1] &&
                transactionDates[0].toDateString() === transactionDates[transactionDates.length - 1].toDateString()),
            dayCount: new Set(transactionDates.map(d => d.toDateString())).size,
            averagePerDay: transactionDates.length > 0 ? totalAmount / new Set(transactionDates.map(d => d.toDateString())).size : 0
        };

    } catch (error) {
        console.error('Error calculating search statistics:', error);
        // Fall back to default stats with the count of all results
        this.searchStats = {
            transactionCount: this.searchResults ? this.searchResults.length : 0,
            firstTransactionDate: null,
            lastTransactionDate: null,
            incomeTotal: 0,
            expenseTotal: 0,
            transactionDates: []
        };
    }
}

renderSearchResults() {
console.log('Rendering search results...');

const tbody = document.getElementById('search-results-body');
if (!tbody) {
console.error('Search results table body not found');
return;
}

// Clear existing content
tbody.innerHTML = '';

// Reset search button state
const searchBtn = document.getElementById('search-btn');
if (searchBtn) {
searchBtn.disabled = false;
searchBtn.textContent = 'Search';
}

// Validate search results
if (!Array.isArray(this.searchResults)) {
console.error('searchResults is not an array:', this.searchResults);
tbody.innerHTML = `
<tr>
<td colspan="5" class="text-center text-danger py-4">
<div class="d-flex flex-column align-items-center">
<i class="bi bi-exclamation-triangle-fill text-danger mb-2" style="font-size: 1.5rem;"></i>
<div>Error: Invalid search results format</div>
<div class="small mt-1">Please try your search again</div>
</div>
</td>
</tr>`;
return;
}

// Handle empty results
if (this.searchResults.length === 0) {
console.log('No search results to display');
const searchInput = document.getElementById('transaction-search')?.value.trim() || '';

let emptyStateHtml = '';

if (searchInput) {
// If there was a search term
emptyStateHtml = `
<tr>
<td colspan="5" class="text-center py-5">
<div class="d-flex flex-column align-items-center">
<i class="bi bi-search-x" style="font-size: 2.5rem; opacity: 0.7; margin-bottom: 1rem;"></i>
<h5 class="mb-2">No matching transactions</h5>
<p class="text-muted mb-3">We couldn't find any transactions matching "${this.app.escapeHtml(searchInput)}"</p>
<div class="d-flex gap-2">
<button class="btn btn-sm btn-outline-primary" onclick="document.getElementById('transaction-search').value = ''; document.getElementById('search-btn').click();">
<i class="bi bi-arrow-counterclockwise me-1"></i> Clear search
</button>
<button class="btn btn-sm btn-primary" onclick="document.getElementById('transaction-search').focus();">
<i class="bi bi-search me-1"></i> Try a different search
</button>
</div>
</div>
</td>
</tr>`;
} else {
// If no search term was entered
emptyStateHtml = `
<tr>
<td colspan="5" class="text-center py-5">
<div class="d-flex flex-column align-items-center">
<i class="bi bi-search" style="font-size: 2.5rem; opacity: 0.7; margin-bottom: 1rem;"></i>
<h5 class="mb-2">Search for transactions</h5>
<p class="text-muted mb-3">Enter a search term to find matching transactions</p>
<div class="input-group" style="max-width: 400px;">
<input type="text" id="search-input-focus" class="form-control" placeholder="Search transactions...">
<button class="btn btn-primary" type="button" onclick="document.getElementById('search-btn').click();">
<i class="bi bi-search me-1"></i> Search
</button>
</div>
<script>
// Auto-focus the search input when this is rendered
document.addEventListener('DOMContentLoaded', () => {
const input = document.getElementById('search-input-focus');
if (input) {
input.focus();
// Handle Enter key in the search input
input.addEventListener('keypress', (e) => {
if (e.key === 'Enter') {
document.getElementById('transaction-search').value = input.value;
document.getElementById('search-btn').click();
}
});
}
});
</script>
</div>
</td>
</tr>`;
}

tbody.innerHTML = emptyStateHtml;
return;
}
            this.searchStats = { 
                ...defaultStats, 
                transactionCount: this.searchResults.length 
            };
        }
    }
    
    renderSearchResults() {
        console.log('Rendering search results...');
        
        const tbody = document.getElementById('search-results-body');
        if (!tbody) {
            console.error('Search results table body not found');
            return;
        }
        
        // Clear existing content
        tbody.innerHTML = '';
        
        // Reset search button state
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.disabled = false;
            searchBtn.textContent = 'Search';
        }
        
        // Validate search results
        if (!Array.isArray(this.searchResults)) {
            console.error('searchResults is not an array:', this.searchResults);
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-danger py-4">
                        <div class="d-flex flex-column align-items-center">
                            <i class="bi bi-exclamation-triangle-fill text-danger mb-2" style="font-size: 1.5rem;"></i>
                            <div>Error: Invalid search results format</div>
                            <div class="small mt-1">Please try your search again</div>
                        </div>
                    </td>
                </tr>`;
            return;
        }
        
        // Handle empty results
        if (this.searchResults.length === 0) {
            console.log('No search results to display');
            const searchInput = document.getElementById('transaction-search')?.value.trim() || '';
            
            let emptyStateHtml = '';
            
            if (searchInput) {
                // If there was a search term
                emptyStateHtml = `
                    <tr>
                        <td colspan="5" class="text-center py-5">
                            <div class="d-flex flex-column align-items-center">
                                <i class="bi bi-search-x" style="font-size: 2.5rem; opacity: 0.7; margin-bottom: 1rem;"></i>
                                <h5 class="mb-2">No matching transactions</h5>
                                <p class="text-muted mb-3">We couldn't find any transactions matching "${this.app.escapeHtml(searchInput)}"</p>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-sm btn-outline-primary" onclick="document.getElementById('transaction-search').value = ''; document.getElementById('search-btn').click();">
                                        <i class="bi bi-arrow-counterclockwise me-1"></i> Clear search
                                    </button>
                                    <button class="btn btn-sm btn-primary" onclick="document.getElementById('transaction-search').focus();">
                                        <i class="bi bi-search me-1"></i> Try a different search
                                    </button>
                                </div>
                            </div>
                        </td>
                    </tr>`;
            } else {
                // If no search term was entered
                emptyStateHtml = `
                    <tr>
                        <td colspan="5" class="text-center py-5">
                            <div class="d-flex flex-column align-items-center">
                                <i class="bi bi-search" style="font-size: 2.5rem; opacity: 0.7; margin-bottom: 1rem;"></i>
                                <h5 class="mb-2">Search for transactions</h5>
                                <p class="text-muted mb-3">Enter a search term to find matching transactions</p>
                                <div class="input-group" style="max-width: 400px;">
                                    <input type="text" id="search-input-focus" class="form-control" placeholder="Search transactions...">
                                    <button class="btn btn-primary" type="button" onclick="document.getElementById('search-btn').click();">
                                        <i class="bi bi-search me-1"></i> Search
                                    </button>
                                </div>
                                <script>
                                    // Auto-focus the search input when this is rendered
                                    document.addEventListener('DOMContentLoaded', () => {
                                        const input = document.getElementById('search-input-focus');
                                        if (input) {
                                            input.focus();
                                            // Handle Enter key in the search input
                                            input.addEventListener('keypress', (e) => {
                                                if (e.key === 'Enter') {
                                                    document.getElementById('transaction-search').value = input.value;
                                                    document.getElementById('search-btn').click();
                                                }
                                            });
                                        }
                                    });
                                </script>
                            </div>
                        </td>
                    </tr>`;
            }
            
            tbody.innerHTML = emptyStateHtml;
            return;
        }
        
        // Sort by date (newest first)
        const sortedResults = [...this.searchResults].sort((a, b) => {
            try {
                return new Date(b.date) - new Date(a.date);
            } catch (error) {
                console.error('Error sorting transactions by date:', error);
                return 0;
            }
        });
        
        // Update result count and total
        const resultCount = document.getElementById('result-count');
        const resultTotal = document.getElementById('result-total');
        
        if (resultCount) resultCount.textContent = this.searchResults.length;
        if (resultTotal) resultTotal.textContent = this.app.formatCurrency(this.searchStats.totalAmount);
        
        // Render transaction rows
        tbody.innerHTML = sortedResults.map(transaction => {
            if (!transaction) {
                console.warn('Skipping undefined transaction');
                return '';
            }
            
            try {
                const date = new Date(transaction.date);
                const formattedDate = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                const amount = parseFloat(transaction.amount) || 0;
                const amountClass = amount >= 0 ? 'text-success' : 'text-danger';
                
                return `
                    <tr>
                        <td>${formattedDate}</td>
                        <td>${this.app.escapeHtml(transaction.description || 'No description')}</td>
                        <td>${this.app.escapeHtml(transaction.category || 'Uncategorized')}</td>
                        <td class="${amountClass} text-end">${this.app.formatCurrency(amount)}</td>
                        <td>${this.calculateTransactionChange(transaction)}</td>
                    </tr>`;
            } catch (error) {
                console.error('Error rendering transaction row:', error, transaction);
                return `
                    <tr class="table-warning">
                        <td colspan="5">Error displaying transaction</td>
                    </tr>`;
            }
        }).join('');
    }
    
    calculateTransactionChange(transaction) {
        // This is a simplified version - you would want to implement more sophisticated
        // change detection based on similar transactions over time
        return '—'; // Placeholder
    }
    
    renderSearchCharts() {
        console.log('Rendering search charts...');
        
        if (!Array.isArray(this.searchResults) || this.searchResults.length === 0) {
            console.log('No results to render charts for');
            return;
        }
        
        try {
            this.renderSearchTrendChart();
            
            // Only show category chart if we have categories
            const hasCategories = this.searchResults.some(t => t.category);
            console.log(`Transactions with categories: ${hasCategories ? 'Yes' : 'No'}`);
            
            if (hasCategories) {
                this.renderSearchCategoryChart();
            } else {
                console.log('No categories found in search results, skipping category chart');
                const categoryChartContainer = document.getElementById('search-category-chart-container');
                if (categoryChartContainer) {
                    categoryChartContainer.innerHTML = '<p class="text-muted">No category data available for this search</p>';
                }
            }
        } catch (error) {
            console.error('Error rendering search charts:', error);
        }
    }
    
    generateSearchInsights() {
        console.log('Generating search insights...');
        
        const insightsContainer = document.getElementById('search-insights');
        if (!insightsContainer) {
            console.error('Insights container not found');
            return;
        }
        
        // Clear any existing content
        insightsContainer.innerHTML = '';
        
        // Validate search results
        if (!Array.isArray(this.searchResults)) {
            console.error('searchResults is not an array:', this.searchResults);
            insightsContainer.innerHTML = `
                <div class="alert alert-danger">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        <div>
                            <h6 class="mb-1">Error Loading Insights</h6>
                            <p class="mb-0 small">Invalid search results format. Please try your search again.</p>
                        </div>
                    </div>
                </div>`;
            return;
        }
        
        if (this.searchResults.length === 0) {
            console.log('No search results, showing empty state');
            const searchInput = document.getElementById('transaction-search')?.value.trim() || '';
            
            if (searchInput) {
                insightsContainer.innerHTML = `
                    <div class="alert alert-info">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-info-circle-fill me-2"></i>
                            <div>
                                <h6 class="mb-1">No Matching Transactions</h6>
                                <p class="mb-0 small">No transactions found matching "${this.app.escapeHtml(searchInput)}"</p>
                            </div>
                        </div>
                    </div>`;
            } else {
                insightsContainer.innerHTML = `
                    <div class="alert alert-secondary">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-search me-2"></i>
                            <div>
                                <h6 class="mb-1">Search for Transactions</h6>
                                <p class="mb-0 small">Enter a search term to find matching transactions and see insights</p>
                            </div>
                        </div>
                    </div>`;
            }
            return;
        }
        
        // Generate insights based on search results
        try {
            const stats = this.searchStats;
            const hasDates = stats.firstTransactionDate && stats.lastTransactionDate;
            const dateRange = hasDates ? 
                `${stats.firstTransactionDate.toLocaleDateString()} - ${stats.lastTransactionDate.toLocaleDateString()}` : 
                'N/A';
            
            // Create insights HTML
            let insightsHtml = `
                <div class="card mb-4">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">Search Insights</h5>
                        <span class="badge bg-primary">${stats.transactionCount} transactions</span>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <h6>Date Range</h6>
                                    <p class="mb-1">${dateRange}</p>
                                    ${hasDates ? `<small class="text-muted">${stats.dayCount} day${stats.dayCount !== 1 ? 's' : ''}</small>` : ''}
                                </div>
                                <div class="mb-3">
                                    <h6>Total Amount</h6>
                                    <p class="h4 ${stats.totalAmount >= 0 ? 'text-success' : 'text-danger'}">
                                        ${this.app.formatCurrency(stats.totalAmount)}
                                    </p>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <h6>Income vs. Expenses</h6>
                                    <div class="d-flex justify-content-between">
                                        <span class="text-success">${this.app.formatCurrency(stats.incomeTotal)}</span>
                                        <span class="text-danger">-${this.app.formatCurrency(stats.expenseTotal)}</span>
                                    </div>
                                    <div class="progress mt-1" style="height: 6px;">
                                        <div class="progress-bar bg-success" role="progressbar" 
                                             style="width: ${stats.incomeTotal + stats.expenseTotal > 0 ? 
                                             (stats.incomeTotal / (stats.incomeTotal + stats.expenseTotal) * 100) : 0}%"
                                             aria-valuenow="50" aria-valuemin="0" aria-valuemax="100">
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <h6>Transaction Stats</h6>
                                    <div class="small">
                                        <div class="d-flex justify-content-between">
                                            <span>Average:</span>
                                            <span>${this.app.formatCurrency(stats.averageAmount)}</span>
                                        </div>
                                        <div class="d-flex justify-content-between">
                                            <span>Min:</span>
                                            <span>${this.app.formatCurrency(stats.minAmount)}</span>
                                        </div>
                                        <div class="d-flex justify-content-between">
                                            <span>Max:</span>
                                            <span>${this.app.formatCurrency(stats.maxAmount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
                
            insightsContainer.innerHTML = insightsHtml;
            
        } catch (error) {
            console.error('Error generating search insights:', error);
            insightsContainer.innerHTML = `
                <div class="alert alert-warning">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        <div>
                            <h6 class="mb-1">Error Generating Insights</h6>
                            <p class="mb-0 small">An error occurred while generating insights. ${error.message}</p>
                        </div>
                    </div>
                </div>`;
        }
    }
    renderSearchTrendChart() {
        console.log('Rendering search trend chart...');
        
        const chartCanvas = document.getElementById('search-trend-chart');
        if (!chartCanvas) {
            console.error('Trend chart canvas not found');
            return;
        }
        
        // Get the chart instance if it exists and destroy it
        const chartInstance = Chart.getChart(chartCanvas);
        if (chartInstance) {
            chartInstance.destroy();
        }
        
        // Group transactions by date
        const transactionsByDate = {};
        this.searchResults.forEach(transaction => {
            if (!transaction || !transaction.date) return;
            
            try {
                const date = new Date(transaction.date);
                if (isNaN(date.getTime())) return;
                
                const dateKey = date.toISOString().split('T')[0];
                const amount = parseFloat(transaction.amount) || 0;
                
                if (!transactionsByDate[dateKey]) {
                    transactionsByDate[dateKey] = 0;
                }
                transactionsByDate[dateKey] += amount;
            } catch (error) {
                console.warn('Error processing transaction date:', error);
            }
        });
        
        // Sort dates
        const sortedDates = Object.keys(transactionsByDate).sort();
        if (sortedDates.length === 0) {
            console.log('No valid date data for trend chart');
            chartCanvas.closest('.card').style.display = 'none';
            return;
        }
        
        // Prepare data for chart
        const labels = sortedDates.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        const data = sortedDates.map(date => transactionsByDate[date]);
        
        // Create the chart
        try {
            const ctx = chartCanvas.getContext('2d');
            if (!ctx) {
                throw new Error('Could not get 2D context for chart');
            }
            
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Amount',
                        data: data,
                        borderColor: 'rgba(13, 110, 253, 1)',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true,
                        pointBackgroundColor: 'rgba(13, 110, 253, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `$${context.parsed.y.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            grid: {
                                drawBorder: false
                            },
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toFixed(2);
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    }
                }
            });
            
            // Make sure the chart container is visible
            chartCanvas.closest('.card').style.display = 'block';
            
        } catch (error) {
            console.error('Error creating trend chart:', error);
            const container = chartCanvas.closest('.card');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-warning m-3">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-exclamation-triangle-fill me-2"></i>
                            <div>
                                <h6 class="mb-1">Error Loading Chart</h6>
                                <p class="mb-0 small">Could not render the trend chart. ${error.message}</p>
                            </div>
                        </div>
                    </div>`;
            }
        }
    }
    
    renderSearchCategoryChart() {
        console.log('Rendering search category chart...');
        
        const chartCanvas = document.getElementById('search-category-chart');
        if (!chartCanvas) {
            console.error('Search category chart canvas not found');
            return;
        }
        
        // Get the chart instance if it exists and destroy it
        const chartInstance = Chart.getChart(chartCanvas);
        if (chartInstance) {
            chartInstance.destroy();
        }
        
        const ctx = chartCanvas.getContext('2d');
        if (!ctx) {
            console.error('Could not get 2D context for category chart');
            return;
        }
        
        // Group transactions by category
        const categoryData = {};
        try {
            // Check if we have search results
            if (!Array.isArray(this.searchResults) || this.searchResults.length === 0) {
                console.log('No search results to render category chart');
                chartCanvas.closest('.card').style.display = 'none';
                return;
            }
            
            // Count transactions per category
            this.searchResults.forEach(transaction => {
                if (!transaction) {
                    console.warn('Encountered undefined transaction');
                    return;
                }
                
                const category = transaction.category || 'Uncategorized';
                const amount = Math.abs(parseFloat(transaction.amount) || 0);
                
                if (!categoryData[category]) {
                    categoryData[category] = 0;
                }
                categoryData[category] += amount;
            });
            
            // Sort categories by amount (descending)
            const sortedCategories = Object.entries(categoryData)
                .sort((a, b) => b[1] - a[1]);
                
            if (sortedCategories.length === 0) {
                console.log('No category data available for chart');
                chartCanvas.closest('.card').style.display = 'none';
                return;
            }
            
            const labels = sortedCategories.map(([category]) => category);
            const data = sortedCategories.map(([_, amount]) => amount);
            
            console.log('Category labels:', labels);
            console.log('Category data values:', data);
            
            // Generate colors for categories
            const backgroundColors = labels.map((_, i) => {
                const hue = (i * 137.508) % 360; // Golden angle approximation
                return `hsl(${hue}, 70%, 60%)`;
            });
            
            // Create the chart
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: backgroundColors,
                        borderWidth: 1,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                padding: 15,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${context.label}: ${this.app.formatCurrency(value)} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    layout: {
                        padding: 10
                    },
                    animation: {
                        animateScale: true,
                        animateRotate: true
                    }
                }
            });
            
            // Make sure the chart container is visible
            chartCanvas.closest('.card').style.display = 'block';
            console.log('Category chart rendered successfully');
            
        } catch (error) {
            console.error('Error rendering category chart:', error);
            const container = chartCanvas.closest('.card');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-warning m-3">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-exclamation-triangle-fill me-2"></i>
                            <div>
                                <h6 class="mb-1">Error Loading Chart</h6>
                                <p class="mb-0 small">Could not render the category chart. ${error.message}</p>
                            </div>
                        </div>
                    </div>`;
            }
        }
    }
}

class BudgetApp {
    // Static bank format configurations
    static BANK_FORMATS = {
        'chase': {
            name: 'Chase',
            date: 'Posting Date',
            description: 'Description',
            amount: 'Amount',
            type: 'Type',
            skipLines: 0,
            dateFormat: 'MM/DD/YYYY'
        },
        'bankofamerica': {
            name: 'Bank of America',
            date: 'Date',
            description: 'Description',
            amount: 'Amount',
            type: 'Type',
            skipLines: 0,
            dateFormat: 'MM/DD/YYYY'
        },
        'wellsfargo': {
            name: 'Wells Fargo',
            date: 'Date',
            description: 'Description',
            amount: 'Amount',
            type: 'Type',
            skipLines: 0,
            dateFormat: 'MM/DD/YYYY'
        },
        'citi': {
            name: 'Citi Bank',
            date: 'Date',
            description: 'Description',
            amount: 'Debit',
            credit: 'Credit',
            type: 'Type',
            skipLines: 0,
            dateFormat: 'MM/DD/YYYY'
        }
    };

    constructor() {
        this.transactions = [];
        this.charts = {}; // Initialize charts object
        this.budgetCategories = [];
        this.accounts = [];
        this.merchantCategories = {};
        this.currentView = 'dashboard';
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.db = localDB;
        this.dbInitialized = false;
        this.unsubscribeCallbacks = [];
        this.pendingImport = []; // Initialize pending import array
        
        // Initialize search manager
        this.searchManager = new SearchManager(this);
        
        // Initialize the app when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeApp());
        } else {
            this.initializeApp();
        }
    }
    
    initializeEventListeners() {
        try {
            // CSV import
            const csvImportBtn = document.getElementById('csv-import-btn');
            if (csvImportBtn) {
                csvImportBtn.addEventListener('click', () => {
                    document.getElementById('csv-file')?.click();
                });
            }

            // Transaction buttons
            const transactionButtons = document.querySelectorAll('.transaction-button');
            transactionButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const id = button.dataset.transactionId;
                    if (id) {
                        this.handleTransactionSubmit(button);
                    }
                });
            });

            // Category buttons
            const categoryButtons = document.querySelectorAll('.category-button');
            categoryButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const id = button.dataset.categoryId;
                    if (id) {
                        this.handleCategorySubmit(button);
                    }
                });
            });

            // Account buttons
            const accountButtons = document.querySelectorAll('.account-button');
            accountButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const id = button.dataset.accountId;
                    if (id) {
                        this.handleAccountSubmit(button);
                    }
                });
            });

            // Budget buttons
            const budgetButtons = document.querySelectorAll('.budget-button');
            budgetButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const id = button.dataset.budgetId;
                    if (id) {
                        this.handleBudgetSubmit(button);
                    }
                });
            });

            // File input
            const fileInput = document.getElementById('csv-file');
            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.processCSVFile(file);
                    }
                });
            }

            // CSV dropzone
            const dropzone = document.getElementById('csv-dropzone');
            if (dropzone) {
                dropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropzone.classList.add('csv-upload__dropzone--dragover');
                });
                dropzone.addEventListener('dragleave', () => {
                    dropzone.classList.remove('csv-upload__dropzone--dragover');
                });
                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('csv-upload__dropzone--dragover');
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        this.processCSVFile(files[0]);
                    }
                });
            }
        } catch (error) {
            console.error('Error initializing event listeners:', error);
            throw error;
        }
    };

    async processCSVFile(file) {
        if (!file) return Promise.reject(new Error('No file provided'));

        return new Promise(async (resolve, reject) => {
            try {
                const reader = new FileReader();
                const transactions = [];
                const skippedRows = [];
                const format = this.getCSVFormat();

                reader.onload = async (e) => {
                    try {
                        const text = e.target.result;
                        const rows = text.split('\n');

                        // Skip header row
                        for (let i = 1; i < rows.length; i++) {
                            const row = rows[i].trim();
                            if (!row) continue;

                            const values = row.split(',');
                            if (values.length < format.date + 1) {
                                skippedRows.push({ line: i + 1, reason: 'Insufficient columns' });
                                continue;
                            }

                            try {
                                // Parse date
                                let transactionDate;
                                try {
                                    transactionDate = this.parseDate(values[format.date]);
                                } catch (error) {
                                    console.error(`Error parsing date in row ${i + 1}:`, error);
                                    skippedRows.push({ line: i + 1, reason: error.message });
                                    continue;
                                }

                                // Parse amount
                                let amount;
                                try {
                                    amount = this.parseAmount(values[format.amount]);
                                } catch (error) {
                                    console.error(`Error parsing amount in row ${i + 1}:`, error);
                                    skippedRows.push({ line: i + 1, reason: error.message });
                                    continue;
                                }

                                // Create transaction object
                                const transaction = {
                                    id: crypto.randomUUID(),
                                    date: transactionDate.toISOString().split('T')[0],
                                    description: values[format.description] || 'Imported Transaction',
                                    amount: amount,
                                    category: 'Uncategorized',
                                    account: format.account || 'Imported',
                                    notes: '',
                                    createdAt: new Date().toISOString()
                                };

                                transactions.push(transaction);
                            } catch (error) {
                                console.error(`Error processing row ${i + 1}:`, error);
                                skippedRows.push({ line: i + 1, reason: error.message });
                            }
                        }

                        // Show preview
                        this.showCSVPreview(transactions, skippedRows);
                        resolve({ transactions, skippedRows });
                    } catch (error) {
                        console.error('Error processing CSV:', error);
                        reject(error);
                    }
                };

                reader.onerror = (error) => {
                    console.error('Error reading file:', error);
                    reject(new Error('Error reading file'));
                };

                reader.readAsText(file);
            } catch (error) {
                console.error('Error setting up CSV processing:', error);
                reject(error);
            }
        });
    };

    async confirmCSVImport(transactions) {
        try {
            if (!transactions || !Array.isArray(transactions)) {
                throw new Error('No transactions provided for import');
            }

            // Save transactions to database
            await this.db.transactions.bulkAdd(transactions);

            // Update local state
            this.transactions = await this.db.transactions.getAll();

            // Update UI
            this.renderTransactions();
            this.renderStats();
            this.renderCharts();

            // Show success message
            this.showNotification('CSV import successful!', 'success');

            // Close preview modal
            const modal = document.getElementById('csv-preview-modal');
            if (modal) {
                modal.style.display = 'none';
            }
        } catch (error) {
            console.error('Error confirming CSV import:', error);
            this.showNotification(`Error importing CSV: ${error.message}`, 'error');
            throw error;
        }
    };

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger alert-dismissible fade show';
        errorDiv.innerHTML = `
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    };

    showNotification(message, type = 'info') {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = `alert alert-${type} alert-dismissible fade show`;
        notificationDiv.innerHTML = `
            <i class="bi bi-info-circle-fill me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(notificationDiv);
        setTimeout(() => notificationDiv.remove(), 5000);
    };

    async initializeApp() {
        try {
            console.log('Initializing app...');
            
            // Initialize the database first
            await this.db.initializeDB();
            this.dbInitialized = true;
            
            // Initialize event listeners
            this.initializeEventListeners();
            
            // Render the dashboard view
            this.renderCurrentView();
            
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Failed to initialize application. Please try refreshing the page.');
            throw error;
        }
    }

    async processCSVFile(file) {
        if (!file) return Promise.reject(new Error('No file provided'));
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const allLines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                    
                    if (allLines.length < 2) {
                        throw new Error('CSV file must have at least one data row');
                    }
                    
                    const transactions = [];
                    const skippedRows = [];
                    
                    // Process header row
                    const header = this.parseCSVLine(allLines[0]);
                    const format = this.detectCSVFormat(header);
                    
                    // Process data rows
                    for (let i = 1; i < allLines.length; i++) {
                        try {
                            const values = this.parseCSVLine(allLines[i]);
                            if (values.length === 0) continue;
                            
                            // Parse date with fallback to today
                            let transactionDate;
                            try {
                                transactionDate = this.parseDate(values[format.date], format.dateFormat);
                            } catch (error) {
                                transactionDate = new Date();
                            }
                            
                            // Parse amount
                            let amount;
                            try {
                                amount = this.parseAmount(values[format.amount]);
                            } catch (error) {
                                amount = 0;
                            }
                            
                            // Create transaction object
                            const transaction = {
                                id: crypto.randomUUID(),
                                date: transactionDate.toISOString().split('T')[0],
                                description: values[format.description] || 'Imported Transaction',
                                amount: amount,
                                category: 'Uncategorized',
                                account: format.account || 'Imported',
                                notes: '',
                                createdAt: new Date().toISOString()
                            };
                            
                            transactions.push(transaction);
                        } catch (error) {
                            console.error(`Error processing row ${i + 1}:`, error);
                            skippedRows.push({ line: i + 1, reason: error.message || 'Error processing row' });
                        }
                    }
                    
                    // Show preview
                    this.showCSVPreview(transactions, skippedRows);
                    resolve({ transactions, skippedRows });
                } catch (error) {
                    console.error('Error processing CSV:', error);
                    reject(error);
                }
            };
            
            reader.onerror = (error) => {
                console.error('Error reading file:', error);
                reject(new Error('Error reading file'));
            };
            
            reader.readAsText(file);
        });
    }

    async confirmCSVImport() {
        try {
            // Get the transactions from the preview
            const previewModal = document.getElementById('csv-preview-modal');
            if (!previewModal) {
                this.showNotification('CSV preview modal not found', 'error');
                return;
    };

    // Transaction buttons
    const transactionButtons = document.querySelectorAll('.transaction-button');
    transactionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const id = button.dataset.transactionId;
            if (id) {
                this.handleTransactionSubmit(button);
            }
        });
    });

    // Category buttons
    const categoryButtons = document.querySelectorAll('.category-button');
    categoryButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const id = button.dataset.categoryId;
            if (id) {
                this.handleCategorySubmit(button);
            }
        });
    });

    // Account buttons
    const accountButtons = document.querySelectorAll('.account-button');
    accountButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const id = button.dataset.accountId;
            if (id) {
                this.handleAccountSubmit(button);
            }
        });
    });

    // Budget buttons
    const budgetButtons = document.querySelectorAll('.budget-button');
    budgetButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const id = button.dataset.budgetId;
            if (id) {
                this.handleBudgetSubmit(button);
            }
        });
    });

    // File input
    const fileInput = document.getElementById('csv-file');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.processCSVFile(file);
            }
        });
    }
*/

async processCSVFile(file) {
    if (!file) return Promise.reject(new Error('No file provided'));

    return new Promise(async (resolve, reject) => {
        const reader = new FileReader();
        const transactions = [];
        const skippedRows = [];
        const format = this.getCSVFormat();

        reader.onload = async (e) => {
            try {
                const text = e.target.result;
                const rows = text.split('\n');

                // Skip header row
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i].trim();
                    if (!row) continue;

                    const values = row.split(',');
                    if (values.length < format.date + 1) {
                        skippedRows.push({ line: i + 1, reason: 'Insufficient columns' });
                        continue;
                    }

                    try {
                        // Parse date
                        let transactionDate;
                        try {
                            transactionDate = this.parseDate(values[format.date]);
                        } catch (error) {
                            transactionDate = new Date();
                        }

                        // Parse amount
                        let amount;
                        try {
                            amount = this.parseAmount(values[format.amount]);
                        } catch (error) {
                            amount = 0;
                        }

                        // Create transaction object
                        const transaction = {
                            id: crypto.randomUUID(),
                            date: transactionDate.toISOString().split('T')[0],
                            description: values[format.description] || 'Imported Transaction',
                            amount: amount,
                            category: 'Uncategorized',
                            account: format.account || 'Imported',
                            notes: '',
                            createdAt: new Date().toISOString()
                        };

                        transactions.push(transaction);
                    } catch (error) {
                        console.error(`Error processing row ${i + 1}:`, error);
                        skippedRows.push({ line: i + 1, reason: error.message || 'Error processing row' });
                    }
                }

                // Show preview of transactions
                this.showCSVPreview(transactions, skippedRows);
                resolve({ transactions, skippedRows });
            } catch (error) {
                console.error('Error processing CSV file:', error);
                reject(error);
            }
        };

        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            reject(new Error('Error reading file. Please try again.'));
        };

        reader.readAsText(file);
    });
}
            `;
        }

        // Add transactions to database
        await this.db.addTransactions(transactions);
        
        // Update local transactions
        this.transactions.push(...transactions);
        
        // Update UI
        await this.renderTransactions();
        this.showNotification(`${transactions.length} transactions imported successfully`, 'success');
        
        // Close modal
        const modal = document.getElementById('csv-preview-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    } catch (error) {
        console.error('Error importing CSV:', error);
        this.showNotification('Error importing transactions', 'error');
    }
}

    /**
     * Render the current view based on the currentView property
     */
    renderCurrentView() {
        const view = this.currentView;
        
        switch (view) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'budget':
                this.renderBudget();
                break;
            case 'transactions':
                this.renderTransactions();
                break;
            case 'calendar':
                this.renderCalendar();
                break;
            case 'search':
                this.renderSearch();
                break;
            default:
                this.renderDashboard();
        }
    }

    async loadBudgetCategories() {
        try {
            this.budgetCategories = await this.db.getAllItems('budgetCategories') || [];
            return this.budgetCategories;
        } catch (error) {
            console.error('Failed to load budget categories:', error);
            return [];
        }
    }

    /**
     * Render the transactions view with all transactions
     */
    /**
     * Render the transactions view with all transactions
     */
    async renderTransactions() {
        try {
            const transactionsView = document.getElementById('transactions-view');
            if (!transactionsView) {
                console.error('Transactions view container not found');
                return;
            }

            // Show loading state
            transactionsView.innerHTML = `
                <div class="text-center p-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading transactions...</p>
                </div>`;

            // Get all transactions
            const transactions = await this.db.getAllItems('transactions') || [];
            
            // Sort transactions by date (newest first)
            const sortedTransactions = [...transactions].sort((a, b) => 
                new Date(b.date) - new Date(a.date)
            );

            // Create table
            let html = `
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead class="table-light">
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th class="text-end">Amount</th>
                                <th>Category</th>
                                <th>Account</th>
                                <th class="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>`;

            // Add transaction rows
            if (sortedTransactions.length === 0) {
                html += `
                    <tr>
                        <td colspan="6" class="text-center py-4">
                            <p class="text-muted">No transactions found.</p>
                            <button class="btn btn-primary" onclick="window.app.showTransactionModal()">
                                <i class="bi bi-plus-circle"></i> Add Your First Transaction
                            </button>
                        </td>
                    </tr>`;
            } else {
                sortedTransactions.forEach(transaction => {
                    if (!transaction) return;
                    
                    const date = new Date(transaction.date).toLocaleDateString();
                    const amount = parseFloat(transaction.amount) || 0;
                    const amountClass = transaction.type === 'expense' ? 'text-danger' : 'text-success';
                    const amountStr = this.formatCurrency ? this.formatCurrency(amount) : `$${amount.toFixed(2)}`;
                    
                    html += `
                        <tr>
                            <td>${date}</td>
                            <td>${this.escapeHtml(transaction.description || '')}</td>
                            <td class="text-end ${amountClass}">${amount < 0 ? '-' : ''}${amountStr}</td>
                            <td>${this.escapeHtml(transaction.category || 'Uncategorized')}</td>
                            <td>${this.escapeHtml(transaction.account || '')}</td>
                            <td class="text-center">
                                <button class="btn btn-sm btn-outline-primary me-1" 
                                    onclick="window.app.editTransaction('${transaction.id}')"
                                    title="Edit transaction">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" 
                                    onclick="window.app.confirmAndDeleteTransaction('${transaction.id}')"
                                    title="Delete transaction">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>`;
                });
            }

            // Close table
            html += `
                        </tbody>
                    </table>
                </div>`;

            // Add search and action buttons
            html += `
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <div class="col-md-4">
                        <div class="input-group">
                            <span class="input-group-text">
                                <i class="bi bi-search"></i>
                            </span>
                            <input type="text" 
                                class="form-control" 
                                id="transaction-search" 
                                placeholder="Search transactions...">
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-primary" onclick="window.app.showTransactionModal()">
                            <i class="bi bi-plus-circle"></i> Add Transaction
                        </button>
                    </div>
                </div>`;

            // Update the view
            transactionsView.innerHTML = html;

            // Initialize search functionality
            this.initializeSearch();

        } catch (error) {
            console.error('Error rendering transactions:', error);
            const errorHtml = `
                <div class="alert alert-danger">
                    <p>Error loading transactions: ${error.message}</p>
                    <button class="btn btn-secondary" onclick="window.app.renderTransactions()">
                        <i class="bi bi-arrow-clockwise"></i> Try Again
                    </button>
                </div>`;
            
            const transactionsView = document.getElementById('transactions-view');
            if (transactionsView) {
                transactionsView.innerHTML = errorHtml;
            }
        }
    }
    
    /**
     * Initialize search functionality for transactions
     */
    initializeSearch() {
        const searchInput = document.getElementById('transaction-search');
        const transactionsView = document.getElementById('transactions-view');
        
        if (!searchInput || !transactionsView) return;
        
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const rows = transactionsView.querySelectorAll('tbody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = searchTerm === '' || text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
                                   id="transaction-search" 
                                   placeholder="Search transactions...">
                        </div>
                        <div class="col-md-4">
                            <select class="form-select" id="transaction-filter">
                                <option value="">All Categories</option>
                                ${this.budgetCategories.map(cat => 
                                    `<option value="${cat.name}">${cat.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="col-md-4">
                            <button class="btn btn-primary" onclick="window.app.showTransactionModal()">
                                Add New Transaction
                            </button>
                        </div>
                    </div>
                </div>`;

            // Update the view
            transactionsView.innerHTML = html;

        } catch (error) {
            console.error('Error rendering transactions:', error);
            const errorHtml = `
                <div class="alert alert-danger">
                    <p>Error loading transactions: ${error.message}</p>
                    <button class="btn btn-primary" onclick="window.app.renderTransactions()">
                        Try Again
                    </button>
                </div>`;
            transactionsView.innerHTML = errorHtml;
        }
    }

    async loadAccounts() {
        try {
            this.accounts = await this.db.getAllItems('accounts') || [];
            return this.accounts;
        } catch (error) {
            console.error('Failed to load accounts:', error);
            return [];
        }
    }

    // Render budget view
    async renderBudget() {
        try {
            const budgetView = document.getElementById('budget-view');
            if (!budgetView) {
                console.error('Budget view container not found');
                return;
            }

            // Show loading state
            budgetView.innerHTML = `
                <div class="loading">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p>Loading budget data...</p>
                </div>`;

            // Get current month's budget categories
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();

            // Get all transactions for current month
            const startDate = new Date(currentYear, currentMonth, 1);
            const endDate = new Date(currentYear, currentMonth + 1, 0);
            const transactions = this.getTransactionsByDateRange(startDate, endDate);

            // Group transactions by category
            const categoryTotals = {};
            transactions.forEach(t => {
                const category = t.category || 'Uncategorized';
                if (!categoryTotals[category]) {
                    categoryTotals[category] = 0;
                }
                categoryTotals[category] += parseFloat(t.amount);
            });

            // Get budget allocations
            const budgetAllocations = {};
            this.budgetCategories.forEach(cat => {
                if (cat.active && cat.monthlyLimit > 0) {
                    budgetAllocations[cat.name] = {
                        limit: parseFloat(cat.monthlyLimit),
                        color: cat.color || '#6c757d'
                    };
                }
            });

            // Create budget cards
            let html = '<div class="row">';

            // Create a card for each budget category
            Object.keys(budgetAllocations).forEach(category => {
                const totalSpent = categoryTotals[category] || 0;
                const limit = budgetAllocations[category].limit;
                const color = budgetAllocations[category].color;
                const percentage = Math.min((totalSpent / limit) * 100, 100);
                const remaining = limit - totalSpent;
                const statusClass = percentage >= 80 ? 'text-warning' : 
                                   percentage >= 100 ? 'text-danger' : '';

                html += `
                    <div class="col-md-4 mb-4">
                        <div class="card h-100">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="card-title mb-0">${category}</h5>
                                <button class="btn btn-sm btn-primary" 
                                        onclick="window.app.editBudgetCategory('${category}')">
                                    <i class="bi bi-pencil"></i>
                                </button>
                            </div>
                            <div class="card-body">
                                <div class="progress mb-3">
                                    <div class="progress-bar" 
                                         role="progressbar" 
                                         style="width: ${percentage}%; background-color: ${color};"
                                         aria-valuenow="${percentage}" 
                                         aria-valuemin="0" 
                                         aria-valuemax="100">
                                        ${percentage.toFixed(1)}%
                                    </div>
                                </div>
                                <div class="d-flex justify-content-between mb-2">
                                    <span>Spent:</span>
                                    <span class="text-end">${this.formatCurrency(totalSpent)}</span>
                                </div>
                                <div class="d-flex justify-content-between mb-2">
                                    <span>Limit:</span>
                                    <span class="text-end">${this.formatCurrency(limit)}</span>
                                </div>
                                <div class="d-flex justify-content-between">
                                    <span class="${statusClass}">Remaining:</span>
                                    <span class="text-end ${statusClass}">${this.formatCurrency(remaining)}</span>
                                </div>
                            </div>
                        </div>
                    </div>`;
            });

            // Close row
            html += '</div>';

            // Add budget summary
            html += `
                <div class="mt-4">
                    <h4>Budget Summary</h4>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title">Total Spent</h5>
                                    <p class="card-text display-6">${this.formatCurrency(
                                        Object.values(categoryTotals).reduce((a, b) => a + b, 0)
                                    )}</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title">Remaining Budget</h5>
                                    <p class="card-text display-6">${this.formatCurrency(
                                        Object.values(budgetAllocations).reduce((a, b) => a + b.limit, 0) -
                                        Object.values(categoryTotals).reduce((a, b) => a + b, 0)
                                    )}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;

            // Add budget controls
            html += `
                <div class="mt-4">
                    <button class="btn btn-primary" onclick="window.app.showNewBudgetCategoryModal()">
                        Add New Category
                    </button>
                    <button class="btn btn-secondary ms-2" onclick="window.app.importBudgetCategories()">
                        Import Categories
                    </button>
                </div>`;

            // Update the view
            budgetView.innerHTML = html;

        } catch (error) {
            console.error('Error rendering budget:', error);
            const errorHtml = `
                <div class="alert alert-danger">
                    <p>Error loading budget data: ${error.message}</p>
                    <button class="btn btn-primary" onclick="window.app.renderBudget()">
                        Try Again
                    </button>
                </div>`;
            budgetView.innerHTML = errorHtml;
        }
    }

    setupRealtimeListeners() {
        // Add real-time listeners for transactions
        this.unsubscribeCallbacks.push(
            this.db.subscribeToStore('transactions', (newTransactions) => {
                // Only reload if there are actual changes
                if (JSON.stringify(newTransactions) !== JSON.stringify(this.transactions)) {
                    this.transactions = newTransactions;
                    this.renderCurrentView();
                }
            })
        );

        // Add real-time listeners for budget categories
        this.unsubscribeCallbacks.push(
            this.db.subscribeToStore('budgetCategories', (newCategories) => {
                // Only reload if there are actual changes
                if (JSON.stringify(newCategories) !== JSON.stringify(this.budgetCategories)) {
                    this.budgetCategories = newCategories;
                    this.renderCurrentView();
                }
            })
        );

        // Add real-time listeners for accounts
        this.unsubscribeCallbacks.push(
            this.db.subscribeToStore('accounts', (newAccounts) => {
                // Only reload if there are actual changes
                if (JSON.stringify(newAccounts) !== JSON.stringify(this.accounts)) {
                    this.accounts = newAccounts;
                    this.renderCurrentView();
                }
            })
        );
    }

    async loadTransactions() {
        try {
            this.transactions = await this.db.getAllItems('transactions') || [];
            // Sort by date (newest first)
            this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            console.log(`Loaded ${this.transactions.length} transactions into memory`);
            return this.transactions;
        } catch (error) {
            console.error('Error loading transactions:', error);
            this.transactions = [];
            return [];
        }
    }
    
    /**
     * Get transactions for a specific date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Array} Filtered transactions
     */
    getTransactionsByDateRange(startDate, endDate) {
        console.log('getTransactionsByDateRange - Input dates:', { startDate, endDate });
        
        const filtered = this.transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const isInRange = transactionDate >= startDate && transactionDate <= endDate;
            
            if (isInRange) {
                console.log('Transaction in range:', {
                    id: t.id,
                    date: t.date,
                    amount: t.amount,
                    description: t.description
                });
            }
            
            return isInRange;
        });
        
        console.log('getTransactionsByDateRange - Total transactions in range:', filtered.length);
        return filtered;
    }
    
    /**
     * Get transactions for a specific date
     * @param {Date} date - The date to get transactions for
     * @returns {Array} Filtered transactions
     */
    getTransactionsByDate(date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        console.log('getTransactionsByDate - Date range:', {
            start: startOfDay,
            end: endOfDay,
            inputDate: date
        });
        
        const transactions = this.getTransactionsByDateRange(startOfDay, endOfDay);
        console.log('getTransactionsByDate - Found transactions:', transactions);
        
        return transactions;
    }
    
    /**
     * Format date as YYYY-MM-DD
     * @param {Date} date - The date to format
     * @returns {string} Formatted date string
     */
    formatDateKey(date) {
        return date.toISOString().split('T')[0];
    }
    
    /**
     * Render the calendar view
     * @param {Date} [date] - The date to display (defaults to current month)
     */
    renderCalendar(date = new Date()) {
        // Update current month and year
        this.currentMonth = date.getMonth();
        this.currentYear = date.getFullYear();
        
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;
        
        const month = date.getMonth();
        const year = date.getFullYear();
        const today = new Date();
        
        // Get first day of month (0-6, where 0 is Sunday)
        const firstDay = new Date(year, month, 1).getDay();
        // Get number of days in month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        // Get number of days in previous month
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        
        // Get transactions for the current month
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        const monthlyTransactions = this.getTransactionsByDateRange(startDate, endDate);
        
        // Group transactions by day with proper month/year validation
        const transactionsByDay = {};
        console.log('Grouping ' + monthlyTransactions.length + ' transactions for ' + (month + 1) + '/' + year);
        
        monthlyTransactions.forEach(t => {
            const transactionDate = new Date(t.date);
            const day = transactionDate.getDate();
            const transactionMonth = transactionDate.getMonth();
            const transactionYear = transactionDate.getFullYear();
            
            // Only include if it's in the current month we're displaying
            if (transactionMonth === month && transactionYear === year) {
                if (!transactionsByDay[day]) {
                    transactionsByDay[day] = [];
                }
                transactionsByDay[day].push(t);
                console.log('Added transaction to day ' + day + ':', t);
            } else {
                console.log('Skipping transaction not in current month:', t);
            }
        });
        
        console.log('Transactions grouped by day:', transactionsByDay);
        
        // Generate calendar HTML
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        
        let calendarHTML = `
            <div class="calendar-controls">
                <button id="prev-month" class="btn btn--icon">
                    <i class="bi bi-chevron-left"></i>
                </button>
                <h2>${monthNames[month]} ${year}</h2>
                <button id="next-month" class="btn btn--icon">
                    <i class="bi bi-chevron-right"></i>
                </button>
            </div>
            <div class="calendar">
                <div class="calendar__header">
                    <div class="calendar__day">Sun</div>
                    <div class="calendar__day">Mon</div>
                    <div class="calendar__day">Tue</div>
                    <div class="calendar__day">Wed</div>
                    <div class="calendar__day">Thu</div>
                    <div class="calendar__day">Fri</div>
                    <div class="calendar__day">Sat</div>
                </div>
                <div class="calendar__body">
        `;
        
        // Calculate the previous month and year
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
        }
        
        // Add empty cells for days from previous month
        for (let i = 0; i < firstDay; i++) {
            const day = daysInPrevMonth - firstDay + i + 1;
            const dayOfWeek = new Date(prevYear, prevMonth, day).getDay();
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
            
            calendarHTML += `
                <div class="calendar__day calendar__day--other-month" 
                     data-date="${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}">
                    <div class="calendar__day-number">${day}</div>
                    <div class="calendar__day-name">${dayName}</div>
                </div>`;
        }
        
        // Add days of current month
        const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
        
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dayOfWeek = currentDate.getDay();
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
            const isToday = isCurrentMonth && day === today.getDate();
            const isSelected = this.selectedDate && 
                             currentDate.getDate() === this.selectedDate.getDate() &&
                             currentDate.getMonth() === this.selectedDate.getMonth() &&
                             currentDate.getFullYear() === this.selectedDate.getFullYear();
            
            const dayTransactions = transactionsByDay[day] || [];
            const hasTransactions = dayTransactions.length > 0;
            const income = dayTransactions
                .filter(t => parseFloat(t.amount) > 0)
                .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
            const expenses = dayTransactions
                .filter(t => parseFloat(t.amount) < 0)
                .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
            
            calendarHTML += `
                <div class="calendar__day ${isToday ? 'calendar__day--today' : ''} ${isSelected ? 'calendar__day--selected' : ''}" 
                     data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}">
                    <div class="calendar__day-number">${day}</div>
                    <div class="calendar__day-name">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(year, month, day).getDay()]}</div>`;
            
            if (dayTransactions.length > 0) {
                calendarHTML += `
                    <div class="calendar__transactions">`;

                // Show up to 2 transactions per day in the calendar
                dayTransactions.slice(0, 2).forEach(transaction => {
                    const isIncome = parseFloat(transaction.amount) > 0;
                    calendarHTML += `
                        <div class="calendar__transaction ${isIncome ? 'income' : 'expense'}">
                            <span class="transaction-description">${transaction.description || 'No description'}</span>
                            <span class="transaction-amount">${this.formatCurrency(transaction.amount)}</span>
                        </div>`;
                });

                // Show indicator if there are more transactions
                if (dayTransactions.length > 2) {
                    calendarHTML += `
                        <div class="calendar__transaction-more">+${dayTransactions.length - 2} more</div>`;
                }
                
                calendarHTML += `
                    </div>`;
            }
            
            // Show daily total if there are transactions
            if (dayTransactions.length > 0) {
                const net = income - expenses;
                calendarHTML += `
                    <div class="calendar__total ${net >= 0 ? 'calendar__total--positive' : 'calendar__total--negative'}">
                        ${net >= 0 ? '+' : ''}${this.formatCurrency(net)}
                    </div>`;
            }
            
            calendarHTML += `
                </div>`;
        }
        
        // Add empty cells for days from next month to complete the grid
        const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
        const remainingCells = totalCells - (firstDay + daysInMonth);
        
        // Calculate the next month and year
        let nextMonth = month + 1;
        let nextYear = year;
        if (nextMonth > 11) {
            nextMonth = 0;
            nextYear++;
        }
        
        // Add days from next month
        for (let i = 1; i <= remainingCells; i++) {
            const dayOfWeek = (firstDay + daysInMonth + i - 1) % 7;
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
            
            calendarHTML += `
                <div class="calendar__day calendar__day--other-month" 
                     data-date="${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}">
                    <div class="calendar__day-number">${i}</div>
                    <div class="calendar__day-name">${dayName}</div>
                </div>`;
        }
        
        calendarHTML += `
                </div>
            </div>`;
        
        // Update month/year display
        const monthYearEl = document.getElementById('calendar-month-year');
        if (monthYearEl) {
            monthYearEl.textContent = new Intl.DateTimeFormat('en-US', { 
                year: 'numeric', 
                month: 'long' 
            }).format(new Date(year, month, 1));
        }
        
        // Close calendar days div
        calendarHTML += '</div>';
        
        // Update the DOM
        calendarEl.innerHTML = calendarHTML;
        
        // Set up event listeners
        this.setupCalendarEventListeners();
        
        // Update mini calendar
        this.renderMiniCalendar(new Date(year, month, 1));
        
        // Update summary
        this.updateCalendarSummary(new Date(year, month, 1));
    }
    
    /**
     * Render the mini calendar in the sidebar
     * @param {Date} date - The date to display
     */
    renderMiniCalendar(date) {
        const miniCalendarEl = document.getElementById('mini-calendar');
        if (!miniCalendarEl) return;
        
        const month = date.getMonth();
        const year = date.getFullYear();
        const today = new Date();
        
        // Get first day of month (0-6, where 0 is Sunday)
        const firstDay = new Date(year, month, 1).getDay();
        // Get number of days in month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        // Get number of days in previous month
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        
        // Get transactions for the current month
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        const monthlyTransactions = this.getTransactionsByDateRange(startDate, endDate);
        
        // Group transactions by day
        const transactionsByDay = {};
        monthlyTransactions.forEach(t => {
            const day = new Date(t.date).getDate();
            if (!transactionsByDay[day]) {
                transactionsByDay[day] = [];
            }
            transactionsByDay[day].push(t);
        });
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        
        let html = `
            <div class="mini-calendar-header">
                <button id="mini-prev-month" class="btn btn--icon btn--sm" title="Previous month">
                    <i class="bi bi-chevron-left"></i>
                </button>
                <h4>${monthNames[month].substring(0, 3)} ${year}</h4>
                <button id="mini-next-month" class="btn btn--icon btn--sm" title="Next month">
                    <i class="bi bi-chevron-right"></i>
                </button>
            </div>
            <div class="mini-calendar-grid">
                ${dayNames.map(day => `<div class="mini-calendar-day-header">${day}</div>`).join('')}
        `;
        
        // Calculate previous month and year
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
        }
        
        // Add empty cells for days from previous month
        for (let i = 0; i < firstDay; i++) {
            const day = daysInPrevMonth - firstDay + i + 1;
            const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            html += `
                <div class="mini-calendar-day mini-calendar-day--other-month" data-date="${dateStr}">
                    <span class="mini-calendar-day-number">${day}</span>
                </div>`;
        }
        
   /** Set up event listeners for the calendar
    * 
     */



        
    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const isToday = today.getDate() === day && 
                      today.getMonth() === month && 
                      today.getFullYear() === year;
        const isSelected = this.selectedDate && 
                         this.selectedDate.getDate() === day &&
                         this.selectedDate.getMonth() === month &&
                         this.selectedDate.getFullYear() === year;
        
        const hasTransactions = transactionsByDay[day]?.length > 0;
        const dayClass = [
            'mini-calendar-day',
            isToday ? 'mini-calendar-day--today' : '',
            isSelected ? 'mini-calendar-day--selected' : '',
            hasTransactions ? 'has-transactions' : ''
        ].filter(Boolean).join(' ');
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        html += `
            <div class="${dayClass}" data-date="${dateStr}">
                <span class="mini-calendar-day-number">${day}</span>
                ${hasTransactions ? '<span class="mini-calendar-day-dot"></span>' : ''}
            </div>`;
    }
        
    // Calculate next month and year
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 11) {
        nextMonth = 0;
        nextYear++;
    }
        
    // Add empty cells for days from next month to complete the grid
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const remainingCells = totalCells - (firstDay + daysInMonth);
        
    for (let i = 1; i <= remainingCells; i++) {
        const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        html += `
            <div class="mini-calendar-day mini-calendar-day--other-month" data-date="${dateStr}">
                <span class="mini-calendar-day-number">${i}</span>
            </div>`;
    }
        
    html += '</div>';
    miniCalendarEl.innerHTML = html;
        
    // Add event listeners
    miniCalendarEl.querySelectorAll('.mini-calendar-day').forEach(dayEl => {
        dayEl.addEventListener('click', () => {
            const dateStr = dayEl.dataset.date;
            if (dateStr) {
                const [y, m, d] = dateStr.split('-').map(Number);
                const selectedDate = new Date(y, m - 1, d);
                this.selectDate(selectedDate);
                this.renderCalendar(selectedDate);
            }
        });
    });
        
    document.getElementById('mini-prev-month')?.addEventListener('click', (e) => {
        e.stopPropagation();
        // Navigate to previous month
        const currentDate = new Date(this.selectedDate || new Date());
        currentDate.setMonth(currentDate.getMonth() - 1);
        this.renderCalendar(currentDate);
    });
    
    document.getElementById('mini-next-month')?.addEventListener('click', (e) => {
        e.stopPropagation();
        // Navigate to next month
        const currentDate = new Date(this.selectedDate || new Date());
        currentDate.setMonth(currentDate.getMonth() + 1);
        this.renderCalendar(currentDate);
    });
}

/**
 * Update navigation state
 * @param {string} view - The view to navigate to
 */
updateNavigation(view) {
    const activeNav = document.querySelector(`[data-view="${view}"]`);
    if (activeNav) {
        activeNav.classList.add('nav__link--active');
    }

    // Update views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('view--active');
    });
    
    const activeView = document.getElementById(`${view}-view`);
    if (activeView) {
        activeView.classList.add('view--active');
    }

    // If switching to calendar view, initialize it with today's date
    if (view === 'calendar' && !this.selectedDate) {
        this.selectedDate = new Date();
        this.renderCalendar(this.selectedDate);
    }
    
    // If switching to search view, ensure search UI is properly initialized
    if (view === 'search' && this.searchManager) {
        // Re-bind events in case the search tab was not loaded when the page first loaded
        this.searchManager.bindEvents();
    }
    
    this.currentView = view;
    this.renderCurrentView();
}
    
    async filterTransactions() {
        try {
            const searchTerm = (document.getElementById('transaction-search')?.value || '').toLowerCase();
            const filterValue = document.getElementById('transaction-filter')?.value || '';
            
            // Get all transactions
            const transactions = await this.db.getAllItems('transactions');
            
            // Apply filters
            let filtered = [...transactions];
            
            // Apply search term filter
            if (searchTerm) {
                filtered = filtered.filter(t => 
                    (t.description && t.description.toLowerCase().includes(searchTerm)) ||
                    (t.notes && t.notes.toLowerCase().includes(searchTerm)) ||
                    (t.category && t.category.toLowerCase().includes(searchTerm))
                );
            }
            
            // Apply category filter
            if (filterValue) {
                filtered = filtered.filter(t => t.category === filterValue);
            }
            
            // Sort by date (newest first)
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Update the transactions list
            const transactionsTable = document.getElementById('transactions-table');
            if (transactionsTable) {
                transactionsTable.innerHTML = this.renderTransactionList(filtered);
            }
            
        } catch (error) {
            console.error('Error filtering transactions:', error);
        }
    }
    
    renderTransactionList(transactions = []) {
        if (!transactions || transactions.length === 0) {
            return '<div class="no-transactions">No transactions found</div>';
        }
        
        return `
            <div class="transactions-container">
                <table class="transactions-table">
                    <thead>
                        <tr>
                            <th style="width: 100px;">Date</th>
                            <th>Description</th>
                            <th>Category</th>
                            <th class="amount-col" style="width: 120px;">Amount</th>
                            <th style="width: 180px; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map(transaction => `
                            <tr data-id="${transaction.id}">
                                <td>${new Date(transaction.date).toLocaleDateString()}</td>
                                <td>${this.escapeHtml(transaction.description || '')}</td>
                                <td>${this.escapeHtml(transaction.category || 'Uncategorized')}</td>
                                <td class="amount-col ${transaction.amount < 0 ? 'expense' : 'income'}">
                                    ${transaction.amount < 0 ? '-' : ''}${this.formatCurrency(Math.abs(transaction.amount))}
                                </td>
                                <td class="transaction-actions">
                                    <button class="btn-edit" data-id="${transaction.id}">
                                        Edit
                                    </button>
                                    <button class="btn-delete" data-id="${transaction.id}">
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    async renderBudget() {
        try {
            const budgetEl = document.getElementById('budget');
            if (!budgetEl) return;
            
            // Show loading state
            budgetEl.innerHTML = '<div class="loading">Loading budget...</div>';
            
            // Get all transactions and categories
            const transactions = await this.db.getAllItems('transactions');
            const categories = await this.db.getAllItems('categories');
            
            // Calculate budget summary
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            const monthlyTransactions = transactions.filter(t => {
                const date = new Date(t.date);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            });
            
            // Group by category and calculate totals
            const categoryTotals = {};
            monthlyTransactions.forEach(t => {
                const category = t.category || 'Uncategorized';
                if (!categoryTotals[category]) {
                    categoryTotals[category] = 0;
                }
                categoryTotals[category] += parseFloat(t.amount);
            });
            
            // Render the budget view
            budgetEl.innerHTML = `
                <div class="budget-header">
                    <h2>Budget for ${new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
                </div>
                <div class="budget-summary">
                    ${Object.entries(categoryTotals).map(([category, amount]) => `
                        <div class="budget-category">
                            <div class="category-name">${this.escapeHtml(category)}</div>
                            <div class="category-amount ${amount < 0 ? 'expense' : 'income'}">
                                ${amount < 0 ? '-' : ''}${this.formatCurrency(Math.abs(amount))}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            
        } catch (error) {
            console.error('Error rendering budget:', error);
            const budgetEl = document.getElementById('budget');
            if (budgetEl) {
                budgetEl.innerHTML = `
                    <div class="error">
                        Error loading budget: ${error.message}
                    </div>
                `;
            }
        }
    }
    
    async renderCurrentView() {
        try {
            if (!this.dbInitialized) {
                console.log('Waiting for database to initialize...');
                setTimeout(() => this.renderCurrentView(), 100);
                return;
            }

            switch (this.currentView) {
                case 'dashboard':
                    await this.renderDashboard();
                    break;
                case 'transactions':
                    await this.renderTransactions();
                    break;
                case 'budget':  // Note: This is a typo, should be 'budget' to match the view ID
                case 'budget':  // This is the spelling used in the view, keeping both for backward compatibility
                    await this.renderBudget();
                    break;
                case 'reports':
                    await this.renderReports();
                    break;
                case 'settings':
                    await this.renderSettings();
                    break;
                case 'search':
                    await this.renderSearch();
                    break;
                default:
                    await this.renderDashboard();
            }
        } catch (error) {
            console.error('Error in renderCurrentView:', error);
            // Show error to user
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                mainContent.innerHTML = `
                    <div class="alert alert-danger">
                        <h4>Error loading view</h4>
                        <p>${this.escapeHtml(error.message)}</p>
                    </div>
                `;
            }
        }
    }

    // Detect bank format from CSV headers
    detectBankFormat(headers) {
        if (!headers || !headers.length) return null;
        
        const headerLine = headers.join(',').toLowerCase();
        
        for (const [key, format] of Object.entries(BudgetApp.BANK_FORMATS)) {
            const requiredFields = [format.date, format.description, format.amount]
                .filter(Boolean)
                .map(f => f.toLowerCase());
                
            if (requiredFields.every(field => headerLine.includes(field))) {
                console.log(`Detected ${format.name} format`);
                return format;
            }
        }
        
        return null;
    }

    // Handle file selection
    handleCSVFile(e) {
        const file = e.target.files[0];
        if (file) {
            this.processCSVFile(file);
        }
    }

    // Process CSV file and extract transactions
    processCSVFile(file) {
        if (!file) return Promise.reject(new Error('No file provided'));
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const allLines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
                    
                    if (allLines.length < 2) {
                        throw new Error('CSV file is empty or has no data rows');
                    }
                    
                    // Parse header row to detect column indices
                    const headers = this.parseCSVLine(allLines[0]);
                    const bankFormat = this.detectBankFormat(headers);
                    let skipLines = 0;
                    let columnIndices = {
                        date: -1,
                        description: -1,
                        amount: -1,
                        category: -1,
                        account: -1,
                        notes: -1,
                        type: -1,
                        credit: -1
                    };
                    
                    // If bank format detected, use its column mapping
                    if (bankFormat) {
                        skipLines = bankFormat.skipLines || 0;
                        columnIndices = {
                            date: headers.findIndex(h => h.toLowerCase() === bankFormat.date.toLowerCase()),
                            description: headers.findIndex(h => h.toLowerCase() === bankFormat.description.toLowerCase()),
                            amount: headers.findIndex(h => h.toLowerCase() === bankFormat.amount.toLowerCase()),
                            type: bankFormat.type ? 
                                headers.findIndex(h => h.toLowerCase() === bankFormat.type.toLowerCase()) : -1,
                            credit: bankFormat.credit ? 
                                headers.findIndex(h => h.toLowerCase() === bankFormat.credit.toLowerCase()) : -1,
                            category: -1,
                            account: -1,
                            notes: -1
                        };
                        
                        console.log(`Using ${bankFormat.name} format with column mapping:`, columnIndices);
                    } else {
                        // Default column mapping (try to auto-detect)
                        headers.forEach((header, index) => {
                            const lowerHeader = header.toLowerCase();
                            if (lowerHeader.includes('date')) {
                                columnIndices.date = index;
                            } else if (lowerHeader.includes('desc') || lowerHeader.includes('memo') || lowerHeader.includes('note')) {
                                columnIndices.description = index;
                            } else if (lowerHeader.includes('amount') || lowerHeader.includes('value') || lowerHeader.includes('total')) {
                                columnIndices.amount = index;
                            } else if (lowerHeader.includes('type') || lowerHeader.includes('transaction type')) {
                                columnIndices.type = index;
                            } else if (lowerHeader.includes('category') || lowerHeader.includes('cat')) {
                                columnIndices.category = index;
                            } else if (lowerHeader.includes('account') || lowerHeader.includes('bank') || lowerHeader.includes('source')) {
                                columnIndices.account = index;
                            }
                        });
                    }
                    
                    console.log('Detected column indices:', columnIndices);
                    
                    // Process data rows
                    const transactions = [];
                    const skippedRows = [];
                    
                    for (let i = 1; i < allLines.length; i++) {
                        try {
                            const values = this.parseCSVLine(allLines[i]);
                            if (values.length === 0) continue;
                            
                            // Parse date with fallback to today
                            let transactionDate;
                            if (columnIndices.date >= 0 && values[columnIndices.date]) {
                                transactionDate = this.parseDate(values[columnIndices.date]);
                                if (!transactionDate || isNaN(new Date(transactionDate).getTime())) {
                                    console.warn(`Invalid date '${values[columnIndices.date]}' in row ${i + 1}, using today's date`);
                                    transactionDate = new Date().toISOString().split('T')[0];
                                }
                            } else {
                                console.warn(`No date column found in row ${i + 1}, using today's date`);
                                transactionDate = new Date().toISOString().split('T')[0];
                            }
                            
                            // Parse amount with validation
                            let amount = 0;
                            
                            if (columnIndices.amount >= 0 && values[columnIndices.amount]) {
                                // Clean and parse the amount
                                const amountStr = values[columnIndices.amount].toString().replace(/[^0-9.-]/g, '');
                                amount = parseFloat(amountStr) || 0;
                                
                                // Determine if this is a credit or debit
                                if (columnIndices.type >= 0 && values[columnIndices.type]) {
                                    const typeValue = (values[columnIndices.type] || '').toString().toLowerCase().trim();
                                    const isCredit = ['credit', 'deposit', 'income', 'payment', 'refund', 'cr'].some(term => 
                                        typeValue.includes(term)
                                    );
                                    
                                    // If type is 'debit' or similar, ensure amount is negative
                                    if (!isCredit && ['debit', 'withdrawal', 'purchase', 'dr'].some(term => 
                                        typeValue.includes(term)
                                    )) {
                                        amount = -Math.abs(amount);
                                    }
                                }
                                
                                // If amount is 0, skip this row
                                if (amount === 0) {
                                    console.warn(`Skipping row ${i + 1}: Amount is 0`);
                                    skippedRows.push({ line: i + 1, reason: 'Zero amount' });
                                    continue;
                                }
                                
                                // Create transaction object
                                const transaction = {
                                    id: `import-${Date.now()}-${i}`,
                                    date: transactionDate,
                                    description: columnIndices.description >= 0 && values[columnIndices.description] 
                                        ? values[columnIndices.description].trim() 
                                        : 'Imported Transaction',
                                    amount: amount,
                                    category: columnIndices.category >= 0 && values[columnIndices.category] 
                                        ? values[columnIndices.category].trim() 
                                        : 'Uncategorized',
                                    account: columnIndices.account >= 0 && values[columnIndices.account] 
                                        ? values[columnIndices.account].trim() 
                                        : 'Imported',
                                    type: amount >= 0 ? 'credit' : 'debit',
                                    status: 'cleared',
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    imported: true,
                                    originalRow: values.join(',')
                                };
                                
                                transactions.push(transaction);
                            } else {
                                console.warn(`Skipping row ${i + 1}: No amount found`);
                                skippedRows.push({ line: i + 1, reason: 'No amount found' });
                            }
                            
                        } catch (error) {
                            console.error(`Error processing row ${i + 1}:`, error);
                            skippedRows.push({ line: i + 1, reason: error.message || 'Error processing row' });
                        }
                    }
                    
                    // Show preview of transactions
                    this.showCSVPreview(transactions, skippedRows);
                    
                    // Store transactions for confirmation
                    this.pendingImport = transactions;
                    
                    // Show success message
                    alert(`Successfully parsed ${transactions.length} transactions. ${skippedRows.length} rows were skipped.`);
                    resolve(transactions);
                } catch (error) {
                    console.error('Error processing CSV file:', error);
                    alert(`Error processing CSV file: ${error.message}`);
                    // Reset the file input
                    const fileInput = document.getElementById('csv-file');
                    if (fileInput) fileInput.value = '';
                    reject(error);
                }
            });
        } catch (error) {
            console.error('Error setting up CSV file processing:', error);
            reject(error);
        }
    };

});

            
            // Handle auto format detection
            if (format === 'auto') {
                const formats = [
                    /^\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\s+(\d{1,2})\s+(\d{4})$/i,
                    /^(\d{4})-(\d{2})-(\d{2})$/,
                    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
                    /^(\d{1,2})-(\d{1,2})-(\d{2})$/
                ];
                
                for (const format of formats) {
                    const match = dateStr.match(format);
                    if (match) {
                        let year, month, day;
                        
                        // Handle month names
                        if (match[1].length > 2) {
                            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
                            const monthIndex = monthNames.findIndex(
                                m => m.startsWith(match[1].toLowerCase().substring(0, 3))
                            );
                            if (monthIndex === -1) continue;
                            
                            month = monthIndex + 1;
                            day = parseInt(match[2], 10);
                            year = parseInt(match[3], 10);
                        } else {
                            // Handle numeric formats
                            if (match[1].length === 4) { // YYYY-MM-DD
                                year = parseInt(match[1], 10);
                                month = parseInt(match[2], 10);
                                day = parseInt(match[3], 10);
                            } else if (match[3].length === 4) { // DD-MM-YYYY or MM-DD-YYYY
                                // Try to determine if it's DD-MM-YYYY or MM-DD-YYYY
                                const first = parseInt(match[1], 10);
                                const second = parseInt(match[2], 10);
                                
                                if (first > 12) {
                                    // Must be DD-MM-YYYY
                                    day = first;
                                    month = second;
                                } else if (second > 12) {
                                    // Must be MM-DD-YYYY
                                    month = first;
                                    day = second;
                                } else {
                                    // Ambiguous, default to DD-MM-YYYY
                                    day = first;
                                    month = second;
                                }
                                year = parseInt(match[3], 10);
                            } else {
                                // Default to MM-DD-YY
                                month = parseInt(match[1], 10);
                                day = parseInt(match[2], 10);
                                year = 2000 + parseInt(match[3], 10);
                            }
                        }
                        
                        // Handle two-digit years
                        if (year < 100) {
                            year = 2000 + year;
                        }
                        
                        // Create date object
                        const parsedDate = new Date(year, month - 1, day);
                        if (!isNaN(parsedDate.getTime())) {
                            return parsedDate.toISOString().split('T')[0];
                        }
                    }
                }
            }
            
            // If we get here, return today's date as fallback
            console.warn(`Could not parse date: ${dateStr}, using today's date`);
            return new Date().toISOString().split('T')[0];
        } catch (error) {
            console.error('Error parsing date:', error);
            return new Date().toISOString().split('T')[0];
        }
    };

    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} unsafe - The string to escape
     * @returns {string} Escaped string
     */
    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    /**
     * Parse CSV line with proper handling of quoted fields and escaped quotes
     * @param {string} line - The CSV line to parse
     * @returns {Array} Array of parsed fields
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        let escapeNext = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (escapeNext) {
                current += char;
                escapeNext = false;
                continue;
            }
            
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    // Handle escaped quote inside quotes
                    current += '"';
                    i++; // Skip the next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of field
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        // Add the last field
        result.push(current);
        
        // Trim whitespace and remove surrounding quotes
        return result.map(field => {
            field = field.trim();
            if (field.startsWith('"') && field.endsWith('"')) {
                field = field.substring(1, field.length - 1);
            }
            return field.replace(/"/g, '"'); // Replace double quotes with single
        });
    }
    
    /**
     * Parse a date string into YYYY-MM-DD format
     * @param {string} dateStr - The date string to parse
     * @param {string} [format='auto'] - Optional format hint (e.g., 'MM/DD/YYYY', 'DD-MM-YYYY')
     * @returns {string} Formatted date string (YYYY-MM-DD)
     */
    parseDate(dateStr, format = 'auto') {
        try {
            if (!dateStr) return new Date().toISOString().split('T')[0];
            
            // Try parsing with Date object first (handles ISO 8601 and other standard formats)
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
            
            // Try common date formats
            const formats = [
                // MM/DD/YYYY or M/D/YYYY
                /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/,
                // YYYY-MM-DD
                /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
                // DD-MM-YYYY
                /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
                // Month DD, YYYY (e.g., Jan 5, 2023)
                /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{4})$/i
            ];
            
            for (const pattern of formats) {
                const match = dateStr.match(pattern);
                if (!match) continue;
                
                let day, month, year;
                
                // Handle different format patterns
                if (pattern === formats[0]) { // MM/DD/YYYY or M/D/YYYY
                    if (format === 'DD-MM-YYYY' || format === 'DD/MM/YYYY') {
                        day = parseInt(match[1], 10);
                        month = parseInt(match[2], 10);
                    } else {
                        month = parseInt(match[1], 10);
                        day = parseInt(match[2], 10);
                    }
                    year = parseInt(match[3], 10);
                } else if (pattern === formats[1]) { // YYYY-MM-DD
                    year = parseInt(match[1], 10);
                    month = parseInt(match[2], 10);
                    day = parseInt(match[3], 10);
                } else if (pattern === formats[2]) { // DD-MM-YYYY
                    day = parseInt(match[1], 10);
                    month = parseInt(match[2], 10);
                    year = parseInt(match[3], 10);
                } else if (pattern === formats[3]) { // Month DD, YYYY
                    const monthNames = [
                        "january", "february", "march", "april", "may", "june",
                        "july", "august", "september", "october", "november", "december"
                    ];
                    const monthIndex = monthNames.findIndex(
                        m => m.toLowerCase().startsWith(match[1].toLowerCase().substring(0, 3))
                    );
                    if (monthIndex === -1) continue;
                    
                    month = monthIndex + 1;
                    day = parseInt(match[2], 10);
                    year = parseInt(match[3], 10);
                }
                
                // Handle two-digit years
                if (year < 100) {
                    year = 2000 + year;
                }
                
                // Create date object
                const parsedDate = new Date(year, month - 1, day);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate.toISOString().split('T')[0];
                }
            }
            
            // If we get here, return today's date as fallback
            console.warn(`Could not parse date: ${dateStr}, using today's date`);
            return new Date().toISOString().split('T')[0];
        } catch (error) {
            console.error('Error parsing date:', error);
            return new Date().toISOString().split('T')[0];
        }
    };
                const monthName = match[1].toLowerCase();
                month = monthNames.findIndex(m => monthName.startsWith(m.toLowerCase())) + 1;
                if (month === 0) continue; // Month not found
                day = parseInt(match[2], 10);
                year = parseInt(match[3], 10);
            }
            
            // Handle two-digit years
            if (year < 100) {
                year = 2000 + year;
            }
            
            // Validate date components
            if (month < 1 || month > 12) continue;
            if (day < 1 || day > 31) continue;
            
            // Create date object (months are 0-indexed in JavaScript)
            const parsedDate = new Date(year, month - 1, day);
            if (!isNaN(parsedDate.getTime())) {
                return parsedDate.toISOString().split('T')[0];
            }
        }
        
        // If we get here, return today's date as fallback
        console.warn(`Could not parse date: ${dateStr}, using today's date`);
        return new Date().toISOString().split('T')[0];
    }
    
    /**
     * Parse an amount string into a number
     * @param {string} amountStr - The amount string to parse
     * @param {string} [format='auto'] - Optional format hint (e.g., 'US', 'EU')
     * @returns {number} Parsed amount as a number
     */
    parseAmount(amountStr, format = 'auto') {
        if (typeof amountStr === 'number') return amountStr;
        if (!amountStr || !amountStr.toString().trim()) return 0;
        
        // Clean the string
        let cleanStr = amountStr.toString().trim();
        
        // Check if the amount is in parentheses (common accounting format for negatives)
        const isNegative = cleanStr.startsWith('(') && cleanStr.endsWith(')');
        if (isNegative) {
            cleanStr = cleanStr.substring(1, cleanStr.length - 1);
        }
        
        // Remove all non-numeric characters except decimal point and minus sign
        cleanStr = cleanStr.replace(/[^0-9.-]/g, '');
        
        // Handle cases where there are multiple decimal points
        const decimalPoints = cleanStr.split('.').length - 1;
        if (decimalPoints > 1) {
            // If there are multiple decimal points, keep only the first one
            const parts = cleanStr.split('.');
            cleanStr = parts[0] + '.' + parts.slice(1).join('');
        }
        
        // Parse the number
        let amount = parseFloat(cleanStr) || 0;
        
        // Apply negative if needed
        if (isNegative || amountStr.startsWith('-')) {
            amount = -Math.abs(amount);
        }
        
        // Round to 2 decimal places to avoid floating point issues
        return Math.round(amount * 100) / 100;
    }
    
    /**
     * Export skipped rows to a CSV file
     * @param {Array} skippedRows - Array of skipped rows with errors
     */
    exportSkippedRows(skippedRows) {
        if (!skippedRows || skippedRows.length === 0) {
            this.showToast('info', 'No Errors', 'There are no errors to export.');
            return;
        }
        
        try {
            // Create CSV header
            let csvContent = 'Row,Error,Data\n';
            
            // Add each skipped row
            skippedRows.forEach(row => {
                const rowData = row.data ? 
                    (Array.isArray(row.data) ? `"${row.data.join(',')}"` : `"${String(row.data).replace(/"/g, '""')}"`) : 
                    '""';
                
                csvContent += `"${row.row || ''}",`;
                csvContent += `"${(row.reason || 'Unknown error').replace(/"/g, '""')}",`;
                csvContent += `${rowData}\n`;
            });
            
            // Create download link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `import_errors_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';
            
            // Add to document, trigger download, and clean up
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showToast('success', 'Export Complete', `Exported ${skippedRows.length} errors to CSV.`);
            
        } catch (error) {
            console.error('Error exporting skipped rows:', error);
            this.showToast('error', 'Export Failed', 'Failed to export error log. Check console for details.');
        }
    }
    
    /**
     * Show a preview of the parsed CSV data before import
     * @param {Array} transactions - Array of transaction objects
     * @param {Array} skippedRows - Array of skipped rows with reasons
     */
    showCSVPreview(transactions = [], skippedRows = []) {
        const preview = document.getElementById('csv-preview');
        const confirmBtn = document.getElementById('import-csv-confirm');
        const cancelBtn = document.getElementById('cancel-csv');
        
        if (!preview || !confirmBtn || !cancelBtn) {
            console.error('Required preview elements not found');
            return;
        }
        
        try {
            if (transactions.length === 0) {
                preview.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        No valid transactions found to import.
                    </div>`;
                preview.classList.remove('hidden');
                confirmBtn.classList.add('hidden');
                return;
            }
            
            // Calculate summary stats
            const totalAmount = transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
            const incomeCount = transactions.filter(t => (parseFloat(t.amount) || 0) >= 0).length;
            const expenseCount = transactions.length - incomeCount;
            const categories = [...new Set(transactions.map(t => t.category || 'Uncategorized'))];
            
            // Build preview HTML
            let html = `
                <div class="preview-header">
                    <h4>Preview Import</h4>
                    <div class="preview-stats">
                        ${transactions.length} transactions • ${this.formatCurrency(totalAmount)}
                    </div>
                </div>
                <div class="preview-content">
                    <div class="preview-summary">
                        <div class="summary-item">
                            <span class="summary-label">Total Amount:</span>
                            <span class="summary-value ${totalAmount >= 0 ? 'text-success' : 'text-danger'}">
                                ${this.formatCurrency(totalAmount)}
                            </span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Income:</span>
                            <span class="summary-value text-success">
                                ${incomeCount} (${this.formatCurrency(
                                    transactions
                                        .filter(t => (parseFloat(t.amount) || 0) >= 0)
                                        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
                                )})
                            </span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Expenses:</span>
                            <span class="summary-value text-danger">
                                ${expenseCount} (${this.formatCurrency(
                                    Math.abs(transactions
                                        .filter(t => (parseFloat(t.amount) || 0) < 0)
                                        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
                                    ))
                                }) 
                            </span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Categories:</span>
                            <span class="summary-value">
                                ${categories.length}
                                <span class="text-muted">${categories.length > 5 ? ' (first 5 shown)' : ''}</span>
                            </span>
                        </div>
                        <div class="categories-preview">
                            ${categories.slice(0, 5).map(cat => 
                                `<span class="category-tag">${cat}</span>`
                            ).join('')}
                        </div>
                    </div>
                    
                    <div class="table-responsive">
                        <table class="preview-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th class="text-end">Amount</th>
                                    <th>Category</th>
                                </tr>
                            </thead>
                            <tbody>`;
            
            // Add up to 10 sample rows
            const sampleSize = Math.min(transactions.length, 10);
            
            for (let i = 0; i < sampleSize; i++) {
                const t = transactions[i];
                const amount = parseFloat(t.amount) || 0;
                
                html += `
                    <tr>
                        <td>${this.formatDate(t.date)}</td>
                        <td class="description-cell" title="${this.escapeHtml(t.description || '')}">
                            <div class="description-text">
                                ${this.escapeHtml((t.description || '').substring(0, 40))}
                                ${(t.description || '').length > 40 ? '...' : ''}
                            </div>
                        </td>
                        <td class="text-end ${amount >= 0 ? 'text-success' : 'text-danger'}">
                            ${this.formatCurrency(amount)}
                        </td>
                        <td>${this.escapeHtml(t.category || 'Uncategorized')}</td>
                    </tr>`;
            }
            
            // Add summary row
            html += `
                            </tbody>
                            <tfoot>
                                <tr class="summary-row">
                                    <td colspan="4" class="text-end">
                                        Showing ${sampleSize} of ${transactions.length} transactions
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>`;
            
            // Add skipped rows info if any
            if (skippedRows && skippedRows.length > 0) {
                const errorCount = skippedRows.length;
                const errorSample = skippedRows.slice(0, 5);
                
                html += `
                    <div class="skipped-rows">
                        <div class="skipped-header">
                            <i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                            <span>${errorCount} row${errorCount > 1 ? 's were' : ' was'} skipped due to errors</span>
                        </div>`;
                
                if (errorSample.length > 0) {
                    html += `
                        <div class="skipped-list">
                            <table class="skipped-table">
                                <thead>
                                    <tr>
                                        <th>Row</th>
                                        <th>Error</th>
                                        <th>Data</th>
                                    </tr>
                                </thead>
                                <tbody>`;
                    
                    errorSample.forEach((row, index) => {
                        const rowData = row.data ? 
                            (Array.isArray(row.data) ? row.data.join(', ') : String(row.data)) : 
                            'No data';
                        
                        html += `
                            <tr>
                                <td>${row.row || (index + 1)}</td>
                                <td>${this.escapeHtml(row.reason || 'Unknown error')}</td>
                                <td class="skipped-data" title="${this.escapeHtml(rowData)}">
                                    ${this.escapeHtml(rowData.length > 50 ? rowData.substring(0, 50) + '...' : rowData)}
                                </td>
                            </tr>`;
                    });
                    
                    if (errorCount > 5) {
                        html += `
                            <tr>
                                <td colspan="3" class="text-center text-muted">
                                    ... and ${errorCount - 5} more errors not shown
                                </td>
                            </tr>`;
                    }
                    
                    html += `
                                </tbody>
                            </table>
                        </div>`;
                }
                
                html += `
                        <div class="skipped-actions">
                            <button class="btn btn-sm btn-outline-secondary" id="export-errors-btn">
                                <i class="bi bi-download me-1"></i> Export Errors
                            </button>
                        </div>
                    </div>`;
            }
            
            html += `
                </div>`; // Close preview-content
            
            // Set the HTML and show the preview
            preview.innerHTML = html;
            preview.classList.remove('hidden');
            confirmBtn.classList.remove('hidden');
            
            // Add event listeners for the export errors button
            const exportBtn = document.getElementById('export-errors-btn');
            if (exportBtn && skippedRows.length > 0) {
                exportBtn.addEventListener('click', () => this.exportSkippedRows(skippedRows));
            }
            
            // Scroll to preview
            preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
        } catch (error) {
            console.error('Error generating preview:', error);
            
            const errorHtml = `
                <div class="alert alert-danger">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        <div>
                            <strong>Error generating preview</strong>
                            <div class="small">${this.escapeHtml(error.message || 'Unknown error')}</div>
                        </div>
                    </div>
                </div>`;
                
            if (preview) {
                preview.innerHTML = errorHtml;
                preview.classList.remove('hidden');
            } else {
                // If preview element doesn't exist, show an alert
                alert(`Error generating preview: ${error.message}`);
            }
            
            // Hide confirm button on error
            if (confirmBtn) {
        
        // Clear any transaction ID from the form (in case it was in edit mode)
        if (form.dataset.transactionId) {
            delete form.dataset.transactionId;
        try {
            const results = {
                success: 0,
                skipped: 0,
                failed: 0,
                errors: []
            };
            
            // Add transactions to database
            for (const [index, transaction] of this.pendingImport.entries()) {
                try {
                    console.log(`Importing transaction ${index + 1}/${this.pendingImport.length}:`, transaction);
                    const success = await this.addTransaction(transaction);
                    if (success === true) {
                        results.success++;
                    } else if (success === false) {
                        // This is a duplicate that was skipped
                        results.skipped++;
                        results.errors.push(`Skipped duplicate transaction: ${transaction.description} (${transaction.date} - ${transaction.amount})`);
                    } else {
                        // This is an actual failure
                        results.failed++;
                        results.errors.push(`Failed to import transaction: ${JSON.stringify(transaction)}`);
                    }
                } catch (error) {
                    console.error(`Error importing transaction ${index + 1}:`, error);
                    results.failed++;
                    results.errors.push(`Error importing transaction: ${error.message}`);
                }
            }
            
            console.log('Import results:', results);
            
            // Reset form and show success
            this.resetForms();
            
            // Build result message
            let resultMessage = [];
            if (results.success > 0) {
                resultMessage.push(`✅ Successfully imported ${results.success} transactions`);
            }
            if (results.skipped > 0) {
                resultMessage.push(`⏭️ Skipped ${results.skipped} duplicate transactions`);
            }
            if (results.failed > 0) {
                resultMessage.push(`❌ Failed to import ${results.failed} transactions`);
            }
            
            // Show results to user
            if (resultMessage.length > 0) {
                alert(resultMessage.join('\n\n'));
            } else {
                alert('No transactions were processed. Please check your file and try again.');
            }
            
            // Log any errors
            if (results.errors.length > 0) {
                console.error('Import results:', results.errors);
            }
            
            // Update UI
            this.renderCurrentView();
            
        } catch (error) {
            const errorMsg = `Error during import: ${error.message}`;
            console.error(errorMsg, error);
            alert(errorMsg);
        } finally {
            this.pendingImport = [];
        }
    };

    /**
     * Shows the transaction modal for adding a new transaction
     */
    showTransactionModal() {
        const form = document.getElementById('transaction-form');
        if (form) {
            // Reset the form
            form.reset();
            
            // Clear any transaction ID from the form (in case it was in edit mode)
            if (form.dataset.transactionId) {
                delete form.dataset.transactionId;
            }
            
            // Set default date to today
            const today = new Date().toISOString().split('T')[0];
            const dateInput = form.querySelector('[name="date"]');
            if (dateInput) {
                dateInput.value = today;
            }
            
            // Update modal title
            const modalTitle = document.querySelector('#add-transaction-modal .modal-title');
            if (modalTitle) {
                modalTitle.textContent = 'Add Transaction';
            }
            
            // Show the modal
            this.showModal('add-transaction-modal');
        } else {
            console.error('Transaction form not found');
        }
    }
    
    // Reset all forms
    resetForms() {
        const form = document.getElementById('transaction-form');
        if (form) {
            form.reset();
            form.dataset.transactionId = '';
            const modalTitle = document.querySelector('#add-transaction-modal .modal-title');
            if (modalTitle) {
                modalTitle.textContent = 'Add Transaction';
            }
        }
        document.getElementById('category-form')?.reset();
        document.getElementById('csv-preview').innerHTML = '';
        document.getElementById('csv-preview').classList.add('hidden');
        document.getElementById('import-csv-confirm').classList.add('hidden');
        document.getElementById('csv-import-modal').classList.remove('modal--active');
        document.body.classList.remove('modal-open');
    }

    renderSearch() {
        console.log('Rendering search view');
        try {
            // Ensure search manager is initialized
            if (!this.searchManager) {
                console.log('Initializing new SearchManager');
                this.searchManager = new SearchManager(this);
            } else {
                console.log('Using existing SearchManager instance');
            }
            
            const resultsBody = document.getElementById('search-results-body');
            const insights = document.getElementById('search-insights');
            
            if (resultsBody) {
                resultsBody.innerHTML = '<tr><td colspan="5" class="text-center">Enter a search term to find transactions</td></tr>';
            }
            
            if (insights) {
                insights.innerHTML = '';
            }
            
            // Clear any existing charts
            if (this.charts.searchTrend) {
                this.charts.searchTrend.destroy();
                delete this.charts.searchTrend;
            }
            
            if (this.charts.searchCategory) {
                this.charts.searchCategory.destroy();
                delete this.charts.searchCategory;
            }
        } catch (error) {
            console.error('Error in renderSearch:', error);
        }
    }

    formatCurrency(amount) {
        if (typeof amount !== 'number') return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    parseCurrency(currencyString) {
        if (!currencyString) return 0;
        // Remove any non-numeric characters except decimal point and minus sign
        const numberString = currencyString.replace(/[^0-9.-]+/g, "");
        return parseFloat(numberString) || 0;
    };

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateString; // Return original string if date parsing fails
        }
    };
    }

    parseCurrency(currencyString) {
        if (!currencyString) return 0;
        // Remove any non-numeric characters except decimal point and minus sign
        const numberString = currencyString.replace(/[^0-9.-]+/g, "");
        return parseFloat(numberString) || 0;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateString; // Return original string if date parsing fails
        }
    }
    
    /**
     * Show transactions for a specific date
     * @param {Date} date - The date to show transactions for
     */
    showTransactionsForDate(date) {
        const dayTransactions = this.transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate.toDateString() === date.toDateString();
        });
        
        if (dayTransactions.length === 0) {
            this.showToast('info', 'No Transactions', `No transactions found for ${date.toLocaleDateString()}`);
            return;
        }
        
        // Create modal content
        const modalContent = `
            <div class="modal-header">
                <h3>Transactions for ${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                <button class="modal-close" id="close-transaction-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="transaction-list">
                    ${dayTransactions.map(t => `
                        <div class="transaction-item ${t.amount < 0 ? 'expense' : 'income'}">
                            <div class="transaction-main">
                                <div class="transaction-category">${t.category || 'Uncategorized'}</div>
                                <div class="transaction-amount">${this.formatCurrency(t.amount)}</div>
                            </div>
                            ${t.description ? `<div class="transaction-description">${t.description}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Show modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'day-transactions-modal';
        modal.innerHTML = `
            <div class="modal-content">
                ${modalContent}
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add close handler
        modal.querySelector('.modal-close, .modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close') || e.target.classList.contains('modal')) {
                modal.remove();
            }
        });
        
        // Prevent modal from closing when clicking inside content
        modal.querySelector('.modal-content').addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // Render the dashboard view
    async renderDashboard() {
        try {
            // Get the dashboard container
            const dashboardEl = document.querySelector('#dashboard-view .dashboard-grid');
            if (!dashboardEl) {
                console.error('Dashboard element not found');
                return;
            }
            
            // Show loading state
            dashboardEl.innerHTML = '<div class="loading">Loading dashboard data...</div>';
            
            // Get transactions for the current month
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            
            // Get transactions from the database
            let transactions = [];
            try {
                transactions = await this.db.getTransactions({
                    startDate: firstDay,
                    endDate: lastDay
                }) || [];
                console.log(`Loaded ${transactions.length} transactions for dashboard`);
            } catch (error) {
                console.error('Error loading transactions:', error);
                throw new Error('Failed to load transactions');
            }
            
            // Calculate totals
            const totals = transactions.reduce((acc, t) => {
                const amount = parseFloat(t.amount) || 0;
                if (amount > 0) {
                    acc.income += amount;
                } else {
                    acc.expenses += Math.abs(amount);
                }
                return acc;
            }, { income: 0, expenses: 0 });
            
            // Format currency function
            const formatCurrency = (amount) => {
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2
                }).format(amount);
            };
            
            // Format date function
            const formatDate = (dateString) => {
                if (!dateString) return '';
                const options = { year: 'numeric', month: 'short', day: 'numeric' };
                return new Date(dateString).toLocaleDateString(undefined, options);
            };
            
            // Update the dashboard HTML
            dashboardEl.innerHTML = `
                <div class="dashboard-header">
                    <h2>Dashboard</h2>
                    <button id="refresh-dashboard" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-arrow-clockwise"></i> Refresh
                    </button>
                </div>
                
                <div class="dashboard-summary">
                    <div class="dashboard-card">
                        <h3>Available to Budget</h3>
                        <div class="amount ${totals.income - totals.expenses >= 0 ? 'income' : 'expense'}">
                            ${formatCurrency(totals.income - totals.expenses)}
                        </div>
                        <div class="card-description">Money waiting for assignment</div>
                    </div>
                    
                    <div class="dashboard-card">
                        <h3>Budgeted This Month</h3>
                        <div class="amount">${formatCurrency(totals.expenses)}</div>
                        <div class="card-description">Total assigned to categories</div>
                    </div>
                    
                    <div class="dashboard-card">
                        <h3>Spent This Month</h3>
                        <div class="amount expense">${formatCurrency(totals.expenses)}</div>
                        <div class="card-description">Total expenses</div>
                    </div>
                    
                    <div class="dashboard-card">
                        <h3>Monthly Income</h3>
                        <div class="amount income">${formatCurrency(totals.income)}</div>
                        <div class="card-description">Total income this month</div>
                    </div>
                </div>
                
                <div class="dashboard-charts">
                    <div class="chart-container">
                        <h3>Spending Trend</h3>
                        <canvas id="monthly-trend-chart"></canvas>
                    </div>
                    <div class="chart-container">
                        <h3>Category Breakdown</h3>
                        <canvas id="category-breakdown-chart"></canvas>
                    </div>
                </div>
                
                <div class="recent-transactions">
                    <div class="section-header">
                        <h3>Recent Transactions</h3>
                        <a href="#transactions" class="view-all">View All</a>
                    </div>
                    <div class="transaction-list">
                        ${transactions.length > 0 ? 
                            transactions.slice(0, 5).map(t => `
                                <div class="transaction-item ${t.amount < 0 ? 'expense' : 'income'}">
                                    <div class="transaction-main">
                                        <div class="transaction-category">${t.category || 'Uncategorized'}</div>
                                        <div class="transaction-description">${t.description || 'No description'}</div>
                                        <div class="transaction-amount">${formatCurrency(t.amount)}</div>
                                    </div>
                                    <div class="transaction-footer">
                                        <div class="transaction-date">${formatDate(t.date)}</div>
                                        <div class="transaction-actions">
                                            <button class="btn-icon" data-id="${t.id}" data-action="edit">
                                                <i class="bi bi-pencil"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('') : 
                            '<div class="no-transactions">No transactions found. Add your first transaction to get started!</div>'
                        }
                    </div>
                </div>`;
            
            // Initialize charts if we have data
            if (transactions.length > 0) {
                try {
                    await this.initializeDashboardCharts(transactions);
                } catch (error) {
                    console.error('Error initializing charts:', error);
                }
            }
            
            // Add event listeners
            this.setupDashboardEventListeners();
            
        } catch (error) {
            console.error('Error rendering dashboard:', error);
            const errorMessage = error.message || 'Failed to load dashboard data';
            dashboardEl.innerHTML = `
                <div class="alert alert-danger">
                    <h3>Error Loading Dashboard</h3>
                    <p>${errorMessage}</p>
                    <button class="btn btn-primary mt-2" onclick="window.location.reload()">
                        Try Again
                    </button>
                </div>`;
        }
    }
    
    // Set up event listeners for dashboard elements
    setupDashboardEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-dashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.renderDashboard());
        }
        
        // Edit transaction buttons
        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const transactionId = e.currentTarget.getAttribute('data-id');
                if (transactionId) {
                    this.editTransaction(transactionId);
                }
            });
        });
    }
    
    // Update the dashboard with fresh data
    async updateDashboard() {
        await this.renderDashboard();
    }
    
    // Helper method to get category color
    getCategoryColor(categoryName) {
        if (!categoryName || !Array.isArray(this.budgetCategories)) return '#cccccc';
        const category = this.budgetCategories.find(c => c && c.name === categoryName);
        return category && category.color ? category.color : '#cccccc';
    }

    /**
     * Edit a transaction by ID
     * @param {string} id - The ID of the transaction to edit
     */
    async editTransaction(id) {
        try {
            // Ensure transactions are loaded
            await this.loadTransactions();
            
            // Find the transaction
            const transaction = this.transactions.find(t => t.id.toString() === id.toString());
            if (!transaction) {
                console.error('Transaction not found:', id);
                this.showNotification('Transaction not found', 'error');
                return;
            }

            // Pre-fill the form with existing data
            const form = document.getElementById('transaction-form');
            if (form) {
                // Convert the date to YYYY-MM-DD format
                const transactionDate = new Date(transaction.date);
                const formattedDate = transactionDate.toISOString().split('T')[0];
                
                form.querySelector('[name="date"]').value = formattedDate;
                form.querySelector('[name="description"]').value = transaction.description || '';
                form.querySelector('[name="amount"]').value = Math.abs(parseFloat(transaction.amount)) || '';
                form.querySelector('[name="type"]').value = transaction.amount >= 0 ? 'income' : 'expense';
                form.querySelector('[name="category"]').value = transaction.category || '';
                
                // Show the form
                this.showModal('add-transaction-modal');
                
                // Store the transaction ID in the form for updating
                form.dataset.transactionId = id;
                
                // Change the form title to indicate edit mode
                const modalTitle = document.querySelector('#add-transaction-modal .modal-title');
                if (modalTitle) {
                    modalTitle.textContent = 'Edit Transaction';
                }
            }
        } catch (error) {
            console.error('Error editing transaction:', error);
            this.showNotification('Failed to edit transaction: ' + error.message, 'error');
        }
    }

    /**
     * Confirm and delete a transaction
     * @param {string} transactionId - The ID of the transaction to delete
     * @param {Date} currentDate - The current date being viewed (for refreshing the view)
     */
    async confirmAndDeleteTransaction(transactionId, currentDate) {
        try {
            // Ensure transactions are loaded
            await this.loadTransactions();
            
            // Find the transaction to show details in confirmation
            const transaction = this.transactions.find(t => t.id.toString() === transactionId.toString());
            if (!transaction) {
                console.error('Transaction not found:', transactionId);
                console.log('Available transaction IDs:', this.transactions.map(t => t.id));
                this.showNotification('Transaction not found', 'error');
                return;
            }

            // Show confirmation dialog
            const confirmDelete = confirm(`Are you sure you want to delete this transaction?\n\n` +
                `Amount: ${this.formatCurrency(transaction.amount)}\n` +
                `Category: ${transaction.category || 'Uncategorized'}\n` +
                `${transaction.description ? `Description: ${transaction.description}\n` : ''}`);

            if (!confirmDelete) return;

            // Delete from IndexedDB
            await this.db.deleteTransaction(transactionId);
            
            // Update in-memory transactions
            this.transactions = this.transactions.filter(t => t.id.toString() !== transactionId.toString());
            
            // Update UI
            if (currentDate) {
                await this.showTransactionsForDate(currentDate);
                this.renderCalendar(currentDate); // Refresh calendar to update transaction counts
            }
            
            // Show success message
            this.showNotification('Transaction deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting transaction:', error);
            this.showNotification('Failed to delete transaction: ' + error.message, 'error');
        }
    }
    
    /**
     * Handle transaction form submission
     * @param {Event} e - Form submit event
     */
    async handleTransactionSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const transactionData = {
            description: formData.get('description'),
            amount: parseFloat(formData.get('amount')),
            type: formData.get('type'),
            category: formData.get('category'),
            date: formData.get('date'),
            account: formData.get('account'),
            recurring: formData.get('recurring') === 'on',
            notes: formData.get('notes')
        };
        
        try {
            const isEditMode = !!form.dataset.transactionId;
            
            if (isEditMode) {
                // Update existing transaction
                await this.updateTransaction(form.dataset.transactionId, transactionData);
                this.showNotification('Transaction updated successfully', 'success');
            } else {
                // Add new transaction
                await this.addTransaction(transactionData);
                this.showNotification('Transaction added successfully', 'success');
            }
            
            // Reset form and close modal
            this.resetForms();
            this.closeModal('add-transaction-modal');
            
            // Refresh UI
            await this.loadTransactions();
            this.renderCurrentView();
            
            // If in calendar view, update the selected date's transactions
            if (this.currentView === 'calendar') {
                const selectedDate = document.querySelector('.calendar-day.selected');
                if (selectedDate) {
                    const date = new Date(selectedDate.dataset.date);
                    await this.showTransactionsForDate(date);
                }
            }
            
        } catch (error) {
            console.error('Error saving transaction:', error);
            this.showNotification(`Failed to save transaction: ${error.message}`, 'error');
        }
    };
}
    
    /**
     * Show a notification to the user
     * @param {string} message - The message to display
     * @param {string} type - The type of notification (success, error, info)
     */
    /**
     * Shows a notification to the user
     * @param {string} message - The message to display
     * @param {string} type - The type of notification (success, error, info)
     */
    showNotification(message, type = 'info') {
        // Check if notification container exists, create it if not
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.style.position = 'fixed';
            notificationContainer.style.top = '20px';
            notificationContainer.style.right = '20px';
            notificationContainer.style.zIndex = '1000';
            document.body.appendChild(notificationContainer);
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.padding = '10px 15px';
        notification.style.marginBottom = '10px';
        notification.style.borderRadius = '4px';
        notification.style.color = 'white';
        notification.style.backgroundColor = type === 'error' ? '#f44336' : 
                                           type === 'success' ? '#4caf50' : '#2196f3';
        notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        notification.style.transform = 'translateX(120%)';
        notification.style.transition = 'transform 0.3s ease-in-out';
        notification.textContent = message;

        // Add to container
        notificationContainer.appendChild(notification);

        // Trigger animation
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(120%)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    /**
     * Render the current view based on the currentView property
     */
    renderCurrentView() {
        const view = this.currentView;
        
        switch (view) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'budget':
                this.renderBudget();
                break;
            case 'transactions':
                this.renderTransactions();
                break;
            case 'calendar':
                this.renderCalendar();
                break;
            case 'search':
                this.renderSearch();
                break;
            default:
                this.renderDashboard();
        }
    }
}

// Initialize the app when the DOM is fully loaded
// Export the BudgetApp class for use in other modules
export { BudgetApp };

// Initialize the app when the DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new BudgetApp();
    });
} else {
    window.app = new BudgetApp();
}
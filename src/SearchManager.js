import { TransactionGraph } from './TransactionGraph.js';

export class SearchManager {
    constructor(app) {
        this.app = app;
        this.searchResults = [];
        this.searchStats = {
            totalAmount: 0,
            averageAmount: 0,
            minAmount: 0,
            maxAmount: 0,
            transactionCount: 0,
            firstTransactionDate: null,
            lastTransactionDate: null
        };
        this.transactionGraph = null;
        this.trendChart = null;
        this.categoryChart = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('transaction-search');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.performSearch());
        }
        
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performSearch();
            });
        }
        
        const exactMatch = document.getElementById('exact-match');
        const includeNotes = document.getElementById('include-notes');
        const timeRange = document.getElementById('time-range');
        
        if (exactMatch) exactMatch.addEventListener('change', () => this.renderSearchResults());
        if (includeNotes) includeNotes.addEventListener('change', () => this.performSearch());
        if (timeRange) timeRange.addEventListener('change', () => this.performSearch());
    }

    async performSearch() {
        const searchTerm = document.getElementById('transaction-search')?.value.trim();
        const exactMatch = document.getElementById('exact-match')?.checked || false;
        const includeNotes = document.getElementById('include-notes')?.checked || false;
        const timeRange = document.getElementById('time-range')?.value || 'all';
        
        try {
            // Show loading state
            const searchBtn = document.getElementById('search-btn');
            if (searchBtn) {
                const originalText = searchBtn.textContent;
                searchBtn.disabled = true;
                searchBtn.innerHTML = '<span class="spinner"></span> Searching...';

                try {
                    // Get transactions from the database
                    const allTransactions = await this.app.db.getAllItems('transactions');
                    
                    // Filter transactions based on search criteria
                    this.searchResults = allTransactions.filter(transaction => {
                        // Filter by search term if provided
                        if (searchTerm) {
                            const searchFields = [
                                transaction.description,
                                transaction.merchant,
                                transaction.category,
                                transaction.amount?.toString(),
                                transaction.account
                            ];
                            
                            if (includeNotes && transaction.notes) {
                                searchFields.push(transaction.notes);
                            }
                            
                            const searchText = searchFields.join(' ').toLowerCase();
                            const searchTermLower = searchTerm.toLowerCase();
                            
                            const matchesSearch = exactMatch 
                                ? searchText === searchTermLower
                                : searchText.includes(searchTermLower);
                                
                            if (!matchesSearch) return false;
                        }
                        
                        // Filter by time range if needed
                        if (timeRange !== 'all' && transaction.date) {
                            const transactionDate = new Date(transaction.date);
                            const now = new Date();
                            let startDate;
                            
                            switch(timeRange) {
                                case 'year':
                                    startDate = new Date(now.getFullYear(), 0, 1);
                                    break;
                                case '6months':
                                    startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
                                    break;
                                case 'month':
                                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                                    break;
                                case 'week':
                                    startDate = new Date(now);
                                    startDate.setDate(now.getDate() - now.getDay());
                                    break;
                                default:
                                    return true;
                            }
                            
                            if (transactionDate < startDate) return false;
                        }
                        
                        return true;
                    });
                    
                    // Calculate and update search statistics
                    this.calculateSearchStats();
                    
                    // Update the UI with search results
                    this.renderSearchResults();
                    
                } finally {
                    // Restore search button state
                    if (searchBtn) {
                        searchBtn.disabled = false;
                        searchBtn.textContent = 'Search';
                    }
                }
            }
        } catch (error) {
            console.error('Error performing search:', error);
            this.showError('An error occurred while performing the search. Please try again.');
        }
    }
    
    calculateSearchStats() {
        if (this.searchResults.length === 0) {
            this.searchStats = {
                totalAmount: 0,
                averageAmount: 0,
                minAmount: 0,
                maxAmount: 0,
                transactionCount: 0,
                firstTransactionDate: null,
                lastTransactionDate: null
            };
            return;
        }
        
        const amounts = [];
        const dates = [];
        
        this.searchResults.forEach(tx => {
            const amount = parseFloat(tx.amount) || 0;
            amounts.push(amount);
            
            if (tx.date) {
                const date = new Date(tx.date);
                if (!isNaN(date.getTime())) {
                    dates.push(date.getTime());
                }
            }
        });
        
        this.searchStats = {
            totalAmount: amounts.reduce((sum, amount) => sum + amount, 0),
            averageAmount: amounts.length > 0 ? amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length : 0,
            minAmount: amounts.length > 0 ? Math.min(...amounts) : 0,
            maxAmount: amounts.length > 0 ? Math.max(...amounts) : 0,
            transactionCount: this.searchResults.length,
            firstTransactionDate: dates.length > 0 ? new Date(Math.min(...dates)) : null,
            lastTransactionDate: dates.length > 0 ? new Date(Math.max(...dates)) : null
        };
    }
    
    renderSearchResults() {
        const tbody = document.getElementById('search-results-body');
        const resultCount = document.getElementById('result-count');
        const resultTotal = document.getElementById('result-total');
        const insightsContainer = document.getElementById('search-insights');
        
        if (!tbody || !resultCount || !resultTotal) return;
        
        // Clear previous results
        tbody.innerHTML = '';
        
        if (this.searchResults.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No transactions found</td></tr>';
            
            // Hide graph container if no results
            const graphContainer = document.getElementById('transaction-graph');
            if (graphContainer) {
                graphContainer.style.display = 'none';
            }
            
            return;
        }
        
        // Update result count and total
        resultCount.textContent = this.searchResults.length;
        const totalAmount = this.searchResults.reduce((sum, tx) => {
            const amount = parseFloat(tx.amount) || 0;
            return sum + amount;
        }, 0);
        
        resultTotal.textContent = this.formatCurrency(totalAmount);
        
        // Update insights if container exists
        if (insightsContainer) {
            insightsContainer.innerHTML = `
                <div class="insight">
                    <h5>Search Insights</h5>
                    <p>Found ${this.searchResults.length} transactions totaling ${this.formatCurrency(totalAmount)}</p>
                    ${this.searchStats.firstTransactionDate ? 
                        `<p>Time range: ${this.formatDate(this.searchStats.firstTransactionDate)} to ${this.formatDate(this.searchStats.lastTransactionDate)}` : ''}
                    <p>Average transaction: ${this.formatCurrency(this.searchStats.averageAmount)}</p>
                </div>
            `;
        }
        
        // Add transactions to the table
        this.searchResults.forEach(transaction => {
            const row = document.createElement('tr');
            row.className = 'transaction-row';
            row.setAttribute('data-transaction-id', transaction.id || '');
            
            const amount = parseFloat(transaction.amount) || 0;
            const amountClass = amount < 0 ? 'negative' : 'positive';
            
            row.innerHTML = `
                <td>${this.formatDate(transaction.date)}</td>
                <td>${transaction.description || ''}</td>
                <td>${transaction.category || 'Uncategorized'}</td>
                <td class="amount ${amountClass}">${this.formatCurrency(amount)}</td>
                <td>${transaction.account || ''}</td>
            `;
            
            // Add click handler for transaction selection
            row.addEventListener('click', () => {
                this.highlightTransaction(transaction.id);
            });
            
            tbody.appendChild(row);
        });
        
        // Initialize or update the transaction graph
        this.initTransactionGraph();
    }
    
    initTransactionGraph() {
        if (!this.searchResults || this.searchResults.length === 0) {
            return;
        }
        
        const graphData = {
            transactions: this.searchResults,
            categories: [...new Set(this.searchResults.map(tx => tx.category || 'Uncategorized'))],
            accounts: [...new Set(this.searchResults.map(tx => tx.account || 'Unknown'))]
        };
        
        // Initialize or update the graph
        const graphContainer = document.getElementById('transaction-graph');
        if (graphContainer) {
            graphContainer.style.display = 'block';
            
            if (!this.transactionGraph) {
                this.transactionGraph = new TransactionGraph(graphContainer, graphData);
            } else {
                this.transactionGraph.updateGraph(graphData);
            }
        }
    }
    
    highlightTransaction(transactionId) {
        // Remove highlight from all rows
        document.querySelectorAll('.transaction-row').forEach(row => {
            row.classList.remove('selected');
        });
        
        // Add highlight to selected row
        const selectedRow = document.querySelector(`.transaction-row[data-transaction-id="${transactionId}"]`);
        if (selectedRow) {
            selectedRow.classList.add('selected');
            selectedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        // Highlight corresponding node in the graph if available
        if (this.transactionGraph) {
            this.transactionGraph.highlightNode(transactionId);
        }
    }
    
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
    }
    
    formatCurrency(amount) {
        if (amount === undefined || amount === null) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
    
    showError(message) {
        // Show error message to the user
        const errorContainer = document.getElementById('search-error');
        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            
            // Hide error after 5 seconds
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
        }
    }
}

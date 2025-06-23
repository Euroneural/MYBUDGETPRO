import { localDB } from './local-db.js';

class SearchManager {
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
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('transaction-search');
        
        if (searchBtn) searchBtn.addEventListener('click', () => this.performSearch());
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
        if (!searchTerm) return;

        try {
            // Show loading state
            const searchBtn = document.getElementById('search-btn');
            if (searchBtn) {
                const originalText = searchBtn.textContent;
                searchBtn.disabled = true;
                searchBtn.innerHTML = '<span class="spinner"></span> Searching...';
            }

            // Get search options
            const exactMatch = document.getElementById('exact-match')?.checked || false;
            const includeNotes = document.getElementById('include-notes')?.checked || false;
            const timeRange = document.getElementById('time-range')?.value || 'month';
            
            // Calculate date range
            let startDate, endDate = new Date().toISOString().split('T')[0];
            const today = new Date();
            
            switch(timeRange) {
                case 'month':
                    startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                    break;
                case '6months':
                    startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().split('T')[0];
                    break;
                case 'year':
                    startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
                    break;
                default: // 'all'
                    startDate = '1970-01-01';
            }
            
            // Get transactions from database
            let transactions = await this.app.db.getTransactions({
                startDate,
                endDate
            });
            
            // Filter transactions based on search term
            const searchTerms = searchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
            
            this.searchResults = transactions.filter(transaction => {
                // Build searchable text
                let searchText = [
                    transaction.description?.toLowerCase() || '',
                    transaction.merchant?.toLowerCase() || '',
                    transaction.category?.toLowerCase() || '',
                    transaction.amount?.toString() || '',
                    transaction.type?.toLowerCase() || ''
                ];
                
                if (includeNotes && transaction.notes) {
                    searchText.push(transaction.notes.toLowerCase());
                }
                
                const searchTextStr = searchText.join(' ');
                
                // Apply search logic
                if (exactMatch) {
                    return searchTerms.every(term => searchTextStr.includes(term));
                } else {
                    // Fuzzy match - at least one term matches
                    return searchTerms.some(term => searchTextStr.includes(term));
                }
            });
            
            // Calculate search statistics
            this.calculateSearchStats();
            
            // Render results
            this.renderSearchResults();
            this.renderSearchCharts();
            this.generateSearchInsights();
            
        } catch (error) {
            console.error('Error performing search:', error);
            // Show error to user
            const tbody = document.getElementById('search-results-body');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-error">Error performing search: ${error.message}</td>
                    </tr>`;
            }
        } finally {
            // Reset button state
            const searchBtn = document.getElementById('search-btn');
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.textContent = 'Search';
            }
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
        
        const amounts = this.searchResults.map(t => Math.abs(t.amount));
        const dates = this.searchResults
            .map(t => new Date(t.date))
            .sort((a, b) => a - b);
            
        this.searchStats = {
            totalAmount: amounts.reduce((sum, amount) => sum + amount, 0),
            averageAmount: amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length,
            minAmount: Math.min(...amounts),
            maxAmount: Math.max(...amounts),
            transactionCount: this.searchResults.length,
            firstTransactionDate: dates[0],
            lastTransactionDate: dates[dates.length - 1]
        };
    }
    
    renderSearchResults() {
        const tbody = document.getElementById('search-results-body');
        if (!tbody) return;
        
        if (this.searchResults.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No transactions found matching your search criteria</td>
                </tr>`;
            return;
        }
        
        // Sort by date (newest first)
        const sortedResults = [...this.searchResults].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        // Update result count and total
        const resultCount = document.getElementById('result-count');
        const resultTotal = document.getElementById('result-total');
        
        if (resultCount) resultCount.textContent = this.searchResults.length;
        if (resultTotal) resultTotal.textContent = this.app.formatCurrency(this.searchStats.totalAmount);
        
        // Render transaction rows
        tbody.innerHTML = sortedResults.map(transaction => {
            const date = new Date(transaction.date);
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            const amountClass = transaction.amount >= 0 ? 'text-success' : 'text-error';
            
            return `
                <tr>
                    <td>${formattedDate}</td>
                    <td>${transaction.description || 'No description'}</td>
                    <td>${transaction.category || 'Uncategorized'}</td>
                    <td class="${amountClass}">${this.app.formatCurrency(transaction.amount)}</td>
                    <td>${this.calculateTransactionChange(transaction)}</td>
                </tr>`;
        }).join('');
    }
    
    calculateTransactionChange(transaction) {
        // This is a simplified version - you would want to implement more sophisticated
        // change detection based on similar transactions over time
        return '—'; // Placeholder
    }
    
    renderSearchCharts() {
        if (this.searchResults.length === 0) return;
        
        // Render spending trend chart
        this.renderSearchTrendChart();
        
        // Render category breakdown chart
        this.renderSearchCategoryChart();
    }
    
    renderSearchTrendChart() {
        const ctx = document.getElementById('search-trend-chart')?.getContext('2d');
        if (!ctx) return;
        
        // Group transactions by month
        const monthlyData = {};
        this.searchResults.forEach(transaction => {
            const date = new Date(transaction.date);
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = 0;
            }
            monthlyData[monthYear] += Math.abs(transaction.amount);
        });
        
        const labels = Object.keys(monthlyData).sort();
        const data = labels.map(label => monthlyData[label]);
        
        if (this.app.charts.searchTrend) {
            this.app.charts.searchTrend.destroy();
        }
        
        this.app.charts.searchTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly Spending',
                    data: data,
                    borderColor: '#1e88e5',
                    backgroundColor: 'rgba(30, 136, 229, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${this.app.formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.app.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }
    
    renderSearchCategoryChart() {
        const ctx = document.getElementById('search-category-chart')?.getContext('2d');
        if (!ctx) return;
        
        // Group transactions by category
        const categoryData = {};
        this.searchResults.forEach(transaction => {
            const category = transaction.category || 'Uncategorized';
            if (!categoryData[category]) {
                categoryData[category] = 0;
            }
            categoryData[category] += Math.abs(transaction.amount);
        });
        
        const labels = Object.keys(categoryData);
        const data = labels.map(label => categoryData[label]);
        
        if (this.app.charts.searchCategory) {
            this.app.charts.searchCategory.destroy();
        }
        
        // Generate colors for categories
        const backgroundColors = labels.map((_, i) => {
            const hue = (i * 137.508) % 360; // Golden angle approximation
            return `hsl(${hue}, 70%, 60%)`;
        });
        
        this.app.charts.searchCategory = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const value = context.raw;
                                const percentage = Math.round((value / total) * 100);
                                return `${context.label}: ${this.app.formatCurrency(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    generateSearchInsights() {
        const insightsContainer = document.getElementById('search-insights');
        if (!insightsContainer) return;
        
        if (this.searchResults.length === 0) {
            insightsContainer.innerHTML = '<p>No insights available for this search.</p>';
            return;
        }
        
        // Generate time-based insights
        const timeInsights = [];
        if (this.searchStats.transactionCount > 1) {
            const dateRange = Math.ceil(
                (this.searchStats.lastTransactionDate - this.searchStats.firstTransactionDate) / 
                (1000 * 60 * 60 * 24)
            ) || 1;
            
            const transactionsPerMonth = (this.searchStats.transactionCount / dateRange) * 30;
            const avgMonthlySpend = (this.searchStats.totalAmount / dateRange) * 30;
            
            timeInsights.push(
                `• On average, you make <strong>${transactionsPerMonth.toFixed(1)}</strong> similar transactions per month.`,
                `• You spend an average of <strong>${this.app.formatCurrency(avgMonthlySpend)}</strong> per month on these transactions.`
            );
        }
        
        // Generate amount-based insights
        const amountInsights = [];
        if (this.searchStats.transactionCount > 1) {
            amountInsights.push(
                `• The highest single transaction was <strong>${this.app.formatCurrency(this.searchStats.maxAmount)}</strong>.`,
                `• The average transaction amount is <strong>${this.app.formatCurrency(this.searchStats.averageAmount)}</strong>.`
            );
        }
        
        // Generate category insights if available
        const categoryInsights = [];
        const categories = new Set(this.searchResults.map(t => t.category).filter(Boolean));
        if (categories.size > 0) {
            categoryInsights.push(
                `• Transactions span across <strong>${categories.size}</strong> categories.`
            );
        }
        
        // Combine all insights
        insightsContainer.innerHTML = `
            <div class="insight">
                <h4>Spending Patterns</h4>
                ${timeInsights.map(insight => `<p>${insight}</p>`).join('')}
            </div>
            <div class="insight">
                <h4>Transaction Amounts</h4>
                ${amountInsights.map(insight => `<p>${insight}</p>`).join('')}
            </div>
            ${categoryInsights.length > 0 ? `
            <div class="insight">
                <h4>Categories</h4>
                ${categoryInsights.map(insight => `<p>${insight}</p>`).join('')}
            </div>` : ''}
        `;
    }
}

class BudgetApp {
    constructor() {
        this.transactions = [];
        this.charts = {}; // Initialize charts object
        this.budgetCategories = [];
        this.accounts = [];
        this.merchantCategories = {};
        this.currentView = 'dashboard';
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.charts = {};
        this.db = localDB;
        this.dbInitialized = false;
        this.unsubscribeCallbacks = [];
        this.pendingImport = []; // Initialize pending import array
        
        // Initialize the app
        this.initializeApp();
    }

    async init() {
        try {
            await this.db.initializeDB;
            this.bindEvents();
            this.setupRealtimeListeners();
            this.renderCurrentView();
            this.updateDashboard();
            this.loadSampleData();
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }

    async addTransaction(transaction) {
        if (!this.db) {
            console.error('Database not initialized');
            return false;
        }
        
        try {
            // Ensure we wait for DB to be ready
            await this.db.initializeDB;
            
            // Format the date consistently
            const formattedDate = new Date(transaction.date).toISOString().split('T')[0];
            const amount = parseFloat(transaction.amount);
            
            // Check for existing transactions with the same date, amount, and description
            const allTransactions = await this.db.getAllItems('transactions');
            const isDuplicate = allTransactions.some(t => 
                t.date === formattedDate && 
                t.description === transaction.description && 
                parseFloat(t.amount) === amount
            );
            
            if (isDuplicate) {
                console.log('Duplicate transaction found, skipping:', {
                    date: formattedDate,
                    description: transaction.description,
                    amount: amount
                });
                return false; // Skip adding duplicate transaction
            }
            
            // Generate a unique ID if not provided
            const transactionId = transaction.id || `trans-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Prepare the transaction data
            const transactionData = {
                id: transactionId,
                ...transaction,
                amount: amount,
                date: formattedDate,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            console.log('Adding transaction:', transactionData);
            
            // Add the transaction to the database
            await this.db.addItem('transactions', transactionData);
            
            // Update account balance if account is specified
            if (transaction.account) {
                try {
                    const accounts = await this.db.getAllItems('accounts');
                    const account = accounts.find(a => a.name === transaction.account);
                    if (account) {
                        const newBalance = (parseFloat(account.balance) || 0) + parseFloat(transaction.amount);
                        console.log(`Updating account ${account.name} balance from ${account.balance} to ${newBalance}`);
                        await this.db.updateItem('accounts', account.id, { 
                            balance: newBalance,
                            updatedAt: new Date().toISOString() 
                        });
                    }
                } catch (accountError) {
                    console.error('Error updating account balance:', accountError);
                    // Don't fail the whole transaction if account update fails
                }
            }
            
            // Refresh transactions list
            this.transactions = await this.db.getAllItems('transactions');
            this.updateDashboard();
            this.renderTransactionList();
            
            return true;
        } catch (error) {
            console.error('Error adding transaction:', error);
            return false;
        }
    }

    async addTransactions(transactions) {
        if (!this.db) return false;
        
        try {
            for (const transaction of transactions) {
                await this.addTransaction(transaction);
            }
            return true;
        } catch (error) {
            console.error('Error adding transactions:', error);
            return false;
        }
    }

    setupRealtimeListeners() {
        // Clean up any existing listeners
        this.cleanup();
        
        // Set up new listeners with proper error handling and binding
        const onTransactionsChange = async () => {
            try {
                if (!this.dbInitialized) return;
                this.transactions = await this.db.getTransactions();
                if (this.updateDashboard && typeof this.updateDashboard === 'function') {
                    await this.updateDashboard();
                }
            } catch (error) {
                console.error('Error in transactions listener:', error);
            }
        };
        
        const onCategoriesChange = async () => {
            try {
                if (!this.dbInitialized) return;
                this.budgetCategories = await this.db.getCategories();
                if (this.updateDashboard && typeof this.updateDashboard === 'function') {
                    await this.updateDashboard();
                }
            } catch (error) {
                console.error('Error in categories listener:', error);
            }
        };
        
        const onAccountsChange = async () => {
            try {
                if (!this.dbInitialized) return;
                this.accounts = await this.db.getAccounts();
                if (this.updateDashboard && typeof this.updateDashboard === 'function') {
                    await this.updateDashboard();
                }
            } catch (error) {
                console.error('Error in accounts listener:', error);
            }
        };
        
        // Bind the methods to the instance
        this.onTransactionsChange = onTransactionsChange.bind(this);
        this.onCategoriesChange = onCategoriesChange.bind(this);
        this.onAccountsChange = onAccountsChange.bind(this);
        
        // Set up the listeners
        const unsubscribeTransactions = this.db.onTransactionsChange(this.onTransactionsChange);
        const unsubscribeCategories = this.db.onCategoriesChange(this.onCategoriesChange);
        const unsubscribeAccounts = this.db.onAccountsChange(this.onAccountsChange);
        
        // Store unsubscribe callbacks
        this.unsubscribeCallbacks = [
            unsubscribeTransactions,
            unsubscribeCategories,
            unsubscribeAccounts
        ];
    }

    async updateTransaction(id, updates) {
        if (!this.db) return false;
        
        try {
            // Get the original transaction first
            const transactions = await this.db.getTransactions();
            const originalTransaction = transactions.find(t => t.id === id);
            
            if (!originalTransaction) {
                console.error('Transaction not found:', id);
                return false;
            }
            
            // Update the transaction
            if (updates.amount) updates.amount = parseFloat(updates.amount);
            if (updates.date) updates.date = new Date(updates.date).toISOString().split('T')[0];
            
            await this.db.updateTransaction(id, updates);
            
            // If amount or account changed, update account balances
            if ((updates.amount && updates.amount !== originalTransaction.amount) || 
                (updates.account && updates.account !== originalTransaction.account)) {
                
                const accounts = await this.db.getAccounts();
                
                // Revert the old transaction's effect on the old account
                if (originalTransaction.account) {
                    const oldAccount = accounts.find(a => a.name === originalTransaction.account);
                    if (oldAccount) {
                        const newBalance = (parseFloat(oldAccount.balance) || 0) - parseFloat(originalTransaction.amount);
                        await this.db.updateAccount(oldAccount.id, { balance: newBalance });
                    }
                }
                
                // Apply the new transaction to the new account
                const accountName = updates.account || originalTransaction.account;
                const amount = updates.amount !== undefined ? updates.amount : originalTransaction.amount;
                
                if (accountName) {
                    const newAccount = accounts.find(a => a.name === accountName);
                    if (newAccount) {
                        const newBalance = (parseFloat(newAccount.balance) || 0) + parseFloat(amount);
                        await this.db.updateAccount(newAccount.id, { balance: newBalance });
                    }
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error updating transaction:', error);
            return false;
        }
    }

    cleanup() {
        try {
            // Clean up any event listeners or intervals
            while (this.unsubscribeCallbacks && this.unsubscribeCallbacks.length) {
                const unsubscribe = this.unsubscribeCallbacks.pop();
                if (unsubscribe && typeof unsubscribe === 'function') {
                    try {
                        unsubscribe();
                    } catch (error) {
                        console.error('Error during cleanup:', error);
                    }
                }
            }
            
            // Clear bound methods
            delete this.onTransactionsChange;
            delete this.onCategoriesChange;
            delete this.onAccountsChange;
            
            // Clear any intervals
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            
            // Reset the array
            this.unsubscribeCallbacks = [];
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    async loadSampleData() {
        if (!this.userId) return;
        
        // Check if we already have data
        const transactions = await this.db.getTransactions();
        if (!transactions.empty) return; // Don't load sample data if we already have data
        
        // Sample data from the provided JSON
        const sampleData = {
            "sampleTransactions": [
                {
                    "id": 1,
                    "date": "2025-06-01",
                    "description": "SALARY DEPOSIT - ACME CORP",
                    "amount": 5000.00,
                    "type": "income",
                    "category": "Salary",
                    "account": "Checking",
                    "recurring": true,
                    "frequency": "monthly"
                },
                {
                    "id": 2,
                    "date": "2025-06-02",
                    "description": "RENT PAYMENT",
                    "amount": -1500.00,
                    "type": "expense",
                    "category": "Housing",
                    "account": "Checking",
                    "recurring": true,
                    "frequency": "monthly"
                },
                {
                    "id": 3,
                    "date": "2025-06-03",
                    "description": "STARBUCKS #1234",
                    "amount": -5.47,
                    "type": "expense",
                    "category": "Food & Dining",
                    "account": "Credit Card",
                    "recurring": false
                },
                {
                    "id": 4,
                    "date": "2025-06-04",
                    "description": "SHELL GAS STATION",
                    "amount": -45.30,
                    "type": "expense",
                    "category": "Transportation",
                    "account": "Credit Card",
                    "recurring": false
                },
                {
                    "id": 5,
                    "date": "2025-06-05",
                    "description": "GROCERY STORE",
                    "amount": -127.84,
                    "type": "expense",
                    "category": "Groceries",
                    "account": "Debit Card",
                    "recurring": false
                },
                {
                    "id": 6,
                    "date": "2025-06-10",
                    "description": "NETFLIX SUBSCRIPTION",
                    "amount": -15.99,
                    "type": "expense",
                    "category": "Entertainment",
                    "account": "Credit Card",
                    "recurring": true,
                    "frequency": "monthly"
                },
                {
                    "id": 7,
                    "date": "2025-06-15",
                    "description": "ELECTRIC COMPANY",
                    "amount": -89.50,
                    "type": "expense",
                    "category": "Utilities",
                    "account": "Checking",
                    "recurring": true,
                    "frequency": "monthly"
                }
            ],
            "budgetCategories": [
                {
                    "name": "Housing",
                    "budgeted": 1600.00,
                    "color": "#e74c3c"
                },
                {
                    "name": "Food & Dining",
                    "budgeted": 400.00,
                    "color": "#f39c12"
                },
                {
                    "name": "Groceries",
                    "budgeted": 300.00,
                    "color": "#27ae60"
                },
                {
                    "name": "Transportation",
                    "budgeted": 200.00,
                    "color": "#3498db"
                },
                {
                    "name": "Entertainment",
                    "budgeted": 150.00,
                    "color": "#9b59b6"
                },
                {
                    "name": "Utilities",
                    "budgeted": 250.00,
                    "color": "#34495e"
                },
                {
                    "name": "Savings",
                    "budgeted": 1000.00,
                    "color": "#2ecc71"
                },
                {
                    "name": "Salary",
                    "budgeted": 0.00,
                    "color": "#1abc9c"
                }
            ],
            "accounts": [
                {
                    "name": "Checking",
                    "balance": 2500.00,
                    "type": "checking"
                },
                {
                    "name": "Credit Card",
                    "balance": -450.00,
                    "type": "credit"
                },
                {
                    "name": "Debit Card",
                    "balance": 1200.00,
                    "type": "checking"
                }
            ],
            "merchantCategories": {
                "STARBUCKS": "Food & Dining",
                "MCDONALDS": "Food & Dining",
                "SHELL": "Transportation",
                "EXXON": "Transportation",
                "WALMART": "Groceries",
                "TARGET": "Shopping",
                "NETFLIX": "Entertainment",
                "SPOTIFY": "Entertainment",
                "RENT": "Housing",
                "MORTGAGE": "Housing",
                "ELECTRIC": "Utilities",
                "GAS COMPANY": "Utilities",
                "WATER": "Utilities",
                "INTERNET": "Utilities"
            }
        };

        // Only load sample data if no existing data
        if (!localStorage.getItem('budget-app-transactions')) {
            this.transactions = sampleData.sampleTransactions;
            this.budgetCategories = sampleData.budgetCategories;
            this.accounts = sampleData.accounts;
            this.merchantCategories = sampleData.merchantCategories;
            this.saveToStorage();
        }
    }

    loadFromStorage() {
        const transactions = localStorage.getItem('budget-app-transactions');
        const categories = localStorage.getItem('budget-app-categories');
        const accounts = localStorage.getItem('budget-app-accounts');
        const merchants = localStorage.getItem('budget-app-merchants');

        if (transactions) this.transactions = JSON.parse(transactions);
        if (categories) this.budgetCategories = JSON.parse(categories);
        if (accounts) this.accounts = JSON.parse(accounts);
        if (merchants) this.merchantCategories = JSON.parse(merchants);
    }

    saveToStorage() {
        localStorage.setItem('budget-app-transactions', JSON.stringify(this.transactions));
        localStorage.setItem('budget-app-categories', JSON.stringify(this.budgetCategories));
        localStorage.setItem('budget-app-accounts', JSON.stringify(this.accounts));
        localStorage.setItem('budget-app-merchants', JSON.stringify(this.merchantCategories));
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav__link').forEach(link => {
            link.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // Add transaction buttons
        document.getElementById('add-transaction-btn').addEventListener('click', () => this.showTransactionModal());
        document.getElementById('add-transaction-btn-2').addEventListener('click', () => this.showTransactionModal());
        
        // Add category button
        document.getElementById('add-category-btn').addEventListener('click', () => this.showCategoryModal());

        // Import CSV button
        document.getElementById('import-csv-btn').addEventListener('click', () => this.showCSVModal());

        // Modal close buttons
        document.querySelectorAll('.modal__close, #cancel-transaction, #cancel-category, #cancel-csv').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Form submissions
        document.getElementById('transaction-form').addEventListener('submit', (e) => this.handleTransactionSubmit(e));
        document.getElementById('category-form').addEventListener('submit', (e) => this.handleCategorySubmit(e));

        // CSV import
        document.getElementById('select-csv-btn').addEventListener('click', () => {
            document.getElementById('csv-file-input').click();
        });
        document.getElementById('csv-file-input').addEventListener('change', (e) => this.handleCSVFile(e));
        document.getElementById('import-csv-confirm').addEventListener('click', () => this.confirmCSVImport());

        // Calendar navigation
        document.getElementById('prev-month').addEventListener('click', () => this.navigateMonth(-1));
        document.getElementById('next-month').addEventListener('click', () => this.navigateMonth(1));

        // Search and filter
        document.getElementById('transaction-search').addEventListener('input', (e) => this.filterTransactions());
        document.getElementById('transaction-filter').addEventListener('change', (e) => this.filterTransactions());

        // CSV dropzone
        const dropzone = document.getElementById('csv-dropzone');
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
        dropzone.addEventListener('click', () => {
            document.getElementById('csv-file-input').click();
        });
    }

    switchView(view) {
        // Update navigation
        document.querySelectorAll('.nav__link').forEach(link => {
            link.classList.remove('nav__link--active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('nav__link--active');

        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('view--active');
        });
        document.getElementById(`${view}-view`).classList.add('view--active');
        this.currentView = view;
        this.renderCurrentView();
    }

    saveToStorage() {
        localStorage.setItem('budget-app-transactions', JSON.stringify(this.transactions));
        localStorage.setItem('budget-app-categories', JSON.stringify(this.budgetCategories));
        localStorage.setItem('budget-app-accounts', JSON.stringify(this.accounts));
        localStorage.setItem('budget-app-merchants', JSON.stringify(this.merchantCategories));
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav__link').forEach(link => {
            link.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // Add transaction buttons
        document.getElementById('add-transaction-btn')?.addEventListener('click', () => this.showTransactionModal());
        document.getElementById('add-transaction-btn-2')?.addEventListener('click', () => this.showTransactionModal());
        
        // Add category button
        document.getElementById('add-category-btn')?.addEventListener('click', () => this.showCategoryModal());

        // Import CSV button
        document.getElementById('import-csv-btn')?.addEventListener('click', () => this.showCSVModal());

        // Modal close buttons
        document.querySelectorAll('.modal__close, #cancel-transaction, #cancel-category, #cancel-csv').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModals();
            });
        });

        // Form submissions
        document.getElementById('transaction-form')?.addEventListener('submit', (e) => this.handleTransactionSubmit(e));
        document.getElementById('category-form')?.addEventListener('submit', (e) => this.handleCategorySubmit(e));

        // CSV import handling
        const csvFileInput = document.getElementById('csv-file');
        const dropzone = document.getElementById('csv-dropzone');
        const importConfirmBtn = document.getElementById('import-csv-confirm');
        
        // Handle file selection via input
        if (csvFileInput) {
            csvFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.processCSVFile(e.target.files[0]);
                }
            });
        }
        
        // Handle import confirmation
        if (importConfirmBtn) {
            importConfirmBtn.addEventListener('click', () => this.confirmCSVImport());
        }

        // Calendar navigation
        document.getElementById('prev-month')?.addEventListener('click', () => this.navigateMonth(-1));
        document.getElementById('next-month')?.addEventListener('click', () => this.navigateMonth(1));

        // Search and filter
        document.getElementById('transaction-search')?.addEventListener('input', (e) => this.filterTransactions());
        document.getElementById('transaction-filter')?.addEventListener('change', (e) => this.filterTransactions());

        // CSV dropzone handling
        if (dropzone) {
            // Prevent default drag behaviors
            const preventDefaults = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };
            
            const highlight = () => {
                dropzone.classList.add('csv-upload__dropzone--dragover');
            };
            
            const unhighlight = () => {
                dropzone.classList.remove('csv-upload__dropzone--dragover');
            };
            
            const handleDrop = (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                
                if (files.length) {
                    // If we have files, process the first one
                    const file = files[0];
                    if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
                        // Show loading state
                        const dropzoneContent = dropzone.querySelector('.dropzone-content');
                        if (dropzoneContent) {
                            dropzoneContent.innerHTML = `
                                <div class="text-center">
                                    <div class="spinner-border text-primary mb-2" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p>Processing file: ${file.name}</p>
                                </div>`;
                        }
                        
                        // Process the file
                        this.processCSVFile(file)
                            .then(() => {
                                // Success handling is done in processCSVFile
                            })
                            .catch(error => {
                                console.error('Error processing CSV file:', error);
                                this.showToast('error', 'Import Failed', 'Failed to process CSV file. Please check the format and try again.');
                                
                                // Reset dropzone
                                if (dropzoneContent) {
                                    dropzoneContent.innerHTML = `
                                        <i class="bi bi-cloud-arrow-up-fill display-4 text-muted mb-3"></i>
                                        <h4>Drag & drop your CSV file here</h4>
                                        <p class="text-muted mb-3">or</p>
                                        <button class="btn btn--primary">
                                            <i class="bi bi-upload me-2"></i>Select File
                                            <input type="file" id="csv-file" accept=".csv,.txt" class="csv-upload__input">
                                        </button>
                                        <p class="small text-muted mt-2">Supports: .csv, .txt (Max 10MB)</p>`;
                                    
                                    // Rebind the file input
                                    const newFileInput = dropzoneContent.querySelector('input[type="file"]');
                                    if (newFileInput) {
                                        newFileInput.addEventListener('change', (e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                this.processCSVFile(e.target.files[0]);
                                            }
                                        });
                                    }
                                }
                            });
                    } else {
                        this.showToast('error', 'Invalid File', 'Please upload a valid CSV file.');
                    }
                }
            };
            
            // Set up event listeners
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, preventDefaults, false);
                document.body.addEventListener(eventName, preventDefaults, false);
            });
            
            // Highlight drop zone when item is dragged over it
            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, highlight, false);
            });
            
            // Remove highlight when item leaves drop zone
            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, unhighlight, false);
            });
            
            // Handle dropped files
            dropzone.addEventListener('drop', handleDrop, false);
            
            // Handle click to select file
            dropzone.addEventListener('click', () => {
                const fileInput = document.getElementById('csv-file');
                if (fileInput) {
                    fileInput.click();
                }
            });
        }
    }

    switchView(view) {
        // Update navigation
        document.querySelectorAll('.nav__link').forEach(link => {
            link.classList.remove('nav__link--active');
        });
        const activeLink = document.querySelector(`[data-view="${view}"]`);
        if (activeLink) {
            activeLink.classList.add('nav__link--active');
        }

        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('view--active');
        });
        const viewElement = document.getElementById(`${view}-view`);
        if (viewElement) {
            viewElement.classList.add('view--active');
        }
        this.currentView = view;
        this.renderCurrentView();
    }

    async renderTransactions() {
        try {
            const transactionsEl = document.getElementById('transactions');
            if (!transactionsEl) return;
            
            // Show loading state
            transactionsEl.innerHTML = '<div class="loading">Loading transactions...</div>';
            
            // Get all transactions from the database
            const transactions = await this.db.getAllItems('transactions');
            
            // Sort by date descending (newest first)
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Render the transactions list
            transactionsEl.innerHTML = `
                <div class="transactions-header">
                    <h2>Transactions</h2>
                    <button class="btn btn-primary" id="add-transaction-btn">
                        <i class="fas fa-plus"></i> Add Transaction
                    </button>
                </div>
                <div class="transactions-list" id="transactions-list">
                    ${this.renderTransactionList(transactions)}
                </div>
            `;
            
            // Add event listeners
            document.getElementById('add-transaction-btn')?.addEventListener('click', () => {
                // TODO: Show add transaction form/modal
                console.log('Add transaction clicked');
            });
            
        } catch (error) {
            console.error('Error rendering transactions:', error);
            const transactionsEl = document.getElementById('transactions');
            if (transactionsEl) {
                transactionsEl.innerHTML = `
                    <div class="error">
                        Error loading transactions: ${error.message}
                    </div>
                `;
            }
        }
    }
    
    renderTransactionList(transactions = []) {
        if (!transactions || transactions.length === 0) {
            return '<div class="no-transactions">No transactions found</div>';
        }
        
        return `
            <table class="transactions-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th class="amount-col">Amount</th>
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
                        </tr>
                    `).join('')}
                </tbody>
            </table>
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
                case 'budget':  // This is the correct spelling, keeping both for backward compatibility
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
            console.error('Error rendering view ' + this.currentView + ':', error);
        }
    }

    // Show the CSV import modal
    showCSVModal() {
        document.getElementById('csv-import-modal').classList.add('modal--active');
        document.body.classList.add('modal-open');
    }

    // Handle file selection
    handleCSVFile(e) {
        const file = e.target.files[0];
        if (file) {
            this.processCSVFile(file);
        }
    }
    
    // Process CSV file and extract transactions
    async processCSVFile(file) {
        if (!file) return Promise.reject(new Error('No file provided'));
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
                    
                    if (lines.length < 2) {
                        throw new Error('CSV file is empty or has no data rows');
                    }
                    
                    // Parse header row to detect column indices
                    const headers = this.parseCSVLine(lines[0]);
                    const columnIndices = {
                        date: -1,
                        description: -1,
                        amount: -1,
                        type: -1,
                        category: -1,
                        account: -1
                    };
                    
                    // Map common column names to our expected format
                    headers.forEach((header, index) => {
                        const lowerHeader = header.toLowerCase().trim();
                        
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
                    
                    console.log('Detected column indices:', columnIndices);
                    
                    // Process data rows
                    const transactions = [];
                    const skippedRows = [];
                    
                    for (let i = 1; i < lines.length; i++) {
                        try {
                            const values = this.parseCSVLine(lines[i]);
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
            };
            
            reader.onerror = (error) => {
                console.error('Error reading file:', error);
                alert('Error reading file. Please try again.');
                reject(error);
            };
            
            reader.readAsText(file);
        });
    }
    
    // Parse date string in various formats to YYYY-MM-DD
    parseDate(dateStr) {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        
        // Try parsing with Date object first
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
        
        // Try common date formats
        const formats = [
            // MM/DD/YYYY or M/D/YYYY
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/,
            // YYYY-MM-DD
            /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
            // DD-MM-YYYY
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
            // Month name formats (Jan 1, 2023 or January 1, 2023)
            /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{2,4})$/,
            // DD/MM/YYYY (European format)
            /^(\d{1,2})[\/](\d{1,2})[\/](\d{2,4})$/,
        ];
        
        for (const format of formats) {
            const match = dateStr.match(format);
            if (match) {
                let year, month, day;
                
                if (match[1].length > 2) { // Month name format
                    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
                    const monthIndex = monthNames.findIndex(m => 
                        m.startsWith(match[1].toLowerCase().substring(0, 3))
                    );
                    if (monthIndex === -1) continue;
                    
                    month = monthIndex + 1;
                    day = parseInt(match[2], 10);
                    year = parseInt(match[3], 10);
                } else {
                    // Numeric formats
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
        
        // If we get here, return today's date as fallback
        console.warn(`Could not parse date: ${dateStr}, using today's date`);
        return new Date().toISOString().split('T')[0];
    }
    
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
    }

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
     * @param {string} [format] - Optional format hint (e.g., 'MM/DD/YYYY', 'DD-MM-YYYY')
     * @returns {string} Formatted date string (YYYY-MM-DD)
     */
    parseDate(dateStr, format = 'auto') {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        
        // Try to parse with Date object first
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
        
        // If auto-detection failed, try common formats
        const formats = [
            // MM/DD/YYYY or MM-DD-YYYY
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/,
            // YYYY-MM-DD
            /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
            // DD/MM/YYYY or DD-MM-YYYY
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/,
            // MMM/DD/YYYY or MMM DD, YYYY
            /^([A-Za-z]{3})[\/\s](\d{1,2})[,\s]?\s*(\d{4})?$/
        ];
        
        for (const regex of formats) {
            const match = dateStr.match(regex);
            if (match) {
                let year, month, day;
                
                if (match[1].length === 3) {
                    // Handle month names (e.g., Jan, Feb, etc.)
                    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", 
                                      "jul", "aug", "sep", "oct", "nov", "dec"];
                    const monthName = match[1].toLowerCase().substring(0, 3);
                    month = monthNames.indexOf(monthName) + 1;
                    day = parseInt(match[2], 10);
                    year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
                } else {
                    // Handle numeric dates
                    if (match[1].length === 4) {
                        // YYYY-MM-DD format
                        year = parseInt(match[1], 10);
                        month = parseInt(match[2], 10);
                        day = parseInt(match[3], 10);
                    } else {
                        // Assume MM/DD/YYYY or DD/MM/YYYY based on format hint
                        if (format.includes('DD/MM') || format.includes('DD-MM')) {
                            day = parseInt(match[1], 10);
                            month = parseInt(match[2], 10) - 1; // Months are 0-indexed in JS
                        } else {
                            // Default to MM/DD/YYYY
                            month = parseInt(match[1], 10) - 1;
                            day = parseInt(match[2], 10);
                        }
                        
                        year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
                        
                        // Handle 2-digit years
                        if (year < 100) {
                            year += year > 50 ? 1900 : 2000;
                        }
                    }
                }
                
                const parsedDate = new Date(year, month, day);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate.toISOString().split('T')[0];
                }
            }
        }
        
        // If all else fails, return today's date
        console.warn(`Could not parse date: ${dateStr}, using today's date`);
        return new Date().toISOString().split('T')[0];
    }
    
    /**
     * Parse an amount string into a number
     * @param {string} amountStr - The amount string to parse
     * @param {string} [format] - Optional format hint (e.g., 'US', 'EU')
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
                                }}) 
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
                confirmBtn.classList.add('hidden');
            }
        }
    }
    
    // Confirm and import the CSV data
    async confirmCSVImport() {
        if (!this.pendingImport || this.pendingImport.length === 0) {
            alert('No transactions to import. Please upload a CSV file first.');
            return;
        }
        
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
    }
    
    // Reset all forms
    resetForms() {
        document.getElementById('transaction-form').reset();
        document.getElementById('category-form').reset();
        document.getElementById('csv-preview').innerHTML = '';
        document.getElementById('csv-preview').classList.add('hidden');
        document.getElementById('import-csv-confirm').classList.add('hidden');
        document.getElementById('csv-import-modal').classList.remove('modal--active');
        document.body.classList.remove('modal-open');
    }

    renderSearch() {
        try {
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
     * Render the calendar view with transactions
     * @param {Date} [date] - Optional date to display (defaults to current month)
     */
    async renderCalendar(date = new Date()) {
        const calendarView = document.getElementById('calendar-view');
        if (!calendarView) return;

        try {
            // Set the current month and year
            this.currentMonth = date.getMonth();
            this.currentYear = date.getFullYear();
            
            // Get transactions for the current month
            const startDate = new Date(this.currentYear, this.currentMonth, 1);
            const endDate = new Date(this.currentYear, this.currentMonth + 1, 0);
            
            // Filter transactions for the current month
            const monthlyTransactions = this.transactions.filter(t => {
                const transactionDate = new Date(t.date);
                return transactionDate >= startDate && transactionDate <= endDate;
            });
            
            // Group transactions by day
            const transactionsByDay = {};
            monthlyTransactions.forEach(t => {
                const day = new Date(t.date).getDate();
                if (!transactionsByDay[day]) {
                    transactionsByDay[day] = [];
                }
                transactionsByDay[day].push(t);
            });
            
            // Generate calendar HTML
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'];
            
            // Get first day of month (0-6, where 0 is Sunday)
            const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
            // Get number of days in month
            const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
            
            let calendarHTML = `
                <div class="calendar-header">
                    <h2>${monthNames[this.currentMonth]} ${this.currentYear}</h2>
                    <div class="calendar-nav">
                        <button id="prev-month" class="btn btn--icon">
                            <i class="bi bi-chevron-left"></i>
                        </button>
                        <button id="today" class="btn btn--text">Today</button>
                        <button id="next-month" class="btn btn--icon">
                            <i class="bi bi-chevron-right"></i>
                        </button>
                    </div>
                </div>
                <div class="calendar-grid">
                    <div class="calendar-weekday">Sun</div>
                    <div class="calendar-weekday">Mon</div>
                    <div class="calendar-weekday">Tue</div>
                    <div class="calendar-weekday">Wed</div>
                    <div class="calendar-weekday">Thu</div>
                    <div class="calendar-weekday">Fri</div>
                    <div class="calendar-weekday">Sat</div>
            `;
            
            // Add empty cells for days before the first of the month
            for (let i = 0; i < firstDay; i++) {
                calendarHTML += '<div class="calendar-day empty"></div>';
            }
            
            // Add days of the month
            for (let day = 1; day <= daysInMonth; day++) {
                const dayTransactions = transactionsByDay[day] || [];
                const totalAmount = dayTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
                const isToday = new Date().getDate() === day && 
                               new Date().getMonth() === this.currentMonth && 
                               new Date().getFullYear() === this.currentYear;
                
                calendarHTML += `
                    <div class="calendar-day ${isToday ? 'today' : ''}">
                        <div class="calendar-day-number">${day}</div>
                        ${dayTransactions.length > 0 ? `
                            <div class="calendar-day-transactions">
                                ${dayTransactions.slice(0, 2).map(t => `
                                    <div class="calendar-transaction ${t.amount < 0 ? 'expense' : 'income'}">
                                        <span class="transaction-amount">${this.formatCurrency(t.amount)}</span>
                                        <span class="transaction-category">${t.category || 'Uncategorized'}</span>
                                    </div>
                                `).join('')}
                                ${dayTransactions.length > 2 ? `
                                    <div class="calendar-more-transactions">
                                        +${dayTransactions.length - 2} more
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                        ${totalAmount !== 0 ? `
                            <div class="calendar-day-total ${totalAmount < 0 ? 'negative' : 'positive'}">
                                ${this.formatCurrency(totalAmount)}
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            // Close calendar grid
            calendarHTML += '</div>';
            
            // Update the DOM
            calendarView.innerHTML = calendarHTML;
            
            // Add event listeners for navigation
            document.getElementById('prev-month')?.addEventListener('click', () => {
                const prevMonth = new Date(this.currentYear, this.currentMonth - 1, 1);
                this.renderCalendar(prevMonth);
            });
            
            document.getElementById('next-month')?.addEventListener('click', () => {
                const nextMonth = new Date(this.currentYear, this.currentMonth + 1, 1);
                this.renderCalendar(nextMonth);
            });
            
            document.getElementById('today')?.addEventListener('click', () => {
                this.renderCalendar(new Date());
            });
            
            // Add click handler for calendar days
            calendarView.querySelectorAll('.calendar-day:not(.empty)').forEach(dayEl => {
                dayEl.addEventListener('click', (e) => {
                    const day = parseInt(dayEl.querySelector('.calendar-day-number').textContent);
                    const selectedDate = new Date(this.currentYear, this.currentMonth, day);
                    this.showTransactionsForDate(selectedDate);
                });
            });
            
        } catch (error) {
            console.error('Error rendering calendar:', error);
            calendarView.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    Error loading calendar. Please try again.
                </div>
            `;
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
            const dashboardEl = document.getElementById('dashboard');
            if (!dashboardEl) return;
            
            // Get transactions for the current month
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            
            const transactions = await this.localDB.getTransactions({
                startDate: firstDay,
                endDate: lastDay
            });
            
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
            
            // Update the dashboard HTML
            dashboardEl.innerHTML = `
                <div class="dashboard-summary">
                    <div class="dashboard-card">
                        <h3>Income</h3>
                        <div class="amount income">${this.formatCurrency(totals.income)}</div>
                    </div>
                    <div class="dashboard-card">
                        <h3>Expenses</h3>
                        <div class="amount expense">${this.formatCurrency(totals.expenses)}</div>
                    </div>
                    <div class="dashboard-card">
                        <h3>Balance</h3>
                        <div class="amount ${totals.income - totals.expenses >= 0 ? 'income' : 'expense'}">
                            ${this.formatCurrency(totals.income - totals.expenses)}
                        </div>
                    </div>
                </div>
                <div class="recent-transactions">
                    <h3>Recent Transactions</h3>
                    ${this.renderTransactionList(transactions.slice(0, 5))}
                </div>
            `;
            
        } catch (error) {
            console.error('Error rendering dashboard:', error);
        }
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

    async initializeApp() {
        try {
            // Initialize the database first
            await this.db.initializeDB();
            this.dbInitialized = true;
            
            // Then initialize the rest of the app
            await this.init();
            
            // Set up real-time listeners
            this.setupRealtimeListeners();
            
            // Initial render
            this.renderCurrentView();
            
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
        }
    }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BudgetApp();
    window.app.initializeApp();
});
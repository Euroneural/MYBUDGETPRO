import { secureDB } from './secure-db.js';
import PasswordPrompt from './components/PasswordPrompt.js';
import { transactionAnalytics } from './analytics.js';

// Chart.js is available globally via CDN in index.html

// Import Budget Manager for auto budget rendering
import { initBudgetManager } from './budget-manager.js';
import { AccountManager, createAccountDB } from './account-manager.js';

// SearchManager stub – original implementation removed as part of simplification
class SearchManager {

  constructor(app) {
    console.log('SearchManager: Initializing SearchManager');
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
    this.initialized = false;
    console.log('SearchManager: Ready to initialize when search view is active');
  }
  
  // Call this when search view becomes active
  initialize() {
    if (this.initialized) return;
    console.log('SearchManager: Initializing search functionality');
    this.bindEvents();
    this.initialized = true;
    console.log('SearchManager: Initialization complete');
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

  // Kept for backward compatibility
  init() {
    console.warn('SearchManager.init() is deprecated. Use initialize() instead.');
    this.initialize();
  }

  bindEvents() {
    console.log('Binding search events...');
    
    // Store reference to 'this' for use in callbacks
    const self = this;
    
    // Get elements - search might be in a modal or hidden initially
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('transaction-search');
    const exactMatch = document.getElementById('exact-match');
    const includeNotes = document.getElementById('include-notes');
    const timeRange = document.getElementById('time-range');
    
    if (!searchBtn) {
      console.warn('Search button not found - will retry when search view is active');
      return false;
    }
    
    if (!searchInput) {
      console.warn('Search input not found - will retry when search view is active');
      return false;
    }
    
    // Remove any existing event listeners to prevent duplicates
    const newSearchBtn = searchBtn.cloneNode(true);
    searchBtn.parentNode.replaceChild(newSearchBtn, searchBtn);
    
    // Helper function to safely perform search
    const safeSearch = async () => {
      try {
        await self.performSearch();
      } catch (error) {
        console.error('Search error:', error);
        const resultsBody = document.getElementById('search-results-body');
        if (resultsBody) {
          resultsBody.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center text-danger py-4">
                                Error performing search: ${error.message}
                            </td>
                        </tr>`;
        }
      }
    };
        
    // Helper function to safely render results
    const safeRenderResults = () => {
      try {
        if (self.renderSearchResults) {
          self.renderSearchResults();
        }
      } catch (error) {
        console.error('Error rendering search results:', error);
      }
    };
        
    // Add click event to search button
    newSearchBtn.addEventListener('click', safeSearch);
    console.log('Search button event listener added');
    
    // Setup input event with debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const searchTerm = e.target.value.trim();
        if (searchTerm.length >= 2) {
          console.log('Input changed, performing search for:', searchTerm);
          safeSearch();
        } else if (searchTerm.length === 0) {
          // Clear results if search is empty
          console.log('Search input cleared');
          self.searchResults = [];
          safeRenderResults();
          if (self.renderSearchCharts) self.renderSearchCharts();
          if (self.generateSearchInsights) self.generateSearchInsights();
        }
      }, 500); // 500ms debounce delay
    });
            
    // Also search on Enter key
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        console.log('Enter key pressed in search input');
        clearTimeout(searchTimeout); // Clear any pending debounced search
        safeSearch();
      }
    });
            
    console.log('Search input event listeners added');
    
    // Only proceed if all required elements are found
    if (!exactMatch || !includeNotes || !timeRange) {
      if (!exactMatch) console.warn('Exact match checkbox not found');
      if (!includeNotes) console.warn('Include notes checkbox not found');
      if (!timeRange) console.warn('Time range select not found');
      return false;
    }
        
    if (exactMatch) {
      exactMatch.removeEventListener('change', safeRenderResults);
      exactMatch.addEventListener('change', () => {
        console.log('Exact match changed:', exactMatch.checked);
        safeRenderResults();
      });
    }
        
    if (includeNotes) {
      includeNotes.removeEventListener('change', safeSearch);
      includeNotes.addEventListener('change', () => {
        console.log('Include notes changed:', includeNotes.checked);
        safeSearch();
      });
    }
        
    if (timeRange) {
      timeRange.removeEventListener('change', safeSearch);
      timeRange.addEventListener('change', () => {
        console.log('Time range changed:', timeRange.value);
        safeSearch();
      });
    }
    
    return true;
  }

  async performSearch() {
    console.log('performSearch called');
        
    // Get search input and validate
    const searchInput = document.getElementById('transaction-search');
    if (!searchInput) {
      console.error('Search input element not found');
      return;
    }
        
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) {
      console.log('No search term entered');
      return;
    }
        
    console.log('Searching for:', searchTerm);
        
    // Show loading state
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      searchBtn.disabled = true;
      searchBtn.innerHTML = '<i class="bi bi-hourglass"></i> Searching...';
    }
        
    try {
      // Get search options
      const exactMatch = document.getElementById('exact-match')?.checked || false;
      const includeNotes = document.getElementById('include-notes')?.checked || false;
      const timeRange = document.getElementById('time-range')?.value || 'all';
            
      console.log('Search options:', { exactMatch, includeNotes, timeRange });
            
      // Calculate date range based on selection
      const today = new Date();
      const endDate = today.toISOString().split('T')[0];
      let startDate;
            
      switch(timeRange) {
        case 'week':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 7);
          startDate = startDate.toISOString().split('T')[0];
          break;
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
            
      console.log('Date range:', { startDate, endDate });
            
      let transactions;
      try {
        console.log("Fetching transactions from ${startDate} to ${endDate}");
        transactions = await this.app.db.getTransactions({
          startDate,
          endDate
        });
        if (!Array.isArray(transactions)) {
          throw new Error('Invalid transactions data received from database');
        }
        console.log("Found ${transactions.length} transactions in date range");
      } catch (error) {
        console.error('Error fetching transactions:', error);
        throw new Error('Could not load transactions. Please try again.');
      }

      // Track the last search state to prevent unnecessary updates
      this._lastSearchState = this._lastSearchState || {
        searchTerm: '',
        filterValue: '',
        exactMatch: false,
        includeNotes: false,
        resultCount: 0
      };

      // Call filterTransactions to filter the transactions
      await this.filterTransactions(true, startDate, endDate);

      // Calculate search statistics
      this.calculateSearchStats();

      // Debug: Log before rendering
      console.log('About to render search results');

      // Render results with error handling for each step
      try {
        this.renderSearchResults();
        console.log('Search results rendered');
        this.renderSearchCharts();
        console.log('Search charts rendered');
        this.generateSearchInsights();
        console.log('Search insights generated');
      } catch (renderError) {
        console.error('Error during search result rendering:', renderError);
        throw renderError; // Re-throw to be caught by the outer try-catch
      }
            
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
    
  async filterTransactions(forceUpdate = false, startDate = null, endDate = null) {
    try {
      // Get search input element (only using transactions-search now)
      const searchInput = document.getElementById('transactions-search') || document.getElementById('transaction-search');
      
      // Get values with null checks
      const searchTerm = (searchInput?.value || '').trim();
      
      // Get filter controls
      const filterSelect = document.getElementById('transaction-filter');
      const exactMatchCheckbox = document.getElementById('exact-match');
      const includeNotesCheckbox = document.getElementById('include-notes');
      
      // Get filter values with null checks
      const filterValue = filterSelect?.value || '';
      const exactMatch = exactMatchCheckbox?.checked || false;
      const includeNotes = includeNotesCheckbox?.checked || false;
      
      // Initialize last search state if it doesn't exist
      if (!this._lastSearchState) {
        this._lastSearchState = {
          searchTerm: '',
          filterValue: '',
          exactMatch: false,
          includeNotes: false,
          resultCount: 0
        };
      }
      
      // Check if search state has changed
      const searchState = { searchTerm, filterValue, exactMatch, includeNotes };
      const searchStateChanged = 
        this._lastSearchState.searchTerm !== searchTerm ||
        this._lastSearchState.filterValue !== filterValue ||
        this._lastSearchState.exactMatch !== exactMatch ||
        this._lastSearchState.includeNotes !== includeNotes;
      
      // Skip processing if search state hasn't changed and we're not forcing an update
      if (!searchStateChanged && !forceUpdate) {
        console.log('Search state unchanged, skipping filter');
        return this._lastFilteredTransactions || [];
      }
      
      console.log('Filtering transactions with:', searchState);
      
      // Get all transactions
      const transactions = await this.app.db.getTransactions({
        startDate,
        endDate
      });
      if (!Array.isArray(transactions)) {
        throw new Error('Failed to load transactions');
      }
      
      // Apply filters
      let filtered = [...transactions];
      
      // Apply search filter if search term exists
      if (searchTerm) {
        // Split search terms by pipe (|), trim, and filter out empty terms
        const searchTerms = searchTerm
          .split('|')
          .map(term => term.trim())
          .filter(term => term.length > 0);

        if (searchTerms.length > 0) {
          filtered = filtered.filter(transaction => {
            if (!transaction) return false;
            
            // Build searchable text from relevant fields
            const searchText = [
              String(transaction.description || '').toLowerCase(),
              String(transaction.category || '').toLowerCase()
            ];
            
            // Include notes if specified
            if (includeNotes && transaction.notes) {
              searchText.push(String(transaction.notes).toLowerCase());
            }
            
            const searchTextStr = searchText.join(' ').toLowerCase();
            
            // Apply exact or partial match based on exactMatch flag
            if (exactMatch) {
              // All pipe-separated terms must be present for exact match
              return searchTerms.every(term => 
                searchTextStr.includes(term.toLowerCase())
              );
            } else {
              // Any pipe-separated term can match for partial search
              return searchTerms.some(term => 
                searchTextStr.includes(term.toLowerCase())
              );
            }
          });
        }
      }
      
      // Store the filtered transactions and update last search state
      this.searchResults = filtered;
      this._lastSearchState = {
        ...searchState,
        resultCount: filtered.length
      };
      this._lastFilteredTransactions = filtered;
      
      console.log("Filtered to ${filtered.length} transactions");
      
      // Only update UI if this is not an initial load or if forced
      if (searchStateChanged || forceUpdate) {
        // Update search results in the transactions view if we're not in the search view
        const searchView = document.getElementById('search-view');
        if (!searchView || searchView.style.display === 'none') {
          // We're in the transactions view, update the transactions table and analytics
          if (typeof this.app.updateTransactionsUI === 'function') {
            this.app.updateTransactionsUI(filtered);
          }
          
          // Update analytics charts
          if (typeof this.app.renderTransactionsAnalyticsCharts === 'function') {
            this.app.renderTransactionsAnalyticsCharts(filtered);
          }
        } else {
          // We're in the search view, update search results
          await this.renderSearchResults();
        }
      }
      
      return filtered;
    } catch (error) {
      console.error('Error filtering transactions:', error);
      throw error;
    }
  }

  calculateSearchStats() {
    console.log('Calculating search statistics...');
        
    // Initialize default stats
    const defaultStats = {
      totalAmount: 0,
      averageAmount: 0,
      minAmount: 0,
      maxAmount: 0,
      transactionCount: 0,
      firstTransactionDate: null,
      lastTransactionDate: null,
      incomeTotal: 0,
      expenseTotal: 0,
      transactionDates: []
    };
        
    // Reset to default if no results
    if (!Array.isArray(this.searchResults) || this.searchResults.length === 0) {
      console.log('No search results, resetting stats to default');
      this.searchStats = { ...defaultStats };
      return;
    }
        
    try {
      // Filter out invalid transactions
      const validTransactions = this.searchResults
        .filter(transaction => {
          if (!transaction) return false;
          const amount = parseFloat(transaction.amount);
          return !isNaN(amount);
        });
            
      if (validTransactions.length === 0) {
        console.log('No valid transactions with amounts found');
        this.searchStats = { ...defaultStats, transactionCount: this.searchResults.length };
        return;
      }
            
      // Extract and parse amounts
      const amounts = validTransactions.map(t => {
        const amount = parseFloat(t.amount);
        return isNaN(amount) ? 0 : amount;
      });
            
      // Calculate financial stats
      const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
      const incomeTotal = amounts.filter(amount => amount > 0).reduce((sum, amount) => sum + amount, 0);
      const expenseTotal = Math.abs(amounts.filter(amount => amount < 0).reduce((sum, amount) => sum + amount, 0));
            
      // Process transaction dates
      const transactionDates = validTransactions
        .map(t => {
          try {
            const date = new Date(t.date);
            return isNaN(date.getTime()) ? null : date;
          } catch (e) {
            console.warn('Invalid transaction date:', t.date, e);
            return null;
          }
        })
        .filter(date => date !== null)
        .sort((a, b) => a - b);
            
      // Update stats
      this.searchStats = {
        totalAmount,
        averageAmount: validTransactions.length > 0 ? totalAmount / validTransactions.length : 0,
        minAmount: Math.min(...amounts),
        maxAmount: Math.max(...amounts),
        transactionCount: validTransactions.length,
        firstTransactionDate: transactionDates.length > 0 ? transactionDates[0] : null,
        lastTransactionDate: transactionDates.length > 0 ? transactionDates[transactionDates.length - 1] : null,
        incomeTotal,
        expenseTotal,
        transactionDates,
        // Additional calculated fields
        isSingleDay: transactionDates.length <= 1 || 
                    (transactionDates[0] && transactionDates[transactionDates.length - 1] &&
                     transactionDates[0].toDateString() === transactionDates[transactionDates.length - 1].toDateString()),
        dayCount: new Set(transactionDates.map(d => d.toDateString())).size,
        averagePerDay: transactionDates.length > 0 ? totalAmount / new Set(transactionDates.map(d => d.toDateString())).size : 0
      };
            
      console.log('Calculated search stats:', {
        ...this.searchStats,
        firstTransactionDate: this.searchStats.firstTransactionDate?.toISOString(),
        lastTransactionDate: this.searchStats.lastTransactionDate?.toISOString(),
        transactionDates: this.searchStats.transactionDates.map(d => d.toISOString().split('T')[0])
      });
            
    } catch (error) {
      console.error('Error calculating search statistics:', error);
      // Fall back to default stats with the count of all results
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
    
  calculateTransactionChange(_transaction) {
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
      console.log("Transactions with categories: ${hasCategories ? 'Yes' : 'No'}");
            
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
      const insightsHtml = `
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
                label: function (context) {
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
                callback: function (value) {
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
  /**
   * Confirm with user and delete ALL transactions from the database.
   * Clears in-memory list and refreshes all views.
   */
  async confirmAndDeleteAllTransactions() {
    if (!confirm('Are you sure you want to delete ALL transactions? This action cannot be undone.')) {
      return;
    }

    try {
      // Clear all transactions via secureDB helper when available
      if (this.db && typeof this.db.clearAllTransactions === 'function') {
        await this.db.clearAllTransactions();
      } else if (this.db && typeof this.db.clearStore === 'function') {
        await this.db.clearStore('transactions');
      } else if (this.db && typeof this.db.deleteAllItems === 'function') {
        await this.db.deleteAllItems('transactions');
      } else {
        // Fallback: retrieve all items and delete individually
        const all = await this.db.getAllItems('transactions');
        for (const item of all) {
          await this.db.deleteItem('transactions', item.id);
        }
      }

      // Reset local array
      this.transactions = [];
      this.pendingImport = [];

      // Refresh relevant views
      await Promise.all([
        this.renderDashboard?.(),
        this.renderTransactions?.(),
        this.renderCalendar?.(),
        this.renderTransactionsAnalyticsCharts?.(),
      ]);

      this.showToast?.('success', 'All transactions deleted');
    } catch (error) {
      console.error('Error deleting all transactions:', error);
      this.showToast?.('error', 'Failed to delete all transactions');
    }
  }
  /**
   * Show the CSV import modal
   */
  showCSVModal() {
    const modal = document.getElementById('csv-import-modal');
    if (modal) {
      modal.classList.add('modal--active');
      document.body.classList.add('modal-open');
    } else {
      console.error('CSV Import Modal not found');
    }
  }

  constructor() {
    this.db = secureDB; 
    this.transactions = [];
    this.budgetCategories = [];
    this.accounts = [];
    this.currentView = 'dashboard';
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();
    this.dbInitialized = false;
    this.searchManager = new SearchManager(this);
    this.passwordPrompt = new PasswordPrompt();
  this.accountManager = new AccountManager();
    this.charts = {}; // Initialize charts object
  this.overviewCharts = []; // Store Chart.js instances for Overview tab

    // Show password prompt and initialize
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeWithPassword());
    } else {
      setTimeout(() => this.initializeWithPassword(), 100);
    }

    // Wire up Unlock App button
    setTimeout(() => {
      const unlockBtn = document.getElementById('unlock-app-btn');
      if (unlockBtn) {
        unlockBtn.addEventListener('click', () => this.initializeWithPassword());
      }
    }, 500);
  }

  async initializeWithPassword() {
    try {
      const password = await this.passwordPrompt.prompt();
      if (!password) {
        this.passwordPrompt.showError('Password is required to access the secure database');
        throw new Error('Password is required to access the secure database');
      }
      await this.db.initialize(password);
      this.passwordPrompt.close();
      this.initializeApp(); // Continue normal app initialization
    } catch (error) {
      this.passwordPrompt.showError(error.message || 'Failed to initialize secure storage');
      setTimeout(() => this.initializeWithPassword(), 100);
    }
  }

  // Static getter for bank format configurations
  static get BANK_FORMATS() {
    return {
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
  }


  async initializeApp() {
    try {
      console.log('Initializing app...');

      this.dbInitialized = true;
      console.log('Secure database initialized');
      // Initialize accounts and DB wrapper
      await this.accountManager.init();
      this.db = createAccountDB(this.accountManager.getActiveAccountId());
      // Ensure object stores exist before any queries
      await this.db.ensureStores();
      // Listen for future account switches
      window.addEventListener('account-switched', async (e) => {
        this.db = createAccountDB(e.detail.accountId);
      await this.db.ensureStores();
        await this.loadTransactions();
        this.renderCurrentView();
        this.renderAccountDropdown();
      });

      // Load initial data
      console.log('Loading initial data...');
      await Promise.all([
        this.loadTransactions(),
        this.loadBudgetCategories(),
        this.loadAccounts()
      ]);
      
      // Render account dropdown
      this.renderAccountDropdown();
      // Initial render
      console.log('Rendering initial view...');
      await this.renderCurrentView();
      
      // Initial event binding
      console.log('Binding event listeners...');
      this.bindEventListeners();
      
      // Set up real-time listeners
      console.log('Setting up real-time listeners...');
      await this.setupRealtimeListeners();
      
      // Force a re-render after a short delay to ensure all elements are present
      console.log('Scheduling final render...');
      setTimeout(() => {
        console.log('Performing final render...');
        this.renderCurrentView().then(() => {
          console.log('Final render complete, binding event listeners...');
          this.bindEventListeners();
          console.log('App fully initialized');
        });
      }, 500);

      console.log('App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      // Show error to user
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        mainContent.innerHTML = `
          <div class="alert alert-danger">
            <h4>Error initializing application</h4>
            <p>${this.escapeHtml(error.message)}</p>
            <p>Check the console for more details.</p>
          </div>
        `;
      }
    }
  }

  async loadTransactions() {
    try {
      // Load transactions from the database
      this.transactions = await this.db.getAllItems('transactions') || [];
      
      // Sort by date (newest first)
      this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      console.log("Loaded ${this.transactions.length} transactions into memory");
      return this.transactions;
    } catch (error) {
      console.error('Error loading transactions:', error);
      this.transactions = [];
      return [];
    }
  }

  async loadBudgetCategories() {
try {
this.budgetCategories = await this.db.getAllItems('categories') || [];
console.log("Loaded ${this.budgetCategories.length} budget categories");
return this.budgetCategories;
} catch (error) {
console.error('Error loading budget categories:', error);
this.budgetCategories = [];
return [];
}
}

async loadAccounts() {
  try {
    this.accounts = await this.accountManager.listAccounts();
    console.log(`Loaded ${this.accounts.length} accounts`);
    return this.accounts;
  } catch (error) {
    console.error('Error loading accounts:', error);
    this.accounts = [];
    return [];
  }
}

/**
* Set up real-time listeners for data changes
*/
setupRealtimeListeners() {
console.log('Setting up real-time listeners');
// This is a placeholder for real-time functionality
// In a real app, this would set up listeners for database changes
// For now, we'll just log that it was called

// Example of what this might look like with a real-time database:
// this.db.on('transactions:changed', () => this.loadTransactions());
// this.db.on('categories:changed', () => this.loadBudgetCategories());
// this.db.on('accounts:changed', () => this.loadAccounts());

// For now, we'll just return a resolved promise
return Promise.resolve();
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
 * Parse a date string from CSV and return ISO YYYY-MM-DD or null if invalid
 * Supports common formats like:
 *   - YYYY-MM-DD / YYYY/MM/DD
 *   - MM/DD/YYYY or M/D/YY
 *   - DD/MM/YYYY or D/M/YY (day first)
 *   - DD MMM YYYY (e.g. 01 Jan 2024)
 *   - Locale strings that the built-in Date constructor can parse
 * @param {string} str Raw date string
 * @returns {string|null}
 */
parseDate(str) {
    if (!str) return null;

    // Remove surrounding quotes and trim whitespace
    const clean = str.trim().replace(/^['"]|['"]$/g, '');

    // 1. Let native Date handle ISO or recognised formats
    let d = new Date(clean);
    if (!isNaN(d)) {
        return d.toISOString().split('T')[0];
    }

    // 2. Regex based parsing for the most common bank formats
    const monthNames = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
    };

    // MM/DD/YYYY or M/D/YY (US style)
    let m = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
    if (m) {
        let [ , mm, dd, yy] = m;
        mm = parseInt(mm, 10) - 1;
        dd = parseInt(dd, 10);
        let yyyy = parseInt(yy, 10);
        if (yyyy < 100) {
            // assume 20xx for two-digit years
            yyyy += 2000;
        }
        d = new Date(yyyy, mm, dd);
        if (!isNaN(d)) return d.toISOString().split('T')[0];
    }

    // DD/MM/YYYY or D/M/YY (EU style)
    m = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
    if (m) {
        let [ , dd, mm, yy] = m;
        mm = parseInt(mm, 10) - 1;
        dd = parseInt(dd, 10);
        let yyyy = parseInt(yy, 10);
        if (yyyy < 100) {
            yyyy += 2000;
        }
        d = new Date(yyyy, mm, dd);
        if (!isNaN(d)) return d.toISOString().split('T')[0];
    }

    // DD MMM YYYY (01 Jan 2024)
    m = clean.match(/^(\d{1,2})[\s-]([A-Za-z]{3,4})[\s-](\d{2}|\d{4})$/);
    if (m) {
        let [ , dd, mon, yy] = m;
        dd = parseInt(dd, 10);
        mon = mon.toLowerCase();
        if (monthNames.hasOwnProperty(mon)) {
            let yyyy = parseInt(yy, 10);
            if (yyyy < 100) yyyy += 2000;
            d = new Date(yyyy, monthNames[mon], dd);
            if (!isNaN(d)) return d.toISOString().split('T')[0];
        }
    }

    console.warn('parseDate: Unable to parse date string', str);
    return null;
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
      <!-- Calendar days will be inserted here -->
    </div>
  </div>`;
  
  // Set the calendar HTML
  calendarEl.innerHTML = calendarHTML;
  
  // Set up event listeners for the calendar
  this.setupCalendarEventListeners();
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
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startOfDay && transactionDate <= endOfDay;
    });
  }

/**
 * Set up event listeners for the calendar
 */
setupCalendarEventListeners() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;
      
  // Day click handler
  calendarEl.querySelectorAll('.calendar__day').forEach(dayEl => {
    dayEl.addEventListener('click', async () => {
      const dateStr = dayEl.getAttribute('data-date');
      if (dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        try {
          await this.selectDate(new Date(year, month - 1, day));
          // Update active day styling
          calendarEl.querySelectorAll('.calendar__day').forEach(el => {
            el.classList.remove('calendar__day--selected');
          });
          dayEl.classList.add('calendar__day--selected');
        } catch (error) {
          console.error('Error selecting date:', error);
        }
      }
    });
  });
}

  /**
   * Render the mini calendar
   * @param {Date} date - The date to display in the mini calendar
   */
  renderMiniCalendar(date = new Date()) {
    const miniCalendarEl = document.getElementById('mini-calendar');
    if (!miniCalendarEl) return;
    
    const today = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
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
          
      // Add days of current month
      for (let day = 1; day <= daysInMonth; day++) {
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
        this.renderCalendar(new Date(year, month - 1, 1));
      });
          
      document.getElementById('mini-next-month')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.renderCalendar(new Date(year, month + 1, 1));
      });
  }
    
  /**
     * Set up event listeners for the calendar
     */
  setupCalendarEventListeners() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
        
    // Day click handler
    calendarEl.querySelectorAll('.calendar__day').forEach(dayEl => {
      dayEl.addEventListener('click', async () => {
        const dateStr = dayEl.getAttribute('data-date');
        if (dateStr) {
          const [year, month, day] = dateStr.split('-').map(Number);
          try {
            await this.selectDate(new Date(year, month - 1, day));
            // Update active day styling
            calendarEl.querySelectorAll('.calendar__day').forEach(el => {
              el.classList.remove('calendar__day--selected');
            });
            dayEl.classList.add('calendar__day--selected');
          } catch (error) {
            console.error('Error selecting date:', error);
          }
        }
      });
    });
  }

  // Add event listeners for the app
  bindEventListeners() {
    // Navigation buttons (Add Transaction, Import CSV, etc.)
    const navButtons = [
      { id: 'add-transaction-btn', handler: () => this.showTransactionModal() },
      { id: 'add-transaction-btn-2', handler: () => this.showTransactionModal() },
      { id: 'add-category-btn', handler: () => this.showCategoryModal() },
      { id: 'csv-import-btn', handler: () => this.showCSVModal() },
      { id: 'export-csv-btn', handler: () => this.exportToCSV() },
    { id: 'delete-all-btn', handler: () => this.confirmAndDeleteAllTransactions() },
      { id: 'close-transaction-modal', handler: () => this.closeModal('add-transaction-modal') },
      { id: 'close-category-modal', handler: () => this.closeModal('add-category-modal') },
      { id: 'close-budget-modal', handler: () => this.closeModal('set-budget-modal') },
      { id: 'close-csv-modal', handler: () => this.closeModal('csv-import-modal') },
      { id: 'import-csv-confirm', handler: () => this.confirmCSVImport() },
      { id: 'cancel-csv', handler: () => this.cancelCSVImport() }
    ];

    // Add event listeners for navigation/action buttons by ID
    navButtons.forEach(button => {
      const element = document.getElementById(button.id);
      if (element) {
        // Remove any existing listeners to prevent duplicates
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        newElement.addEventListener('click', button.handler);
      }
    });

    // Search and filter controls - only using transactions-search now
    const searchInput = document.getElementById('transactions-search');
  
    // Debounce function to prevent too many rapid searches
    const debounce = (func, delay) => {
      let timeoutId;
      return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
      };
    };
  
    // Debounced filter function
    const debouncedFilter = debounce(() => this.filterTransactions(), 300);

    // Add input event listener for search with debouncing
    if (searchInput) {
      searchInput.removeEventListener('input', debouncedFilter); // Remove existing to prevent duplicates
      searchInput.addEventListener('input', debouncedFilter);
    }

    // Add event listeners for navigation links by class/data-view
    const navLinks = document.querySelectorAll('.nav__link[data-view]');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const view = link.getAttribute('data-view');
        if (view) {
          this.switchView(view);
        }
      });
    });

    // Form submissions
    const forms = [
      { id: 'transaction-form', handler: (e) => this.handleTransactionSubmit(e) },
      { id: 'category-form', handler: (e) => this.handleCategorySubmit(e) },
      { id: 'budget-form', handler: (e) => this.handleBudgetSubmit(e) }
    ];

    forms.forEach(form => {
      const element = document.getElementById(form.id);
      if (element) {
        element.addEventListener('submit', form.handler);
      }
    });

    // Filter controls (category filter, exact match, include notes)
    const filterControls = [
      { id: 'transaction-filter', event: 'change' },
      { id: 'exact-match', event: 'change' },
      { id: 'include-notes', event: 'change' }
    ];

    filterControls.forEach(control => {
      const element = document.getElementById(control.id);
      if (element) {
        element.removeEventListener(control.event, debouncedFilter);
        element.addEventListener(control.event, debouncedFilter);
      }
    });

    forms.forEach(form => {
      const element = document.getElementById(form.id);
      if (element) {
        element.addEventListener('submit', form.handler);
      }
    });

    // Search and filter
    const searchElements = [
      { id: 'transaction-search', event: 'input', handler: () => this.filterTransactions() },
      { id: 'transaction-filter', event: 'change', handler: () => this.filterTransactions() }
    ];

    searchElements.forEach(item => {
      const element = document.getElementById(item.id);
      if (element) {
        element.removeEventListener(item.event, item.handler); // Prevent duplicate bindings
        element.addEventListener(item.event, item.handler);
      }
    });

    // Handle delete and edit button clicks with event delegation
    document.addEventListener('click', (e) => {
      // Handle delete button clicks
      if (e.target.classList.contains('btn-delete') || e.target.closest('.btn-delete')) {
        e.preventDefault();
        e.stopPropagation();
        const button = e.target.classList.contains('btn-delete') ? e.target : e.target.closest('.btn-delete');
        const transactionId = button.getAttribute('data-id');
        if (transactionId) {
          this.confirmAndDeleteTransaction(transactionId, new Date());
        }
        return;
      }

      // Handle edit button clicks
      if (e.target.classList.contains('btn-edit') || e.target.closest('.btn-edit')) {
        e.preventDefault();
        e.stopPropagation();
        const button = e.target.classList.contains('btn-edit') ? e.target : e.target.closest('.btn-edit');
        const transactionId = button.getAttribute('data-id');
        if (transactionId) {
          this.editTransaction(transactionId);
        }
        return;
      }
    });

    // CSV file input
    const csvFileInput = document.getElementById('csv-file-input');
    if (csvFileInput) {
      csvFileInput.addEventListener('change', (e) => this.handleCSVFile(e));
    }

    // Calendar navigation
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => this.navigateMonth(-1));
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => this.navigateMonth(1));

    // Initialize any other event listeners
    this.initializeAdditionalEventListeners();
  }

  initializeAdditionalEventListeners() {
    // Initialize CSV dropzone
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
        if (files && files.length > 0) {
          this.processCSVFile(files[0]);
        }
      });
    }

    // "Select File" button triggers hidden file input
    const selectFileBtn = document.getElementById('select-file-btn');
    if (selectFileBtn) {
      selectFileBtn.onclick = () => {
        const fileInput = document.getElementById('csv-file-input');
        if (fileInput) {
          fileInput.click();
        }
      };
    }
  }

  /**
   * Switch between main application views
   * @param {string} view - The name of the view to display (dashboard, transactions, calendar, etc.)
   */
  async switchView(view) {
    try {
      console.log(`Switching to view: ${view}`);

      // Update navigation active state
      document.querySelectorAll('.nav__link').forEach((link) => link.classList.remove('nav__link--active'));
      const activeNav = document.querySelector(`[data-view="${view}"]`);
      if (activeNav) activeNav.classList.add('nav__link--active');

      // Update visible view containers
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('view--active'));
      const activeView = document.getElementById(`${view}-view`);
      if (activeView) activeView.classList.add('view--active');

      // Special cases for certain views
      if (view === 'calendar') {
        if (!this.selectedDate) this.selectedDate = new Date();
        await this.renderCalendar(this.selectedDate);
      } else if (view === 'search' && this.searchManager) {
        // Lazily initialize search manager the first time search view is shown
        try {
          this.searchManager.initialize();
        } catch (err) {
          console.error('Failed to initialize search manager', err);
        }
      }

      // Update current view & render
      this.currentView = view;
      await this.renderCurrentView();

      // Re-bind listeners that may have been replaced by new HTML
      this.bindEventListeners();

      console.log(`Successfully switched to ${view} view`);
      return true;
    } catch (error) {
      console.error(`Error switching to ${view} view:`, error);
      this.showToast(`Error loading ${view} view`, 'error');
      return false;
    }
  }

  /**
   * Render the currently active view
   */
  async renderCurrentView() {
    // Wait until the database has finished initialising
    if (!this.dbInitialized) {
      console.log('Waiting for database to initialise…');
      setTimeout(() => this.renderCurrentView(), 100);
      return;
    }

    try {
      switch (this.currentView) {
        case 'dashboard':
          await this.renderDashboard();
          break;

        case 'transactions':
          await this.renderTransactions();
          break;

        case 'budget':
          await this.renderBudget();
          break;

        case 'overview':
        await this.renderOverview();
        break;

      case 'reports':
          await this.renderReports();
          break;

        case 'settings':
          await this.renderSettings();
          break;

        case 'calendar':
          await this.renderCalendar(this.selectedDate || new Date());
          break;

        case 'search':
          if (this.searchManager) {
            this.searchManager.initialize();
            this.renderSearch();
          }
          break;

        default:
          await this.renderDashboard();
      }
    } catch (error) {
      console.error('Error in renderCurrentView:', error);

      // Show friendly error in UI
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        mainContent.innerHTML = `
          <div class="alert alert-danger">
            <h4>Error loading view</h4>
            <p>${this.escapeHtml(error.message)}</p>
          </div>`;
      }
    }
  }

  // Detect bank format from CSV headers
  detectBankFormat(headers) {
    if (!headers || !headers.length) return null;
        
  // Strip quotes from headers
  headers = headers.map(header => header.trim().replace(/^"|"$/g, ''));

  for (const [_key, format] of Object.entries(BudgetApp.BANK_FORMATS)) {
    const requiredFields = [format.date, format.description, format.amount]
      .filter(Boolean)
      .map(f => f.toLowerCase());

    // Check each required field against individual headers for more reliable match
    const hasAllFields = requiredFields.every(reqField =>
      headers.some(h => h.toLowerCase().includes(reqField))
    );

    if (hasAllFields) {
      console.log(`Detected ${format.name} format`);
      return format;
    }
  }
        
  return null;
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
        let _skipLines = 0;
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
          _skipLines = bankFormat.skipLines || 0;
          switch (bankFormat.name) {
            // Special handling for Citi credit cards
            case 'citi':
              columnIndices.date = headers.findIndex(h => h === 'Transaction Date');
              columnIndices.description = headers.findIndex(h => h === 'Description');
              columnIndices.amount = headers.findIndex(h => h === 'Amount');
              columnIndices.type = headers.findIndex(h => h === 'Type');
              break;        
            default:
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
          }
          console.log(`Using ${bankFormat.name} format with column mapping:`, columnIndices);
        } else {
          // Default column mapping (try to auto-detect)
          headers.forEach((header, index) => {
            const lowerHeader = header.toLowerCase().trim();

            // Detect date column - include a wider array of keywords, including concatenated variations
            if (['date', 'transactiondate', 'transaction date', 'transdate', 'trans date', 'posting date', 'post date', 'date posted', 'posted'].some(k => lowerHeader.includes(k))) {
              columnIndices.date = index;

            // Detect description column
            } else if (['desc', 'description', 'memo', 'details', 'note', 'narrative'].some(k => lowerHeader.includes(k))) {
              columnIndices.description = index;

            // Detect amount column - include debit/credit keywords as fallback
            } else if (['amount', 'value', 'total', 'transaction amount', 'debit', 'credit'].some(k => lowerHeader.includes(k))) {
              columnIndices.amount = index;

            // Detect type column
            } else if (['type', 'transaction type'].some(k => lowerHeader.includes(k))) {
              columnIndices.type = index;

            } else if (lowerHeader.includes('category') || lowerHeader.includes('cat')) {
              columnIndices.category = index;
            } else if (['account', 'bank', 'source'].some(k => lowerHeader.includes(k))) {
              columnIndices.account = index;
            }
          });
        }
                    
// --------------------------------------------------------------------
// Fallback heuristic – if critical columns (date/description/amount) are
// still undetected after the primary mapping logic above (e.g. when a
// bank format is mistakenly detected but the exact header names differ),
// attempt another pass using looser matching rules.
// --------------------------------------------------------------------
if (columnIndices.date === -1 || columnIndices.description === -1 || columnIndices.amount === -1) {
  headers.forEach((header, index) => {
    const h = header.toLowerCase().trim();

    if (columnIndices.date === -1 && /date/.test(h)) {
      columnIndices.date = index;
    }
    if (columnIndices.description === -1 && /(desc|description|memo|details|note|narrative)/.test(h)) {
      columnIndices.description = index;
    }
    if (columnIndices.amount === -1 && /(amount|debit|credit|value|total|transaction)/.test(h)) {
      columnIndices.amount = index;
    }
  });
}

console.log('Detected column indices (after fallback):', columnIndices);
                    
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
              console.log(`CSV row ${i}: rawDate="${columnIndices.date >= 0 ? values[columnIndices.date] : ''}", parsedDate="${transactionDate}"`);
                            
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
                    
          // Show success toast instead of multiple blocking alerts
          this.showNotification(`Parsed ${transactions.length} transactions. ${skippedRows.length} row(s) skipped.`, 'success');
          resolve(transactions);
                    
        } catch (error) {
          console.error('Error processing CSV file:', error);
          alert(`Error processing CSV file: ${error.message}`);
          // Reset the file input
          const fileInput = document.getElementById('csv-file-input');
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
      .replace(/>/g, '&gt;');
  }

  /**
   * Parse CSV line with proper handling of quoted fields and escaped quotes
   * @param {string} line - The CSV line to parse
   * @returns {Array} Array of parsed fields
   */
  parseCSVLine(line) {
    const pattern = /(?:^|,)(?:(?:(?:"((?:[^"]|"")*)")|([^",]*)))/g;
    const fields = [];
    let match;

    while ((match = pattern.exec(line)) !== null) {
      let field = match[1] !== undefined ? match[1] : match[2];
      
      // Handle escaped quotes within the field
      if (field !== undefined) {
        field = field.replace(/""/g, '"');
        fields.push(field);
      }
    }
    
    // Trim whitespace and remove surrounding quotes
    return fields.map(field => {
      field = field.trim();
      if (field.startsWith('"') && field.endsWith('"')) {
        field = field.substring(1, field.length - 1);
      }
      return field;
    });
  }
    
  /**
     * Parse a date string into YYYY-MM-DD format
     * @param {string} dateStr - The date string to parse
     * @param {string} [format='auto'] - Optional format hint (e.g., 'MM/DD/YYYY', 'DD-MM-YYYY')
     * @returns {string} Formatted date string (YYYY-MM-DD)
    return new Date().toISOString().split('T')[0];
  }

  // Try native Date constructor first (handles ISO and RFC strings).
  const native = new Date(dateStr);
  if (!isNaN(native.getTime())) {
    return native.toISOString().split('T')[0];
    // Try common date formats
    const formats = [
      // MM/DD/YYYY or M/D/YYYY
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/,
      // YYYY-MM-DD
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      // DD-MM-YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      // Month DD, YYYY (e.g., Jan 5, 2023)
      /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{4})$/i

      const match = dateStr.match(pattern);
        } else {
          // Ambiguous – default to US style
          month = first;
          day = second;
        }
        month = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
      } else if (pattern === formats[3]) { // Month DD, YYYY
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december'];
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
  /**
     * Parse an amount string into a number
     * @param {string} amountStr - The amount string to parse
     * @param {string} [format='auto'] - Optional format hint (e.g., 'US', 'EU')
     * @returns {number} Parsed amount as a number
     */
  parseAmount(amountStr, _format = 'auto') {
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
    const importCount = document.getElementById('import-count');
    const dropzone = document.getElementById('csv-dropzone');
    const fileInput = document.getElementById('csv-file-input');
    
    if (!preview || !confirmBtn || !cancelBtn || !importCount || !dropzone) {
      console.error('Required preview elements not found');
      return;
    }
    
    try {
      // Hide dropzone and show preview
      dropzone.style.display = 'none';
      preview.classList.remove('hidden');
      
      if (transactions.length === 0) {
        preview.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            No valid transactions found to import.
          </div>`;
        confirmBtn.classList.add('hidden');
        return;
      }
      
      // Update import count in the confirm button
      importCount.textContent = transactions.length;
      
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
                `<span class="badge bg-secondary me-1">${this.escapeHtml(cat)}</span>`
              ).join('')}
            </div>
          </div>
          
          <div class="table-responsive mt-3">
            <table class="table table-sm table-hover">
              <thead class="table-light">
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th class="text-end">Amount</th>
                  <th>Category</th>
                  <th>Account</th>
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
                    <div class="description-text text-truncate" style="max-width: 200px">
                      ${this.escapeHtml(t.description || '')}
                    </div>
                  </td>
                  <td class="text-end ${amount >= 0 ? 'text-success' : 'text-danger'}">
                    ${this.formatCurrency(amount)}
                  </td>
                  <td>${this.escapeHtml(t.category || 'Uncategorized')}</td>
                  <td>${this.escapeHtml(t.account || '')}</td>
                </tr>`;
      }
      
      // Add summary row if there are more transactions
      if (transactions.length > 10) {
        html += `
                <tr class="table-info">
                  <td colspan="2" class="text-end fw-bold">And ${transactions.length - 10} more transactions...</td>
                  <td class="text-end fw-bold">${this.formatCurrency(totalAmount)}</td>
                  <td colspan="2"></td>
                </tr>`;
      }
      
      // Close table and preview content
      html += `
              </tbody>
            </table>
          </div>`;
      
      // Add skipped rows section if any
      if (skippedRows.length > 0) {
        html += `
          <div class="alert alert-warning mt-3">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                ${skippedRows.length} rows were skipped due to errors
              </div>
              <button class="btn btn-sm btn-outline-warning" id="show-skipped-rows">
                Show Details
              </button>
            </div>
            <div id="skipped-rows-details" class="mt-2" style="display: none;">
              <table class="table table-sm table-bordered mt-2">
                <thead>
                  <tr>
                    <th>Row #</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  ${skippedRows.map(row => `
                    <tr>
                      <td>${row.line}</td>
                      <td>${this.escapeHtml(row.reason)}</td>
                    </tr>`
                  ).join('')}
                </tbody>
              </table>
              <button class="btn btn-sm btn-outline-secondary" id="export-skipped-rows">
                <i class="bi bi-download me-1"></i> Export Skipped Rows
              </button>
            </div>
          </div>`;
      }
      
      // Close preview content div
      html += `
        </div>`;
      
      // Set the HTML content
      preview.innerHTML = html;
      
      // Show the confirm button
      confirmBtn.classList.remove('hidden');
      
      // Add event listeners for show/hide skipped rows
      const showSkippedBtn = document.getElementById('show-skipped-rows');
      if (showSkippedBtn) {
        showSkippedBtn.addEventListener('click', (e) => {
          const details = document.getElementById('skipped-rows-details');
          if (details) {
            const isVisible = details.style.display !== 'none';
            details.style.display = isVisible ? 'none' : 'block';
            e.target.textContent = isVisible ? 'Show Details' : 'Hide Details';
          }
        });
      }
      
      // Add event listener for export skipped rows
      const exportSkippedBtn = document.getElementById('export-skipped-rows');
      if (exportSkippedBtn) {
        exportSkippedBtn.addEventListener('click', () => {
          this.exportSkippedRows(skippedRows);
        });
      }
      
      // Store transactions for confirmation
      this.pendingImport = transactions;
      this.skippedImportRows = skippedRows;
      
    } catch (error) {
      console.error('Error showing CSV preview:', error);
      if (preview) {
        preview.innerHTML = `
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            Error showing preview: ${error.message}
          </div>`;
        preview.classList.remove('hidden');
      } else {
        alert(`Error generating preview: ${error.message}`);
      }
      if (confirmBtn) {
        confirmBtn.classList.add('hidden');
      }
    }
  }
    
  // Confirm and import the CSV data
  async confirmCSVImport() {
  // Prevent duplicate imports by tracking existing transactions
  await this.loadTransactions();
  const existingKeySet = new Set(
    this.transactions.map(t => `${t.date}|${(t.description || '').trim().toLowerCase()}|${t.amount}`)
  );
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
      const dedupKey = `${transaction.date}|${(transaction.description || '').trim().toLowerCase()}|${transaction.amount}`;
      if (existingKeySet.has(dedupKey)) {
        console.log(`Skipping duplicate transaction at import index ${index}:`, transaction);
        results.skipped += 1;
        continue;
      }
      existingKeySet.add(dedupKey);
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
      const resultMessage = [];
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
        this.showNotification(resultMessage.join('\n'), results.failed > 0 ? 'error' : 'success');
      } else {
        this.showNotification('No transactions were processed. Please check your file and try again.', 'info');
      }
            
      // Log any errors
      if (results.errors.length > 0) {
        console.error('Import results:', results.errors);
      }
            
      // Update UI and refresh all views
      try {
        // Reload all data
        await Promise.all([
          this.loadTransactions(),
          this.loadBudgetCategories(),
          this.loadAccounts()
        ]);
        
        // Refresh all views
        const viewUpdates = [];
        
        // Always refresh dashboard and analytics
        if (typeof this.renderDashboard === 'function') {
          viewUpdates.push(this.renderDashboard());
        }
        
        if (typeof this.renderCalendar === 'function') {
          viewUpdates.push(this.renderCalendar());
        }
        
        // Always update analytics
        viewUpdates.push(this.updateAnalytics());
        
        // If currently in transactions view, refresh it
        if (this.currentView === 'transactions' && typeof this.renderTransactions === 'function') {
          viewUpdates.push(this.renderTransactions());
        }
        
        // If in search view, refresh search results
        if (this.currentView === 'search' && this.searchManager && typeof this.searchManager.filterTransactions === 'function') {
          viewUpdates.push(this.searchManager.filterTransactions());
        }
        
        // Wait for all view updates to complete
        await Promise.all(viewUpdates);
        
        // Show success message
        this.showToast('success', 'Import Complete', `Successfully imported ${results.success} transactions`);
        
      } catch (error) {
        console.error('Error refreshing views after import:', error);
        this.showToast('error', 'Import Error', 'Imported data but failed to refresh all views');
      }
            
    } catch (error) {
      const errorMsg = `Error during import: ${error.message}`;
      console.error(errorMsg, error);
      alert(errorMsg);
    } finally {
      this.pendingImport = [];
    }
  }
    
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
  }

  parseCurrency(currencyString) {
    if (!currencyString) return 0;
    // Remove any non-numeric characters except decimal point and minus sign
    const numberString = currencyString.replace(/[^0-9.-]+/g, '');
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
    
  // Update analytics (charts, stats, etc.)
  async updateAnalytics() {
    try {
      // Example: update charts/stats for dashboard and analytics views
      if (window.Chart && this.transactions && Array.isArray(this.transactions)) {
        // (Assume you have chart instances stored in this.charts)
        if (this.charts && this.charts.dashboard) {
          // Update dashboard chart with latest transactions
          this.charts.dashboard.data = this.transactions;
        }
        if (this.charts && this.charts.analytics) {
          // Update analytics chart window.txnAnalytics = new TransactionAnalytics();
        }
      }
      // Optionally, update custom analytics summary UI here
    } catch (error) {
      console.error('Error updating analytics:', error);
    }
  }

  // Initialize or update analytics charts based on current view
  initializeOrUpdateAnalytics(transactions) {
    try {
      if (this.currentView === 'transactions') {
        // If transactions are provided, use them; otherwise, let the method fetch them
        this.renderTransactionsAnalyticsCharts(transactions);
      } else if (this.currentView === 'dashboard') {
        this.renderDashboard();
      } else if (this.currentView === 'search' && this.searchManager) {
        // Use the renderSearchResults method instead of safeRenderResults
        if (typeof this.searchManager.renderSearchResults === 'function') {
          this.searchManager.renderSearchResults();
        } else if (this.searchManager.performSearch) {
          this.searchManager.performSearch();
        }
      }
    } catch (error) {
      console.error('Error in initializeOrUpdateAnalytics:', error);
    }
  }
  
  /**
   * Render analytics charts for transactions
   * @param {Array} [transactions] - Optional transactions to use for analytics
   */
  async renderTransactionsAnalyticsCharts(transactionsToUse) {
    try {
      
      
      // Use provided transactions or get all transactions if not provided
      const transactions = transactionsToUse || await this.loadTransactions();
      
      if (!transactions || transactions.length === 0) {
        
        // Hide or clear any existing charts
        const analyticsContainer = document.getElementById('transactions-analytics-container');
        if (!analyticsContainer) {
          return; // Not on analytics-capable view, exit quietly
        }
        analyticsContainer.innerHTML = '<p class="text-muted">No transaction data available for analytics.</p>';
        return;
      }
      
      // Group transactions by category for category breakdown
      const categoryTotals = {};
      transactions.forEach(transaction => {
        const category = transaction.category || 'Uncategorized';
        const amount = Math.abs(parseFloat(transaction.amount) || 0);
        
        if (!categoryTotals[category]) {
          categoryTotals[category] = 0;
        }
        categoryTotals[category] += amount;
      });
      
      // Sort categories by total amount (descending)
      const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Limit to top 10 categories
      
      // Prepare data for charts
      const categoryLabels = sortedCategories.map(([category]) => category);
      const categoryData = sortedCategories.map(([_, total]) => total);
      
      // Get or create chart containers
      const analyticsContainer = document.getElementById('transactions-analytics-container');
      if (!analyticsContainer) {
        console.error('Analytics container not found');
        return;
      }
      
      // Clear previous content
      analyticsContainer.innerHTML = `
        <div class="row">
          <div class="col-md-6">
            <div class="card mb-4">
              <div class="card-header">Spending by Category</div>
              <div class="card-body">
                <canvas id="category-chart"></canvas>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card mb-4">
              <div class="card-header">Monthly Spending Trend</div>
              <div class="card-body">
                <canvas id="monthly-trend-chart"></canvas>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // 1. Category Pie Chart
      const categoryCtx = document.getElementById('category-chart').getContext('2d');
      if (this.charts.categoryChart) {
        this.charts.categoryChart.destroy();
      }
      
      this.charts.categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
          labels: categoryLabels,
          datasets: [{
            data: categoryData,
            backgroundColor: [
              '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
              '#5a5c69', '#858796', '#a6aab8', '#b7b9cc', '#d1d3e2'
            ],
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
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = Math.round((value / total) * 100);
                  return `${label}: ${value.toFixed(2)} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
      
      // 2. Monthly Trend Chart
      // Group transactions by month
      const monthlyData = {};
      transactions.forEach(transaction => {
        if (!transaction.date) return;
        
        const date = new Date(transaction.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const amount = parseFloat(transaction.amount) || 0;
        
        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = 0;
        }
        monthlyData[monthYear] += amount;
      });
      
      // Sort months chronologically
      const sortedMonths = Object.keys(monthlyData).sort();
      const monthlyLabels = sortedMonths.map(monthYear => {
        const [year, monthNum] = monthYear.split('-');
        return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      });
      
      const monthlyAmounts = sortedMonths.map(monthKey => Math.abs(monthlyData[monthKey]));
      
      const trendCtx = document.getElementById('monthly-trend-chart').getContext('2d');
      if (this.charts.trendChart) {
        this.charts.trendChart.destroy();
      }
      
      this.charts.trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: monthlyLabels,
          datasets: [{
            label: 'Monthly Spending',
            data: monthlyAmounts,
            borderColor: '#4e73df',
            backgroundColor: 'rgba(78, 115, 223, 0.05)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#4e73df',
            pointBorderColor: '#fff',
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#4e73df',
            pointHoverBorderColor: '#fff',
            pointHitRadius: 10,
            pointBorderWidth: 2
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
                  return '$' + value.toLocaleString();
                }
              }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  return '$' + context.raw.toLocaleString(undefined, { minimumFractionDigits: 2 });
                }
              }
            }
          }
        }
      });
      
      console.log('Successfully rendered transactions analytics charts');
      
    } catch (error) {
      console.error('Error rendering transactions analytics charts:', error);
      const analyticsContainer = document.getElementById('transactions-analytics-container');
      if (analyticsContainer) {
        analyticsContainer.innerHTML = `
          <div class="alert alert-danger">
            Error loading analytics: ${error.message}
          </div>
        `;
      }
    }
  }

  /**
   * Render the transactions view – lightweight implementation to list transactions
   */
  /**
   * Render Transactions view with search and date filtering controls
   */
  async renderTransactions() {
    const viewEl = document.getElementById('transactions-view');
    if (!viewEl) {
      console.warn('transactions-view container not found');
      return;
    }

    try {
      // Ensure transactions are in memory
      if (!this.transactions || this.transactions.length === 0) {
        await this.loadTransactions();
      }

      // Sort newest first
      const txns = [...this.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

      const rowsHtml = txns.map(t => `
        <tr data-id="${this.escapeHtml(t.id)}">
          <td>${new Date(t.date).toLocaleDateString()}</td>
          <td>${this.escapeHtml(t.description || '')}</td>
          <td>${this.escapeHtml(t.category || 'Uncategorised')}</td>
          <td class="${t.amount < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(Math.abs(t.amount))}</td>
        </tr>`).join('');

      viewEl.innerHTML = `
        <div id="transactions-search-controls" class="d-flex flex-wrap gap-2 mb-3">
          <input type="search" class="form-control" id="txn-search-input" style="max-width:260px" placeholder="Search (use | between terms)">
          <select class="form-select" id="txn-date-range-select" style="max-width:160px">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="last30">Last 30 Days</option>
            <option value="custom">Custom…</option>
          </select>
          <input type="date" class="form-control d-none" id="txn-custom-start">
          <input type="date" class="form-control d-none" id="txn-custom-end">
        </div>
        <!-- Analytics expandable section -->
        <div id="transactions-analytics-wrapper" class="mb-3">
          <button id="toggle-analytics-btn" class="btn btn-outline-secondary btn-sm mb-2" type="button">
            Show Analytics ▼
          </button>
          <button id="swap-order-btn" class="btn btn-outline-secondary btn-sm mb-2 ms-2" type="button">
 
           <button id="delete-all-btn" class="btn btn-outline-danger btn-sm mb-2 ms-2" type="button">
             Delete All
           </button>
            Analytics Below ▼
          </button>
          <div id="transactions-analytics-section" class="card d-none">
            <div class="card-body">
              <div id="txn-analytics-stats" class="row row-cols-2 row-cols-md-3 g-3 mb-4"></div>
              <div id="txn-analytics-charts" class="row g-4">
                <div class="col-md-6">
                  <canvas id="price-trend-chart" style="height:320px"></canvas>
                </div>
                <div class="col-md-6">
                  <canvas id="transactions-distribution-chart" style="height:320px"></canvas>
                </div>
                <div class="col-md-6">
                  <canvas id="transactions-seasonality-chart" style="height:320px"></canvas>
                </div>
                <div class="col-md-6">
                  <canvas id="transactions-boxplot-chart" style="height:320px"></canvas>
                </div>
                <!-- Forecast & Johnson charts could be inserted similarly -->
              </div>
            </div>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table table-striped" id="transactions-table">
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="text-end">Amount</th></tr></thead>
            <tbody id="transactions-table-body">${rowsHtml}</tbody>
          </table>
        </div>`;

      // initialize search & filter controls
      this.setupTransactionsSearchControls();

    } catch (err) {
      console.error('Error rendering transactions view:', err);
      viewEl.innerHTML = `<div class="alert alert-danger">Failed to load transactions: ${this.escapeHtml(err.message)}</div>`;
    }
  }

  /**
   * Setup event listeners for transactions search and date range filters
   */
  setupTransactionsSearchControls() {
    const searchInput = document.getElementById('txn-search-input');
    const rangeSelect = document.getElementById('txn-date-range-select');
    const customStart = document.getElementById('txn-custom-start');
    const customEnd = document.getElementById('txn-custom-end');
    const tbody = document.getElementById('transactions-table-body');
    const analyticsWrapper = document.getElementById('transactions-analytics-wrapper');
    const analyticsSection = document.getElementById('transactions-analytics-section');
    const toggleAnalyticsBtn = document.getElementById('toggle-analytics-btn');
    const swapOrderBtn = document.getElementById('swap-order-btn');

    // ---------------- Analytics Controls ------------------
    // Expand/collapse analytics section
    if (toggleAnalyticsBtn && analyticsSection) {
      toggleAnalyticsBtn.addEventListener('click', () => {
        const willShow = analyticsSection.classList.contains('d-none');
        analyticsSection.classList.toggle('d-none', !willShow);
        toggleAnalyticsBtn.innerHTML = willShow ? 'Hide Analytics ▲' : 'Show Analytics ▼';
      });
    }

    // Swap analytics order (above/below table)
    if (swapOrderBtn && analyticsWrapper) {
      swapOrderBtn.addEventListener('click', () => {
        const viewEl = document.getElementById('transactions-view');
        if (!viewEl) return;
        const tableContainer = viewEl.querySelector('.table-responsive');
        if (!tableContainer) return;

        const analyticsCurrentlyAbove = analyticsWrapper.nextElementSibling && analyticsWrapper.nextElementSibling.classList.contains('table-responsive');
        if (analyticsCurrentlyAbove) {
          // Move below table
          viewEl.insertBefore(analyticsWrapper, tableContainer.nextSibling);
          swapOrderBtn.innerHTML = 'Analytics Above ▲';
        } else {
          // Move above table
          viewEl.insertBefore(analyticsWrapper, tableContainer);
          swapOrderBtn.innerHTML = 'Analytics Below ▼';
        }
      });
    }

    if (!searchInput || !rangeSelect || !tbody) return;

    const filterAndRender = () => {
      const terms = searchInput.value
        .split('|')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      // Determine date range
      let startDate = null;
      let endDate = null;
      const today = new Date();
      switch (rangeSelect.value) {
        case 'today':
          startDate = endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          break;
        case 'week': {
          const first = new Date(today);
          first.setDate(today.getDate() - today.getDay()); // Sunday
          startDate = first;
          endDate = today;
          break;
        }
        case 'month':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          endDate = today;
          break;
        case 'last30': {
          const past = new Date(today);
          past.setDate(today.getDate() - 29);
          startDate = past;
          endDate = today;
          break;
        }
        case 'custom':
          if (customStart.value) startDate = new Date(customStart.value);
          if (customEnd.value) endDate = new Date(customEnd.value);
          break;
        default:
          break; // 'all' – no date filtering
      }

      const filtered = this.transactions.filter(t => {
        const d = new Date(t.date);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;

        if (terms.length === 0) return true;
        const haystack = `${(t.description || '')} ${(t.category || '')} ${(t.notes || '')}`.toLowerCase();
        return terms.some(term => haystack.includes(term));
      }).sort((a, b) => new Date(b.date) - new Date(a.date));

      // update table
      // Update analytics section
transactionAnalytics.updateAnalytics(filtered);
transactionAnalytics.showAnalytics(filtered.length > 0);

      tbody.innerHTML = filtered.map(t => `
        <tr data-id="${this.escapeHtml(t.id)}">
          <td>${new Date(t.date).toLocaleDateString()}</td>
          <td>${this.escapeHtml(t.description || '')}</td>
          <td>${this.escapeHtml(t.category || 'Uncategorised')}</td>
          <td class="${t.amount < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(Math.abs(t.amount))}</td>
        </tr>`).join('');
    };

    // Show/hide custom date inputs
    const toggleCustomDates = () => {
      const show = rangeSelect.value === 'custom';
      customStart.classList.toggle('d-none', !show);
      customEnd.classList.toggle('d-none', !show);
    };

    searchInput.addEventListener('input', () => {
      clearTimeout(this._txnSearchTimeout);
      this._txnSearchTimeout = setTimeout(filterAndRender, 300);
    });

    rangeSelect.addEventListener('change', () => {
      toggleCustomDates();
      filterAndRender();
    });

    customStart.addEventListener('change', filterAndRender);
    customEnd.addEventListener('change', filterAndRender);

    toggleCustomDates();
  }

  /**
   * Render the budget view – placeholder table until full implementation
   */
  async renderBudget() {
    const viewEl = document.getElementById('budget-view');
    if (!viewEl) {
      console.warn('budget-view container not found');
      return;
    }

    try {
      if (!this.budgetCategories || this.budgetCategories.length === 0) {
        await this.loadBudgetCategories();
      }

      const rows = this.budgetCategories.map(c => `
        <tr><td>${this.escapeHtml(c.name)}</td><td>${this.formatCurrency(c.limit || 0)}</td></tr>`).join('');

      viewEl.innerHTML = `
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead>
              <tr>
                <th>Category</th>
                <th>Budget</th>
                <th>Spent</th>
                <th>Remaining</th>
                <th>Progress</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="budget-categories"></tbody>
          </table>
        </div>`;
    } catch (err) {
      console.error('Error rendering budget view:', err);
      viewEl.innerHTML = `<div class="alert alert-danger">Failed to load budget data: ${this.escapeHtml(err.message)}</div>`;
    }
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
      const confirmDelete = confirm('Are you sure you want to delete this transaction?\n\n' +
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
   * Add a transaction to the database
   * @param {Object} transaction - Transaction object to add
   * @returns {Promise<boolean>} - True if successful
   */
  async addTransaction(transaction) {
    try {
      // Generate a unique ID if not present
      if (!transaction.id) {
        transaction.id = Date.now().toString() + Math.floor(Math.random() * 10000);
      }
      await this.db.addItem('transactions', transaction);
      return true;
    } catch (error) {
      console.error('Error adding transaction:', error, transaction);
      return false;
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
  }
    
  /**
   * Lightweight wrapper used by older code – maps to showNotification
   * @param {string} type - success | error | info
   * @param {string} title - Brief title text
   * @param {string} message - Detailed description
   */
  showToast(type = 'info', title = '', message = '') {
    // Concatenate title + message for a single notification line
    const full = title ? `${title}${message ? ': ' + message : ''}` : message;
    this.showNotification(full, type);
  }

  /**
     * Show a notification to the user
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

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      // Slide out
      notification.style.transform = 'translateX(120%)';
      // Remove element after transition
      setTimeout(() => {
        notification.remove();
        // If container empty, remove it
        if (notificationContainer.childElementCount === 0) {
          notificationContainer.remove();
        }
      }, 300);
    }, 4000);
  }


/**
   * Render the Overview tab – interactive trend and forecast charts per description category
   */
  async renderOverview() {
    // ------- Persist filter state -------
    if (!this.overviewFilter) {
      this.overviewFilter = { showDebits: true, showCredits: true };
    } else {
      // If header exists, capture live checkbox states before wiping DOM
      const existingDebits = document.getElementById('overview-toggle-debits');
      const existingCredits = document.getElementById('overview-toggle-credits');
      if (existingDebits && existingCredits) {
        this.overviewFilter.showDebits = existingDebits.checked;
        this.overviewFilter.showCredits = existingCredits.checked;
      }
    }

    // ----- Build / ensure control panel and summary -----
    const headerContainerId = 'overview-header';
    let headerContainer = document.getElementById(headerContainerId);
    if (!headerContainer) {
      headerContainer = document.createElement('div');
      headerContainer.id = headerContainerId;
      headerContainer.className = 'mb-3';
      // Insert before charts container if exists later
      const chartsEl = document.getElementById('overview-charts');
      if (chartsEl) chartsEl.parentNode.insertBefore(headerContainer, chartsEl);
    } else {
      headerContainer.innerHTML = '';
    }

    // Control toggles
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'mb-2';
    controlsDiv.innerHTML = `
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" id="overview-toggle-debits" ${this.overviewFilter.showDebits ? 'checked' : ''}>
        <label class="form-check-label" for="overview-toggle-debits">Show Debits</label>
      </div>
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" id="overview-toggle-credits" ${this.overviewFilter.showCredits ? 'checked' : ''}>
        <label class="form-check-label" for="overview-toggle-credits">Show Credits</label>
      </div>`;
    headerContainer.appendChild(controlsDiv);

    // Summary placeholder
    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'overview-summary';
    headerContainer.appendChild(summaryDiv);

    // Add listeners (will overwrite each time safely)
    const debitsCb = controlsDiv.querySelector('#overview-toggle-debits');
    const creditsCb = controlsDiv.querySelector('#overview-toggle-credits');
    debitsCb.onchange = () => {
      this.overviewFilter.showDebits = debitsCb.checked;
      this.renderOverview();
    };
    creditsCb.onchange = () => {
      this.overviewFilter.showCredits = creditsCb.checked;
      this.renderOverview();
    };

    const showDebits = this.overviewFilter.showDebits;
    const showCredits = this.overviewFilter.showCredits;


    const container = document.getElementById('overview-charts');
    if (!container) {
      console.warn('overview-charts container not found');
      return;
    }

    // Ensure transactions are loaded
    await this.loadTransactions();

    // Clean previous charts and HTML
    if (Array.isArray(this.overviewCharts)) {
      this.overviewCharts.forEach(ch => {
        try { ch.destroy(); } catch (e) { /* ignore */ }
      });
    }
    this.overviewCharts = [];
    container.innerHTML = '';

    if (!this.transactions || this.transactions.length === 0) {
      container.innerHTML = '<p class="text-muted">No transactions available to display.</p>';
      return;
    }

    // Group transactions by description (case-insensitive) - apply debit/credit filter
    const groups = {};
    this.transactions.forEach(t => {
      const amtRaw = parseFloat(t.amount) || 0;
      if ((amtRaw < 0 && !showDebits) || (amtRaw > 0 && !showCredits)) return;
      const desc = (t.description || 'Uncategorized').trim().toLowerCase();
      if (!groups[desc]) groups[desc] = [];
      groups[desc].push(t);
    });

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // ----- Compute summary data -----
    let totalDebits = 0, totalCredits = 0;
    this.transactions.forEach(t => {
      const amtRaw = parseFloat(t.amount) || 0;
      if (amtRaw < 0) totalDebits += Math.abs(amtRaw);
      else totalCredits += amtRaw;
    });
    const net = totalCredits - totalDebits;
    summaryDiv.innerHTML = `
      <div class="d-flex flex-wrap gap-3">
        <span><strong>Total Debits:</strong> ${this.formatCurrency(totalDebits)}</span>
        <span><strong>Total Credits:</strong> ${this.formatCurrency(totalCredits)}</span>
        <span><strong>Net:</strong> ${this.formatCurrency(net)}</span>
        <span><strong>Transactions:</strong> ${this.transactions.length}</span>
      </div>`;

    let chartIdx = 0;

    // ----- Combined Trend & Forecast for All Transactions -----
    try {
      const allMonthlyTotals = {};
      this.transactions.forEach(txn => {
        const amtRaw = parseFloat(txn.amount) || 0;
        if ((amtRaw < 0 && !showDebits) || (amtRaw > 0 && !showCredits)) return;
        const d = new Date(txn.date);
        if (isNaN(d)) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const amt = Math.abs(parseFloat(txn.amount) || 0);
        allMonthlyTotals[key] = (allMonthlyTotals[key] || 0) + amt;
      });

      const allKeys = Object.keys(allMonthlyTotals).sort();
      if (allKeys.length >= 3) {
        const labelsActualAll = allKeys.map(k => {
          const [y, m] = k.split('-');
          return `${monthNames[parseInt(m, 10) - 1]} ${y.slice(2)}`;
        });
        const amountsAll = allKeys.map(k => allMonthlyTotals[k]);

        // Simple linear regression on index vs amount
        const nAll = amountsAll.length;
        let sumXAll = 0, sumYAll = 0, sumXYAll = 0, sumX2All = 0;
        amountsAll.forEach((y, i) => {
          sumXAll += i;
          sumYAll += y;
          sumXYAll += i * y;
          sumX2All += i * i;
        });
        const denomAll = nAll * sumX2All - sumXAll * sumXAll || 1;
        const slopeAll = (nAll * sumXYAll - sumXAll * sumYAll) / denomAll;
        const interceptAll = (sumYAll - slopeAll * sumXAll) / nAll;

        // Forecast next 3 months
        const forecastPeriodsAll = 3;
        const forecastLabelsAll = [];
        const lastDatePartsAll = allKeys[allKeys.length - 1].split('-');
        const lastDateObjAll = new Date(parseInt(lastDatePartsAll[0]), parseInt(lastDatePartsAll[1]) - 1, 1);
        for (let i = 1; i <= forecastPeriodsAll; i++) {
          const idx = nAll - 1 + i;
          const d = new Date(lastDateObjAll);
          d.setMonth(d.getMonth() + i);
          forecastLabelsAll.push(`${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
        }

        const allLabels = [...labelsActualAll, ...forecastLabelsAll];
        const trendValuesAll = allLabels.map((_, i) => parseFloat((interceptAll + slopeAll * i).toFixed(2)));

        // Build DOM elements
        const card = document.createElement('div');
        card.className = 'card mb-4';
        const header = document.createElement('div');
        header.className = 'card-header';
        header.innerHTML = '<strong>All Transactions - Trend & Forecast</strong>';
        const body = document.createElement('div');
        body.className = 'card-body';
        const canvas = document.createElement('canvas');
        canvas.id = `overview-all-chart-${Date.now()}`;
        body.appendChild(canvas);
        card.appendChild(header);
        card.appendChild(body);
        // Insert at the top of container
        container.prepend(card);

        const ctxAll = canvas.getContext('2d');
        const chartAll = new Chart(ctxAll, {
          type: 'line',
          data: {
            labels: allLabels,
            datasets: [
              {
                label: 'Actual',
                data: [...amountsAll, ...Array(forecastPeriodsAll).fill(null)],
                borderColor: 'rgba(54,162,235,1)',
                backgroundColor: 'rgba(54,162,235,0.2)',
                tension: 0.3
              },
              {
                label: 'Trend / Forecast',
                data: trendValuesAll,
                borderColor: 'rgba(255,159,64,1)',
                borderDash: [5, 5],
                pointRadius: 0,
                tension: 0.3
              }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: true } },
            scales: {
              y: { beginAtZero: false, title: { display: true, text: 'Amount ($)' } },
              x: { ticks: { autoSkip: false } }
            }
          }
        });
        this.overviewCharts.push(chartAll);
        chartIdx++;
      }
    } catch (e) {
      console.error('[Overview] Failed to render combined all-transactions chart', e);
    }
    // ----- End Combined Chart -----

    for (const [desc, txns] of Object.entries(groups)) {
      if (txns.length < 3) continue; // need enough data for trend

      // Aggregate totals by month (YYYY-MM key)
      const monthlyTotals = {};
      txns.forEach(txn => {
        const d = new Date(txn.date);
        if (isNaN(d)) return;
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const amtRaw = parseFloat(txn.amount) || 0;
        const amt = Math.abs(amtRaw);
        monthlyTotals[key] = (monthlyTotals[key] || 0) + amt;
      });

      const sortedKeys = Object.keys(monthlyTotals).sort();
      if (sortedKeys.length < 3) continue;

      const labelsActual = sortedKeys.map(k => {
        const [y,m] = k.split('-');
        return `${monthNames[parseInt(m,10)-1]} ${y.slice(2)}`;
      });
      const amounts = sortedKeys.map(k => monthlyTotals[k]);

      // Simple linear regression on index vs amount
      const n = amounts.length;
      let sumX=0,sumY=0,sumXY=0,sumX2=0;
      amounts.forEach((y,i) => {
        sumX += i;
        sumY += y;
        sumXY += i * y;
        sumX2 += i * i;
      });
      const denom = n * sumX2 - sumX * sumX || 1;
      const slope = (n * sumXY - sumX * sumY) / denom;
      const intercept = (sumY - slope * sumX) / n;

      // Forecast next 3 months
      const forecastPeriods = 3;
      const forecastLabels = [];
      const forecastValues = [];
      const lastDateParts = sortedKeys[sortedKeys.length-1].split('-');
      const lastDateObj = new Date(parseInt(lastDateParts[0]), parseInt(lastDateParts[1])-1, 1);
      for (let i = 1; i <= forecastPeriods; i++) {
        const idx = n - 1 + i;
        const val = intercept + slope * idx;
        forecastValues.push(parseFloat(val.toFixed(2)));
        const d = new Date(lastDateObj);
        d.setMonth(d.getMonth() + i);
        forecastLabels.push(`${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
      }

      const allLabels = [...labelsActual, ...forecastLabels];
      const trendValues = allLabels.map((_, i) => parseFloat((intercept + slope * i).toFixed(2)));

      const actualDataset = {
        label: 'Actual',
        data: [...amounts, ...Array(forecastPeriods).fill(null)],
        borderColor: 'rgba(75,192,192,1)',
        backgroundColor: 'rgba(75,192,192,0.2)',
        tension: 0.3
      };
      const trendDataset = {
        label: 'Trend / Forecast',
        data: trendValues,
        borderColor: 'rgba(255,99,132,1)',
        borderDash: [5,5],
        pointRadius: 0,
        tension: 0.3
      };

      // Create card wrapper
      const card = document.createElement('div');
      card.className = 'card mb-4';
      card.innerHTML = `
        <div class="card-body">
          <h6 class="card-title text-capitalize">${this.escapeHtml(desc)}</h6>
          <canvas id="overview-chart-${chartIdx}" style="width:100%;height:300px"></canvas>
        </div>`;
      container.appendChild(card);

      const ctx = card.querySelector('canvas').getContext('2d');
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: allLabels,
          datasets: [actualDataset, trendDataset]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true }
          },
          scales: {
            y: {
              beginAtZero: false,
              title: { display: true, text: 'Amount ($)' }
            },
            x: {
              ticks: { autoSkip: false }
            }
          }
        }
      });
      this.overviewCharts.push(chart);
      chartIdx++;
    }

    if (this.overviewCharts.length === 0) {
      container.innerHTML = '<p class="text-muted">Not enough data to generate overview charts.</p>';
    }
  }

}



// Render account dropdown in navbar
BudgetApp.prototype.renderAccountDropdown = function renderAccountDropdown() {
    let container = document.getElementById('account-dropdown');
    if (!container) {
      // Create minimal dropdown if not present
      const nav = document.querySelector('nav.navbar, nav.nav');
      if (!nav) return;
      container = document.createElement('div');
      container.id = 'account-dropdown';
      container.className = 'dropdown ms-auto';
      container.innerHTML = `<button class="btn btn-outline-secondary dropdown-toggle" id="accountDropdownBtn" data-bs-toggle="dropdown" aria-expanded="false">Account</button><ul class="dropdown-menu" id="accountDropdownMenu"></ul>`;
      nav.appendChild(container);
    }
    const menu = container.querySelector('#accountDropdownMenu');
    const btn = container.querySelector('#accountDropdownBtn');
    menu.innerHTML = '';

    this.accountManager.listAccounts().then(accounts => {
      let activeName = 'Account';
      accounts.forEach(ac => {
        const li = document.createElement('li');
        li.innerHTML = `<a class="dropdown-item${ac.id===this.accountManager.getActiveAccountId() ? ' active' : ''}" href="#">${ac.name}</a>`;
        li.onclick = () => this.accountManager.switchAccount(ac.id);
        menu.appendChild(li);
        if (ac.id === this.accountManager.getActiveAccountId()) activeName = ac.name;
      });

      // divider
      const div1 = document.createElement('li');
      div1.innerHTML = '<hr class="dropdown-divider">';
      menu.appendChild(div1);

      // Reset account
      const resetLi = document.createElement('li');
      resetLi.innerHTML = '<a class="dropdown-item text-danger" href="#">Reset Account (delete all transactions)…</a>';
      resetLi.onclick = () => {
        if (confirm('Delete ALL transactions in this account? This cannot be undone.')) {
          this.confirmAndDeleteAllTransactions();
        }
      };
      menu.appendChild(resetLi);

      // divider
      const div2 = document.createElement('li');
      div2.innerHTML = '<hr class="dropdown-divider">';
      menu.appendChild(div2);

      // New account
      const newLi = document.createElement('li');
      newLi.innerHTML = '<a class="dropdown-item" href="#">+ New Account…</a>';
            newLi.onclick = async () => {
        const name = prompt('Account name');
        if (name) await this.accountManager.createAccount(name);
      };
      menu.appendChild(newLi);

      // Update button label
      btn.textContent = activeName;
    });
  }

export { BudgetApp };

// Initialize the app when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new BudgetApp();
  });
} else {
  window.app = new BudgetApp();
}

// Initialise Budget Manager only after the secure database is ready
(function waitForAppReady() {
  if (window.app && window.app.dbInitialized) {
    try {
      initBudgetManager(window.app);
    } catch (e) {
      console.error('Failed to initialise Budget Manager', e);
    }
  } else {
    // Retry until the app reports dbInitialized
    setTimeout(waitForAppReady, 300);
  }
})();
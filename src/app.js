import { localDB } from './local-db.js';

class BudgetApp {
    constructor() {
        this.currentView = 'dashboard';
        this.initializeEventListeners();
        this.initializeCSVHandlers();
        console.log('BudgetApp initialized');
        
        // Initialize database and load initial data
        this.init();
    }
    
    async init() {
        try {
            await localDB.init();
            this.refreshCurrentView();
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showToast('Error initializing application', 'error');
        }
    }

    initializeEventListeners() {
        // Navigation links
        const navLinks = document.querySelectorAll('.nav__link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                this.switchView(view);
            });
        });

        // Add Transaction buttons
        const addTransactionBtns = [
            document.getElementById('add-transaction-btn'),
            document.getElementById('add-transaction-btn-2'),
            document.getElementById('add-first-transaction')
        ];
        
        addTransactionBtns.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.showModal('add-transaction-modal');
                });
            }
        });

        // Clear all transactions button
        document.getElementById('clear-transactions-btn')?.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete ALL transactions? This action cannot be undone.')) {
                try {
                    await localDB.clearAllTransactions();
                    this.showToast('All transactions have been deleted', 'success');
                    this.loadTransactions(); // Refresh the view
                } catch (error) {
                    console.error('Error clearing transactions:', error);
                    this.showToast('Error clearing transactions', 'error');
                }
            }
        });

        // Import CSV button
        const importCsvBtn = document.getElementById('csv-import-btn');
        if (importCsvBtn) {
            importCsvBtn.addEventListener('click', () => {
                this.showModal('csv-import-modal');
            });
        }

        // Close modal buttons
        const closeButtons = document.querySelectorAll('.modal__close');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const modal = button.closest('.modal');
                if (modal) {
                    this.hideModal(modal.id);
                }
            });
        });
        
        // Transaction search
        const searchInput = document.getElementById('transaction-search');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterTransactions(e.target.value);
                }, 300);
            });
            
            // Clear search
            const clearSearchBtn = document.getElementById('clear-search');
            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', () => {
                    searchInput.value = '';
                    this.filterTransactions('');
                });
            }
        }
        
        // Transaction filter
        const filterSelect = document.getElementById('transaction-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterTransactions('', e.target.value);
            });
        }
    }


    switchView(viewName) {
        console.log(`Switching to view: ${viewName}`);
        
        // Hide all views
        const views = document.querySelectorAll('.view');
        views.forEach(view => {
            view.classList.remove('view--active');
        });
        
        // Show the selected view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('view--active');
            this.refreshView(viewName);
        } else {
            console.warn(`View '${viewName}' not found`);
            // Fallback to dashboard if view not found
            const dashboardView = document.getElementById('dashboard-view');
            if (dashboardView) {
                dashboardView.classList.add('view--active');
                viewName = 'dashboard';
                this.refreshView('dashboard');
            }
        }
        
        // Update active nav link
        const navLinks = document.querySelectorAll('.nav__link');
        navLinks.forEach(link => {
            const linkView = link.getAttribute('data-view');
            if (linkView === viewName) {
                link.classList.add('nav__link--active');
            } else {
                link.classList.remove('nav__link--active');
            }
        });
        
        this.currentView = viewName;
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = ''; // Re-enable scrolling
            
            // Reset CSV import form when closing the modal
            if (modalId === 'csv-import-modal') {
                this.resetCSVImport();
            }
        }
    }
    
    initializeCSVHandlers() {
        const csvFileInput = document.getElementById('csv-file');
        const csvDropzone = document.getElementById('csv-dropzone');
        const selectFileBtn = document.getElementById('select-file-btn');
        const cancelCsvBtn = document.getElementById('cancel-csv');
        const importCsvConfirmBtn = document.getElementById('import-csv-confirm');
        
        // Handle file selection via button
        if (selectFileBtn && csvFileInput) {
            selectFileBtn.addEventListener('click', () => {
                csvFileInput.click();
            });
            
            csvFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        
        // Handle drag and drop
        if (csvDropzone) {
            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                csvDropzone.addEventListener(eventName, this.preventDefaults, false);
                document.body.addEventListener(eventName, this.preventDefaults, false);
            });
            
            // Highlight drop zone when item is dragged over it
            ['dragenter', 'dragover'].forEach(eventName => {
                csvDropzone.addEventListener(eventName, () => {
                    csvDropzone.classList.add('drag-over');
                }, false);
            });
            
            // Remove highlight when drag leaves
            ['dragleave', 'drop'].forEach(eventName => {
                csvDropzone.addEventListener(eventName, () => {
                    csvDropzone.classList.remove('drag-over');
                }, false);
            });
            
            // Handle dropped files
            csvDropzone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files.length) {
                    this.handleDroppedFiles(files);
                }
            }, false);
        }
        
        // Handle cancel button
        if (cancelCsvBtn) {
            cancelCsvBtn.addEventListener('click', () => {
                this.hideModal('csv-import-modal');
            });
        }
        
        // Handle import confirmation
        if (importCsvConfirmBtn) {
            importCsvConfirmBtn.addEventListener('click', () => {
                this.processCSVImport();
            });
        }
    }
    
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length) {
            this.processCSVFile(files[0]);
        }
    }
    
    handleDroppedFiles(files) {
        const file = files[0];
        if (file && (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
            this.processCSVFile(file);
        } else {
            this.showToast('Please upload a valid CSV file', 'error');
        }
    }
    
    async processCSVFile(file) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            this.showToast('File is too large. Maximum size is 10MB.', 'error');
            return;
        }
        
        try {
            const text = await file.text();
            this.previewCSV(text);
        } catch (error) {
            console.error('Error reading file:', error);
            this.showToast('Error reading file. Please try again.', 'error');
        }
    }
    
    previewCSV(csvText) {
        try {
            const rows = this.parseCSV(csvText);
            if (rows.length === 0) {
                this.showToast('CSV file is empty', 'error');
                return;
            }
            
            // Update UI to show preview
            const previewElement = document.getElementById('csv-preview');
            const importConfirmBtn = document.getElementById('import-csv-confirm');
            const importCount = document.getElementById('import-count');
            
            if (previewElement && importConfirmBtn && importCount) {
                // Show preview
                const table = this.createPreviewTable(rows);
                previewElement.innerHTML = '';
                previewElement.appendChild(table);
                previewElement.classList.remove('hidden');
                
                // Update import button
                importCount.textContent = (rows.length - 1).toString(); // Subtract 1 for header
                importConfirmBtn.classList.remove('hidden');
                
                // Scroll to bottom of modal
                previewElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
            
            // Store the parsed data for later import
            this.csvData = rows;
            
        } catch (error) {
            console.error('Error parsing CSV:', error);
            this.showToast('Error parsing CSV file. Please check the format.', 'error');
        }
    }
    
    parseCSV(csvText) {
        // Simple CSV parser - can be enhanced based on your CSV format
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        return lines.map(line => {
            // Handle quoted fields with commas
            const values = [];
            let inQuotes = false;
            let currentValue = '';
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        // Escaped quote
                        currentValue += '"';
                        i++; // Skip next quote
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    values.push(currentValue);
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            
            // Add the last value
            values.push(currentValue);
            
            return values;
        });
    }
    
    createPreviewTable(rows) {
        const table = document.createElement('table');
        table.className = 'preview-table';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        if (rows.length > 0) {
            rows[0].forEach(cell => {
                const th = document.createElement('th');
                th.textContent = cell;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
        }
        
        // Create body (limit to 5 rows for preview)
        const tbody = document.createElement('tbody');
        const maxPreviewRows = Math.min(5, rows.length - 1);
        for (let i = 1; i <= maxPreviewRows; i++) {
            const tr = document.createElement('tr');
            rows[i].forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        
        return table;
    }
    
    resetCSVImport() {
        // Reset file input
        const fileInput = document.getElementById('csv-file');
        if (fileInput) fileInput.value = '';
        
        // Hide preview and reset UI
        const previewElement = document.getElementById('csv-preview');
        const importConfirmBtn = document.getElementById('import-csv-confirm');
        
        if (previewElement) previewElement.innerHTML = '';
        if (importConfirmBtn) importConfirmBtn.classList.add('hidden');
        
        // Clear stored data
        delete this.csvData;
    }
    
    // Helper function to detect column types from header names
    detectColumnTypes(headers) {
        const columnTypes = {
            date: -1,
            amount: -1,
            description: -1,
            merchant: -1,
            category: -1,
            type: -1
        };
        
        const lowerHeaders = headers.map(h => h.toString().toLowerCase().trim());
        
        // Common column name patterns
        lowerHeaders.forEach((header, index) => {
            if (header.match(/(date|posted|transact)/) && columnTypes.date === -1) columnTypes.date = index;
            if ((header.match(/(amount|amt|value|debit|credit)/) || header === '$') && columnTypes.amount === -1) columnTypes.amount = index;
            if (header.match(/(desc|details|memo|note|info)/) && columnTypes.description === -1) columnTypes.description = index;
            if (header.match(/(merchant|payee|vendor|store|from|to|name)/) && columnTypes.merchant === -1) columnTypes.merchant = index;
            if (header.match(/(categor|type|group|label)/) && columnTypes.category === -1) columnTypes.category = index;
            if (header.match(/(type|flow|direction)/) && columnTypes.type === -1) columnTypes.type = index;
        });
        
        // If no amount columns found, try to find numeric columns
        if (columnTypes.amount === -1) {
            lowerHeaders.forEach((header, index) => {
                if (header.match(/[0-9]/) && !header.match(/(date|phone|zip|id|ref)/) && columnTypes.amount === -1) {
                    columnTypes.amount = index;
                }
            });
        }
        
        return columnTypes;
    }
    
    // Helper function to parse amount from string
    parseAmount(amountStr) {
        if (!amountStr && amountStr !== 0) return 0;
        
        // Handle negative amounts in parentheses
        amountStr = amountStr.toString().trim();
        const isNegative = amountStr.includes('(') || amountStr.startsWith('-');
        
        // Remove all non-numeric characters except decimal point and minus sign
        const numericStr = amountStr.replace(/[^0-9.-]/g, '');
        
        // Convert to number and round to 2 decimal places
        let amount = Math.round(parseFloat(numericStr) * 100) / 100 || 0;
        
        // Apply negative sign if needed
        return isNegative ? -Math.abs(amount) : amount;
    }
    
    // Helper function to parse date from string
    parseDate(dateStr) {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        
        // Try different date formats
        const formats = [
            // MM/DD/YYYY or MM-DD-YYYY
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/,
            // YYYY-MM-DD
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
            // DD/MM/YYYY or DD-MM-YYYY
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/,
        ];
        
        for (const format of formats) {
            const match = dateStr.toString().match(format);
            if (match) {
                let month, day, year;
                
                if (match[1] > 12) {
                    // Likely DD/MM/YYYY format
                    day = parseInt(match[1], 10);
                    month = parseInt(match[2], 10) - 1;
                    year = parseInt(match[3], 10);
                } else {
                    // Likely MM/DD/YYYY format
                    month = parseInt(match[1], 10) - 1;
                    day = parseInt(match[2], 10);
                    year = parseInt(match[3], 10);
                }
                
                // Handle 2-digit years
                if (year < 100) {
                    year += 2000; // Adjust for 21st century
                }
                
                const date = new Date(year, month, day);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
        }
        
        // If no format matched, return today's date
        return new Date().toISOString().split('T')[0];
    }
    
    async processCSVImport() {
        if (!this.csvData || this.csvData.length < 2) {
            this.showToast('No data to import', 'error');
            return;
        }
        
        try {
            const headers = this.csvData[0];
            const transactions = [];
            const columnMap = this.detectColumnTypes(headers);
            
            console.log('Detected column mapping:', columnMap);
            
            // Skip header row
            for (let i = 1; i < this.csvData.length; i++) {
                const row = this.csvData[i];
                if (row.every(cell => !cell || cell.toString().trim() === '')) continue;
                
                // Get values using detected columns or fallback to default positions
                const date = columnMap.date >= 0 ? row[columnMap.date] : (row[0] || '');
                const merchant = columnMap.merchant >= 0 ? row[columnMap.merchant] : (row[1] || '');
                const description = columnMap.description >= 0 ? row[columnMap.description] : (row[2] || '');
                const amountStr = columnMap.amount >= 0 ? row[columnMap.amount] : (row[3] || '0');
                const category = columnMap.category >= 0 ? row[columnMap.category] : (row[4] || '');
                const type = columnMap.type >= 0 ? row[columnMap.type] : '';
                
                // Parse amount
                const amount = this.parseAmount(amountStr);
                const isIncome = type ? type.toString().toLowerCase().includes('income') : amount >= 0;
                
                const transaction = {
                    date: this.parseDate(date),
                    merchant: merchant.toString().trim() || 'Unknown',
                    description: description.toString().trim() || 'No description',
                    amount: isIncome ? Math.abs(amount) : -Math.abs(amount),
                    category: category.toString().trim() || 'Uncategorized',
                    type: isIncome ? 'income' : 'expense',
                    createdAt: new Date().toISOString(),
                    searchText: `${merchant} ${description}`.toLowerCase()
                };
                
                console.log('Processed transaction:', transaction);
                
                // Skip if we don't have a valid amount
                if (isNaN(transaction.amount)) {
                    console.warn('Skipping row with invalid amount:', row);
                    continue;
                }
                
                transactions.push(transaction);
            }
            
            if (transactions.length === 0) {
                throw new Error('No valid transactions to import');
            }
            
            // Save transactions to IndexedDB
            const db = await localDB.init();
            const tx = db.transaction(['transactions'], 'readwrite');
            const store = tx.objectStore('transactions');
            
            // Add each transaction
            const addPromises = transactions.map(transaction => {
                return new Promise((resolve, reject) => {
                    const request = store.add(transaction);
                    request.onsuccess = () => resolve();
                    request.onerror = (e) => {
                        console.error('Error adding transaction:', e.target.error);
                        resolve(); // Continue with other transactions even if one fails
                    };
                });
            });
            
            await Promise.all(addPromises);
            
            this.showToast(`Successfully imported ${transactions.length} transactions`, 'success');
            this.hideModal('csv-import-modal');
            
            // Refresh the current view to show the new transactions
            this.refreshCurrentView();
            
        } catch (error) {
            console.error('Error importing transactions:', error);
            this.showToast('Error importing transactions: ' + error.message, 'error');
        }
    }
    
    // Helper method to refresh the current view
    refreshCurrentView() {
        if (this.currentView === 'transactions') {
            const searchInput = document.getElementById('transaction-search');
            const filterSelect = document.getElementById('transaction-filter');
            
            const searchTerm = searchInput ? searchInput.value : '';
            const filterType = filterSelect ? filterSelect.value : '';
            
            this.loadTransactions(searchTerm, filterType);
        } else {
            this.refreshView(this.currentView);
        }
    }

    // Method to refresh a specific view
    async refreshView(viewName) {
        switch (viewName) {
            case 'transactions':
                await this.loadTransactions();
                break;
            case 'dashboard':
                await this.updateDashboard();
                break;
            case 'calendar':
                await this.updateCalendar();
                break;
            // Add other views as needed
        }
    }

    // Method to load and display transactions with search and filter
    async loadTransactions(searchTerm = '', filterType = '') {
        try {
            const transactionsList = document.getElementById('transactions-list');
            const emptyState = document.getElementById('transactions-empty');
            const loadingState = document.getElementById('transactions-loading');
            const table = document.querySelector('.transactions-table');
            
            if (!transactionsList || !emptyState || !loadingState || !table) return;
            
            // Show loading state
            loadingState.style.display = 'flex';
            emptyState.style.display = 'none';
            table.style.display = 'none';
            
            // Get all transactions
            let transactions = await localDB.getTransactions();
            console.log('Loaded transactions from DB:', transactions);
            
            // Apply search filter if provided
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase().trim();
                transactions = transactions.filter(t => {
                    // Search in merchant, description, and amount
                    return (
                        (t.merchant && t.merchant.toLowerCase().includes(searchLower)) ||
                        (t.description && t.description.toLowerCase().includes(searchLower)) ||
                        (t.category && t.category.toLowerCase().includes(searchLower)) ||
                        (t.amount && t.amount.toString().includes(searchTerm)) ||
                        (t.searchText && t.searchText.includes(searchLower))
                    );
                });
            }
            
            // Apply type filter if provided
            if (filterType) {
                transactions = transactions.filter(t => {
                    if (filterType === 'income') return parseFloat(t.amount) >= 0;
                    if (filterType === 'expense') return parseFloat(t.amount) < 0;
                    return true;
                });
            }
            
            // Clear existing rows
            transactionsList.innerHTML = '';
            
            // Show empty state if no transactions
            if (transactions.length === 0) {
                emptyState.style.display = 'block';
                loadingState.style.display = 'none';
                return;
            }
            
            // Sort by date (newest first)
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Add transactions to the table
            transactions.forEach(transaction => {
                const row = document.createElement('tr');
                
                // Parse transaction data
                const amount = parseFloat(transaction.amount) || 0;
                const isIncome = transaction.type === 'income' || amount >= 0;
                const displayAmount = Math.abs(amount);
                const amountClass = isIncome ? 'text-success' : 'text-danger';
                
                // Format date
                let formattedDate = 'Invalid Date';
                try {
                    const date = new Date(transaction.date);
                    if (!isNaN(date.getTime())) {
                        formattedDate = date.toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        });
                    }
                } catch (e) {
                    console.warn('Invalid date:', transaction.date, e);
                }
                
                // Create row HTML
                row.innerHTML = `
                    <td class="text-nowrap">${formattedDate}</td>
                    <td class="fw-medium">
                        ${transaction.merchant || 'Unknown'}
                    </td>
                    <td class="text-truncate" style="max-width: 200px;" title="${transaction.description || ''}">
                        ${transaction.description || 'No description'}
                    </td>
                    <td>
                        <span class="badge bg-light text-dark">
                            ${transaction.category || 'Uncategorized'}
                        </span>
                    </td>
                    <td class="text-end ${amountClass} fw-medium">
                        ${isIncome ? '+' : '-'}$${displayAmount.toFixed(2)}
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1" data-id="${transaction.id || ''}" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" data-id="${transaction.id || ''}" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>`;
                
                // Add click handlers for edit/delete
                const editBtn = row.querySelector('button[title="Edit"]');
                const deleteBtn = row.querySelector('button[title="Delete"]');
                
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (transaction.id) this.editTransaction(transaction.id);
                    });
                }
                
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (transaction.id) this.deleteTransaction(transaction.id);
                    });
                }
                
                // Add click handler for row to view details
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => {
                    if (transaction.id) this.viewTransactionDetails(transaction.id);
                });
                
                // Add row to the table
                transactionsList.appendChild(row);
                
                // Make row clickable to view details
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => this.viewTransactionDetails(transaction));
                
            });
            
            // Show the table and hide loading state
            table.style.display = 'table';
            loadingState.style.display = 'none';
            
        } catch (error) {
            console.error('Error loading transactions:', error);
            this.showToast('Error loading transactions', 'error');
            
            // Make sure to hide loading state on error
            const loadingState = document.getElementById('transactions-loading');
            if (loadingState) loadingState.style.display = 'none';
        }
    }
    
    // Filter transactions based on search term and filter type
    async filterTransactions(searchTerm = '', filterType = '') {
        try {
            await this.loadTransactions(searchTerm, filterType);
        } catch (error) {
            console.error('Error filtering transactions:', error);
            this.showToast('Error filtering transactions', 'error');
        }
    }
    
    // View transaction details
    viewTransactionDetails(transaction) {
        // This can be expanded to show a detailed view of the transaction
        console.log('Viewing transaction:', transaction);
        // For now, just show a toast with the transaction details
        this.showToast(`Viewing: ${transaction.description || 'Transaction'} (${transaction.amount})`, 'info');
    }
    
    // Edit transaction
    async editTransaction(id) {
        console.log('Editing transaction:', id);
        // TODO: Implement edit transaction functionality
        this.showToast('Edit transaction: ' + id, 'info');
    }
    
    // Delete transaction
    async deleteTransaction(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            try {
                await localDB.deleteItem('transactions', id);
                this.showToast('Transaction deleted', 'success');
                this.refreshCurrentView();
            } catch (error) {
                console.error('Error deleting transaction:', error);
                this.showToast('Error deleting transaction', 'error');
            }
        }
    }
    
    // Method to update the dashboard
    async updateDashboard() {
        try {
            const transactions = await localDB.getTransactions();
            
            // Calculate total income and expenses
            const totals = transactions.reduce((acc, t) => {
                const amount = parseFloat(t.amount) || 0;
                if (amount >= 0) {
                    acc.income += amount;
                } else {
                    acc.expenses += Math.abs(amount);
                }
                return acc;
            }, { income: 0, expenses: 0 });
            
            // Update dashboard UI
            const incomeEl = document.getElementById('total-income');
            const expensesEl = document.getElementById('total-expenses');
            const balanceEl = document.getElementById('balance');
            
            if (incomeEl) incomeEl.textContent = totals.income.toFixed(2);
            if (expensesEl) expensesEl.textContent = totals.expenses.toFixed(2);
            if (balanceEl) balanceEl.textContent = (totals.income - totals.expenses).toFixed(2);
            
        } catch (error) {
            console.error('Error updating dashboard:', error);
            this.showToast('Error updating dashboard', 'error');
        }
    }
    
    // Method to update the calendar view
    async updateCalendar() {
        try {
            const transactions = await localDB.getTransactions();
            
            // Group transactions by date
            const transactionsByDate = transactions.reduce((acc, t) => {
                const date = t.date.split('T')[0]; // Just the date part
                if (!acc[date]) {
                    acc[date] = [];
                }
                acc[date].push(t);
                return acc;
            }, {});
            
            // Update calendar UI (implement your calendar update logic here)
            console.log('Updating calendar with transactions:', transactionsByDate);
            
        } catch (error) {
            console.error('Error updating calendar:', error);
            this.showToast('Error updating calendar', 'error');
        }
    }
    
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        // Auto-remove toast after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

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

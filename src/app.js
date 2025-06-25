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
                
                // Parse amount - preserve original sign from CSV
                const amount = this.parseAmount(amountStr);
                const isDeposit = description && (
                    description.toString().toLowerCase().includes('deposit') ||
                    description.toString().toLowerCase().includes('credit') ||
                    description.toString().toLowerCase().includes('achcredit') ||
                    description.toString().toLowerCase().includes('direct dep')
                );
                
                // Determine if this is income based on type hint or if it's a deposit
                const isIncome = type ? type.toString().toLowerCase().includes('income') : (amount > 0 || isDeposit);
                
                const transaction = {
                    date: this.parseDate(date),
                    merchant: merchant.toString().trim() || 'Unknown',
                    description: description.toString().trim() || 'No description',
                    // Preserve the original amount sign from CSV
                    amount: amount,
                    category: category.toString().trim() || 'Uncategorized',
                    type: isIncome ? 'income' : 'expense',
                    createdAt: new Date().toISOString(),
                    searchText: `${merchant} ${description}`.toLowerCase()
                };
                
                console.log('Processed transaction:', {
                    ...transaction,
                    isIncome,
                    isDeposit,
                    originalAmount: amountStr
                });
                
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
    
    // Initialize calendar
    async initCalendar() {
        if (this.calendar) return; // Already initialized
        
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;
        
        // Initialize FullCalendar
        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            dayMaxEvents: true,
            events: this.getCalendarEvents.bind(this),
            eventClick: this.handleCalendarEventClick.bind(this),
            dateClick: this.handleDateClick.bind(this),
            eventDidMount: this.handleEventDidMount.bind(this)
        });
        
        this.calendar.render();
        
        // Initialize mini calendar
        this.initMiniCalendar();
    }
    
    // Initialize mini calendar
    initMiniCalendar() {
        const miniCalendarEl = document.getElementById('mini-calendar');
        if (!miniCalendarEl || this.miniCalendar) return;
        
        this.miniCalendar = new FullCalendar.Calendar(miniCalendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev',
                center: 'title',
                right: 'next'
            },
            height: 'auto',
            dateClick: (info) => {
                this.calendar.gotoDate(info.date);
            },
            datesSet: () => {
                // Sync mini calendar with main calendar
                if (this.calendar) {
                    const date = this.miniCalendar.getDate();
                    this.calendar.gotoDate(date);
                }
            }
        });
        
        this.miniCalendar.render();
    }
    
    // Get events for the calendar
    async getCalendarEvents(fetchInfo, successCallback, failureCallback) {
        try {
            const transactions = await localDB.getTransactions();
            console.log('Total transactions in database:', transactions.length);
            
            // Debug: Log income transactions
            const incomeTransactions = transactions.filter(t => t.amount > 0 || t.type === 'income');
            console.log('Income transactions:', incomeTransactions);
            
            const events = [];
            const now = new Date();
            
            // Process actual transactions
            transactions.forEach(transaction => {
                try {
                    const date = new Date(transaction.date);
                    const isExpense = transaction.amount < 0 || transaction.type === 'expense';
                    const amount = Math.abs(parseFloat(transaction.amount) || 0);
                    
                    events.push({
                        id: `t_${transaction.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        title: `${isExpense ? '-' : '+'}$${amount.toFixed(2)} ${transaction.description || ''}`.trim(),
                        start: date,
                        allDay: true,
                        backgroundColor: isExpense ? '#f8d7da' : '#d1e7dd',
                        borderColor: isExpense ? '#f5c2c7' : '#a3cfbb',
                        textColor: isExpense ? '#842029' : '#0f5132',
                        extendedProps: {
                            type: 'transaction',
                            isExpense,
                            amount,
                            originalAmount: transaction.amount,
                            description: transaction.description || '',
                            category: transaction.category || 'Uncategorized',
                            originalDate: date
                        }
                    });
                } catch (e) {
                    console.warn('Error processing transaction for calendar:', transaction, e);
                }
            });
            
            // Add predicted recurring transactions
            const predictedTransactions = this.predictRecurringTransactions(transactions, fetchInfo.start, fetchInfo.end);
            events.push(...predictedTransactions);
            
            successCallback(events);
            
            // Update summary
            this.updateCalendarSummary(transactions, fetchInfo.start, fetchInfo.end);
            
        } catch (error) {
            console.error('Error loading calendar events:', error);
            failureCallback(error);
        }
    }
    
    // Store prediction history for learning
    predictionHistory = {};
    
    // Apply learned patterns to transactions
    applyLearnedPatterns(transactions) {
        if (!this.predictionHistory || Object.keys(this.predictionHistory).length === 0) {
            return transactions; // No learned patterns yet
        }
        
        console.log('Applying learned patterns to transactions');
        
        // For now, we'll just log the learned patterns
        // In a real implementation, we would adjust the transactions based on learned patterns
        Object.entries(this.predictionHistory).forEach(([key, pattern]) => {
            if (pattern.accepted > 0) {
                console.log(`Pattern learned for ${key}:`, {
                    confidence: pattern.accepted / pattern.totalPredictions,
                    adjustments: pattern.adjustments.length,
                    lastUpdated: pattern.lastUpdated
                });
            }
        });
        
        return transactions;
    }
    
    // Predict recurring transactions with improved accuracy
    predictRecurringTransactions(transactions, startDate, endDate) {
        console.log('predictRecurringTransactions called with:', { 
            transactionCount: transactions.length,
            startDate,
            endDate 
        });
        
        const predictedEvents = [];
        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        
        // Get date-fns functions from global object
        const { isSameDay, differenceInDays, addDays, format, isAfter, isBefore } = window.dateFns || {};
        
        // Load prediction history from localStorage if available
        try {
            const savedHistory = localStorage.getItem('predictionHistory');
            if (savedHistory) {
                this.predictionHistory = JSON.parse(savedHistory);
            }
        } catch (e) {
            console.warn('Error loading prediction history:', e);
            this.predictionHistory = {};
        }
        
        // Debug: Log the first few transactions
        console.log('Sample transactions:', transactions.slice(0, 3).map(t => ({
            description: t.description,
            amount: t.amount,
            date: t.date,
            type: t.type
        })));
        
        // Group transactions by description and amount to find patterns
        const transactionGroups = {};
        
        // Apply any learned patterns to enhance the transactions
        const enhancedTransactions = this.applyLearnedPatterns(transactions);
        
        // First, normalize and group transactions
        transactions.forEach(transaction => {
            try {
                // Skip transactions without a valid date
                if (!transaction.date) return;
                
                const transDate = new Date(transaction.date);
                if (isNaN(transDate.getTime())) return;
                
                // Create a normalized description (lowercase, trim, remove special chars)
                const normalizedDesc = transaction.description
                    .toLowerCase()
                    .trim()
                    .replace(/[^\w\s]/g, '');
                
                // Create a group key with description and amount (rounded to avoid minor differences)
                const amount = typeof transaction.amount === 'number' 
                    ? Math.round(transaction.amount * 100) / 100 
                    : Math.round(parseFloat(transaction.amount) * 100) / 100;
                    
                if (isNaN(amount)) return;
                
                const groupKey = `${normalizedDesc}_${amount.toFixed(2)}`;
                
                if (!transactionGroups[groupKey]) {
                    transactionGroups[groupKey] = [];
                }
                
                transactionGroups[groupKey].push({
                    date: transDate,
                    amount: amount,
                    description: transaction.description,
                    type: transaction.type || (amount >= 0 ? 'income' : 'expense')
                });
            } catch (e) {
                console.warn('Error processing transaction for recurring detection:', transaction, e);
            }
        });
        
        console.log('Transaction groups:', Object.keys(transactionGroups).length, 'groups found');
        
        // Analyze each group for recurring patterns
        Object.entries(transactionGroups).forEach(([groupKey, groupTransactions]) => {
            try {
                if (groupTransactions.length < 2) return; // Need at least 2 transactions to detect a pattern
                
                // Sort transactions by date
                groupTransactions.sort((a, b) => a.date - b.date);
                
                // Calculate intervals between transactions
                const intervals = [];
                for (let i = 1; i < groupTransactions.length; i++) {
                    const prevDate = groupTransactions[i - 1].date;
                    const currDate = groupTransactions[i].date;
                    const interval = differenceInDays(currDate, prevDate);
                    intervals.push(interval);
                }
                
                // Calculate average interval (in days)
                const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
                
                // Calculate standard deviation to check consistency
                const squaredDiffs = intervals.map(interval => Math.pow(interval - avgInterval, 2));
                const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / intervals.length;
                const stdDev = Math.sqrt(variance);
                
                // Calculate confidence (0-1) based on standard deviation and number of occurrences
                let confidence = 0.7; // Base confidence
                
                // Increase confidence with more occurrences
                confidence = Math.min(0.95, confidence + (groupTransactions.length * 0.05));
                
                // Decrease confidence with higher standard deviation
                confidence = Math.max(0.1, confidence - (stdDev / 30));
                
                // If we have a consistent pattern, predict future occurrences
                if (confidence > 0.5 && avgInterval > 0) {
                    const lastTransaction = groupTransactions[groupTransactions.length - 1];
                    let nextDate = new Date(lastTransaction.date);
                    
                    // Predict next 3 occurrences or until we reach the end date
                    for (let i = 0; i < 3; i++) {
                        nextDate = addDays(nextDate, Math.round(avgInterval));
                        
                        // Skip if the predicted date is in the past or before the start date
                        if (nextDate < now || nextDate < new Date(startDate)) continue;
                        
                        // Stop if we've gone past the end date
                        if (nextDate > new Date(endDate)) break;
                        
                        // Add predicted event
                        predictedEvents.push({
                            title: `${lastTransaction.description} (${(confidence * 100).toFixed(0)}% likely)`,
                            start: nextDate.toISOString(),
                            allDay: true,
                            color: confidence > 0.8 ? '#FFA500' : '#FFD700', // Orange for high confidence, gold for medium
                            extendedProps: {
                                isPredicted: true,
                                confidence: confidence,
                                amount: lastTransaction.amount,
                                description: lastTransaction.description,
                                type: lastTransaction.type,
                                originalDates: groupTransactions.map(t => t.date.toISOString().split('T')[0])
                            }
                        });
                    }
                }
                
                console.log(`Group ${groupKey}:`, {
                    count: groupTransactions.length,
                    avgInterval,
                    stdDev,
                    confidence: (confidence * 100).toFixed(1) + '%',
                    lastDate: groupTransactions[groupTransactions.length - 1].date.toISOString()
                });
                
            } catch (e) {
                console.error('Error analyzing transaction group:', groupKey, e);
            }
        });
        
        console.log('Predicted events:', predictedEvents);
        return predictedEvents;
        
        // Only consider transactions from the past year for prediction
        const recentTransactions = transactions.filter(t => {
            try {
                const date = new Date(t.date);
                return date >= oneYearAgo;
            } catch (e) {
                return false;
            }
        });
        
        // Group similar transactions
        recentTransactions.forEach(transaction => {
            try {
                const key = `${transaction.description || ''}_${Math.abs(transaction.amount).toFixed(2)}`;
                if (!transactionGroups[key]) {
                    transactionGroups[key] = [];
                }
                transactionGroups[key].push({
                    date: new Date(transaction.date),
                    amount: parseFloat(transaction.amount) || 0,
                    ...transaction
                });
            } catch (e) {
                console.warn('Error processing transaction for prediction:', transaction, e);
            }
        });
        
        // Analyze each group for patterns
        Object.values(transactionGroups).forEach(group => {
            if (group.length < 2) return; // Need at least 2 transactions to detect a pattern
            
            // Sort by date
            group.sort((a, b) => a.date - b.date);
            
            // Calculate average interval between transactions (in days)
            const intervals = [];
            for (let i = 1; i < group.length; i++) {
                const diff = (group[i].date - group[i-1].date) / (1000 * 60 * 60 * 24);
                intervals.push(diff);
            }
            
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const isExpense = group[0].amount < 0;
            const amount = Math.abs(group[0].amount);
            
            // Only proceed if we have a somewhat regular pattern
            const variance = Math.max(...intervals) - Math.min(...intervals);
            if (variance > 10) return; // Too much variance to be considered recurring
            
            // Predict next occurrence
            const lastDate = new Date(Math.max(...group.map(t => t.date)));
            let nextDate = new Date(lastDate);
            
            while (nextDate < endDate) {
                nextDate = new Date(nextDate);
                nextDate.setDate(nextDate.getDate() + Math.round(avgInterval));
                
                if (nextDate >= startDate && nextDate <= endDate) {
                    // Calculate confidence based on number of occurrences and variance
                    const confidence = Math.min(100, Math.round(
                        (1 - (variance / (avgInterval * 0.5))) * 
                        Math.min(1, group.length / 3) * 100
                    ));
                    
                    predictedEvents.push({
                        id: `predicted_${group[0].id || ''}_${nextDate.getTime()}`,
                        title: `[${confidence}%] ${isExpense ? '-' : '+'}$${amount.toFixed(2)} ${group[0].description || 'Recurring'}`.trim(),
                        start: nextDate,
                        allDay: true,
                        backgroundColor: isExpense ? '#fff3cd' : '#cfe2ff',
                        borderColor: isExpense ? '#ffecb5' : '#9ec5fe',
                        textColor: isExpense ? '#664d03' : '#084298',
                        extendedProps: {
                            type: 'predicted',
                            isExpense,
                            amount,
                            description: group[0].description || 'Recurring Transaction',
                            category: group[0].category || 'Uncategorized',
                            confidence,
                            pattern: {
                                interval: Math.round(avgInterval),
                                occurrences: group.length,
                                lastDate: lastDate.toISOString().split('T')[0]
                            }
                        }
                    });
                }
            }
        });
        
        return predictedEvents;
    }
    
    // Handle date click on calendar
    async handleDateClick(info) {
        const date = info.date;
        const dateStr = date.toISOString().split('T')[0];
        
        // Update selected date display
        const selectedDateEl = document.getElementById('selected-date');
        if (selectedDateEl) {
            const { format } = window.dateFns || {};
            selectedDateEl.textContent = format ? format(date, 'EEEE, MMMM d, yyyy') : date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
        // Load transactions for selected date
        await this.loadTransactionsForDate(date);
    }
    
    // Load transactions for a specific date
    async loadTransactionsForDate(date) {
        try {
            const transactions = await localDB.getTransactions();
            const dateStr = date.toISOString().split('T')[0];
            
            // Filter transactions for the selected date
            const dayTransactions = transactions.filter(t => {
                try {
                    const transDate = new Date(t.date).toISOString().split('T')[0];
                    return transDate === dateStr;
                } catch (e) {
                    return false;
                }
            });
            
            // Update transactions list
            const container = document.getElementById('selected-date-transactions');
            if (!container) return;
            
            if (dayTransactions.length === 0) {
                container.innerHTML = '<p class="text-muted">No transactions for this date</p>';
                return;
            }
            
            let html = '<div class="transaction-list">';
            
            dayTransactions.forEach(transaction => {
                const isExpense = transaction.amount < 0 || transaction.type === 'expense';
                const amount = Math.abs(parseFloat(transaction.amount) || 0);
                
                html += `
                    <div class="transaction-item ${isExpense ? 'expense' : 'income'}">
                        <div class="transaction-details">
                            <div class="transaction-description">${transaction.description || 'No description'}</div>
                            <div class="transaction-category">${transaction.category || 'Uncategorized'}</div>
                        </div>
                        <div class="transaction-amount ${isExpense ? 'text-danger' : 'text-success'}">
                            ${isExpense ? '-' : '+'}$${amount.toFixed(2)}
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading transactions for date:', error);
            this.showToast('Error loading transactions', 'error');
        }
    }
    
    // Handle calendar event click
    handleCalendarEventClick(info) {
        const event = info.event;
        const isPredicted = event.extendedProps?.isPredicted;
        
        if (isPredicted) {
            const response = prompt(
                `Edit predicted transaction:\n\n` +
                `Description: ${event.title.replace(/\(\d+%\)/g, '').trim()}\n` +
                `Amount: ${event.extendedProps.amount}\n` +
                `Prediction Confidence: ${Math.round(event.extendedProps.confidence * 100)}%\n\n` +
                'Options:\n' +
                '1. Keep as is\n' +
                '2. Add as new transaction\n' +
                '3. Adjust amount and add\n' +
                '4. Ignore this prediction\n\n' +
                'Enter your choice (1-4):', '1'
            );

            switch(response) {
                case '2':
                    this.addPredictedTransaction(event);
                    break;
                case '3':
                    const newAmount = prompt('Enter new amount:', Math.abs(event.extendedProps.amount));
                    if (newAmount && !isNaN(newAmount)) {
                        const updatedEvent = {...event};
                        updatedEvent.extendedProps.amount = parseFloat(newAmount);
                        if (updatedEvent.title.includes('$')) {
                            updatedEvent.title = updatedEvent.title.replace(/\$\d+(\.\d{2})?/, `$${parseFloat(newAmount).toFixed(2)}`);
                        }
                        this.addPredictedTransaction(updatedEvent);
                        this.improvePrediction(updatedEvent, 'adjusted');
                    }
                    break;
                case '4':
                    this.improvePrediction(event, 'ignored');
                    break;
                default:
                    // Keep as is
                    break;
            }
        } else {
            // Show transaction details for existing transactions
            const transactionId = event.extendedProps?.transactionId;
            if (transactionId) {
                this.viewTransactionDetails(transactionId);
            }
        }
    }
    
    // Improve prediction based on user feedback
    improvePrediction(event, action) {
        try {
            const { description, amount, originalDates = [] } = event.extendedProps;
            const key = `${description}_${amount.toFixed(2)}`;
            
            if (!this.predictionHistory[key]) {
                this.predictionHistory[key] = {
                    pattern: {},
                    adjustments: [],
                    totalPredictions: 0,
                    accepted: 0,
                    adjusted: 0,
                    ignored: 0,
                    lastUpdated: new Date().toISOString()
                };
            }
            
            const prediction = this.predictionHistory[key];
            
            // Update statistics based on user action
            prediction.totalPredictions++;
            if (action === 'accepted') prediction.accepted++;
            if (action === 'adjusted') prediction.adjusted++;
            if (action === 'ignored') prediction.ignored++;
            prediction.lastUpdated = new Date().toISOString();
            
            // Store the adjustment details if this was an adjustment
            if (action === 'adjusted') {
                prediction.adjustments.push({
                    originalAmount: amount,
                    adjustedAmount: parseFloat(prompt('Enter adjusted amount:')),
                    date: new Date().toISOString()
                });
            }
            
            // Save the updated prediction history
            localStorage.setItem('predictionHistory', JSON.stringify(this.predictionHistory));
            
            console.log(`Prediction ${action}:`, { key, prediction });
            
        } catch (e) {
            console.error('Error improving prediction:', e);
        }
    }
    
    // Add predicted transaction to the database
    async addPredictedTransaction(event) {
        try {
            const transaction = {
                description: event.title.replace(/\(\d+%\)/g, '').trim(),
                amount: event.extendedProps.amount,
                date: event.start,
                type: event.extendedProps.type || 'expense',
                category: event.extendedProps.category || 'Uncategorized',
                isPredicted: true,
                originalPrediction: event.extendedProps.originalDates || []
            };
            
            await localDB.addItem('transactions', transaction);
            this.showToast('Transaction added', 'success');
            this.refreshCurrentView();
            
            // Update prediction model with this positive example
            this.improvePrediction(event, 'accepted');
            
        } catch (error) {
            console.error('Error adding predicted transaction:', error);
            this.showToast('Error adding transaction', 'error');
        }
    }
    
    // Customize event rendering
    handleEventDidMount(info) {
        // Add tooltip for events
        if (info.event.extendedProps.type === 'predicted') {
            const tooltip = document.createElement('div');
            tooltip.className = 'event-tooltip';
            tooltip.innerHTML = `
                <strong>${info.event.title}</strong><br>
                <small>Predicted with ${info.event.extendedProps.confidence}% confidence</small>
            `;
            info.el.appendChild(tooltip);
            
            // Position the tooltip
            info.el.addEventListener('mouseenter', () => {
                tooltip.style.display = 'block';
                const rect = info.el.getBoundingClientRect();
                tooltip.style.left = `${rect.left}px`;
                tooltip.style.top = `${rect.bottom + 5}px`;
            });
            
            info.el.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        }
    }
    
    // Update calendar summary
    async updateCalendarSummary(transactions, startDate, endDate) {
        try {
            const summaryEl = document.getElementById('calendar-summary');
            if (!summaryEl) return;
            
            // Filter transactions for the current view
            const filteredTransactions = transactions.filter(t => {
                try {
                    const date = new Date(t.date);
                    return date >= startDate && date <= endDate;
                } catch (e) {
                    return false;
                }
            });
            
            // Calculate totals
            const income = filteredTransactions
                .filter(t => t.amount > 0 || t.type === 'income')
                .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);
                
            const expenses = filteredTransactions
                .filter(t => t.amount < 0 || t.type === 'expense')
                .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);
                
            const net = income - expenses;
            
            // Group by category
            const categories = {};
            filteredTransactions.forEach(t => {
                const category = t.category || 'Uncategorized';
                const amount = Math.abs(parseFloat(t.amount) || 0);
                const isExpense = t.amount < 0 || t.type === 'expense';
                
                if (!categories[category]) {
                    categories[category] = { income: 0, expenses: 0 };
                }
                
                if (isExpense) {
                    categories[category].expenses += amount;
                } else {
                    categories[category].income += amount;
                }
            });
            
            // Generate HTML
            let html = `
                <div class="summary-totals">
                    <div class="summary-total">
                        <span class="summary-label">Income:</span>
                        <span class="summary-amount text-success">$${income.toFixed(2)}</span>
                    </div>
                    <div class="summary-total">
                        <span class="summary-label">Expenses:</span>
                        <span class="summary-amount text-danger">$${expenses.toFixed(2)}</span>
                    </div>
                    <div class="summary-total">
                        <span class="summary-label">Net:</span>
                        <span class="summary-amount ${net >= 0 ? 'text-success' : 'text-danger'}">
                            ${net >= 0 ? '+' : '-'}$${Math.abs(net).toFixed(2)}
                        </span>
                    </div>
                </div>
                <div class="summary-categories">
                    <h4>By Category</h4>
            `;
            
            // Add category breakdown
            Object.entries(categories).forEach(([category, amounts]) => {
                const net = amounts.income - amounts.expenses;
                html += `
                    <div class="category-summary">
                        <div class="category-name">${category}</div>
                        <div class="category-amounts">
                            <span class="text-success">+$${amounts.income.toFixed(2)}</span> / 
                            <span class="text-danger">-$${amounts.expenses.toFixed(2)}</span>
                            <span class="${net >= 0 ? 'text-success' : 'text-danger'}">
                                (${net >= 0 ? '+' : ''}${net.toFixed(2)})
                            </span>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            summaryEl.innerHTML = html;
            
        } catch (error) {
            console.error('Error updating calendar summary:', error);
        }
    }
    
    // Update calendar view with transactions
    async updateCalendar() {
        try {
            await this.initCalendar();
            
            // Refresh the calendar to load events
            if (this.calendar) {
                this.calendar.refetchEvents();
                
                // Update for current view
                const view = this.calendar.view;
                if (view) {
                    this.updateCalendarSummary(
                        await localDB.getTransactions(),
                        view.activeStart,
                        view.activeEnd
                    );
                }
            }
            
        } catch (error) {
            console.error('Error updating calendar:', error);
            this.showToast('Error updating calendar', 'error');
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
                
                // Check for deposit indicators in description
                const isDeposit = transaction.description && (
                    transaction.description.toLowerCase().includes('achcredit') ||
                    transaction.description.toLowerCase().includes('deposit') ||
                    transaction.description.toLowerCase().includes('direct dep') ||
                    transaction.description.toLowerCase().includes('credit')
                );
                
                // Determine if transaction is income based on type, amount sign, and deposit indicators
                const isIncome = (transaction.type === 'income' && amount > 0) || 
                               (transaction.type !== 'expense' && (amount > 0 || isDeposit));
                
                // Use the actual amount sign for display
                const displayAmount = Math.abs(amount);
                const amountSign = amount >= 0 ? '+' : '-';
                const amountClass = amount >= 0 ? 'text-success' : 'text-danger';
                
                console.log('Transaction:', { 
                    description: transaction.description, 
                    amount: amount,
                    displayAmount: displayAmount,
                    type: transaction.type, 
                    isIncome: isIncome,
                    isDeposit: isDeposit
                });
                
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
                        ${amountSign}$${displayAmount.toFixed(2)}
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
                // Make row clickable to view details
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => {
                    if (transaction.id) this.viewTransactionDetails(transaction);
                });
                
                // Add the row to the transactions list
                transactionsList.appendChild(row);
                
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
    
    // Update dashboard with summary data
    async updateDashboard() {
        console.log('Updating dashboard...');
        try {
            // Get all transactions
            const transactions = await localDB.getTransactions();
            console.log('All transactions:', transactions);
            
            // Filter transactions for the current month
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            const monthlyTransactions = transactions.filter(t => {
                try {
                    const transDate = new Date(t.date);
                    const isCurrentMonth = transDate.getMonth() === currentMonth;
                    const isCurrentYear = transDate.getFullYear() === currentYear;
                    return isCurrentMonth && isCurrentYear;
                } catch (e) {
                    console.warn('Error processing transaction date:', t, e);
                    return false;
                }
            });
            
            console.log('Monthly transactions:', monthlyTransactions);
            
            // Calculate totals
            // Income: positive amounts or type 'income'
            const incomeTransactions = monthlyTransactions.filter(t => {
                const amount = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0;
                return t.type === 'income' || amount > 0;
            });
                
            console.log('Income transactions:', incomeTransactions);
                
            const income = incomeTransactions.reduce((sum, t) => {
                const amount = Math.abs(typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0);
                return sum + amount;
            }, 0);
                
            console.log('Calculated income:', income);
                
            // Expenses: negative amounts or type 'expense'
            const expenseTransactions = monthlyTransactions.filter(t => {
                const amount = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0;
                return t.type === 'expense' || amount < 0;
            });
                
            const expenses = expenseTransactions.reduce((sum, t) => {
                const amount = Math.abs(typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0);
                return sum + amount;
            }, 0);
            
            console.log('Expense transactions:', expenseTransactions);
            console.log('Calculated expenses:', expenses);
                    
            // Get budget data (if available)
            let budgeted = 0;
            try {
                const budgets = await localDB.getAllItems('budgets');
                const currentBudget = budgets.find(b => {
                    const budgetDate = new Date(b.month);
                    return budgetDate.getMonth() === currentMonth && 
                           budgetDate.getFullYear() === currentYear;
                });
                budgeted = currentBudget?.amount || 0;
            } catch (e) {
                console.warn('Could not load budget data:', e);
            }
            
            // Calculate available to budget
            const availableToBudget = income - budgeted;
            
            // Update the UI with correct element IDs from HTML
            this.updateDashboardMetric('available-budget', availableToBudget);
            this.updateDashboardMetric('total-budgeted', budgeted);
            this.updateDashboardMetric('total-spent', expenses);
            this.updateDashboardMetric('total-income', income);
            
            // Update recent transactions
            this.updateRecentTransactions(transactions.slice(0, 5));
            
            // Update budget overview chart
            this.updateBudgetOverview(monthlyTransactions);
            
        } catch (error) {
            console.error('Error updating dashboard:', error);
            this.showToast('Error updating dashboard', 'error');
        }
    }
    
    // Helper to update dashboard metric elements
    updateDashboardMetric(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            // Format as currency
            const formattedValue = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(value);
            
            // Update the element's text content
            element.textContent = formattedValue;
        }
    }
    
    // Update recent transactions list
    updateRecentTransactions(transactions) {
        const container = document.getElementById('recent-transactions');
        if (!container) return;
        
        if (transactions.length === 0) {
            container.innerHTML = '<div class="text-muted">No recent transactions</div>';
            return;
        }
        
        const list = document.createElement('div');
        list.className = 'list-group list-group-flush';
        
        transactions.forEach(transaction => {
            const isIncome = transaction.type === 'income' || transaction.amount > 0;
            const amountClass = isIncome ? 'text-success' : 'text-danger';
            const amountSign = isIncome ? '+' : '-';
            
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.innerHTML = `
                <div>
                    <h6 class="mb-1">${transaction.description || 'No description'}</h6>
                    <small class="text-muted">${transaction.category || 'Uncategorized'}</small>
                </div>
                <span class="${amountClass}">${amountSign}$${Math.abs(transaction.amount).toFixed(2)}</span>
            `;
            
            list.appendChild(item);
        });
        
        container.innerHTML = '';
        container.appendChild(list);
    }
    
    // Update budget chart with Chart.js
    updateBudgetChart(canvas, categories) {
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (canvas.chart) {
            canvas.chart.destroy();
        }
        
        // Create new chart
        canvas.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categories.map(([category]) => category),
                datasets: [{
                    data: categories.map(([_, amount]) => amount),
                    backgroundColor: [
                        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
                        '#5a5c69', '#858796', '#3a3b45', '#1cc88a', '#36b9cc'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Update budget overview chart
    updateBudgetOverview(transactions) {
        // Group transactions by category
        const categories = {};
        
        transactions.forEach(transaction => {
            if (transaction.type === 'expense' || transaction.amount < 0) {
                const category = transaction.category || 'Uncategorized';
                categories[category] = (categories[category] || 0) + Math.abs(transaction.amount);
            }
        });
        
        // Sort by amount (descending)
        const sortedCategories = Object.entries(categories)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5 categories
        
        // Update the chart or list
        const container = document.getElementById('budget-overview-chart');
        if (!container) {
            console.warn('Budget overview chart container not found');
            return;
        }
        
        // If we have a canvas, update the chart
        if (container.tagName === 'CANVAS') {
            this.updateBudgetChart(container, sortedCategories);
            return;
        }
        
        if (sortedCategories.length === 0) {
            container.innerHTML = '<div class="text-muted">No expense data available</div>';
            return;
        }
        
        const list = document.createElement('div');
        list.className = 'list-group list-group-flush';
        
        sortedCategories.forEach(([category, amount]) => {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.innerHTML = `
                <div>${category}</div>
                <div>
                    <span class="fw-medium">$${amount.toFixed(2)}</span>
                    <div class="progress mt-1" style="height: 4px; width: 100px;">
                        <div class="progress-bar bg-primary" role="progressbar" 
                             style="width: ${Math.min(100, (amount / 1000) * 100)}%" 
                             aria-valuenow="${amount}" 
                             aria-valuemin="0" 
                             aria-valuemax="1000">
                        </div>
                    </div>
                </div>
            `;
            
            list.appendChild(item);
        });
        
        container.innerHTML = '';
        container.appendChild(list);
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

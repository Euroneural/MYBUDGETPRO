class LocalDB {
    constructor() {
        this.dbName = 'BudgetProDB';
        this.dbVersion = 1;
        this.db = null;
        this.initializeDB();
    }

    async initializeDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains('transactions')) {
                    const store = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('category', 'category', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('categories')) {
                    const store = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: true });
                }
                
                if (!db.objectStoreNames.contains('accounts')) {
                    const store = db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: true });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('Error opening IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Generic method to add an item to a store
    async addItem(storeName, item) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add({ ...item, updatedAt: new Date().toISOString() });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic method to update an item in a store
    async updateItem(storeName, id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (!item) {
                    reject(new Error('Item not found'));
                    return;
                }

                const updatedItem = { ...item, ...updates, updatedAt: new Date().toISOString() };
                const updateRequest = store.put(updatedItem);
                
                updateRequest.onsuccess = () => resolve(updatedItem);
                updateRequest.onerror = () => reject(updateRequest.error);
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    // Generic method to delete an item from a store
    async deleteItem(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic method to get all items from a store
    async getAllItems(storeName, indexName = null, query = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            let request;
            if (indexName && query) {
                const index = store.index(indexName);
                request = index.getAll(query);
            } else {
                request = store.getAll();
            }

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    // Transaction methods
    async addTransaction(transaction) {
        return this.addItem('transactions', {
            ...transaction,
            amount: parseFloat(transaction.amount),
            date: new Date(transaction.date).toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        });
    }

    async updateTransaction(id, updates) {
        if (updates.amount) {
            updates.amount = parseFloat(updates.amount);
        }
        if (updates.date) {
            updates.date = new Date(updates.date).toISOString().split('T')[0];
        }
        return this.updateItem('transactions', id, updates);
    }

    async deleteTransaction(id) {
        return this.deleteItem('transactions', id);
    }

    async getTransactions(queryParams = {}) {
        let transactions = await this.getAllItems('transactions');
        
        // Apply filters
        if (queryParams.startDate && queryParams.endDate) {
            transactions = transactions.filter(t => 
                t.date >= queryParams.startDate && t.date <= queryParams.endDate
            );
        }
        
        if (queryParams.category) {
            transactions = transactions.filter(t => t.category === queryParams.category);
        }
        
        if (queryParams.type) {
            transactions = transactions.filter(t => t.type === queryParams.type);
        }
        
        // Sort by date descending
        return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Category methods
    async addCategory(category) {
        return this.addItem('categories', category);
    }

    async updateCategory(id, updates) {
        return this.updateItem('categories', id, updates);
    }

    async deleteCategory(id) {
        return this.deleteItem('categories', id);
    }

    async getCategories() {
        return this.getAllItems('categories');
    }

    // Account methods
    async addAccount(account) {
        return this.addItem('accounts', {
            ...account,
            balance: parseFloat(account.balance) || 0
        });
    }

    async updateAccount(id, updates) {
        if (updates.balance) {
            updates.balance = parseFloat(updates.balance);
        }
        return this.updateItem('accounts', id, updates);
    }

    async deleteAccount(id) {
        return this.deleteItem('accounts', id);
    }

    async getAccounts() {
        return this.getAllItems('accounts');
    }

    // Real-time listeners (simulated with polling for local storage)
    onTransactionsChange(callback) {
        const checkForChanges = async () => {
            const transactions = await this.getTransactions();
            callback(transactions);
        };
        
        // Check for changes every second
        const intervalId = setInterval(checkForChanges, 1000);
        
        // Initial call
        checkForChanges();
        
        // Return cleanup function
        return () => clearInterval(intervalId);
    }
    
    onCategoriesChange(callback) {
        const checkForChanges = async () => {
            const categories = await this.getCategories();
            callback(categories);
        };
        
        const intervalId = setInterval(checkForChanges, 1000);
        checkForChanges();
        return () => clearInterval(intervalId);
    }
    
    onAccountsChange(callback) {
        const checkForChanges = async () => {
            const accounts = await this.getAccounts();
            callback(accounts);
        };
        
        const intervalId = setInterval(checkForChanges, 1000);
        checkForChanges();
        return () => clearInterval(intervalId);
    }
}

// Create a singleton instance
const localDB = new LocalDB();

export { localDB };

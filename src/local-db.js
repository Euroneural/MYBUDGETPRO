// Local Database implementation using IndexedDB
class LocalDB {
    constructor() {
        this.dbName = 'BudgetProDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('transactions')) {
                    const store = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('category', 'category', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('categories')) {
                    const store = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: true });
                }
                
                if (!db.objectStoreNames.contains('budgets')) {
                    const store = db.createObjectStore('budgets', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('month', 'month', { unique: true });
                }
                
                if (!db.objectStoreNames.contains('accounts')) {
                    const store = db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: true });
                }
            };
        });
    }

    // Generic CRUD operations
    async addItem(storeName, item) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getItem(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async updateItem(storeName, item) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async deleteItem(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getAllItems(storeName, indexName, query) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const target = indexName ? store.index(indexName) : store;
            const request = query ? target.getAll(query) : target.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (event) => reject(event.target.error);
        });
    }
    
    // Clear all transactions from the database
    async clearAllTransactions() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');
            const request = store.clear();
            
            request.onsuccess = () => resolve(true);
            request.onerror = (event) => {
                console.error('Error clearing transactions:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Transaction-specific methods
    async getTransactions(filters = {}) {
        let transactions = await this.getAllItems('transactions');
        
        // Apply filters
        if (filters.startDate || filters.endDate) {
            transactions = transactions.filter(t => {
                const date = new Date(t.date);
                const startDate = filters.startDate ? new Date(filters.startDate) : null;
                const endDate = filters.endDate ? new Date(filters.endDate) : null;
                
                if (startDate && date < startDate) return false;
                if (endDate && date > endDate) return false;
                return true;
            });
        }
        
        if (filters.category) {
            transactions = transactions.filter(t => t.category === filters.category);
        }
        
        return transactions;
    }

    // Category methods
    async getCategories() {
        return this.getAllItems('categories');
    }

    // Budget methods
    async getBudget(month) {
        const budgets = await this.getAllItems('budgets');
        return budgets.find(b => b.month === month) || { month, categories: {} };
    }

    async saveBudget(budget) {
        const existing = await this.getBudget(budget.month);
        if (existing.id) {
            return this.updateItem('budgets', { ...existing, ...budget });
        } else {
            return this.addItem('budgets', budget);
        }
    }
}

// Create and export a singleton instance
export const localDB = new LocalDB();

// Initialize the database when the module loads
localDB.init().catch(console.error);

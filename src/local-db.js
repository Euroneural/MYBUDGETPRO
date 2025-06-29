// Local Database implementation using IndexedDB
class LocalDB {
    constructor() {
        this.dbName = 'BudgetProDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            // First try opening using existing version (no explicit version)
            let request = indexedDB.open(this.dbName);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };

            // If database exists and opens fine, onupgradeneeded will not fire.
            // We still need to ensure baseline stores exist; if missing we
            // immediately close and reopen with bumped version to create them.
            const ensureStores = (db) => {
                const needed = ['transactions','categories','budgets','accounts'];
                const missing = needed.filter(s=>!db.objectStoreNames.contains(s));
                return missing;
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const missing = ensureStores(db);
                if (missing.length===0) return;
                // Create baseline stores during this upgrade
                missing.forEach(storeName=>{
                    const store=db.createObjectStore(storeName,{keyPath:'id',autoIncrement:true});
                    if(storeName==='transactions'){
                        store.createIndex('date','date',{unique:false});
                        store.createIndex('category','category',{unique:false});
                    }
                    if(storeName==='categories'){
                        store.createIndex('name','name',{unique:true});
                    }
                    if(storeName==='budgets'){
                        store.createIndex('month','month',{unique:true});
                    }
                    if(storeName==='accounts'){
                        store.createIndex('name','name',{unique:true});
                    }
                });
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                const missing = ensureStores(this.db);
                if (missing.length>0){
                    // need to upgrade version to add stores
                    const newVersion = this.db.version + 1;
                    this.db.close();
                    const upgradeReq = indexedDB.open(this.dbName,newVersion);
                    upgradeReq.onupgradeneeded = (ev)=>{
                        const db=ev.target.result;
                        missing.forEach(storeName=>{
                            const store=db.createObjectStore(storeName,{keyPath:'id',autoIncrement:true});
                            if(storeName==='transactions'){
                                store.createIndex('date','date',{unique:false});
                                store.createIndex('category','category',{unique:false});
                            }
                            if(storeName==='categories'){
                                store.createIndex('name','name',{unique:true});
                            }
                            if(storeName==='budgets'){
                                store.createIndex('month','month',{unique:true});
                            }
                            if(storeName==='accounts'){
                                store.createIndex('name','name',{unique:true});
                            }
                        });
                    };
                    upgradeReq.onsuccess = ev2=>{
                        this.db = ev2.target.result;
                        resolve(this.db);
                    };
                    upgradeReq.onerror = ev2=>{
                        console.error('IndexedDB upgrade error:',ev2.target.error);
                        reject(ev2.target.error);
                    };
                } else {
                    resolve(this.db);
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

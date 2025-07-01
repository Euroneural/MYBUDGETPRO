import { sqliteService } from './services/sqlite-service.js';
// For backward compatibility: treat localDB as sqliteService
const localDB = sqliteService;
import { secureStorage } from './utils/crypto.js';

class SecureDB {
    constructor() {
        this.initialized = false;
        this.backend = sqliteService;
        this.encryptedFields = {
            transactions: ['description', 'notes', 'amount', 'category', 'account'],
            categories: ['name', 'description'],
            budgets: ['category', 'amount', 'notes']
        };
    }

    async initialize(password) {
        try {
            // Initialize the secure storage with the password
            const success = await secureStorage.initialize(password);
            if (!success) {
                throw new Error('Failed to initialize secure storage');
            }
            
            // Initialize the underlying database
            await this.backend.init();
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize secure database:', error);
            this.initialized = false;
            throw error;
        }
    }

    // Encrypt sensitive fields in an item
    async encryptItem(storeName, item) {
        if (!this.initialized) {
            // Encryption layer not ready (e.g. first launch before password).
            // Simply return the original item unmodified so plain-text data
            // can still be saved / read. This prevents data loss symptoms.
            return item;
        }

        const encryptedItem = { ...item };
        const fields = this.encryptedFields[storeName] || [];

        for (const field of fields) {
            if (field in encryptedItem && encryptedItem[field] !== undefined) {
                try {
                    encryptedItem[field] = await secureStorage.encrypt(encryptedItem[field]);
                } catch (error) {
                    console.error(`Failed to encrypt field ${field}:`, error);
                    throw error;
                }
            }
        }

        return encryptedItem;
    }

    // Decrypt sensitive fields in an item
    async decryptItem(storeName, item) {
        if (!this.initialized) {
            // Encryption layer not ready (e.g. first launch before password).
            // Simply return the original item unmodified so plain-text data
            // can still be saved / read. This prevents data loss symptoms.
            return item;
        }

        if (!item) return item;
        
        const decryptedItem = { ...item };
        const fields = this.encryptedFields[storeName] || [];

        for (const field of fields) {
            if (field in decryptedItem && decryptedItem[field] !== undefined) {
                try {
                    decryptedItem[field] = await secureStorage.decrypt(decryptedItem[field]);
                } catch (error) {
                    console.error(`Failed to decrypt field ${field}:`, error);
                    // If decryption fails, keep the encrypted value
                }
            }
        }

        return decryptedItem;
    }

    // Wrapper methods for localDB with encryption/decryption
    async addItem(storeName, item) {
        const encryptedItem = await this.encryptItem(storeName, item);
        return this.backend.addItem(storeName, encryptedItem);
    }

    async getItem(storeName, id) {
        const item = await this.backend.getItem(storeName, id);
        return this.decryptItem(storeName, item);
    }

    async updateItem(storeName, id, updates) {
        // Get the existing item
        const existingItem = await localDB.getItem(storeName, id);
        if (!existingItem) return null;
        
        // Merge updates with existing item and encrypt
        const updatedItem = { ...existingItem, ...updates };
        const encryptedItem = await this.encryptItem(storeName, updatedItem);
        
        return this.backend.updateItem(storeName, { ...encryptedItem, id });
    }

    async deleteItem(storeName, id) {
        return this.backend.deleteItem(storeName, id);
    }

    async getAllItems(storeName) {
        const items = await this.backend.getAllItems(storeName);
        return Promise.all(items.map(item => this.decryptItem(storeName, item)));
    }

    async queryItems(storeName, indexName, keyRange) {
        const items = await this.backend.getAllItems(storeName);
        return Promise.all(items.map(item => this.decryptItem(storeName, item)));
    }

    // Transaction-specific helper to support existing SearchManager & other code
    async getTransactions(filters = {}) {
        const transactions = await this.backend.getAllItems('transactions');
        return Promise.all(transactions.map(txn => this.decryptItem('transactions', txn)));
    }

    // Clear all transactions – used by delete-all feature
    async clearAllTransactions() {
        return this.backend.deleteItem ? this.backend.clearAllTransactions?.() : Promise.resolve();
    }

    // Add other methods from localDB as needed...
}

// Create and export a singleton instance
export const secureDB = new SecureDB();

// For backward compatibility, we'll keep the original localDB export
export { localDB };

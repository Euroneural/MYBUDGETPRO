import { localDB } from './local-db.js';
import { secureStorage } from './utils/crypto.js';

class SecureDB {
    constructor() {
        this.initialized = false;
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
            await localDB.init();
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
            throw new Error('SecureDB not initialized');
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
            throw new Error('SecureDB not initialized');
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
        return localDB.addItem(storeName, encryptedItem);
    }

    async getItem(storeName, id) {
        const item = await localDB.getItem(storeName, id);
        return this.decryptItem(storeName, item);
    }

    async updateItem(storeName, id, updates) {
        // Get the existing item
        const existingItem = await localDB.getItem(storeName, id);
        if (!existingItem) return null;
        
        // Merge updates with existing item and encrypt
        const updatedItem = { ...existingItem, ...updates };
        const encryptedItem = await this.encryptItem(storeName, updatedItem);
        
        return localDB.updateItem(storeName, id, encryptedItem);
    }

    async deleteItem(storeName, id) {
        return localDB.deleteItem(storeName, id);
    }

    async getAllItems(storeName) {
        const items = await localDB.getAllItems(storeName);
        return Promise.all(items.map(item => this.decryptItem(storeName, item)));
    }

    async queryItems(storeName, indexName, keyRange) {
        const items = await localDB.queryItems(storeName, indexName, keyRange);
        return Promise.all(items.map(item => this.decryptItem(storeName, item)));
    }

    // Add other methods from localDB as needed...
}

// Create and export a singleton instance
export const secureDB = new SecureDB();

// For backward compatibility, we'll keep the original localDB export
export { localDB };

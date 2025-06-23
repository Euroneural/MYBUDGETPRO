import { db } from './firebase-config.js';

class Database {
    constructor(userId) {
        this.userId = userId;
        this.transactionsRef = db.collection(`users/${userId}/transactions`);
        this.categoriesRef = db.collection(`users/${userId}/categories`);
        this.accountsRef = db.collection(`users/${userId}/accounts`);
    }

    // Transactions
    async addTransaction(transaction) {
        const docRef = await this.transactionsRef.add({
            ...transaction,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    }

    async updateTransaction(id, updates) {
        await this.transactionsRef.doc(id).update({
            ...updates,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async deleteTransaction(id) {
        await this.transactionsRef.doc(id).delete();
    }

    getTransactions(queryParams = {}) {
        let query = this.transactionsRef;
        
        // Apply filters if provided
        if (queryParams.startDate && queryParams.endDate) {
            query = query.where('date', '>=', queryParams.startDate)
                       .where('date', '<=', queryParams.endDate);
        }
        
        if (queryParams.category) {
            query = query.where('category', '==', queryParams.category);
        }
        
        if (queryParams.type) {
            query = query.where('type', '==', queryParams.type);
        }
        
        return query.orderBy('date', 'desc').get();
    }

    // Categories
    async addCategory(category) {
        const docRef = await this.categoriesRef.add({
            ...category,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    }

    async updateCategory(id, updates) {
        await this.categoriesRef.doc(id).update({
            ...updates,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async deleteCategory(id) {
        await this.categoriesRef.doc(id).delete();
    }

    getCategories() {
        return this.categoriesRef.orderBy('name').get();
    }

    // Accounts
    async addAccount(account) {
        const docRef = await this.accountsRef.add({
            ...account,
            balance: parseFloat(account.balance) || 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    }

    async updateAccount(id, updates) {
        await this.accountsRef.doc(id).update({
            ...updates,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async deleteAccount(id) {
        await this.accountsRef.doc(id).delete();
    }

    getAccounts() {
        return this.accountsRef.orderBy('name').get();
    }


    // Real-time listeners
    onTransactionsChange(callback) {
        return this.transactionsRef
            .orderBy('date', 'desc')
            .onSnapshot(snapshot => {
                const transactions = [];
                snapshot.forEach(doc => {
                    transactions.push({ id: doc.id, ...doc.data() });
                });
                callback(transactions);
            });
    }

    onCategoriesChange(callback) {
        return this.categoriesRef
            .orderBy('name')
            .onSnapshot(snapshot => {
                const categories = [];
                snapshot.forEach(doc => {
                    categories.push({ id: doc.id, ...doc.data() });
                });
                callback(categories);
            });
    }


    onAccountsChange(callback) {
        return this.accountsRef
            .orderBy('name')
            .onSnapshot(snapshot => {
                const accounts = [];
                snapshot.forEach(doc => {
                    accounts.push({ id: doc.id, ...doc.data() });
                });
                callback(accounts);
            });
    }
}

export { Database };

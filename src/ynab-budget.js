/**
 * YNAB-style Budgeting Module
 * Implements zero-based budgeting with categories, goals, and reporting
 */

import secureDB from './secure-db.js';

class YNABBudget {
    constructor() {
        this.categories = [];
        this.goals = [];
        this.monthlyBudget = 0;
        this.currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        this.initializeStorage();
    }

    // Initialize storage with default categories if none exist
    async initializeStorage() {
        try {
            if (!secureDB) {
                console.error('secureDB is not available');
                return;
            }
            
            // Initialize secureDB if not already done
            if (!secureDB.initialized) {
                try {
                    await secureDB.initialize(''); // Initialize with empty password for now
                } catch (initError) {
                    console.error('Failed to initialize secureDB:', initError);
                    // Continue with unencrypted storage if initialization fails
                }
            }
            
            // Try to load existing budget data
            try {
                const stored = await secureDB.getItem('budget', 'ynab-budget');
                if (stored) {
                    console.log('Loaded existing budget data');
                    Object.assign(this, stored);
                    return; // Successfully loaded existing data
                }
            } catch (loadError) {
                console.error('Error loading budget data:', loadError);
                // Continue with default categories if loading fails
            }
            
            // If we get here, either no data exists or loading failed
            console.log('Creating default categories...');
            await this.createDefaultCategories();
            await this.saveToStorage();
            
        } catch (error) {
            console.error('Error in initializeStorage:', error);
            // Initialize with default categories if there's an error
            await this.createDefaultCategories();
        }
    }
    
    // Save current state to storage
    async saveToStorage() {
        try {
            if (!secureDB) {
                console.error('secureDB is not available');
                return false;
            }
            
            // Ensure secureDB is initialized
            if (!secureDB.initialized) {
                try {
                    await secureDB.initialize('');
                } catch (initError) {
                    console.error('Failed to initialize secureDB for save:', initError);
                    // Continue with unencrypted storage if initialization fails
                }
            }
            
            // Create a budget document with the current month as the ID
            const budgetId = this.currentMonth || new Date().toISOString().slice(0, 7);
            const data = {
                id: budgetId,
                categories: this.categories || [],
                goals: this.goals || [],
                monthlyBudget: this.monthlyBudget || 0,
                currentMonth: budgetId,
                updatedAt: new Date().toISOString()
            };
            
            console.log('Saving budget data:', data);
            
            // First try to update existing budget, if it exists
            try {
                await secureDB.setItem('budgets', data);
            } catch (error) {
                console.warn('Error updating budget, trying to add new:', error);
                // If update fails, try to add as new
                await secureDB.addItem('budgets', data);
            }
            
            console.log('Budget data saved successfully');
            return true;
            
        } catch (error) {
            console.error('Error saving budget data:', error);
            return false;
        }
    }

    // Create default budget categories
    async createDefaultCategories() {
        this.categories = [
            { id: this.generateId(), name: 'Housing', budgeted: 0, activity: 0, balance: 0 },
            { id: this.generateId(), name: 'Transportation', budgeted: 0, activity: 0, balance: 0 },
            { id: this.generateId(), name: 'Food', budgeted: 0, activity: 0, balance: 0 },
            { id: this.generateId(), name: 'Utilities', budgeted: 0, activity: 0, balance: 0 },
            { id: this.generateId(), name: 'Healthcare', budgeted: 0, activity: 0, balance: 0 },
            { id: this.generateId(), name: 'Savings', budgeted: 0, activity: 0, balance: 0 },
            { id: this.generateId(), name: 'Personal', budgeted: 0, activity: 0, balance: 0 },
            { id: this.generateId(), name: 'Entertainment', budgeted: 0, activity: 0, balance: 0 },
            { id: this.generateId(), name: 'Debt', budgeted: 0, activity: 0, balance: 0 },
            { id: this.generateId(), name: 'Other', budgeted: 0, activity: 0, balance: 0 }
        ];
        await this.saveToStorage();
    }

    // Generate a unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Set monthly budget amount
    async setMonthlyBudget(amount) {
        this.monthlyBudget = parseFloat(amount) || 0;
        await this.saveToStorage();
    }

    // Add a new category
    async addCategory(name, budgeted = 0) {
        const newCategory = {
            id: this.generateId(),
            name: name.trim(),
            budgeted: parseFloat(budgeted) || 0,
            activity: 0,
            balance: 0
        };
        this.categories.push(newCategory);
        await this.saveToStorage();
        return newCategory;
    }

    // Update a category
    async updateCategory(categoryId, updates) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return null;

        Object.assign(category, updates);
        await this.saveToStorage();
        return category;
    }

    // Delete a category
    async deleteCategory(categoryId) {
        this.categories = this.categories.filter(c => c.id !== categoryId);
        await this.saveToStorage();
    }

    // Add a goal to a category
    async addGoal(categoryId, targetAmount, targetDate, description = '') {
        const goal = {
            id: this.generateId(),
            categoryId,
            targetAmount: parseFloat(targetAmount) || 0,
            currentAmount: 0,
            targetDate: targetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            description: description.trim(),
            createdAt: new Date().toISOString()
        };
        this.goals.push(goal);
        await this.saveToStorage();
        return goal;
    }

    // Update a goal
    async updateGoal(goalId, updates) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return null;

        Object.assign(goal, updates);
        await this.saveToStorage();
        return goal;
    }

    // Process transactions and update category activities
    async processTransactions(transactions) {
        // Reset activity for all categories
        this.categories.forEach(cat => {
            cat.activity = 0;
        });

        // Process each transaction
        transactions.forEach(tx => {
            const amount = parseFloat(tx.amount) || 0;
            const category = this.categories.find(cat => 
                tx.category && tx.category.toLowerCase() === cat.name.toLowerCase()
            );

            if (category) {
                category.activity += amount;
                category.balance = category.budgeted + category.activity;
            }
        });

        await this.saveToStorage();
    }

    // Get budget summary for the current month
    getBudgetSummary() {
        const totalBudgeted = this.categories.reduce((sum, cat) => sum + (parseFloat(cat.budgeted) || 0), 0);
        const totalActivity = this.categories.reduce((sum, cat) => sum + (parseFloat(cat.activity) || 0), 0);
        const totalBalance = this.categories.reduce((sum, cat) => sum + (parseFloat(cat.balance) || 0), 0);
        const toBeBudgeted = this.monthlyBudget - totalBudgeted;

        return {
            monthlyBudget: this.monthlyBudget,
            totalBudgeted,
            totalActivity,
            totalBalance,
            toBeBudgeted,
            categories: [...this.categories]
        };
    }

    // Get spending report by category
    getSpendingReport() {
        return this.categories.map(cat => ({
            name: cat.name,
            budgeted: cat.budgeted,
            activity: cat.activity,
            balance: cat.balance,
            percentage: this.monthlyBudget > 0 ? (cat.budgeted / this.monthlyBudget) * 100 : 0
        }));
    }

    // Split a transaction across multiple categories
    async splitTransaction(transactionId, splits) {
        // Implementation for splitting transactions
        // splits = [{ categoryId: 'id1', amount: 10 }, ...]
        await this.saveToStorage();
    }
}

// Create singleton instance
const ynabBudget = new YNABBudget();

// Export both as default and named for compatibility
export { ynabBudget };
export default ynabBudget;

// Client-side database using IndexedDB
export class LocalDatabase {
    constructor() {
        this.dbName = 'ExpenseTrackerDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create users table
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                    userStore.createIndex('email', 'email', { unique: true });
                }
                
                // Create expenses table
                if (!db.objectStoreNames.contains('expenses')) {
                    const expenseStore = db.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
                    expenseStore.createIndex('userId', 'userId');
                    expenseStore.createIndex('date', 'date');
                }
                
                // Create sessions table
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
                    sessionStore.createIndex('token', 'token', { unique: true });
                }
                
                // Create sync table for backup/restore
                if (!db.objectStoreNames.contains('sync')) {
                    db.createObjectStore('sync', { keyPath: 'key' });
                }
            };
        });
    }

    async addUser(userData) {
        const transaction = this.db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        const user = {
            id: Date.now(),
            ...userData,
            createdAt: new Date().toISOString()
        };
        await store.add(user);
        return user;
    }

    async getUserByEmail(email) {
        const transaction = this.db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const index = store.index('email');
        return index.get(email);
    }

    async addExpense(expenseData, userId) {
        const transaction = this.db.transaction(['expenses'], 'readwrite');
        const store = transaction.objectStore('expenses');
        const expense = {
            id: Date.now() + Math.random(), // Ensure unique IDs
            userId: userId,
            ...expenseData,
            createdAt: new Date().toISOString()
        };
        await store.add(expense);
        return expense;
    }

    async addExpenses(expensesArray, userId) {
        const transaction = this.db.transaction(['expenses'], 'readwrite');
        const store = transaction.objectStore('expenses');
        
        const results = [];
        for (const expenseData of expensesArray) {
            const expense = {
                id: Date.now() + Math.random(), // Ensure unique IDs
                userId: userId,
                ...expenseData,
                createdAt: new Date().toISOString()
            };
            await store.add(expense);
            results.push(expense);
        }
        
        return results;
    }

    async getExpenses(userId) {
        const transaction = this.db.transaction(['expenses'], 'readonly');
        const store = transaction.objectStore('expenses');
        const index = store.index('userId');
        return new Promise((resolve, reject) => {
            const request = index.getAll(userId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Legacy method name for backward compatibility
    async getAllExpenses(userId) {
        return this.getExpenses(userId);
    }

    async addStatement(statementData, userId) {
        const transaction = this.db.transaction(['statements'], 'readwrite');
        const store = transaction.objectStore('statements');
        const statement = {
            id: Date.now(),
            userId: userId,
            ...statementData,
            uploadedAt: new Date().toISOString()
        };
        await store.add(statement);
        return statement;
    }

    async getStatements(userId) {
        const transaction = this.db.transaction(['statements'], 'readonly');
        const store = transaction.objectStore('statements');
        const index = store.index('userId');
        return new Promise((resolve, reject) => {
            const request = index.getAll(userId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteAllExpenses(userId) {
        const transaction = this.db.transaction(['expenses'], 'readwrite');
        const store = transaction.objectStore('expenses');
        const index = store.index('userId');
        
        return new Promise((resolve, reject) => {
            const request = index.openCursor(userId);
            let deletedCount = 0;
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    resolve(deletedCount);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async updateExpense(id, updates) {
        const transaction = this.db.transaction(['expenses'], 'readwrite');
        const store = transaction.objectStore('expenses');
        const expense = await store.get(id);
        if (expense) {
            Object.assign(expense, updates);
            return store.put(expense);
        }
    }

    async deleteExpense(id) {
        const transaction = this.db.transaction(['expenses'], 'readwrite');
        const store = transaction.objectStore('expenses');
        return store.delete(id);
    }

    // Backup/Restore functionality
    async exportData(userId) {
        const expenses = await this.getExpenses(userId);
        const statements = await this.getStatements(userId);
        const user = await this.getUser(userId);
        return {
            user: user,
            expenses: expenses,
            statements: statements,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
    }

    async importData(data, userId) {
        // Clear existing data
        await this.deleteAllExpenses(userId);
        
        // Clear statements
        const transaction = this.db.transaction(['statements'], 'readwrite');
        const store = transaction.objectStore('statements');
        const index = store.index('userId');
        
        await new Promise((resolve, reject) => {
            const request = index.openCursor(userId);
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
        
        // Import new expenses
        if (data.expenses) {
            await this.addExpenses(data.expenses, userId);
        }
        
        // Import new statements
        if (data.statements) {
            for (const statement of data.statements) {
                await this.addStatement(statement, userId);
            }
        }
    }

    async clearExpenses(userId) {
        const transaction = this.db.transaction(['expenses'], 'readwrite');
        const store = transaction.objectStore('expenses');
        const index = store.index('userId');
        
        return new Promise((resolve, reject) => {
            const request = index.openCursor(userId);
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getUser(userId) {
        const transaction = this.db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        return store.get(userId);
    }
}

export { LocalDatabase };

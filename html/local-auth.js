import { LocalDatabase } from './local-database.js';

// Client-side authentication (no server required)
export class LocalAuth {
    constructor() {
        this.db = new LocalDatabase();
        this.currentUser = null;
    }

    async init() {
        await this.db.init();
        // Check if user is already logged in
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
        }
    }

    async register(email, password, fullName) {
        try {
            // Check if user already exists
            const existingUser = await this.db.getUserByEmail(email);
            if (existingUser) {
                return { success: false, error: 'Email already registered' };
            }

            // Hash password (simple client-side hashing)
            const passwordHash = await this.hashPassword(password);
            
            // Create user
            const userData = {
                email: email.toLowerCase().trim(),
                passwordHash: passwordHash,
                fullName: fullName.trim()
            };

            await this.db.addUser(userData);
            return { success: true, message: 'Account created successfully' };
        } catch (error) {
            return { success: false, error: 'Registration failed: ' + error.message };
        }
    }

    async login(email, password) {
        try {
            const user = await this.db.getUserByEmail(email.toLowerCase().trim());
            if (!user) {
                return { success: false, error: 'Invalid email or password' };
            }

            const isValidPassword = await this.verifyPassword(password, user.passwordHash);
            if (!isValidPassword) {
                return { success: false, error: 'Invalid email or password' };
            }

            // Set current user
            this.currentUser = {
                id: user.id,
                email: user.email,
                fullName: user.fullName
            };

            // Save to localStorage for persistence
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

            return {
                success: true,
                user: this.currentUser
            };
        } catch (error) {
            return { success: false, error: 'Login failed: ' + error.message };
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        window.location.reload();
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isLoggedIn() {
        return !!this.currentUser;
    }

    // Simple password hashing using Web Crypto API
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'expense_tracker_salt');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async verifyPassword(password, hash) {
        const computedHash = await this.hashPassword(password);
        return computedHash === hash;
    }

    // Export user data for backup/sync
    async exportUserData() {
        if (!this.currentUser) return null;
        return await this.db.exportData(this.currentUser.id);
    }

    // Import user data from backup/sync
    async importUserData(data) {
        if (!this.currentUser) return false;
        try {
            await this.db.importData(data, this.currentUser.id);
            return true;
        } catch (error) {
            console.error('Import failed:', error);
            return false;
        }
    }
}

export { LocalAuth };

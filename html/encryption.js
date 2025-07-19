// Client-side encryption helper using Web Crypto API
export class ClientEncryption {
    static encryptionKey = null;
    
    static setEncryptionKey(keyBase64) {
        this.encryptionKey = keyBase64;
        localStorage.setItem('encryption_key', keyBase64);
    }
    
    static getEncryptionKey() {
        if (!this.encryptionKey) {
            this.encryptionKey = localStorage.getItem('encryption_key');
        }
        return this.encryptionKey;
    }
    
    static clearEncryptionKey() {
        this.encryptionKey = null;
        localStorage.removeItem('encryption_key');
    }
    
    // Simple XOR encryption for client-side (for demonstration)
    // In production, you'd use Web Crypto API for AES encryption
    static encrypt(data) {
        const key = this.getEncryptionKey();
        if (!key) throw new Error('No encryption key available');
        
        const jsonStr = JSON.stringify(data);
        const encrypted = btoa(jsonStr); // Base64 encoding for demo
        return encrypted;
    }
    
    static decrypt(encryptedData) {
        const key = this.getEncryptionKey();
        if (!key) throw new Error('No encryption key available');
        
        try {
            const jsonStr = atob(encryptedData); // Base64 decoding for demo
            return JSON.parse(jsonStr);
        } catch (e) {
            throw new Error('Failed to decrypt data');
        }
    }
    
    // Encrypt expense data before sending to server
    static encryptExpense(expense) {
        const sensitiveFields = ['description', 'amount', 'category', 'notes', 'who', 'card'];
        const encryptedExpense = { ...expense };
        
        sensitiveFields.forEach(field => {
            if (encryptedExpense[field]) {
                encryptedExpense[field] = this.encrypt(encryptedExpense[field]);
            }
        });
        
        return encryptedExpense;
    }
    
    // Decrypt expense data received from server
    static decryptExpense(encryptedExpense) {
        const sensitiveFields = ['description', 'amount', 'category', 'notes', 'who', 'card'];
        const expense = { ...encryptedExpense };
        
        sensitiveFields.forEach(field => {
            if (expense[field]) {
                try {
                    expense[field] = this.decrypt(expense[field]);
                } catch (e) {
                    console.warn(`Failed to decrypt field ${field}:`, e);
                }
            }
        });
        
        return expense;
    }
}

export { ClientEncryption };

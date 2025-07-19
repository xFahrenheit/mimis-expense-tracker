// Authentication helper functions
export class AuthManager {
    static getSessionToken() {
        return localStorage.getItem('session_token');
    }
    
    static getCurrentUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }
    
    static isLoggedIn() {
        return !!this.getSessionToken();
    }
    
    static async verifySession() {
        const token = this.getSessionToken();
        if (!token) return false;
        
        try {
            const response = await fetch(`${window.location.origin}/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.ok;
        } catch {
            return false;
        }
    }
    
    static logout() {
        const token = this.getSessionToken();
        if (token) {
            fetch(`${window.location.origin}/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }
        localStorage.removeItem('session_token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }
    
    static redirectToLogin() {
        window.location.href = '/login.html';
    }
    
    static async makeAuthenticatedRequest(url, options = {}) {
        const token = this.getSessionToken();
        if (!token) {
            this.redirectToLogin();
            return;
        }
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };
        
        const response = await fetch(url, { ...options, headers });
        
        if (response.status === 401) {
            // Session expired
            this.logout();
            return;
        }
        
        return response;
    }
}

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    if (!AuthManager.isLoggedIn()) {
        AuthManager.redirectToLogin();
        return;
    }
    
    const isValid = await AuthManager.verifySession();
    if (!isValid) {
        AuthManager.logout();
        return;
    }
    
    // Show user info in the header
    const user = AuthManager.getCurrentUser();
    if (user) {
        // Add user info to header if element exists
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.innerHTML = `
                <span class="text-sm text-gray-600">Welcome, ${user.full_name}</span>
                <button id="logoutBtn" class="ml-4 text-sm text-red-600 hover:text-red-800">Logout</button>
            `;
            
            document.getElementById('logoutBtn').addEventListener('click', () => {
                AuthManager.logout();
            });
        }
    }
});

export { AuthManager };

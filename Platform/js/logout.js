// ===== LOGOUT FUNCTIONALITY =====

// Global logout function
function logoutUser() {
    console.log('🚪 Logout function called');
    
    // Show confirmation dialog
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        // Clear user data from localStorage
        localStorage.removeItem('current_user');
        localStorage.removeItem('twq_cart');
        localStorage.removeItem('user_preferences');
        
        console.log('✅ User data cleared, redirecting to login page...');
        
        // Show success message
        showLogoutMessage('تم تسجيل الخروج بنجاح');
        
        // Redirect to login page after a short delay
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }
}

// Show logout message
function showLogoutMessage(message) {
    const notification = document.createElement('div');
    notification.className = 'logout-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// Check if user is logged in
function isUserLoggedIn() {
    const currentUser = localStorage.getItem('current_user');
    return currentUser !== null;
}

// Get current user data
function getCurrentUser() {
    const currentUserStr = localStorage.getItem('current_user');
    if (currentUserStr) {
        try {
            return JSON.parse(currentUserStr);
        } catch (error) {
            console.error('Error parsing user data:', error);
            return null;
        }
    }
    return null;
}

// Clear all user data
function clearAllUserData() {
    const keysToRemove = [
        'current_user',
        'twq_cart',
        'user_preferences',
        'chat_history',
        'last_activity'
    ];
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
    });
    
    console.log('✅ All user data cleared');
}

// Export functions for global access
window.logoutUser = logoutUser;
window.isUserLoggedIn = isUserLoggedIn;
window.getCurrentUser = getCurrentUser;
window.clearAllUserData = clearAllUserData;

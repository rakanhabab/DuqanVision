// Common Admin JavaScript
// Note: This file is loaded as a module, but doesn't import db directly
// The database connection is handled by individual page modules

class AdminCommonService {
    constructor() {
        this.initializeCommonAdmin();
    }

    async initializeCommonAdmin() {
        try {
            // Check admin authentication
            await this.checkAdminAuth();
            
            // Initialize common components
            this.initializeSidebar();
            this.initializeHeader();
            this.initializeVirtualAssistant();
            this.initializeLogout();
            this.initializeKeyboardShortcuts();
        } catch (error) {
            console.error('Error initializing common admin:', error);
        }
    }

    async checkAdminAuth() {
        const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
        const isAdmin = localStorage.getItem('twq_is_admin') === 'true' || 
                       currentUser.email?.includes('admin') || 
                       currentUser.role === 'admin' || 
                       currentUser.is_admin === true;
        
        if (!isAdmin) {
            alert('غير مصرح لك بالوصول إلى لوحة التحكم');
            window.location.href = '../pages/login.html';
            return;
        }
    }

    initializeSidebar() {
        // Set active navigation item based on current page
        const currentPage = window.location.pathname.split('/').pop();
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            const link = item.querySelector('a');
            if (link && link.getAttribute('href') === currentPage) {
                item.classList.add('active');
            }
        });

        // Add click handlers for navigation
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

    initializeHeader() {
        // Update user info in header
        const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
        const userNameElement = document.querySelector('.user-name');
        const userEmailElement = document.querySelector('.user-email');
        
        if (userNameElement) {
            userNameElement.textContent = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'المدير';
        }
        
        if (userEmailElement) {
            userEmailElement.textContent = currentUser.email || 'admin@dukkan.com';
        }
    }

    initializeVirtualAssistant() {
        const assistantInput = document.getElementById('assistantInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (assistantInput && sendBtn) {
            // Send button click handler
            sendBtn.addEventListener('click', () => {
                this.handleAssistantMessage();
            });
            
            // Enter key handler
            assistantInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleAssistantMessage();
                }
            });
        }
    }

    handleAssistantMessage() {
        const assistantInput = document.getElementById('assistantInput');
        const message = assistantInput?.value?.trim();
        
        if (!message) return;
        
        // Show assistant response
        this.showAssistantResponse(message);
        
        // Clear input
        if (assistantInput) {
            assistantInput.value = '';
        }
    }

    showAssistantResponse(userMessage) {
        // Create response based on user message and current page
        const currentPage = window.location.pathname.split('/').pop();
        let response = 'كيف يمكنني مساعدتك؟';
        
        const responses = {
            'dashboard.html': {
                'help': 'في لوحة التحكم يمكنك:\n- مراقبة الإيرادات والطلبات\n- عرض الإحصائيات اليومية\n- تتبع النشاطات الأخيرة',
                'revenue': 'الإيرادات تعرض المبيعات اليومية والأسبوعية والشهرية',
                'orders': 'الطلبات تعرض عدد الطلبات المكتملة والمعلقة'
            },
            'operations.html': {
                'help': 'في إدارة العمليات يمكنك:\n- مراقبة العربات الافتراضية\n- تتبع الطلبات الحية\n- إدارة العمليات اليومية',
                'carts': 'العربات الافتراضية تعرض الطلبات النشطة حالياً',
                'live': 'العمليات المباشرة تعرض النشاطات الحالية'
            },
            'inventory.html': {
                'help': 'في إدارة المخزون يمكنك:\n- عرض جميع المنتجات\n- البحث والفلترة\n- تحديث الكميات',
                'products': 'المنتجات تعرض جميع السلع المتوفرة في المخزون',
                'search': 'استخدم البحث للعثور على منتجات محددة'
            },
            'branches.html': {
                'help': 'في إدارة الفروع يمكنك:\n- عرض جميع الفروع\n- تعديل معلومات الفروع\n- مراقبة الأداء',
                'branches': 'الفروع تعرض جميع المواقع المتاحة',
                'edit': 'اضغط على زر التعديل لتغيير معلومات الفرع'
            },
            'tickets.html': {
                'help': 'في إدارة التذاكر يمكنك:\n- عرض جميع التذاكر\n- قبول أو رفض الطلبات\n- معالجة الاستفسارات',
                'tickets': 'التذاكر تعرض جميع الطلبات والاستفسارات',
                'approve': 'اضغط على "قبول الطلب" للموافقة على التذكرة'
            }
        };
        
        const pageResponses = responses[currentPage] || responses['dashboard.html'];
        const lowerMessage = userMessage.toLowerCase();
        
        if (lowerMessage.includes('help') || lowerMessage.includes('مساعدة')) {
            response = pageResponses.help;
        } else if (lowerMessage.includes('revenue') || lowerMessage.includes('إيراد')) {
            response = pageResponses.revenue || 'الإيرادات تعرض المبيعات والأرباح';
        } else if (lowerMessage.includes('order') || lowerMessage.includes('طلب')) {
            response = pageResponses.orders || 'الطلبات تعرض عدد الطلبات المكتملة';
        } else if (lowerMessage.includes('cart') || lowerMessage.includes('عربة')) {
            response = pageResponses.carts || 'العربات تعرض الطلبات النشطة';
        } else if (lowerMessage.includes('product') || lowerMessage.includes('منتج')) {
            response = pageResponses.products || 'المنتجات تعرض جميع السلع المتوفرة';
        } else if (lowerMessage.includes('branch') || lowerMessage.includes('فرع')) {
            response = pageResponses.branches || 'الفروع تعرض جميع المواقع';
        } else if (lowerMessage.includes('ticket') || lowerMessage.includes('تذكرة')) {
            response = pageResponses.tickets || 'التذاكر تعرض الطلبات والاستفسارات';
        }
        
        // Show notification with response
        this.showNotification(response, 'info');
    }

    initializeLogout() {
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }
    }

    handleLogout() {
        if (confirm('هل تريد تسجيل الخروج؟')) {
            // Clear admin session
            localStorage.removeItem('current_user');
            localStorage.removeItem('twq_is_admin');
            
            // Redirect to login page
            window.location.href = '../pages/login.html';
        }
    }

    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl/Cmd + L to logout
            if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
                event.preventDefault();
                this.handleLogout();
            }
            
            // Ctrl/Cmd + H to focus on virtual assistant
            if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
                event.preventDefault();
                const assistantInput = document.getElementById('assistantInput');
                if (assistantInput) {
                    assistantInput.focus();
                }
            }
            
            // Escape to close modals or clear search
            if (event.key === 'Escape') {
                const modals = document.querySelectorAll('.modal.show');
                modals.forEach(modal => {
                    modal.classList.remove('show');
                });
                
                const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="بحث"]');
                searchInputs.forEach(input => {
                    input.value = '';
                    input.dispatchEvent(new Event('input'));
                });
            }
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        const colors = {
            success: '#38a169',
            warning: '#d97706',
            error: '#e53e3e',
            info: '#3182ce'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            font-family: 'Cairo', sans-serif;
            font-size: 0.9rem;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
            white-space: pre-line;
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // Utility method to format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR'
        }).format(amount);
    }

    // Utility method to format date
    formatDate(dateString) {
        if (!dateString) return 'غير محدد';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Initialize common admin when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.adminCommonService = new AdminCommonService();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(20px);
        }
    }
    
    .nav-item.active {
        background: rgba(220, 38, 38, 0.1);
        border-right: 3px solid #dc2626;
    }
    
    .nav-item.active a {
        color: #dc2626;
    }
`;
document.head.appendChild(style);

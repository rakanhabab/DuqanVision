// Admin Index Page JavaScript
import { db } from '../../js/database.js';

class AdminIndexService {
    constructor() {
        this.initializeAdminIndex();
    }

    async initializeAdminIndex() {
        try {
            // Initialize admin index functionality
            this.initializeMenuCards();
            this.initializeVirtualAssistant();
            this.initializeLogout();
        } catch (error) {
            console.error('Error initializing admin index:', error);
        }
    }

    initializeMenuCards() {
        // Add click effects to menu cards
        const menuCards = document.querySelectorAll('.menu-card');
        menuCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Add click animation
                card.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    card.style.transform = '';
                }, 150);
            });

            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-4px)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = '';
            });
        });
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
        // Create response based on user message
        const responses = {
            'help': 'مرحباً! كيف يمكنني مساعدتك اليوم؟ يمكنني مساعدتك في:\n- إدارة المنتجات والمخزون\n- مراقبة الطلبات\n- إدارة الفروع\n- معالجة التذاكر',
            'products': 'لإدارة المنتجات، انتقل إلى صفحة "إدارة المخزون" حيث يمكنك:\n- عرض جميع المنتجات\n- إضافة منتجات جديدة\n- تحديث الكميات\n- البحث والفلترة',
            'orders': 'لمراقبة الطلبات، انتقل إلى صفحة "إدارة العمليات" حيث يمكنك:\n- مشاهدة العربات الافتراضية\n- تتبع الطلبات الحية\n- مراقبة العمليات اليومية',
            'branches': 'لإدارة الفروع، انتقل إلى صفحة "إدارة الفروع" حيث يمكنك:\n- عرض جميع الفروع\n- تعديل معلومات الفروع\n- مراقبة أداء كل فرع',
            'tickets': 'لمعالجة التذاكر، انتقل إلى صفحة "إدارة التذاكر" حيث يمكنك:\n- عرض جميع التذاكر\n- قبول أو رفض الطلبات\n- معالجة الاستفسارات'
        };
        
        let response = 'شكراً لسؤالك! كيف يمكنني مساعدتك في إدارة المتجر؟';
        
        // Check for keywords in user message
        const lowerMessage = userMessage.toLowerCase();
        if (lowerMessage.includes('help') || lowerMessage.includes('مساعدة')) {
            response = responses.help;
        } else if (lowerMessage.includes('product') || lowerMessage.includes('منتج')) {
            response = responses.products;
        } else if (lowerMessage.includes('order') || lowerMessage.includes('طلب')) {
            response = responses.orders;
        } else if (lowerMessage.includes('branch') || lowerMessage.includes('فرع')) {
            response = responses.branches;
        } else if (lowerMessage.includes('ticket') || lowerMessage.includes('تذكرة')) {
            response = responses.tickets;
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
            window.location.href = '../login.html';
        }
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
}

// Initialize admin index when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new AdminIndexService();
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
    
    .menu-card {
        transition: all 0.3s ease;
    }
    
    .menu-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 32px rgba(220, 38, 38, 0.2);
    }
`;
document.head.appendChild(style);

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + L to logout
    if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
        event.preventDefault();
        const adminIndexService = window.adminIndexService;
        if (adminIndexService) {
            adminIndexService.handleLogout();
        }
    }
    
    // Ctrl/Cmd + H to focus on virtual assistant
    if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
        event.preventDefault();
        const assistantInput = document.getElementById('assistantInput');
        if (assistantInput) {
            assistantInput.focus();
        }
    }
    
    // Numbers 1-5 to navigate to different sections
    if (event.key >= '1' && event.key <= '5') {
        const sections = [
            './dashboard.html',
            './operations.html',
            './inventory.html',
            './branches.html',
            './tickets.html'
        ];
        const sectionIndex = parseInt(event.key) - 1;
        if (sections[sectionIndex]) {
            window.location.href = sections[sectionIndex];
        }
    }
});

// Tickets Management JavaScript with Database Integration
import { db } from '../pages/js/database.js';

class TicketsService {
    constructor() {
        this.initializeTickets();
    }

    async initializeTickets() {
        try {
            // Load real data from database
            await this.loadTicketsData();
            
            // Initialize UI components
            this.initializeFilters();
            this.initializeSearch();
        } catch (error) {
            console.error('Error initializing tickets:', error);
        }
    }

    async loadTicketsData() {
        try {
            // Get tickets from database
            const tickets = await db.getTickets();
            this.ticketsData = tickets || [];

            // Update stats
            this.updateStats();
            
            // Update UI with real data
            this.populateTicketsTable(this.ticketsData);
        } catch (error) {
            console.error('Error loading tickets data:', error);
        }
    }

    updateStats() {
        const total = this.ticketsData.length;
        // Count tickets by status
        const pending = this.ticketsData.filter(t => (t.status || '').toLowerCase() === 'pending').length;
        const approved = this.ticketsData.filter(t => (t.status || '').toLowerCase() === 'approved').length;
        const resolved = approved; // Approved tickets are considered resolved
        // Sum refund_price (numeric)
        const refundTotal = this.ticketsData.reduce((sum, t) => sum + (Number(t.refund_price) || 0), 0);

        const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        setText('totalTicketsValue', total.toLocaleString('ar-SA'));
        setText('pendingTicketsValue', pending.toLocaleString('ar-SA'));
        setText('resolvedTicketsValue', resolved.toLocaleString('ar-SA'));
        setText('refundTotalValue', db.formatCurrency(refundTotal));

        // Optional: simple change indicators (can be enhanced later)
        setText('totalTicketsChange', '');
        setText('pendingTicketsChange', '');
        setText('resolvedTicketsChange', '');
        setText('refundTotalChange', '');
    }

    populateTicketsTable(tickets) {
        const tableBody = document.getElementById('ticketsTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        // Sort tickets: pending first, then by timestamp (newest first)
        const sortedTickets = this.sortTicketsByPriority(tickets);
        
        sortedTickets.forEach((ticket, index) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${index * 0.1}s`;
            
            const refund = Number(ticket.refund_price) || 0;
            row.innerHTML = `
                <td style="text-align: center;">
                    <strong class="ticket-number">${ticket.ticket_num || 'غير محدد'}</strong>
                </td>
                <td style="text-align: center;">
                    <span class="invoice-number">${ticket.invoice_num || 'غير محدد'}</span>
                </td>
                <td style="text-align: center;">
                    ${this.getStatusBadge(ticket.status)}
                </td>
                <td style="text-align: center;">
                    <span class="refund-amount ${refund === 0 ? 'zero' : ''}">
                        ${db.formatCurrency(refund)}
                    </span>
                </td>
                <td style="text-align: center;">
                    <span class="creation-date">${this.formatDate(ticket.timestamp)}</span>
                </td>
                <td style="text-align: center;">
                    <div class="actions-buttons">
                        <button class="action-btn view" onclick="ticketsService.viewTicketDetails('${ticket.id}')" title="عرض التفاصيل">
                            عرض التفاصيل
                        </button>
                        ${(ticket.status || '').toLowerCase() === 'pending' ? `
                            <button class="action-btn approve" onclick="ticketsService.approveTicket('${ticket.id}')" title="قبول الطلب">
                                قبول الطلب
                            </button>
                            <button class="action-btn reject" onclick="ticketsService.rejectTicket('${ticket.id}')" title="رفض الطلب">
                                رفض الطلب
                            </button>
                        ` : ''}
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add click effects
        this.addTableRowEffects();
    }

    getStatusBadge(status) {
        const s = (status || '').toLowerCase();
        const statusMap = {
            'pending': { text: 'في الانتظار', class: 'pending' },
            'approved': { text: 'تم الحل', class: 'completed' },
            'rejected': { text: 'مرفوض', class: 'rejected' },
            'in_progress': { text: 'قيد المعالجة', class: 'approved' },
            'open': { text: 'مفتوح', class: 'pending' }
        };
        
        const statusInfo = statusMap[s] || statusMap['open'];
        
        return `
            <span class="status-badge ${statusInfo.class}">
                <span class="status-dot"></span>
                ${statusInfo.text}
            </span>
        `;
    }

    formatDate(dateString) {
        if (!dateString) return 'غير محدد';
        
        try {
        const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'غير محدد';
        }
    }

    parseProductsAndQuantities(productsData) {
        try {
            // If it's already an array, return it
            if (Array.isArray(productsData)) {
                return productsData;
            }
            
            // If it's a string, try to parse it as JSON
            if (typeof productsData === 'string') {
                const parsed = JSON.parse(productsData);
                return Array.isArray(parsed) ? parsed : [];
            }
            
            // If it's null or undefined, return empty array
            if (!productsData) {
                return [];
            }
            
            // If it's an object, try to convert it to array
            if (typeof productsData === 'object') {
                return [productsData];
            }
            
            return [];
        } catch (error) {
            console.error('Error parsing products:', error);
            console.error('Products data:', productsData);
            return [];
        }
    }

    // Helper function to sort tickets: pending first, then by timestamp
    sortTicketsByPriority(tickets) {
        return tickets.sort((a, b) => {
            const aStatus = (a.status || '').toLowerCase();
            const bStatus = (b.status || '').toLowerCase();
            
            // If one is pending and the other is not, pending comes first
            if (aStatus === 'pending' && bStatus !== 'pending') {
                return -1;
            }
            if (aStatus !== 'pending' && bStatus === 'pending') {
                return 1;
            }
            
            // If both have the same status, sort by timestamp (newest first)
            const aTime = new Date(a.timestamp || 0);
            const bTime = new Date(b.timestamp || 0);
            return bTime - aTime;
        });
    }

    // Ticket Operations
    async viewTicketDetails(ticketId) {
        try {
            const ticket = await db.getTicketById(ticketId);
            if (!ticket) {
                this.showNotification('لم يتم العثور على التذكرة', 'error');
                return;
            }

            console.log('Ticket data from database:', ticket);
            
            const products = this.parseProductsAndQuantities(ticket.products_and_quantities);
            console.log('Parsed products:', products);
            
            // Create modal content
            const modalContent = `
                <div class="ticket-details-modal">
                    <h3>تفاصيل التذكرة</h3>
                    <div class="ticket-info">
                        <p><strong>رقم التذكرة:</strong> ${ticket.ticket_num || ticket.id}</p>
                        <p><strong>رقم الفاتورة:</strong> ${ticket.invoice_num || ticket.invoice_id}</p>
                        <p><strong>الحالة:</strong> ${this.getStatusBadge(ticket.status)}</p>
                        <p><strong>مبلغ الاسترداد:</strong> ${db.formatCurrency(ticket.refund_price || 0)}</p>
                        <p><strong>التاريخ:</strong> ${this.formatDate(ticket.timestamp)}</p>
                    </div>
                    <div class="products-details">
                        <h4>المنتجات المطلوب استردادها:</h4>
                        ${products.length > 0 ? products.map(product => `
                            <div class="product-detail">
                                <div class="product-info">
                                    <span class="product-name">${product.name || 'منتج غير محدد'}</span>
                                    <span class="product-quantity">الكمية: ${product.quantity || 0}</span>
                                </div>
                                <div class="product-pricing">
                                    <span class="product-unit-price">سعر الوحدة: ${db.formatCurrency(product.price || 0)}</span>
                                    <span class="product-total-price">الإجمالي: ${db.formatCurrency(product.line_total || (product.price * product.quantity) || 0)}</span>
                                </div>
                            </div>
                        `).join('') : '<p class="no-products">لا توجد منتجات مسجلة</p>'}
                    </div>
                </div>
            `;

            this.showModal('تفاصيل التذكرة', modalContent);
        } catch (error) {
            console.error('Error viewing ticket details:', error);
            this.showNotification('خطأ في عرض تفاصيل التذكرة', 'error');
        }
    }

    showModal(title, content) {
        // Remove existing modal
        const existingModal = document.querySelector('.modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    addTableRowEffects() {
        const rows = document.querySelectorAll('.tickets-table tbody tr');
        rows.forEach(row => {
            row.addEventListener('click', (e) => {
                // Don't trigger if clicking on action buttons
                if (e.target.classList.contains('action-btn')) {
                    return;
                }
                
                // Remove active class from all rows
                rows.forEach(r => r.classList.remove('active'));
                // Add active class to clicked row
                row.classList.add('active');
            });
            
            row.addEventListener('mouseenter', function() {
                if (!this.classList.contains('active')) {
                    this.style.backgroundColor = '#f8fafc';
                }
            });
            
            row.addEventListener('mouseleave', function() {
                if (!this.classList.contains('active')) {
                    this.style.backgroundColor = '';
                }
            });
        });
    }

    initializeFilters() {
        // Add event listeners for filters
        const statusFilter = document.getElementById('statusFilter');
        const dateFilter = document.getElementById('dateFilter');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filterTickets());
        }
        if (dateFilter) {
            dateFilter.addEventListener('change', () => this.filterTickets());
        }
    }

    initializeSearch() {
        // Add search functionality
        const searchInput = document.getElementById('ticketsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => this.searchTickets(), 300));
        }
    }

    filterTickets() {
        const statusFilter = document.getElementById('statusFilter')?.value || 'all';
        const dateFilter = document.getElementById('dateFilter')?.value || 'all';
        
        let filteredTickets = this.ticketsData.filter(ticket => {
            // Status filter
            if (statusFilter !== 'all' && ticket.status !== statusFilter) {
                return false;
            }
            
            // Date filter
            if (dateFilter !== 'all' && ticket.timestamp) {
                const ticketDate = new Date(ticket.timestamp);
                const today = new Date();
                
                switch (dateFilter) {
                    case 'today':
                        // Get yesterday's date
                        const yesterday = new Date(today);
                        yesterday.setDate(today.getDate() - 1);
                        return ticketDate.toDateString() === yesterday.toDateString();
                    case 'week':
                        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        return ticketDate >= weekAgo;
                    case 'month':
                        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                        return ticketDate >= monthAgo;
                }
            }
            
            return true;
        });
        
        // Sort filtered tickets: pending first, then by timestamp
        const sortedFilteredTickets = this.sortTicketsByPriority(filteredTickets);
        
        this.populateTicketsTable(sortedFilteredTickets);
    }

    searchTickets() {
        const searchTerm = document.getElementById('ticketsSearch')?.value.toLowerCase() || '';
        
        if (!searchTerm) {
            // Sort all tickets: pending first, then by timestamp
            const sortedTickets = this.sortTicketsByPriority(this.ticketsData);
            
            this.populateTicketsTable(sortedTickets);
            return;
        }
        
        const filteredTickets = this.ticketsData.filter(ticket => {
            // Search in multiple fields
            return (ticket.id && ticket.id.toLowerCase().includes(searchTerm)) ||
                   (ticket.ticket_num && ticket.ticket_num.toLowerCase().includes(searchTerm)) ||
                   (ticket.invoice_id && ticket.invoice_id.toLowerCase().includes(searchTerm)) ||
                   (ticket.invoice_num && ticket.invoice_num.toLowerCase().includes(searchTerm)) ||
                   (ticket.status && ticket.status.toLowerCase().includes(searchTerm));
        });
        
        // Sort filtered tickets: pending first, then by timestamp
        const sortedFilteredTickets = this.sortTicketsByPriority(filteredTickets);
        
        this.populateTicketsTable(sortedFilteredTickets);
    }

    // Action Functions
    async viewInvoice(invoiceId) {
        try {
            // Get invoice details from database
            const invoice = await db.getInvoiceById(invoiceId);
            
            if (invoice) {
                this.showInvoiceModal(invoice);
            } else {
                this.showNotification('لم يتم العثور على الفاتورة', 'error');
            }
        } catch (error) {
            console.error('Error viewing invoice:', error);
            this.showNotification('خطأ في عرض الفاتورة', 'error');
        }
    }

    showInvoiceModal(invoice) {
        // Remove existing modal
        const existingModal = document.querySelector('.modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>عرض الفاتورة</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
            <div class="invoice-preview">
                <div class="invoice-header">
                    <h4>فاتورة رقم: ${invoice.id}</h4>
                    <p>تاريخ الإصدار: ${this.formatDate(invoice.timestamp)}</p>
                </div>
                <div class="invoice-items">
                    <table class="invoice-table">
                        <thead>
                            <tr>
                                <th>المنتج</th>
                                <th>الكمية</th>
                                <th>السعر</th>
                                <th>الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>منتجات متعددة</td>
                                <td>1</td>
                                <td>${db.formatCurrency(invoice.total_amount || 0)}</td>
                                <td>${db.formatCurrency(invoice.total_amount || 0)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="invoice-total">
                    <strong>المجموع: ${db.formatCurrency(invoice.total_amount || 0)}</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async approveTicket(ticketId) {
        try {
            // Update ticket status in database
            const { data, error } = await db.supabase
                .from('tickets')
                .update({ status: 'approved' })
                .eq('id', ticketId)
                .select()
                .single();

            if (data) {
                // Update local data
                const ticketIndex = this.ticketsData.findIndex(t => t.id === ticketId);
                if (ticketIndex !== -1) {
                    this.ticketsData[ticketIndex].status = 'approved';
                }
                
                // Refresh table
                this.populateTicketsTable(this.ticketsData);
                this.showNotification(`تم قبول التذكرة ${ticketId} بنجاح`, 'success');
            }
        } catch (error) {
            console.error('Error approving ticket:', error);
            this.showNotification('خطأ في قبول التذكرة', 'error');
        }
    }

    async rejectTicket(ticketId) {
        try {
            // Update ticket status in database
            const { data, error } = await db.supabase
                .from('tickets')
                .update({ status: 'rejected' })
                .eq('id', ticketId)
                .select()
                .single();

            if (data) {
                // Update local data
                const ticketIndex = this.ticketsData.findIndex(t => t.id === ticketId);
                if (ticketIndex !== -1) {
                    this.ticketsData[ticketIndex].status = 'rejected';
                }
                
                // Refresh table
                this.populateTicketsTable(this.ticketsData);
                this.showNotification(`تم رفض التذكرة ${ticketId}`, 'warning');
            }
        } catch (error) {
            console.error('Error rejecting ticket:', error);
            this.showNotification('خطأ في رفض التذكرة', 'error');
        }
    }

    closeInvoiceModal() {
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
        }
    }





    // Utility Functions
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
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
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize tickets when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.ticketsService = new TicketsService();
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
    
    .tickets-table tr.active {
        background: rgba(102, 126, 234, 0.1) !important;
        border-left: 4px solid #667eea;
    }
    
    .invoice-preview {
        font-family: 'Cairo', sans-serif;
    }
    
    .invoice-header {
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid #e2e8f0;
    }
    
    .invoice-header h4 {
        margin: 0 0 8px 0;
        color: #2d3748;
    }
    
    .invoice-header p {
        margin: 0;
        color: #718096;
        font-size: 0.9rem;
    }
    
    .invoice-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }
    
    .invoice-table th,
    .invoice-table td {
        padding: 12px;
        text-align: right;
        border-bottom: 1px solid #e2e8f0;
    }
    
    .invoice-table th {
        background: #f8fafc;
        font-weight: 600;
        color: #2d3748;
    }
    
    .invoice-total {
        text-align: left;
        font-size: 1.1rem;
        color: #2d3748;
        padding-top: 15px;
        border-top: 2px solid #e2e8f0;
    }



    .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .modal-content {
        background-color: #fff;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        width: 90%;
        max-width: 600px;
        max-height: 90%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        background-color: #4299e1;
        color: white;
    }

    .modal-header h3 {
        margin: 0;
        font-size: 1.2rem;
    }

    .modal-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: white;
        transition: opacity 0.2s ease;
    }

    .modal-close:hover {
        opacity: 0.8;
    }

    .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex-grow: 1;
    }

    .ticket-details-modal {
        font-family: 'Cairo', sans-serif;
    }

    .ticket-info {
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid #e2e8f0;
    }

    .ticket-info p {
        margin: 8px 0;
        color: #4a5568;
        font-size: 0.95rem;
    }

    .ticket-info strong {
        color: #2d3748;
        font-weight: 600;
    }

    .products-details h4 {
        margin-bottom: 15px;
        color: #2d3748;
    }

    .product-detail {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 15px;
        padding: 15px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #f8fafc;
    }
    
    .product-info {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    
    .product-pricing {
        display: flex;
        flex-direction: column;
        gap: 5px;
        text-align: left;
    }
    
    .product-name {
        font-weight: 600;
        color: #2d3748;
        font-size: 1rem;
    }
    
    .product-quantity {
        color: #4a5568;
        font-size: 0.9rem;
    }
    
    .product-unit-price {
        color: #718096;
        font-size: 0.85rem;
    }
    
    .product-total-price {
        font-weight: 600;
        color: #2d3748;
        font-size: 0.95rem;
    }

    .product-detail:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
    }
    
    .no-products {
        text-align: center;
        color: #718096;
        font-style: italic;
        padding: 20px;
        background: #f8fafc;
        border-radius: 8px;
        margin: 10px 0;
    }
`;
document.head.appendChild(style);

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {

    
    // Ctrl/Cmd + F to focus on search
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const searchInput = document.getElementById('ticketsSearch');
        if (searchInput) {
            searchInput.focus();
        }
    }
    
    // Escape to close modal
    if (event.key === 'Escape') {
        const modal = document.querySelector('.modal');
        if (modal) {
            const ticketsService = window.ticketsService;
            if (ticketsService) {
                ticketsService.closeInvoiceModal();
            }
        }
    }
});

// Export for potential use
window.ticketsModule = {
    viewTicketDetails: (ticketId) => {
        const ticketsService = window.ticketsService;
        if (ticketsService) {
            ticketsService.viewTicketDetails(ticketId);
        }
    },
    approveTicket: (ticketId) => {
        const ticketsService = window.ticketsService;
        if (ticketsService) {
            ticketsService.approveTicket(ticketId);
        }
    },
    rejectTicket: (ticketId) => {
        const ticketsService = window.ticketsService;
        if (ticketsService) {
            ticketsService.rejectTicket(ticketId);
        }
    },
    closeInvoiceModal: () => {
        const ticketsService = window.ticketsService;
        if (ticketsService) {
            ticketsService.closeInvoiceModal();
        }
    }
};

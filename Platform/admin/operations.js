// Operations Management JavaScript - Technical Version
import { db } from '../js/database.js';

class OperationsService {
    constructor() {
        this.sessionsData = [];
        this.productsData = [];
        this.currentFilter = 'all';
        this.initializeOperations();
    }

    async initializeOperations() {
        try {
            // Load products from Supabase first
            await this.loadProductsData();
            
            // Load sessions data
            await this.loadSessionsData();
            
            // Initialize UI components
            this.initializeFilters();
            this.renderSessions();
            
            // Set up real-time updates (simulated)
            this.setupRealTimeUpdates();
        } catch (error) {
            console.error('Error initializing operations:', error);
        }
    }

    async loadProductsData() {
        try {
            // Get products from Supabase
            const products = await db.getProducts();
            this.productsData = products;
            console.log('Loaded products from Supabase:', products);
        } catch (error) {
            console.error('Error loading products data:', error);
            // Fallback to mock data if database fails
            this.productsData = this.getMockProductsData();
        }
    }

    getMockProductsData() {
        return [
            {
                id: "SKU001",
                name: "حليب طازج",
                price: "15.50",
                shelf: "Aisle 1 - Shelf 2",
                category: "Dairy",
                calories: 120
            },
            {
                id: "SKU002", 
                name: "خبز أبيض",
                price: "8.00",
                shelf: "Aisle 2 - Shelf 1",
                category: "Bakery",
                calories: 80
            },
            {
                id: "SKU003",
                name: "barni",
                price: "1.75",
                shelf: "Aisle 3 - Shelf 1",
                category: "Cake",
                calories: 120
            },
            {
                id: "SKU004",
                name: "جبنة شيدر",
                price: "25.00",
                shelf: "Aisle 1 - Shelf 3",
                category: "Dairy",
                calories: 150
            },
            {
                id: "SKU005",
                name: "زبدة طبيعية",
                price: "18.00",
                shelf: "Aisle 1 - Shelf 1",
                category: "Dairy",
                calories: 200
            },
            {
                id: "SKU006",
                name: "أرز بسمتي",
                price: "45.00",
                shelf: "Aisle 4 - Shelf 2",
                category: "Grains",
                calories: 100
            }
        ];
    }

    async loadSessionsData() {
        try {
            // Create sessions with real products from database
            this.sessionsData = this.createSessionsWithProducts();
        } catch (error) {
            console.error('Error loading sessions data:', error);
            this.sessionsData = this.createSessionsWithProducts();
        }
    }

    createSessionsWithProducts() {
        // Get random products for each session
        const getRandomProducts = (count) => {
            const shuffled = [...this.productsData].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, count).map(product => ({
                name: product.name,
                sku: product.id,
                quantity: Math.floor(Math.random() * 2) + 1, // 1 or 2
                price: parseFloat(product.price)
            }));
        };

        return [
            {
                id: 'session-001',
                customerId: 'CUST001',
                status: 'processing',
                timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
                items: getRandomProducts(2),
                isLive: true
            },
            {
                id: 'session-002',
                customerId: 'CUST002',
                status: 'paid',
                timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
                items: getRandomProducts(2),
                isLive: false
            },
            {
                id: 'session-003',
                customerId: 'CUST003',
                status: 'unpaid',
                timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
                items: getRandomProducts(2),
                isLive: true
            }
        ];
    }

    initializeFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                filterButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                btn.classList.add('active');
                
                // Update filter
                this.currentFilter = btn.getAttribute('data-filter');
                this.renderSessions();
            });
        });
    }

    renderSessions() {
        const sessionsGrid = document.getElementById('sessionsGrid');
        if (!sessionsGrid) return;

        // Filter sessions based on current filter
        let filteredSessions = this.sessionsData;
        if (this.currentFilter !== 'all') {
            filteredSessions = this.sessionsData.filter(session => session.status === this.currentFilter);
        }

        // Clear existing content
        sessionsGrid.innerHTML = '';

        // Render each session
        filteredSessions.forEach(session => {
            const sessionCard = this.createSessionCard(session);
            sessionsGrid.appendChild(sessionCard);
        });

        // Add animation delay to cards
        const cards = sessionsGrid.querySelectorAll('.customer-session-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });
    }

    createSessionCard(session) {
        const card = document.createElement('div');
        card.className = `customer-session-card ${session.isLive ? 'live' : ''}`;
        card.dataset.sessionId = session.id;

        const statusClass = session.status;
        const total = session.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        card.innerHTML = `
            <div class="session-header ${statusClass}">
                <div class="session-customer-info">
                    <h4>customer_id: ${session.customerId}</h4>
                    <div class="session-timestamp">session_timestamp: ${this.formatTimestamp(session.timestamp)}</div>
                </div>
                <div class="session-status">
                    <div class="status-indicator"></div>
                    <span>status: ${session.status}</span>
                </div>
            </div>
            
            <div class="session-content">
                <div class="cart-items">
                    <div class="cart-item header-row">
                        <div class="col-product">PRODUCT NAME</div>
                        <div class="col-sku">SKU</div>
                        <div class="col-qty">QTY</div>
                        <div class="col-price">PRICE</div>
                    </div>
                    ${session.items.map(item => `
                        <div class="cart-item">
                            <div class="col-product">
                                <div class="item-name">${item.name}</div>
                            </div>
                            <div class="col-sku">${item.sku}</div>
                            <div class="col-qty">${item.quantity}</div>
                            <div class="col-price">${item.price.toFixed(2)} ر.س</div>
                        </div>
                    `).join('')}
                    <div class="cart-item total-row">
                        <div class="col-product"></div>
                        <div class="col-sku"></div>
                        <div class="col-qty total-label">TOTAL:</div>
                        <div class="col-price total-amount">${total.toFixed(2)} ر.س</div>
                    </div>
                </div>
            </div>
        `;

        return card;
    }

    formatTimestamp(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (minutes < 1) return 'NOW';
        if (minutes < 60) return `${minutes} MIN AGO`;
        if (hours < 24) return `${hours} HOURS AGO`;
        return timestamp.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        }).toUpperCase();
    }

    setupRealTimeUpdates() {
        // Simulate real-time updates every 30 seconds
        setInterval(() => {
            // Update existing sessions occasionally
            this.updateRandomSession();
        }, 30000);
    }

    updateRandomSession() {
        const processingSessions = this.sessionsData.filter(s => s.status === 'processing');
        if (processingSessions.length > 0) {
            const randomSession = processingSessions[Math.floor(Math.random() * processingSessions.length)];
            const statuses = ['paid', 'unpaid'];
            randomSession.status = statuses[Math.floor(Math.random() * statuses.length)];
            randomSession.isLive = false;
            
            this.renderSessions();
        }
    }
}

// Initialize operations when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.operationsService = new OperationsService();
});

// Add animation styles
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
`;
document.head.appendChild(style);


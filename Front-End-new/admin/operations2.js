// Operations2 Management JavaScript with Database Integration & Burger Menu
/*
 * Operations2 Management JavaScript
 *
 * This module fetches live session and event data from the backend API
 * and renders it in the right‑hand panel. It also includes a burger menu
 * controller for showing and hiding the sidebar on small screens. The
 * implementation intentionally avoids altering admin.js and focuses on
 * plugging into the improved UI without changing its core functionality.
 */

class Operations2Service {
    constructor() {
        // Data caches
        this.sessionsData = [];
        this.eventsData = [];

        // Initialize UI
        this.initializeBurgerMenu();
        this.initializeFilters();

        // Load data from API and set up polling
        this.loadData();
        this.setupRealTimeUpdates();
    }

    /**
     * Show/hide the sidebar when the burger button is clicked.
     */
    initializeBurgerMenu() {
        const burgerBtn = document.getElementById('burgerMenuBtn');
        const sidebar = document.getElementById('sidebar');
        const closeBtn = document.getElementById('closeSidebarBtn');

        if (burgerBtn) {
            burgerBtn.addEventListener('click', () => {
                sidebar.classList.add('show');
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sidebar.classList.remove('show');
            });
        }
        // Clicking outside the sidebar closes it
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !burgerBtn.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        });
        // Escape key closes the sidebar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                sidebar.classList.remove('show');
            }
        });
    }

    /**
     * Fetch sessions and events from the API and render them.
     */
    async loadData() {
        await Promise.all([this.fetchSessions(), this.fetchEvents()]);
        this.updateSessionsDisplay();
        this.updateEventLog();
    }

    /**
     * Fetch current sessions from the backend. Each session is expected to
     * have the form { id, customerId, customerName, status, timestamp,
     * items: [{ name, sku, quantity, price }] }.
     */
    async fetchSessions() {
        try {
            const resp = await fetch('http://127.0.0.1:8000/sessions');
            if (!resp.ok) throw new Error('Failed to fetch sessions');
            const data = await resp.json();
            // Ensure data is an array
            this.sessionsData = Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error fetching sessions:', err);
            this.sessionsData = [];
        }
    }

    /**
     * Fetch recent events from the backend. Each event should include a
     * message and a timestamp. The backend returns the most recent
     * events first.
     */
    async fetchEvents() {
        try {
            const resp = await fetch('http://127.0.0.1:8000/events');
            if (!resp.ok) throw new Error('Failed to fetch events');
            const data = await resp.json();
            this.eventsData = Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error fetching events:', err);
            this.eventsData = [];
        }
    }

    /**
     * Render the sessions in the DOM. Sessions are filtered by the currently
     * active filter button (all, processing, paid, unpaid).
     */
    updateSessionsDisplay() {
        const sessionsGrid = document.getElementById('sessionsGrid');
        if (!sessionsGrid) return;
        sessionsGrid.innerHTML = '';
        // Determine current filter
        const activeBtn = document.querySelector('.filter-btn.active');
        const filter = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
        const filtered = filter === 'all'
            ? this.sessionsData
            : this.sessionsData.filter(s => (s.status || '').toLowerCase() === filter);
        filtered.forEach(session => {
            const card = this.createSessionCard(session);
            sessionsGrid.appendChild(card);
        });
    }

    /**
     * Render the event log in the DOM.
     */
    updateEventLog() {
        const logWrap = document.getElementById('eventLog');
        if (!logWrap) return;
        logWrap.innerHTML = '';
        // Show events in chronological order (oldest first)
        const events = [...this.eventsData].reverse();
        events.forEach(ev => {
            const div = document.createElement('div');
            div.className = 'event-log-entry';
            const time = this.formatTimestamp(ev.timestamp);
            const msg = ev.message || ev.event || '';
            div.textContent = `${time} • ${msg}`;
            logWrap.appendChild(div);
        });
        // Auto-scroll to bottom
        logWrap.scrollTop = logWrap.scrollHeight;
    }

    /**
     * Create a DOM card for a single session. A session includes a list of
     * items, each with name, sku, quantity and price. The status determines
     * styling (processing → live bar at top). Totals are computed on the
     * fly.
     */
    createSessionCard(session) {
        const card = document.createElement('div');
        const status = (session.status || '').toLowerCase();
        card.className = `customer-session-card ${status === 'processing' ? 'live' : ''}`;
        const items = Array.isArray(session.items) ? session.items : [];
        let total = 0;
        const itemsHtml = items.map(item => {
            const price = Number(item.price) || 0;
            const qty = Number(item.quantity) || 0;
            total += price * qty;
            return `
                <div class="cart-item">
                    <div class="col-product">${item.name}</div>
                    <div class="col-sku">${item.sku || ''}</div>
                    <div class="col-qty">${qty}</div>
                    <div class="col-price">${this.formatCurrency(price)}</div>
                </div>`;
        }).join('');
        card.innerHTML = `
            <div class="session-header">
                <div class="session-customer-info">
                    <h4>customer_id: ${session.customerId || session.id}</h4>
                    <div class="session-timestamp">session_timestamp: ${this.formatTimestamp(session.timestamp)}</div>
                </div>
                    <div class="session-status ${status}">status: ${status}</div>
            </div>
            <div class="cart-items">
                <div class="cart-item header-row">
                    <div class="col-product">PRODUCT NAME</div>
                    <div class="col-sku">SKU</div>
                    <div class="col-qty">QTY</div>
                    <div class="col-price">PRICE</div>
                </div>
                ${itemsHtml}
                <div class="cart-item total-row">
                    <div class="col-product">TOTAL:</div>
                    <div class="col-sku"></div>
                    <div class="col-qty"></div>
                    <div class="col-price">${this.formatCurrency(total)}</div>
                </div>
            </div>
        `;
        return card;
    }

    /**
     * Convert an ISO timestamp or Date into a human‑readable relative string.
     * Fallbacks gracefully if parsing fails.
     */
    formatTimestamp(ts) {
        try {
            const date = ts instanceof Date ? ts : new Date(ts);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 1) return 'Just now';
            if (diffMins === 1) return '1 minute ago';
            if (diffMins < 60) return `${diffMins} minutes ago`;
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours === 1) return '1 hour ago';
            if (diffHours < 24) return `${diffHours} hours ago`;
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return String(ts);
        }
    }

    /**
     * Format a number as currency (SAR). If the value is NaN, returns SAR 0.00.
     */
    formatCurrency(value) {
        const num = Number(value);
        if (Number.isNaN(num)) return 'SAR 0.00';
        return `SAR ${num.toFixed(2)}`;
    }

    /**
     * Set up filter buttons (all/processing/paid/unpaid). When clicked, the
     * active button toggles and sessions are re‑rendered.
     */
    initializeFilters() {
        const buttons = document.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateSessionsDisplay();
            });
        });
    }

    /**
     * Poll the API for new sessions/events every 5 seconds. This ensures
     * that the dashboard stays up to date with the latest activity.
     */
    setupRealTimeUpdates() {
        setInterval(async () => {
            await Promise.all([this.fetchSessions(), this.fetchEvents()]);
            this.updateSessionsDisplay();
            this.updateEventLog();
        }, 5000);
    }
}

// Initialise when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.operations2Service = new Operations2Service();
});

// Inject lightweight CSS animations for newly inserted cards
const animStyle = document.createElement('style');
animStyle.textContent = `
    @keyframes slideInRight {
        from { opacity: 0; transform: translateX(20px); }
        to   { opacity: 1; transform: translateX(0); }
    }
    .customer-session-card {
        animation: slideInRight 0.3s ease-out;
    }
`;
document.head.appendChild(animStyle);

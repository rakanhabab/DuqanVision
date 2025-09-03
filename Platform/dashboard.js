// ===== DASHBOARD WITH DATABASE INTEGRATION =====
import { db } from './database.js'

window.dashboard = {
  // Initialize dashboard
  async init() {
    await this.loadUserInfo();
    await this.loadKPIs();
    this.initBarcodePages();
  },

  // Load user info from database
  async loadUserInfo() {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('current_user');
      if (!currentUserStr) {
        window.location.href = 'login.html';
        return;
      }

      const currentUser = JSON.parse(currentUserStr);
      
      // Get fresh user data from database
      const { data: user, error } = await db.supabase
        .from('users')
        .select('first_name, last_name, email')
        .eq('id', currentUser.id)
        .single();

      if (error || !user) {
        console.error('Error loading user info:', error);
        return;
      }

      const accNameEl = document.getElementById('accName');
      const accEmailEl = document.getElementById('accEmail');

      if (user) {
        const fullName = user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}`
          : user.email.split('@')[0];

        if (accNameEl) accNameEl.textContent = fullName;
        if (accEmailEl) accEmailEl.textContent = user.email;
      } else {
        if (accNameEl) accNameEl.textContent = 'مرحباً';
        if (accEmailEl) accEmailEl.textContent = '—';
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  },

  // Load KPIs from database
  async loadKPIs() {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('current_user');
      if (!currentUserStr) return;

      const currentUser = JSON.parse(currentUserStr);
      
      // Get user data and invoices from database
      const [userData, invoices] = await Promise.all([
        db.supabase.from('users').select('num_visits, owed_balance').eq('id', currentUser.id).single(),
        db.supabase.from('invoices').select('total_amount').eq('user_id', currentUser.id)
      ]);

      const visitsEl = document.getElementById('kVisits');
      const spendEl = document.getElementById('kSpend');
      const avgEl = document.getElementById('kAvg');
      const topEl = document.getElementById('kTop');

      // Calculate KPIs from real data
      const visits = userData.data?.num_visits || 0;
      const totalSpend = invoices.data?.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0) || 0;
      const avgSpend = invoices.data?.length > 0 ? totalSpend / invoices.data.length : 0;

      if (visitsEl) visitsEl.textContent = visits;
      if (spendEl) spendEl.textContent = db.formatCurrency(totalSpend);
      if (avgEl) avgEl.textContent = db.formatCurrency(avgSpend);
      if (topEl) topEl.textContent = 'الرياض - دكان فيجين';
    } catch (error) {
      console.error('Error loading KPIs:', error);
      // Fallback to static data
      const visitsEl = document.getElementById('kVisits');
      const spendEl = document.getElementById('kSpend');
      const avgEl = document.getElementById('kAvg');
      const topEl = document.getElementById('kTop');

      if (visitsEl) visitsEl.textContent = '0';
      if (spendEl) spendEl.textContent = '0 ر.س';
      if (avgEl) avgEl.textContent = '0 ر.س';
      if (topEl) topEl.textContent = '—';
    }
  },

  // Initialize barcode pages
  initBarcodePages() {
    const simulateBtn = document.getElementById('simulateScan');
    const backDashBtn = document.getElementById('backDash');
    const backToDashboardBtn = document.getElementById('backToDashboard');

    if (simulateBtn) {
      simulateBtn.addEventListener('click', () => this.showBarcodeScanPage());
    }
    if (backDashBtn) {
      backDashBtn.addEventListener('click', () => this.hideBarcodePage());
    }
    if (backToDashboardBtn) {
      backToDashboardBtn.addEventListener('click', () => this.hideBarcodeScanPage());
    }

    // Generate QR code when page is shown
    this.showUserQR('12345');
  },

  // Show barcode page
  showBarcodePage() {
    const dashboardPage = document.getElementById('page-dashboard');
    const barcodePage = document.getElementById('page-barcode');

    if (dashboardPage && barcodePage) {
      dashboardPage.classList.remove('active');
      barcodePage.classList.add('active');

      // Generate QR code when page is shown
      setTimeout(() => {
        this.showUserQR('12345');
      }, 100);
    }
  },

  // Hide barcode page
  hideBarcodePage() {
    const dashboardPage = document.getElementById('page-dashboard');
    const barcodePage = document.getElementById('page-barcode');

    if (dashboardPage && barcodePage) {
      barcodePage.classList.remove('active');
      dashboardPage.classList.add('active');
    }
  },

  // Show barcode scan page
  showBarcodeScanPage() {
    const barcodePage = document.getElementById('page-barcode');
    const barcodeScanPage = document.getElementById('page-barcode-scan');

    if (barcodePage && barcodeScanPage) {
      barcodePage.classList.remove('active');
      barcodeScanPage.classList.add('active');
    }
  },

  // Hide barcode scan page
  hideBarcodeScanPage() {
    const barcodePage = document.getElementById('page-barcode');
    const barcodeScanPage = document.getElementById('page-barcode-scan');

    if (barcodePage && barcodeScanPage) {
      barcodeScanPage.classList.remove('active');
      barcodePage.classList.add('active');
    }
  },

  // Show user QR code
  showUserQR(userId) {
    const container = document.getElementById('qr');
    if (!container) return;

    container.innerHTML = ''; // clear old

    // Create QR code directly
    new QRCode(container, {
      text: String(userId),
      width: 300,
      height: 300,
      colorDark: '#000000',
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.M
    });
  }
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  dashboard.init();
});

// Update user info when switching to user dashboard
document.addEventListener('viewChanged', (e) => {
  if (e.detail.view === 'user') {
    dashboard.loadUserInfo();
  }
});

// Global function for barcode page
function showBarcodeScanPage() {
  if (window.dashboard && window.dashboard.showBarcodePage) {
    window.dashboard.showBarcodePage();
  }
}

// Global function to show user QR
function showUserQR(userId) {
  const container = document.getElementById('qr');
  if (!container) return;

  container.innerHTML = ''; // clear old

  // Create QR code directly
  new QRCode(container, {
    text: String(userId),
    width: 300,
    height: 300,
    colorDark: '#000000',
    colorLight: '#FFFFFF',
    correctLevel: QRCode.CorrectLevel.M
  });
}




function addToCart(product) {
  let cart = JSON.parse(localStorage.getItem('twq_cart') || '[]');
  cart.push(product);
  localStorage.setItem('twq_cart', JSON.stringify(cart));
  updateCartDisplay();
}

function updateCartDisplay() {
  const cartItems = document.getElementById('cartItems');
  const cart = JSON.parse(localStorage.getItem('twq_cart') || '[]');

  if (cartItems) {
    cartItems.innerHTML = cart.map((item, index) => `
      <div class="cart-item">
        <span>${item.image} ${item.name}</span>
        <span>${item.price} ر.س</span>
        <button onclick="removeFromCart(${index})">❌</button>
      </div>
    `).join('');
  }
}

function removeFromCart(index) {
  let cart = JSON.parse(localStorage.getItem('twq_cart') || '[]');
  cart.splice(index, 1);
  localStorage.setItem('twq_cart', JSON.stringify(cart));
  updateCartDisplay();
}

function completePurchase() {
  const cart = JSON.parse(localStorage.getItem('twq_cart') || '[]');
  if (cart.length === 0) {
    alert('السلة فارغة!');
    return;
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const invoice = {
    id: Date.now(),
    items: cart,
    total: total,
    date: new Date().toLocaleDateString('ar-SA')
  };

  let invoices = JSON.parse(localStorage.getItem('twq_invoices') || '[]');
  invoices.push(invoice);
  localStorage.setItem('twq_invoices', JSON.stringify(invoices));
  localStorage.setItem('twq_cart', '[]');

  updateCartDisplay();
  alert(`تم إتمام الشراء! المجموع: ${total.toFixed(2)} ر.س`);
}

// Logout function
function logout() {
  if (confirm('هل تريد تسجيل الخروج؟')) {
    // Clear current user data
    localStorage.removeItem('twq_current');
    localStorage.removeItem('twq_current_index');
    localStorage.removeItem('twq_is_admin');

    // Switch to landing view
    if (window.auth) {
      window.auth.switchView('landing');
    }
  }
} 
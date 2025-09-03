// ===== DASHBOARD WITH DATABASE INTEGRATION =====
import { db } from './database.js'

window.dashboard = {
  // Initialize dashboard
  async init() {
    await this.loadUserInfo();
    await this.loadKPIs();
    await this.loadCharts(); // Load charts
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
        console.error('❌ Error loading user info:', error);
        
        // Show error message
        const accNameEl = document.getElementById('accName');
        const accEmailEl = document.getElementById('accEmail');

        if (accNameEl) accNameEl.textContent = 'خطأ في التحميل';
        if (accEmailEl) accEmailEl.textContent = '—';
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
        
        console.log('✅ User info loaded successfully:', { fullName, email: user.email });
      } else {
        if (accNameEl) accNameEl.textContent = 'مرحباً';
        if (accEmailEl) accEmailEl.textContent = '—';
      }
    } catch (error) {
      console.error('❌ Error loading user info:', error);
      
      // Show error message
      const accNameEl = document.getElementById('accName');
      const accEmailEl = document.getElementById('accEmail');

      if (accNameEl) accNameEl.textContent = 'خطأ في التحميل';
      if (accEmailEl) accEmailEl.textContent = '—';
    }
  },

  // Load KPIs from database
  async loadKPIs() {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('current_user');
      if (!currentUserStr) {
        // Show message that user needs to login
        const netSalesEl = document.getElementById('netSalesValue');
        const ordersEl = document.getElementById('ordersValue');
        const aovEl = document.getElementById('aovValue');
        const paidRateEl = document.getElementById('paidRateValue');

        if (netSalesEl) netSalesEl.textContent = '-- ر.س';
        if (ordersEl) ordersEl.textContent = '--';
        if (aovEl) aovEl.textContent = '-- ر.س';
        if (paidRateEl) paidRateEl.textContent = '--%';

        // Show message in console for debugging
        console.log('⚠️ No user logged in. Please login to see dashboard data.');
        return;
      }

      const currentUser = JSON.parse(currentUserStr);
      
      // Get user data and invoices from database
      const [userData, invoices] = await Promise.all([
        db.supabase.from('users').select('num_visits, owed_balance').eq('id', currentUser.id).single(),
        db.supabase.from('invoices').select('total_amount, status').eq('user_id', currentUser.id)
      ]);

      const netSalesEl = document.getElementById('netSalesValue');
      const ordersEl = document.getElementById('ordersValue');
      const aovEl = document.getElementById('aovValue');
      const paidRateEl = document.getElementById('paidRateValue');

      // Calculate KPIs from real data
      const totalOrders = invoices.data?.length || 0;
      const totalSales = invoices.data?.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0) || 0;
      const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
      
      // Calculate paid rate (assuming invoices with status 'paid' are paid)
      const paidInvoices = invoices.data?.filter(invoice => invoice.status === 'paid') || [];
      const paidRate = totalOrders > 0 ? (paidInvoices.length / totalOrders) * 100 : 0;

      // Update UI elements
      if (netSalesEl) netSalesEl.textContent = db.formatCurrency ? db.formatCurrency(totalSales) : `${totalSales} ر.س`;
      if (ordersEl) ordersEl.textContent = totalOrders;
      if (aovEl) aovEl.textContent = db.formatCurrency ? db.formatCurrency(avgOrderValue) : `${avgOrderValue} ر.س`;
      if (paidRateEl) paidRateEl.textContent = `${paidRate.toFixed(1)}%`;

      console.log('✅ KPIs loaded successfully:', { 
        totalOrders, 
        totalSales, 
        avgOrderValue, 
        paidRate 
      });
    } catch (error) {
      console.error('❌ Error loading KPIs:', error);
      
      // Show error message to user
      const netSalesEl = document.getElementById('netSalesValue');
      const ordersEl = document.getElementById('ordersValue');
      const aovEl = document.getElementById('aovValue');
      const paidRateEl = document.getElementById('paidRateValue');

      if (netSalesEl) netSalesEl.textContent = 'خطأ';
      if (ordersEl) ordersEl.textContent = 'خطأ';
      if (aovEl) aovEl.textContent = 'خطأ';
      if (paidRateEl) paidRateEl.textContent = 'خطأ';
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
  },

  // Load and display charts
  async loadCharts() {
    try {
      // Check if Plotly is available
      if (typeof Plotly === 'undefined') {
        console.log('⚠️ Plotly not loaded yet, waiting...');
        setTimeout(() => this.loadCharts(), 1000);
        return;
      }

      console.log('📊 Loading charts...');
      
      // Load chart data from database
      await this.loadBranchSalesChart();
      await this.loadRevenueChart();
      await this.loadCategoryChart();
      await this.loadLowStockChart();
      
      console.log('✅ Charts loaded successfully');
    } catch (error) {
      console.error('❌ Error loading charts:', error);
      this.showEmptyCharts();
    }
  },

  // Load branch sales chart
  async loadBranchSalesChart() {
    try {
      // Get branch sales data from database
      const { data: branchData, error } = await db.supabase
        .from('branches')
        .select('name, total_sales')
        .order('total_sales', { ascending: false })
        .limit(5);

      if (error || !branchData || branchData.length === 0) {
        this.showEmptyBranchChart();
        return;
      }

      // Create chart data
      const chartData = [{
        x: branchData.map(branch => branch.name || 'فرع غير محدد'),
        y: branchData.map(branch => branch.total_sales || 0),
        type: 'bar',
        marker: {
          color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
        }
      }];

      const layout = {
        title: 'مبيعات الفروع',
        font: { family: 'Arial, sans-serif', size: 14 },
        margin: { l: 50, r: 50, t: 50, b: 100 },
        xaxis: { 
          title: 'الفروع',
          tickangle: -45
        },
        yaxis: { 
          title: 'المبيعات (ر.س)',
          tickformat: ',.0f'
        }
      };

      const container = document.getElementById('branchSalesChart');
      if (container) {
        Plotly.newPlot('branchSalesChart', chartData, layout, { 
          displayModeBar: false, 
          responsive: true 
        });
      }
    } catch (error) {
      console.error('❌ Error loading branch sales chart:', error);
      this.showEmptyBranchChart();
    }
  },

  // Load revenue chart
  async loadRevenueChart() {
    try {
      // Get monthly revenue data from database
      const { data: revenueData, error } = await db.supabase
        .from('invoices')
        .select('created_at, total_amount')
        .gte('created_at', new Date(new Date().getFullYear(), 0, 1).toISOString());

      if (error || !revenueData || revenueData.length === 0) {
        this.showEmptyRevenueChart();
        return;
      }

      // Group by month
      const monthlyRevenue = {};
      revenueData.forEach(invoice => {
        const month = new Date(invoice.created_at).getMonth();
        const monthName = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                          'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'][month];
        monthlyRevenue[monthName] = (monthlyRevenue[monthName] || 0) + (invoice.total_amount || 0);
      });

      const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'];
      const revenue = months.map(month => monthlyRevenue[month] || 0);

      const chartData = [{
        x: months,
        y: revenue,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#4ECDC4', width: 3 },
        marker: { size: 8, color: '#4ECDC4' }
      }];

      const layout = {
        title: 'الإيرادات الشهرية',
        font: { family: 'Arial, sans-serif', size: 14 },
        margin: { l: 50, r: 50, t: 50, b: 80 },
        xaxis: { title: 'الشهر' },
        yaxis: { 
          title: 'الإيرادات (ر.س)',
          tickformat: ',.0f'
        }
      };

      const container = document.getElementById('revenueChart');
      if (container) {
        Plotly.newPlot('revenueChart', chartData, layout, { 
          displayModeBar: false, 
          responsive: true 
        });
      }
    } catch (error) {
      console.error('❌ Error loading revenue chart:', error);
      this.showEmptyRevenueChart();
    }
  },

  // Load category chart
  async loadCategoryChart() {
    try {
      // Get product category data from database
      const { data: categoryData, error } = await db.supabase
        .from('products')
        .select('category, quantity_sold')
        .not('category', 'is', null);

      if (error || !categoryData || categoryData.length === 0) {
        this.showEmptyCategoryChart();
        return;
      }

      // Group by category
      const categorySales = {};
      categoryData.forEach(product => {
        const category = product.category || 'أخرى';
        categorySales[category] = (categorySales[category] || 0) + (product.quantity_sold || 0);
      });

      const categories = Object.keys(categorySales);
      const sales = Object.values(categorySales);

      const chartData = [{
        values: sales,
        labels: categories,
        type: 'pie',
        hole: 0.4,
        marker: {
          colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']
        }
      }];

      const layout = {
        title: 'المنتجات المباعة حسب الفئة',
        font: { family: 'Arial, sans-serif', size: 14 },
        margin: { l: 50, r: 50, t: 50, b: 50 }
      };

      const container = document.getElementById('categoryChart');
      if (container) {
        Plotly.newPlot('categoryChart', chartData, layout, { 
          displayModeBar: false, 
          responsive: true 
        });
      }
    } catch (error) {
      console.error('❌ Error loading category chart:', error);
      this.showEmptyCategoryChart();
    }
  },

  // Load low stock chart
  async loadLowStockChart() {
    try {
      // Get product stock data from database
      const { data: stockData, error } = await db.supabase
        .from('products')
        .select('name, current_stock, min_stock_level');

      if (error || !stockData || stockData.length === 0) {
        this.showEmptyLowStockChart();
        return;
      }

      // Categorize stock levels
      const stockLevels = {
        'متوفر': 0,
        'كمية قليلة': 0,
        'نفذ المخزون': 0
      };

      stockData.forEach(product => {
        const stock = product.current_stock || 0;
        const minLevel = product.min_stock_level || 5;
        
        if (stock === 0) {
          stockLevels['نفذ المخزون']++;
        } else if (stock <= minLevel) {
          stockLevels['كمية قليلة']++;
        } else {
          stockLevels['متوفر']++;
        }
      });

      const categories = Object.keys(stockLevels);
      const counts = Object.values(stockLevels);

      const chartData = [{
        values: counts,
        labels: categories,
        type: 'pie',
        marker: {
          colors: ['#96CEB4', '#FFEAA7', '#FF6B6B']
        }
      }];

      const layout = {
        title: 'توافر المنتجات',
        font: { family: 'Arial, sans-serif', size: 14 },
        margin: { l: 50, r: 50, t: 50, b: 50 }
      };

      const container = document.getElementById('lowStockChart');
      if (container) {
        Plotly.newPlot('lowStockChart', chartData, layout, { 
          displayModeBar: false, 
          responsive: true 
        });
      }
    } catch (error) {
      console.error('❌ Error loading low stock chart:', error);
      this.showEmptyLowStockChart();
    }
  },

  // Show empty charts when no data
  showEmptyCharts() {
    this.showEmptyBranchChart();
    this.showEmptyRevenueChart();
    this.showEmptyCategoryChart();
    this.showEmptyLowStockChart();
  },

  // Show empty branch chart
  showEmptyBranchChart() {
    const container = document.getElementById('branchSalesChart');
    if (container) {
      container.innerHTML = '<div class="empty-chart"><p>لا توجد بيانات متاحة</p></div>';
    }
  },

  // Show empty revenue chart
  showEmptyRevenueChart() {
    const container = document.getElementById('revenueChart');
    if (container) {
      container.innerHTML = '<div class="empty-chart"><p>لا توجد بيانات متاحة</p></div>';
    }
  },

  // Show empty category chart
  showEmptyCategoryChart() {
    const container = document.getElementById('categoryChart');
    if (container) {
      container.innerHTML = '<div class="empty-chart"><p>لا توجد بيانات متاحة</p></div>';
    }
  },

  // Show empty low stock chart
  showEmptyLowStockChart() {
    const container = document.getElementById('lowStockChart');
    if (container) {
      container.innerHTML = '<div class="empty-chart"><p>لا توجد بيانات متاحة</p></div>';
    }
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
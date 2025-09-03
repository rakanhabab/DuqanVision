// ===== CART WITH DATABASE INTEGRATION =====
import { db } from './database.js'

const cart = {
  // Initialize cart
  async init() {
    await this.loadCart();
    this.bindEvents();
  },

  // Bind cart events
  bindEvents() {
    // Add event listeners for cart functionality
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-cart-action]')) {
        const action = e.target.dataset.cartAction;
        const productId = e.target.dataset.productId;

        switch (action) {
          case 'add':
            this.addToCart(productId);
            break;
          case 'remove':
            this.removeFromCart(productId);
            break;
          case 'update':
            this.updateQuantity(productId, e.target.value);
            break;
        }
      }
    });
  },

  // Load cart from localStorage
  loadCart() {
    const cartData = JSON.parse(localStorage.getItem('twq_cart') || '[]');
    this.updateCartDisplay(cartData);
  },

  // Add product to cart
  async addToCart(product) {
    try {
      // Get product details from database if only ID is provided
      if (typeof product === 'string') {
        const { data: productData, error } = await db.supabase
          .from('products')
          .select('*')
          .eq('id', product)
          .single();

        if (error || !productData) {
          this.showToast('خطأ في تحميل المنتج', 'error');
          return;
        }
        product = productData;
      }

      let cartData = JSON.parse(localStorage.getItem('twq_cart') || '[]');

      // Check if product already exists in cart
      const existingItem = cartData.find(item => item.id === product.id);

      if (existingItem) {
        existingItem.quantity += 1;
        existingItem.total = existingItem.quantity * product.price;
      } else {
        cartData.push({
          ...product,
          quantity: 1,
          total: product.price
        });
      }

      localStorage.setItem('twq_cart', JSON.stringify(cartData));
      this.updateCartDisplay(cartData);
      this.showToast(`تم إضافة ${product.name} إلى السلة!`, 'success');
    } catch (error) {
      console.error('Error adding to cart:', error);
      this.showToast('خطأ في إضافة المنتج', 'error');
    }
  },

  // Remove product from cart
  removeFromCart(productId) {
    let cartData = JSON.parse(localStorage.getItem('twq_cart') || '[]');
    cartData = cartData.filter(item => item.id !== productId);

    localStorage.setItem('twq_cart', JSON.stringify(cartData));
    this.updateCartDisplay(cartData);
    this.showToast('تم حذف المنتج من السلة!', 'info');
  },

  // Update product quantity
  updateQuantity(productId, quantity) {
    let cartData = JSON.parse(localStorage.getItem('twq_cart') || '[]');
    const item = cartData.find(item => item.id === productId);

    if (item) {
      item.quantity = parseInt(quantity) || 1;
      item.total = item.quantity * item.price;

      localStorage.setItem('twq_cart', JSON.stringify(cartData));
      this.updateCartDisplay(cartData);
    }
  },

  // Update cart display
  updateCartDisplay(cartData) {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');

    if (!cartItems) return;

    if (cartData.length === 0) {
      cartItems.innerHTML = `
        <div style="text-align: center; color: #6c757d; padding: 20px;">
          <div style="font-size: 24px; margin-bottom: 10px;">🛒</div>
          <div>السلة فارغة</div>
          <div style="font-size: 12px; margin-top: 5px;">سيتم إضافة المنتجات تلقائياً</div>
        </div>
      `;
      if (cartTotal) cartTotal.textContent = '0.00 ر.س';
      return;
    }

    const itemsHtml = cartData.map(item => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #dee2e6;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">${item.image || '📦'}</span>
          <div>
            <div style="font-weight: 500;">${item.name}</div>
            <div style="font-size: 12px; color: #6c757d;">الكمية: ${item.quantity}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 500;">${item.total.toFixed(2)} ر.س</div>
          <button onclick="cart.removeFromCart('${item.id}')" style="background: none; border: none; color: #dc3545; cursor: pointer; font-size: 12px;">حذف</button>
        </div>
      </div>
    `).join('');

    cartItems.innerHTML = itemsHtml;

    const total = cartData.reduce((sum, item) => sum + item.total, 0);
    if (cartTotal) cartTotal.textContent = `${total.toFixed(2)} ر.س`;
  },

  // Clear cart
  clearCart() {
    localStorage.removeItem('twq_cart');
    this.updateCartDisplay([]);
    this.showToast('تم مسح السلة!', 'info');
  },

  // Checkout with database integration
  async checkout() {
    const cartData = JSON.parse(localStorage.getItem('twq_cart') || '[]');

    if (cartData.length === 0) {
      this.showToast('السلة فارغة!', 'warning');
      return;
    }

    try {
      // Get current user
      const currentUserStr = localStorage.getItem('current_user');
      if (!currentUserStr) {
        this.showToast('يرجى تسجيل الدخول أولاً', 'error');
        window.location.href = 'login.html';
        return;
      }

      const currentUser = JSON.parse(currentUserStr);
      const total = cartData.reduce((sum, item) => sum + item.total, 0);

      // Create invoice in database
      const { data: invoice, error } = await db.supabase
        .from('invoices')
        .insert({
          user_id: currentUser.id,
          branch_id: '1', // Default branch ID
          items: cartData.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.total
          })),
          total_amount: total,
          status: 'مكتمل',
          payment_method: 'نقدي'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating invoice:', error);
        this.showToast('خطأ في إنشاء الفاتورة', 'error');
        return;
      }

      // Clear cart
      this.clearCart();

      // Show success message
      this.showToast(`تم إتمام الشراء بنجاح! المجموع: ${db.formatCurrency(total)}`, 'success');

      // Redirect to invoice view page
      setTimeout(() => {
        window.location.href = `invoice-view.html?id=${invoice.id}`;
      }, 2000);

    } catch (error) {
      console.error('Error during checkout:', error);
      this.showToast('خطأ في إتمام عملية الشراء', 'error');
    }
  },

  // Get cart count
  getCartCount() {
    const cartData = JSON.parse(localStorage.getItem('twq_cart') || '[]');
    return cartData.reduce((sum, item) => sum + item.quantity, 0);
  },

  // Get cart total
  getCartTotal() {
    const cartData = JSON.parse(localStorage.getItem('twq_cart') || '[]');
    return cartData.reduce((sum, item) => sum + item.total, 0);
  },

  // Show toast notification
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 10000;
      transition: all 0.3s ease;
    `;

    switch (type) {
      case 'success':
        toast.style.background = '#10b981';
        break;
      case 'error':
        toast.style.background = '#ef4444';
        break;
      case 'warning':
        toast.style.background = '#f59e0b';
        break;
      default:
        toast.style.background = '#3b82f6';
    }

    toast.textContent = message;
    document.body.appendChild(toast);

    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
};

// Global functions for HTML onclick handlers
function addToCart(product) {
  cart.addToCart(product);
}

function removeFromCart(productId) {
  cart.removeFromCart(productId);
}

function updateCartQuantity(productId, quantity) {
  cart.updateQuantity(productId, quantity);
}

function clearCart() {
  cart.clearCart();
}

async function checkout() {
  await cart.checkout();
}

// Initialize cart when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  cart.init();
});

// Export for global access
window.cart = cart; 
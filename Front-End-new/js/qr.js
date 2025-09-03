// ===== QR CODE PAGE WITH DATABASE INTEGRATION =====
import { db } from './database.js'

// Helper function to get product emoji based on category
function getProductEmoji(category) {
  const emojiMap = {
    'مشروبات': '🥤',
    'حلويات': '🍫',
    'خضروات': '🥬',
    'فواكه': '🍎',
    'لحوم': '🥩',
    'ألبان': '🥛',
    'خبز': '🍞',
    'default': '📦'
  };
  return emojiMap[category] || emojiMap.default;
}

// QR/Barcode standalone logic

async function ensureAuth() {
  const currentUser = localStorage.getItem('current_user');
  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }
  
  try {
    const user = JSON.parse(currentUser);
    if (!user || !user.id) {
      window.location.href = 'index.html';
      return;
    }
  } catch (error) {
    console.error('Error parsing user data:', error);
    window.location.href = 'index.html';
    return;
  }
}
function utf8ByteStr(s){
  const bytes = new TextEncoder().encode(s);
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

function showUserQR(userId) {
  const container = document.getElementById('qr');
  if (!container || !window.QRCode) return;
  container.innerHTML = '';
  new QRCode(container, {
    text: String(userId),
    width: 300,
    height: 300,
    colorDark: '#000000',
    colorLight: '#FFFFFF',
    correctLevel: QRCode.CorrectLevel.M
  });
}

function getCurrentUsername() {
  try {
    const currentUser = localStorage.getItem('current_user');
    if (currentUser) {
      const user = JSON.parse(currentUser);
      return user.email;
    }
  } catch (error) {
    console.error('Error getting user ID:', error);
  }
  return '12345'; // Fallback
}

function getCurrentUserId() {
  try {
    const currentUser = localStorage.getItem('current_user');
    if (currentUser) {
      const user = JSON.parse(currentUser);
      return user.id;
    }
  } catch (error) {
    console.error('Error getting user ID:', error);
  }
  return '12345'; // Fallback
}

async function simulateProductDetection() {
  try {
    // Get products from database
    const products = await db.getProducts();
    
    if (products.length === 0) {
      // Fallback to static products if database is empty
      const fallbackProducts = [
        { name: 'حليب طازج', price: 12.50, image: '🥛' },
        { name: 'خبز أبيض', price: 3.75, image: '🍞' },
        { name: 'تفاح أحمر', price: 8.90, image: '🍎' },
        { name: 'جبنة شيدر', price: 15.25, image: '🧀' }
      ];
      const randomProduct = fallbackProducts[Math.floor(Math.random() * fallbackProducts.length)];
      addToCart(randomProduct);
    } else {
      // Use real products from database
      const randomProduct = products[Math.floor(Math.random() * products.length)];
      const productWithImage = {
        name: randomProduct.name,
        price: randomProduct.price,
        image: getProductEmoji(randomProduct.category)
      };
      addToCart(productWithImage);
    }
  } catch (error) {
    console.error('Error loading products:', error);
    // Fallback to static product
    const fallbackProduct = { name: 'منتج تجريبي', price: 10.00, image: '📦' };
    addToCart(fallbackProduct);
  }

  const cameraArea = document.getElementById('cameraArea');
  if (!cameraArea) return;
  cameraArea.querySelector('.camera-placeholder').innerHTML = `
    <div style="width: 100%; height: 300px; background: #d4edda; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
      <div style="text-align: center; color: #155724;">
        <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
        <div>تم اكتشاف المنتج!</div>
        <div style="font-size: 16px; margin-top: 5px;">${randomProduct.name}</div>
        <div style="font-size: 14px; margin-top: 5px;">${randomProduct.price} ر.س</div>
      </div>
    </div>
  `;

  setTimeout(() => {
    cameraArea.querySelector('.camera-placeholder').innerHTML = `
      <div style="text-align: center; color: #6c757d;">
        <div style="font-size: 48px; margin-bottom: 10px;">📷</div>
        <div>امسح الباركود للمنتج</div>
        <div style="font-size: 14px; margin-top: 5px;">اضغط على زر المحاكاة</div>
      </div>
    `;
  }, 2000);
}

function addToCart(product) {
  const cart = JSON.parse(localStorage.getItem('twq_cart') || '[]');
  cart.push(product);
  localStorage.setItem('twq_cart', JSON.stringify(cart));
  updateCartDisplay();
}

function removeFromCart(index) {
  const cart = JSON.parse(localStorage.getItem('twq_cart') || '[]');
  cart.splice(index, 1);
  localStorage.setItem('twq_cart', JSON.stringify(cart));
  updateCartDisplay();
}

function updateCartDisplay() {
  const cartItems = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');
  const cart = JSON.parse(localStorage.getItem('twq_cart') || '[]');
  if (!cartItems || !cartTotal) return;

  if (cart.length === 0) {
    cartItems.innerHTML = '<div class="cart-empty"><div style="font-size: 24px; margin-bottom: 10px;">🛒</div><div>السلة فارغة</div><div style="font-size: 12px; margin-top: 5px;">سيتم إضافة المنتجات تلقائياً</div></div>';
    cartTotal.textContent = '0.00 ر.س';
    return;
  }

  cartItems.innerHTML = cart.map((item, index) => `
    <div class="cart-item">
      <span>${item.image} ${item.name}</span>
      <span>${item.price} ر.س</span>
      <button onclick="removeFromCart(${index})">❌</button>
    </div>
  `).join('');

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  cartTotal.textContent = `${total.toFixed(2)} ر.س`;
}

async function completePurchase() {
  const cart = JSON.parse(localStorage.getItem('twq_cart') || '[]');
  if (cart.length === 0) {
    alert('السلة فارغة!');
    return;
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  
          try {
            // Get current user from localStorage
            const currentUserStr = localStorage.getItem('current_user');
            if (!currentUserStr) {
                alert('يرجى تسجيل الدخول أولاً');
                window.location.href = 'login.html';
                return;
            }

            const currentUser = JSON.parse(currentUserStr);
            
            // Create invoice in database
            const { data: newInvoice, error } = await db.supabase
                .from('invoices')
                .insert([{
                    user_id: currentUser.id,
                    total_amount: total,
                    branch_id: 'branch-1', // Default branch
                    status: 'pending',
                    items: cart.map(item => ({
                        name: item.name,
                        price: item.price,
                        quantity: 1
                    }))
                }])
                .select();
            
            if (error) {
                console.error('Error creating invoice:', error);
                alert('حدث خطأ في إنشاء الفاتورة');
                return;
            }
            
            if (newInvoice && newInvoice.length > 0) {
                alert(`تم إتمام الشراء بنجاح! المجموع: ${db.formatCurrency(total)}`);
                
                // Clear cart
                localStorage.removeItem('twq_cart');
                updateCartDisplay();
                
                // Redirect to user dashboard
                window.location.href = 'user.html';
            } else {
                alert('حدث خطأ في إنشاء الفاتورة');
            }
        } catch (error) {
            console.error('Error creating invoice:', error);
            alert('حدث خطأ في إتمام الشراء');
        }
}

function navigateToScan() {
  const barcodePage = document.getElementById('page-barcode');
  const scanPage = document.getElementById('page-barcode-scan');
  if (barcodePage && scanPage) {
    barcodePage.classList.remove('active');
    scanPage.classList.add('active');
  }
}

function navigateToBarcode() {
  const barcodePage = document.getElementById('page-barcode');
  const scanPage = document.getElementById('page-barcode-scan');
  if (barcodePage && scanPage) {
    scanPage.classList.remove('active');
    barcodePage.classList.add('active');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await ensureAuth();

  // Generate user QR on load with actual user ID
  const userId = getCurrentUserId();
  const username = getCurrentUsername();
  showUserQR(userId);
  // Buttons
  const simulateBtn = document.getElementById('simulateScan');
  const backDashBtn = document.getElementById('backDash');
  const backToDashboardBtn = document.getElementById('backToDashboard');
  const simulateProductBtn = document.getElementById('simulateProduct');
  const completeBtn = document.getElementById('completePurchase');

  if (simulateBtn) simulateBtn.addEventListener('click', navigateToScan);
  if (backDashBtn) backDashBtn.addEventListener('click', () => window.location.href = 'user.html');
  if (backToDashboardBtn) backToDashboardBtn.addEventListener('click', navigateToBarcode);
  if (simulateProductBtn) simulateProductBtn.addEventListener('click', simulateProductDetection);
  if (completeBtn) completeBtn.addEventListener('click', completePurchase);

  updateCartDisplay();
});



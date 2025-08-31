// Complaint Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Complaint page loaded');
    
    // Initialize form and load invoice data
    initializeComplaintForm();
    loadInvoiceData();
});

// Initialize complaint form functionality
function initializeComplaintForm() {
    const form = document.getElementById('complaintForm');
    if (form) {
        form.addEventListener('submit', handleComplaintSubmit);
    }
}

// Load invoice data from URL parameters
async function loadInvoiceData() {
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('id');
    
    if (invoiceId) {
        document.getElementById('invoiceNumber').textContent = `#${invoiceId}`;
    }
    
    console.log('Invoice ID:', invoiceId);
    
    // Load invoice products if we have an invoice ID
    if (invoiceId) {
        await loadInvoiceProducts(invoiceId);
    }
}

// Load invoice products from database
async function loadInvoiceProducts(invoiceId) {
    try {
        // Import database service
        const { db } = await import('./database.js');
        
        // Get current user from localStorage
        const currentUserStr = localStorage.getItem('current_user');
        if (!currentUserStr) {
            console.error('No user found in localStorage');
            return;
        }

        const currentUser = JSON.parse(currentUserStr);
        db.setCurrentUser(currentUser.id);
        
        // Get invoice data from database
        const { data: invoice, error } = await db.supabase
            .from('invoices')
            .select('*')
            .eq('id', invoiceId)
            .eq('user_id', currentUser.id)
            .single();

        if (error) {
            console.error('Error loading invoice:', error);
            showMessage('خطأ في تحميل بيانات الفاتورة', 'error');
            return;
        }

        if (invoice) {
            // Update invoice date
            if (invoice.timestamp) {
                const { db } = await import('./database.js');
                document.getElementById('invoiceDate').textContent = db.formatDate(invoice.timestamp);
            }
            displayInvoiceProducts(invoice.products_and_quantities || []);
        }
        
    } catch (error) {
        console.error('Error loading invoice products:', error);
        showMessage('خطأ في تحميل منتجات الفاتورة', 'error');
    }
}

// Store original quantities and products
let originalQuantities = [];
let originalInvoiceProducts = [];

// Display invoice products with selection checkboxes
function displayInvoiceProducts(products) {
    const productsList = document.getElementById('productsList');
    if (!productsList) return;

    if (!products || products.length === 0) {
        productsList.innerHTML = `
            <div class="no-products">
                <p>لا توجد منتجات في هذه الفاتورة</p>
            </div>
        `;
        return;
    }

    // Store original products and quantities
    originalInvoiceProducts = products.map((product, index) => ({
        ...product,
        id: product.id || `product-${index}` // Ensure each product has an ID
    }));
    originalQuantities = products.map(product => parseInt(product.quantity) || 1);

    productsList.innerHTML = products.map((product, index) => `
        <div class="product-item" data-product-id="${product.id || `product-${index}`}" data-index="${index}">
            <div class="product-selection">
                <input type="checkbox" id="select-${index}" class="product-checkbox" onchange="toggleProductSelection(${index})">
                <label for="select-${index}" class="checkbox-label"></label>
            </div>
            <div class="product-info">
                <div class="product-name">${product.name || 'منتج غير محدد'}</div>
                <div class="product-price">${product.price ? `${product.price} ريال` : 'غير محدد'}</div>
                <div class="original-quantity">الكمية الأصلية: ${product.quantity || 1}</div>
            </div>
            <div class="quantity-controls" style="display: none;">
                <button type="button" class="quantity-btn minus" onclick="updateQuantity(${index}, -1); event.stopPropagation();">-</button>
                <span class="quantity-display" id="quantity-${index}">0</span>
                <button type="button" class="quantity-btn plus" onclick="updateQuantity(${index}, 1); event.stopPropagation();">+</button>
            </div>
        </div>
    `).join('');
}

// Toggle product selection and show/hide quantity controls
function toggleProductSelection(index) {
    const productItem = document.querySelector(`[data-index="${index}"]`);
    const checkbox = document.getElementById(`select-${index}`);
    const quantityControls = productItem.querySelector('.quantity-controls');
    
    if (checkbox.checked) {
        // Product is selected - show quantity controls
        productItem.classList.add('selected');
        quantityControls.style.display = 'flex';
        
        // Set quantity to 0 when selected
        const quantityDisplay = document.getElementById(`quantity-${index}`);
        if (quantityDisplay) {
            quantityDisplay.textContent = '0';
        }
    } else {
        // Product is deselected - hide quantity controls and reset quantity to 0
        productItem.classList.remove('selected');
        quantityControls.style.display = 'none';
        
        // Reset quantity to 0
        const quantityDisplay = document.getElementById(`quantity-${index}`);
        if (quantityDisplay) {
            quantityDisplay.textContent = '0';
        }
    }
}

// Update product quantity
function updateQuantity(index, change) {
    const quantityDisplay = document.getElementById(`quantity-${index}`);
    if (!quantityDisplay) return;

    let currentQuantity = parseInt(quantityDisplay.textContent) || 0;
    let newQuantity = currentQuantity + change;
    
    // Ensure quantity doesn't go below 0
    if (newQuantity < 0) {
        newQuantity = 0;
    }
    
    quantityDisplay.textContent = newQuantity;
}

// Handle complaint form submission
async function handleComplaintSubmit(event) {
    event.preventDefault();
    
    console.log('Submitting complaint...');
    
    // Get updated quantities from the products list
    const updatedProducts = await getUpdatedProducts();
    console.log('Updated products:', updatedProducts);
    
    const complaintData = {
        invoiceNumber: document.getElementById('invoiceNumber').textContent,
        invoiceDate: document.getElementById('invoiceDate').textContent,
        updatedProducts: updatedProducts,
        timestamp: new Date().toISOString(),
        id: generateComplaintId()
    };
    
    // Get user data from account
    const userData = getUserData();
    if (userData) {
        complaintData.name = userData.firstName + ' ' + userData.lastName;
        complaintData.phone = userData.phone;
        complaintData.email = userData.email;
    }
    
    console.log('Complaint data:', complaintData);
    
    // Validate form data
    if (!validateComplaintForm(complaintData)) {
        console.log('Validation failed');
        return;
    }
    
    console.log('Validation passed, saving complaint...');
    
    // Save complaint
    saveComplaint(complaintData);
    
    // Show success modal
    showSuccessModal();
    
    // Clear form without showing restore message
    clearFormSilently();
}

// Get updated products with new quantities (only selected products)
async function getUpdatedProducts() {
    const productItems = document.querySelectorAll('.product-item');
    const updatedProducts = [];
    
    // Get all selected product names
    const selectedProductNames = [];
    productItems.forEach((item) => {
        const productName = item.querySelector('.product-name').textContent;
        const index = item.getAttribute('data-index');
        const checkbox = document.getElementById(`select-${index}`);
        
        if (checkbox && checkbox.checked) {
            selectedProductNames.push(productName);
        }
    });
    
    // Get product prices from database by name
    const { db } = await import('./database.js');
    console.log('Searching for products by names:', selectedProductNames);
    
    const { data: productPrices, error: priceError } = await db.supabase
        .from('products')
        .select('id, name, price')
        .in('name', selectedProductNames);
        
    if (priceError) {
        console.error('Error fetching product prices:', priceError);
    } else {
        console.log('Found products in database:', productPrices);
    }
    
    // Create a map for quick lookup by name
    const priceMap = {};
    if (productPrices) {
        productPrices.forEach(p => {
            priceMap[p.name] = { id: p.id, price: p.price };
        });
    }
    console.log('Price map:', priceMap);
    
    productItems.forEach((item) => {
        const productId = item.getAttribute('data-product-id');
        const index = item.getAttribute('data-index');
        const checkbox = document.getElementById(`select-${index}`);
        
        // Only include selected products
        if (checkbox && checkbox.checked) {
            const quantityDisplay = item.querySelector('.quantity-display');
            const productName = item.querySelector('.product-name').textContent;
            
            if (quantityDisplay) {
                const productData = priceMap[productName];
                console.log(`Product: ${productName}, Found in DB:`, productData);
                
                updatedProducts.push({
                    id: productData ? productData.id : productId,
                    name: productName,
                    price: productData ? productData.price : 0, // Use price from database
                    quantity: parseInt(quantityDisplay.textContent) || 0
                });
            }
        }
    });
    
    return updatedProducts;
}

// Validate complaint form data
function validateComplaintForm(data) {
    console.log('=== VALIDATION DEBUG ===');
    console.log('Data:', data);
    console.log('Original invoice products:', originalInvoiceProducts);
    
    if (!data.updatedProducts || data.updatedProducts.length === 0) {
        showMessage('يرجى تحديد المنتجات التي لديك مشكلة فيها', 'error');
        return false;
    }
    
    // Check if any quantities have been modified from original OR if new products were added
    let hasChanges = false;
    let hasNewProducts = false;
    
    // Get all product IDs from the current complaint list
    const currentProductIds = data.updatedProducts.map(product => product.id);
    console.log('Current product IDs:', currentProductIds);
    
    // Get original invoice product IDs (from the original invoice)
    const originalInvoiceProductIds = originalInvoiceProducts.map(product => product.id);
    console.log('Original invoice product IDs:', originalInvoiceProductIds);
    
    // Check if there are new products (products not in original invoice)
    const newProductIds = currentProductIds.filter(id => !originalInvoiceProductIds.includes(id));
    console.log('New product IDs:', newProductIds);
    if (newProductIds.length > 0) {
        hasNewProducts = true;
        console.log('Found new products!');
    }
    
    // Check if any original product quantities have been changed
    data.updatedProducts.forEach((product) => {
        // Only check quantities for products that were in the original invoice
        if (originalInvoiceProductIds.includes(product.id)) {
            const originalProduct = originalInvoiceProducts.find(p => p.id === product.id);
            if (originalProduct && product.quantity !== originalProduct.quantity) {
                hasChanges = true;
                console.log('Found quantity change for product:', product.id);
            }
        }
    });
    
    console.log('Has changes:', hasChanges);
    console.log('Has new products:', hasNewProducts);
    
    // Allow submission if there are new products OR quantity changes
    if (!hasChanges && !hasNewProducts) {
        showMessage('يرجى تعديل الكميات أو إضافة منتجات جديدة للشكوى', 'error');
        return false;
    }
    
    console.log('Validation passed!');
    return true;
}

// Get user data from account
function getUserData() {
    try {
        // Get current user from localStorage
        const currentUserStr = localStorage.getItem('current_user');
        if (currentUserStr) {
            const currentUser = JSON.parse(currentUserStr);
            return {
                firstName: currentUser.first_name || 'مستخدم',
                lastName: currentUser.last_name || 'دكان فيجين',
                phone: currentUser.phone || '0540231533',
                email: currentUser.email || 'user@dukkanvision.com'
            };
        }
        
        // Fallback: return default user data
        return {
            firstName: 'مستخدم',
            lastName: 'دكان فيجين',
            phone: '0540231533',
            email: 'user@dukkanvision.com'
        };
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Generate unique complaint ID
function generateComplaintId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `COMP-${timestamp}-${random}`;
}

// Save complaint to database and redirect to admin tickets page
async function saveComplaint(data) {
    try {
        // Import database service
        const { db } = await import('./database.js');
        
        // Get current user from localStorage
        const currentUserStr = localStorage.getItem('current_user');
        if (!currentUserStr) {
            console.error('No user found in localStorage');
            showMessage('خطأ في تحديد المستخدم', 'error');
            return;
        }

        const currentUser = JSON.parse(currentUserStr);
        db.setCurrentUser(currentUser.id);
        
        // Validate required data
        if (!data.id || !data.invoiceNumber || !data.updatedProducts) {
            showMessage('بيانات الشكوى غير مكتملة', 'error');
            return;
        }

        // Generate UUID for ticket ID
        const ticketId = crypto.randomUUID();
        
        // Get invoice ID from database using invoice number
        const invoiceNumber = data.invoiceNumber.replace('#', '');
        const { data: invoiceData, error: invoiceError } = await db.supabase
            .from('invoices')
            .select('id')
            .eq('id', invoiceNumber)
            .single();
            
        if (invoiceError || !invoiceData) {
            console.error('Error finding invoice:', invoiceError);
            showMessage('خطأ في العثور على الفاتورة', 'error');
            return;
        }
        
        // Calculate refund price based on quantity differences
        let totalRefundPrice = 0;
        
        console.log('=== REFUND CALCULATION DEBUG ===');
        console.log('Original invoice products:', originalInvoiceProducts);
        console.log('Updated products:', data.updatedProducts);
        
        data.updatedProducts.forEach((product) => {
            console.log(`Processing product: ${product.name} (ID: ${product.id})`);
            
            // Find original product from invoice
            const originalProduct = originalInvoiceProducts.find(p => p.id === product.id);
            console.log(`Found original product:`, originalProduct);
            
            // Get price from the product data (already fetched from database)
            const productPrice = product.price || 0;
            console.log(`Product price: ${productPrice}`);
            
            if (originalProduct) {
                // Calculate difference in quantity
                const originalQuantity = parseInt(originalProduct.quantity) || 0;
                const currentQuantity = parseInt(product.quantity) || 0;
                const quantityDifference = originalQuantity - currentQuantity;
                
                console.log(`Product: ${product.name}`);
                console.log(`  Original quantity: ${originalQuantity}`);
                console.log(`  Current quantity: ${currentQuantity}`);
                console.log(`  Quantity difference: ${quantityDifference}`);
                
                // Calculate refund based on quantity difference
                // If current quantity is 0, refund the entire original quantity
                // If current quantity is different from original, refund the difference
                if (currentQuantity === 0) {
                    // User wants refund for entire quantity
                    const refundAmount = originalQuantity * productPrice;
                    totalRefundPrice += refundAmount;
                    console.log(`  Product price: ${productPrice}`);
                    console.log(`  Full refund for original quantity: ${originalQuantity}`);
                    console.log(`  Refund amount: ${refundAmount}`);
                } else if (quantityDifference !== 0) {
                    // User wants refund for difference
                    const refundAmount = Math.abs(quantityDifference) * productPrice;
                    totalRefundPrice += refundAmount;
                    console.log(`  Product price: ${productPrice}`);
                    console.log(`  Quantity difference: ${quantityDifference}`);
                    console.log(`  Refund amount: ${refundAmount}`);
                } else {
                    console.log(`  No refund needed (quantity difference: ${quantityDifference})`);
                }
            } else {
                // This is a new product added to complaint
                // Calculate refund for the quantity specified by user
                const quantity = parseInt(product.quantity) || 0;
                const refundAmount = quantity * productPrice;
                totalRefundPrice += refundAmount;
                
                console.log(`New product: ${product.name}`);
                console.log(`  Product ID: ${product.id}`);
                console.log(`  Quantity: ${quantity}`);
                console.log(`  Product price: ${productPrice}`);
                console.log(`  Refund amount: ${refundAmount}`);
            }
        });
        
        // Format products data for JSONB storage
        const formattedProducts = data.updatedProducts.map(product => ({
            id: product.id,
            name: product.name,
            price: product.price || 0,
            quantity: parseInt(product.quantity) || 0
        }));
        
        // Create ticket data for database
        const ticketData = {
            id: ticketId,
            invoice_id: invoiceData.id,
            timestamp: new Date().toISOString(),
            products_and_quantities: formattedProducts,
            refund_price: totalRefundPrice
            // Removed status field to avoid enum issues
        };
        
        console.log('Saving ticket data:', ticketData);
        console.log('Formatted products:', formattedProducts);
        console.log('Total refund price:', totalRefundPrice);
        
        // Save to database
        const { data: savedTicket, error } = await db.supabase
            .from('tickets')
            .insert([ticketData])
            .select()
            .single();

        if (error) {
            console.error('Error saving ticket to database:', error);
            console.error('Error details:', error.message, error.details, error.hint);
            showMessage('حدث خطأ في حفظ الشكوى: ' + error.message, 'error');
            return;
        }

        console.log('Ticket saved to database:', savedTicket);
        
        // Show success message
        showMessage('تم حفظ الشكوى بنجاح!', 'success');
        
    } catch (error) {
        console.error('Error saving complaint:', error);
        showMessage('حدث خطأ في حفظ الشكوى: ' + error.message, 'error');
    }
}

// Send data to server (placeholder for real implementation)
function sendToServer(data) {
    // This would be replaced with actual API call
    console.log('Sending to server:', data);
    
    // Example API call:
    /*
    fetch('/api/complaints', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        console.log('Success:', result);
    })
    .catch(error => {
        console.error('Error:', error);
        showMessage('حدث خطأ في إرسال الشكوى. يرجى المحاولة مرة أخرى.', 'error');
    });
    */
}

// Show success modal
function showSuccessModal() {
    // Remove any existing modals
    const existingModal = document.querySelector('.success-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'success-modal-overlay';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'success-modal';
    modalContent.innerHTML = `
        <div class="modal-content">
            <div class="modal-icon">✅</div>
            <h3>تم إرسال شكواك بنجاح!</h3>
            <p>سنتواصل معك قريباً</p>
            <button class="btn btn-understood" onclick="closeSuccessModal()">فهمت</button>
        </div>
    `;
    
    // Add modal to page
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Show modal with animation
    setTimeout(() => {
        modalOverlay.classList.add('show');
    }, 10);
}

// Close success modal and redirect to main page
function closeSuccessModal() {
    const modalOverlay = document.querySelector('.success-modal-overlay');
    if (modalOverlay) {
        modalOverlay.classList.remove('show');
        setTimeout(() => {
            modalOverlay.remove();
            // Redirect to main page
            window.location.href = 'user.html';
        }, 300);
    }
}

// Show message to user
function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message element
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    // Insert message before form
    const form = document.getElementById('complaintForm');
    if (form) {
        form.parentNode.insertBefore(messageElement, form);
    }
    
    // Auto-remove message after 5 seconds
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.remove();
        }
    }, 5000);
}

// Store original products from invoice

// Clear form and restore original quantities
async function clearForm() {
    try {
        const form = document.getElementById('complaintForm');
        if (form) {
            form.reset();
        }
        
        // Import database service for formatting
        const { db } = await import('./database.js');
        
        // Restore original invoice products only
        const productsList = document.getElementById('productsList');
        if (productsList && originalInvoiceProducts.length > 0) {
            // Clear current list
            productsList.innerHTML = '';
            
            // Restore original invoice products
            originalQuantities = [];
            originalInvoiceProducts.forEach((product, index) => {
                originalQuantities.push(parseInt(product.quantity) || 1);
                
                const productElement = document.createElement('div');
                productElement.className = 'product-item';
                productElement.setAttribute('data-product-id', product.id || `product-${index}`);
                productElement.setAttribute('data-index', index);
                productElement.innerHTML = `
                    <div class="product-selection">
                        <input type="checkbox" id="select-${index}" class="product-checkbox" onchange="toggleProductSelection(${index})">
                        <label for="select-${index}" class="checkbox-label"></label>
                    </div>
                    <div class="product-info">
                        <div class="product-name">${product.name || 'منتج غير محدد'}</div>
                        <div class="product-price">${product.price ? db.formatCurrency(product.price) : 'غير محدد'}</div>
                        <div class="original-quantity">الكمية الأصلية: ${product.quantity || 1}</div>
                    </div>
                    <div class="quantity-controls" style="display: none;">
                        <button type="button" class="quantity-btn minus" onclick="updateQuantity(${index}, -1); event.stopPropagation();">-</button>
                        <span class="quantity-display" id="quantity-${index}">0</span>
                        <button type="button" class="quantity-btn plus" onclick="updateQuantity(${index}, 1); event.stopPropagation();">+</button>
                    </div>
                `;
                productsList.appendChild(productElement);
            });
        }
        
        // Show message that form has been reset
        showMessage('تم إعادة النموذج إلى حالته الأصلية', 'info');
    } catch (error) {
        console.error('Error clearing form:', error);
        showMessage('خطأ في إعادة تعيين النموذج', 'error');
    }
}

// Clear form silently (without showing restore message)
async function clearFormSilently() {
    try {
        const form = document.getElementById('complaintForm');
        if (form) {
            form.reset();
        }
        
        // Import database service for formatting
        const { db } = await import('./database.js');
        
        // Restore original invoice products only (silently)
        const productsList = document.getElementById('productsList');
        if (productsList && originalInvoiceProducts.length > 0) {
            // Clear current list
            productsList.innerHTML = '';
            
            // Restore original invoice products
            originalQuantities = [];
            originalInvoiceProducts.forEach((product, index) => {
                originalQuantities.push(parseInt(product.quantity) || 1);
                
                const productElement = document.createElement('div');
                productElement.className = 'product-item';
                productElement.setAttribute('data-product-id', product.id || `product-${index}`);
                productElement.setAttribute('data-index', index);
                productElement.innerHTML = `
                    <div class="product-selection">
                        <input type="checkbox" id="select-${index}" class="product-checkbox" onchange="toggleProductSelection(${index})">
                        <label for="select-${index}" class="checkbox-label"></label>
                    </div>
                    <div class="product-info">
                        <div class="product-name">${product.name || 'منتج غير محدد'}</div>
                        <div class="product-price">${product.price ? db.formatCurrency(product.price) : 'غير محدد'}</div>
                        <div class="original-quantity">الكمية الأصلية: ${product.quantity || 1}</div>
                    </div>
                    <div class="quantity-controls" style="display: none;">
                        <button type="button" class="quantity-btn minus" onclick="updateQuantity(${index}, -1); event.stopPropagation();">-</button>
                        <span class="quantity-display" id="quantity-${index}">0</span>
                        <button type="button" class="quantity-btn plus" onclick="updateQuantity(${index}, 1); event.stopPropagation();">+</button>
                    </div>
                `;
                productsList.appendChild(productElement);
            });
        }
    } catch (error) {
        console.error('Error clearing form silently:', error);
    }
}

// Go back function
function goBack() {
    if (document.referrer) {
        window.history.back();
    } else {
        // Fallback: go to user page
        window.location.href = 'user.html';
    }
}

// All Products Modal Functions
let allProducts = [];

// Show all products modal
async function showAllProductsModal() {
    try {
        // Import database service
        const { db } = await import('./database.js');
        
        // Get all products from database
        const { data: products, error } = await db.supabase
            .from('products')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error loading products:', error);
            showMessage('خطأ في تحميل المنتجات: ' + error.message, 'error');
            return;
        }

        allProducts = products || [];
        await displayAllProducts(allProducts);
        
        // Show modal
        const modal = document.getElementById('allProductsModal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        } else {
            console.error('Modal element not found');
            showMessage('خطأ في فتح النافذة المنبثقة', 'error');
        }
        
    } catch (error) {
        console.error('Error showing all products modal:', error);
        showMessage('خطأ في فتح قائمة المنتجات: ' + error.message, 'error');
    }
}

// Display all products in modal
async function displayAllProducts(products) {
    const productsList = document.getElementById('allProductsList');
    if (!productsList) {
        console.error('Products list element not found');
        return;
    }

    if (!products || products.length === 0) {
        productsList.innerHTML = `
            <div class="no-products">
                <p>لا توجد منتجات متاحة</p>
            </div>
        `;
        return;
    }

    try {
        // Import database service for formatting
        const { db } = await import('./database.js');
        
        productsList.innerHTML = products.map(product => {
            // Check if product is already in complaint list
            const existingProduct = document.querySelector(`[data-product-id="${product.id}"]`);
            const isAdded = existingProduct !== null;
            
            return `
                <div class="all-product-item">
                    <div class="all-product-info">
                        <div class="all-product-name">${product.name || 'منتج غير محدد'}</div>
                        <div class="all-product-price">${db.formatCurrency(product.price || 0)}</div>
                    </div>
                    <button type="button" class="btn-add-product" onclick="addSingleProduct('${product.id}')" id="add-btn-${product.id}" ${isAdded ? 'disabled' : ''}>
                        ${isAdded ? 'مضاف' : 'إضافة'}
                    </button>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error displaying products:', error);
        productsList.innerHTML = `
            <div class="no-products">
                <p>خطأ في عرض المنتجات</p>
            </div>
        `;
    }
}

// Add single product to complaint
async function addSingleProduct(productId) {
    try {
        const product = allProducts.find(p => p.id === productId);
        if (!product) {
            showMessage('المنتج غير موجود', 'error');
            return;
        }

        // Check if product already exists in complaint list
        const existingProduct = document.querySelector(`[data-product-id="${product.id}"]`);
        if (existingProduct) {
            showMessage('هذا المنتج موجود بالفعل في قائمة الشكوى', 'error');
            return;
        }

        // Import database service for formatting
        const { db } = await import('./database.js');

        // Add to existing products list
        const productsList = document.getElementById('productsList');
        if (productsList) {
            const productIndex = originalQuantities.length;
            originalQuantities.push(1);
            
            const productElement = document.createElement('div');
            productElement.className = 'product-item selected';
            productElement.setAttribute('data-product-id', product.id);
            productElement.setAttribute('data-index', productIndex);
            productElement.innerHTML = `
                <div class="product-selection">
                    <input type="checkbox" id="select-${productIndex}" class="product-checkbox" onchange="toggleProductSelection(${productIndex})" checked>
                    <label for="select-${productIndex}" class="checkbox-label"></label>
                </div>
                <div class="product-info">
                    <div class="product-name">${product.name || 'منتج غير محدد'}</div>
                    <div class="product-price">${db.formatCurrency(product.price || 0)}</div>
                    <div class="original-quantity">منتج مضافة للشكوى</div>
                </div>
                <div class="quantity-controls" style="display: flex;">
                    <button type="button" class="quantity-btn minus" onclick="updateQuantity(${productIndex}, -1); event.stopPropagation();">-</button>
                    <span class="quantity-display" id="quantity-${productIndex}">0</span>
                    <button type="button" class="quantity-btn plus" onclick="updateQuantity(${productIndex}, 1); event.stopPropagation();">+</button>
                </div>
            `;
            productsList.appendChild(productElement);
        }

        // Disable the add button for this product
        const addButton = document.getElementById(`add-btn-${product.id}`);
        if (addButton) {
            addButton.disabled = true;
            addButton.textContent = 'مضاف';
        }

        showMessage(`تم إضافة ${product.name || 'المنتج'} للشكوى`, 'success');
    } catch (error) {
        console.error('Error adding product:', error);
        showMessage('خطأ في إضافة المنتج', 'error');
    }
}

// Close all products modal
function closeAllProductsModal() {
    const modal = document.getElementById('allProductsModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            // Reset all add buttons
            const addButtons = modal.querySelectorAll('.btn-add-product');
            addButtons.forEach(button => {
                button.disabled = false;
                button.textContent = 'إضافة';
            });
        }, 300);
    }
}

// Search products
async function searchProducts(query) {
    try {
        const filteredProducts = allProducts.filter(product => 
            (product.name || '').toLowerCase().includes(query.toLowerCase())
        );
        await displayAllProducts(filteredProducts);
        
        // Update button states based on already added products
        setTimeout(() => {
            const complaintProducts = document.querySelectorAll('[data-product-id]');
            complaintProducts.forEach(complaintProduct => {
                const productId = complaintProduct.getAttribute('data-product-id');
                const addButton = document.getElementById(`add-btn-${productId}`);
                if (addButton) {
                    addButton.disabled = true;
                    addButton.textContent = 'مضاف';
                }
            });
        }, 100);
    } catch (error) {
        console.error('Error searching products:', error);
    }
}

// Initialize search functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('productSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchProducts(e.target.value);
        });
    }
});

// Export functions for global access
window.clearForm = clearForm;
window.clearFormSilently = clearFormSilently;
window.goBack = goBack;
window.toggleProductSelection = toggleProductSelection;
window.updateQuantity = updateQuantity;
window.closeSuccessModal = closeSuccessModal;
window.showAllProductsModal = showAllProductsModal;
window.closeAllProductsModal = closeAllProductsModal;
window.addSingleProduct = addSingleProduct;

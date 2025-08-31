// ===== INVOICE VIEW WITH DATABASE INTEGRATION =====
import { db } from './database.js'

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Invoice view page loaded');
    
    // Check if user is authenticated
    const currentUserStr = localStorage.getItem('current_user');
    if (!currentUserStr) {
        window.location.href = 'login.html';
        return;
    }
    
    // Get invoice ID from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('id');
    
    console.log('URL parameters:', window.location.search);
    console.log('Invoice ID from URL:', invoiceId);
    
    // Update invoice details based on ID
    if (invoiceId) {
        await updateInvoiceDetails(invoiceId);
    } else {
        console.log('No invoice ID found in URL');
        // Show default invoice or error message
        await showDefaultInvoice();
    }
});

// Function to update invoice details based on ID from database
async function updateInvoiceDetails(invoiceId) {
    console.log('Updating invoice details for ID:', invoiceId);
    
    try {
        // Get current user
        const currentUserStr = localStorage.getItem('current_user');
        const currentUser = JSON.parse(currentUserStr);
        
        // Get invoice from database
        const { data: invoice, error } = await db.supabase
            .from('invoices')
            .select('*')
            .eq('id', invoiceId)
            .eq('user_id', currentUser.id)
            .single();
        
        if (error) {
            console.error('Database error:', error);
            showError(`خطأ في قاعدة البيانات: ${error.message}`);
            return;
        }
        
        if (!invoice) {
            console.error('Invoice not found:', invoiceId);
            showError('الفاتورة غير موجودة');
            return;
        }
        
        console.log('Found invoice:', invoice);
        console.log('Products and quantities:', invoice.products_and_quantities);
        
        // Get product prices from database
        const { data: products, error: productsError } = await db.supabase
            .from('products')
            .select('name, price');
        
        if (productsError) {
            console.error('Error loading products:', productsError);
        } else {
            console.log('Loaded products with prices:', products);
        }
        
        // Create a map of product names to prices
        const productPrices = {};
        if (products) {
            products.forEach(product => {
                productPrices[product.name.toLowerCase()] = parseFloat(product.price) || 0;
            });
        }
        console.log('Product prices map:', productPrices);
        
        // Update invoice header
        document.getElementById('invoice-id').textContent = `#${invoice.id}`;
        document.getElementById('invoice-date').textContent = db.formatDate(invoice.timestamp);
        
        // Get branch name based on branch_id
        let branchName = 'غير محدد';
        if (invoice.branch_id) {
            switch (invoice.branch_id) {
                case '9852c8e7-0be0-4f5c-aa8d-68e289fe9552':
                    branchName = 'فرع العليا';
                    break;
                case 'af73abd0-04f7-44bb-b0d6-396a58cbd33a':
                    branchName = 'فرع الياسمين';
                    break;
                case '130df862-b9e2-4233-8d67-d87a3d3b8323':
                    branchName = 'فرع الملقا';
                    break;
            }
        }
        document.getElementById('invoice-branch').textContent = branchName;
        
        // Parse items from JSONB
        let items = invoice.products_and_quantities || [];
        
        // Ensure items is an array
        if (!Array.isArray(items)) {
            console.warn('Products and quantities is not an array:', items);
            items = [];
        }
        
        // Update invoice items
        const itemsContainer = document.getElementById('invoice-items-list');
        if (itemsContainer) {
            itemsContainer.innerHTML = '';
            
            if (!items || items.length === 0) {
                itemsContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #6c757d;">
                        لا توجد منتجات في هذه الفاتورة
                    </div>
                `;
                // Set totals to zero when no items
                document.getElementById('subtotal').textContent = db.formatCurrency(0);
                document.getElementById('tax').textContent = db.formatCurrency(0);
                document.getElementById('total').textContent = db.formatCurrency(0);
            } else {
                // Check if we have any valid items
                const validItems = items.filter(item => item && typeof item === 'object');
                if (validItems.length === 0) {
                    itemsContainer.innerHTML = `
                        <div style="text-align: center; padding: 20px; color: #6c757d;">
                            لا توجد منتجات صحيحة في هذه الفاتورة
                        </div>
                    `;
                    // Set totals to zero when no valid items
                    document.getElementById('subtotal').textContent = db.formatCurrency(0);
                    document.getElementById('tax').textContent = db.formatCurrency(0);
                    document.getElementById('total').textContent = db.formatCurrency(0);
                } else {
                items.forEach((item, index) => {
                    // Skip invalid items
                    if (!item || typeof item !== 'object') {
                        console.warn('Invalid item at index', index, ':', item);
                        return;
                    }
                    
                    const itemElement = document.createElement('div');
                    itemElement.className = 'invoice-item';
                    const quantity = parseInt(item.quantity) || 1;
                    
                    // Get price from database first, then fallback to hardcoded prices
                    let price = parseFloat(item.price) || 0;
                    if (price === 0) {
                        const productName = (item.name || '').toLowerCase();
                        
                        // Try to get price from database first
                        if (productPrices[productName]) {
                            price = productPrices[productName];
                            console.log(`Found price in database for ${productName}: ${price}`);
                        } else {
                            // Fallback to hardcoded prices if not found in database
                            if (productName.includes('loacker')) {
                                price = 5.00; // 5 ريال للحبة
                            } else if (productName.includes('almarai') || productName.includes('juice')) {
                                price = 8.50; // 8.50 ريال للحبة
                            } else if (productName.includes('water')) {
                                price = 2.00; // 2 ريال للحبة
                            } else if (productName.includes('chips') || productName.includes('snack')) {
                                price = 12.00; // 12 ريال للحبة
                            } else if (productName.includes('chocolate') || productName.includes('candy')) {
                                price = 5.00; // 5 ريال للحبة
                            } else if (productName.includes('bread') || productName.includes('toast')) {
                                price = 6.00; // 6 ريال للحبة
                            } else if (productName.includes('milk') || productName.includes('dairy')) {
                                price = 7.00; // 7 ريال للحبة
                            } else {
                                price = 10.00; // 10 ريال للحبة (سعر افتراضي)
                            }
                            console.log(`Using fallback price for ${productName}: ${price}`);
                        }
                    }
                    
                    const total = quantity * price;
                    
                    console.log('Processing item:', { item, quantity, price, total });
                    
                    itemElement.innerHTML = `
                        <div class="item-product">${item.name || 'منتج غير محدد'}</div>
                        <div class="item-quantity">${quantity}</div>
                        <div class="item-price">${db.formatCurrency(price)}</div>
                        <div class="item-total">${db.formatCurrency(total)}</div>
                    `;
                    itemsContainer.appendChild(itemElement);
                });
                }
            }
        }
        
        // Calculate totals only if we have valid items
        const validItems = items.filter(item => item && typeof item === 'object');
        const subtotal = validItems.reduce((sum, item) => {
            const quantity = parseInt(item.quantity) || 1;
            
            // Use same price logic as above (price per unit)
            let price = parseFloat(item.price) || 0;
            if (price === 0) {
                const productName = (item.name || '').toLowerCase();
                
                // Try to get price from database first
                if (productPrices[productName]) {
                    price = productPrices[productName];
                } else {
                    // Fallback to hardcoded prices if not found in database
                    if (productName.includes('loacker')) {
                        price = 5.00; // 5 ريال للحبة
                    } else if (productName.includes('almarai') || productName.includes('juice')) {
                        price = 8.50; // 8.50 ريال للحبة
                    } else if (productName.includes('water')) {
                        price = 2.00; // 2 ريال للحبة
                    } else if (productName.includes('chips') || productName.includes('snack')) {
                        price = 12.00; // 12 ريال للحبة
                    } else if (productName.includes('chocolate') || productName.includes('candy')) {
                        price = 5.00; // 5 ريال للحبة
                    } else if (productName.includes('bread') || productName.includes('toast')) {
                        price = 6.00; // 6 ريال للحبة
                    } else if (productName.includes('milk') || productName.includes('dairy')) {
                        price = 7.00; // 7 ريال للحبة
                    } else {
                        price = 10.00; // 10 ريال للحبة (سعر افتراضي)
                    }
                }
            }
            
            return sum + (quantity * price);
        }, 0);
        const tax = subtotal * 0.15; // 15% VAT
        const total = subtotal + tax;
        
        console.log('Calculated totals:', { subtotal, tax, total, validItems, totalItems: items.length });
        
        // Update summary
        document.getElementById('subtotal').textContent = db.formatCurrency(subtotal);
        document.getElementById('tax').textContent = db.formatCurrency(tax);
        document.getElementById('total').textContent = db.formatCurrency(total);
        
    } catch (error) {
        console.error('Error loading invoice:', error);
        showError('خطأ في تحميل الفاتورة');
    }
}

// Function to show default invoice
async function showDefaultInvoice() {
    console.log('Showing default invoice');
    
    try {
        // Get current user
        const currentUserStr = localStorage.getItem('current_user');
        const currentUser = JSON.parse(currentUserStr);
        
        // Get first invoice for current user
        const { data: invoices, error } = await db.supabase
            .from('invoices')
            .select('id')
            .eq('user_id', currentUser.id)
            .order('timestamp', { ascending: false })
            .limit(1);
        
        if (error || !invoices || invoices.length === 0) {
            showError('لا توجد فواتير متاحة');
            return;
        }
        
        // Show the most recent invoice
        await updateInvoiceDetails(invoices[0].id);
        
    } catch (error) {
        console.error('Error loading default invoice:', error);
        showError('خطأ في تحميل الفاتورة الافتراضية');
    }
}

// Function to show error message
function showError(message) {
    const mainCard = document.querySelector('.main-card');
    if (mainCard) {
        mainCard.innerHTML = `
            <h2 class="page-title">خطأ</h2>
            <div style="text-align: center; padding: 40px;">
                <p style="font-size: 18px; color: #ef4444;">${message}</p>
                <button class="btn btn-back" onclick="history.back()" style="margin-top: 20px;">رجوع</button>
            </div>
        `;
    }
}

// Print invoice function
function printInvoice() {
    console.log('Printing invoice');
    
    // Hide the back button and actions for printing
    const nav = document.querySelector('.nav');
    const actions = document.querySelector('.invoice-actions');
    
    if (nav) nav.style.display = 'none';
    if (actions) actions.style.display = 'none';
    
    // Print the page
    window.print();
    
    // Show elements back after printing
    setTimeout(() => {
        if (nav) nav.style.display = 'flex';
        if (actions) actions.style.display = 'flex';
    }, 1000);
}

// Download PDF function
function downloadPDF() {
    console.log('Downloading PDF');
    
    // In a real application, this would generate and download a PDF
    // Here you would typically:
    // 1. Generate PDF using a library like jsPDF
    // 2. Create a download link
    // 3. Trigger the download
}

// Share invoice function
function shareInvoice() {
    console.log('Sharing invoice');
    
    // Get current invoice ID
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('id');
    
    if (navigator.share) {
        // Use Web Share API if available
        navigator.share({
            title: `فاتورة دكان فيجين #${invoiceId}`,
            text: `عرض فاتورة دكان فيجين رقم ${invoiceId}`,
            url: window.location.href
        }).catch(console.error);
    } else {
        // Fallback: copy to clipboard
        const shareUrl = window.location.href;
        navigator.clipboard.writeText(shareUrl).then(() => {
            console.log('تم نسخ رابط الفاتورة إلى الحافظة');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            console.log('تم نسخ رابط الفاتورة إلى الحافظة');
        });
    }
}

// Back button function
function goBack() {
    if (document.referrer) {
        window.history.back();
    } else {
        // Fallback: go to invoices management page
        window.location.href = 'invoices-management.html';
    }
}

// File complaint function
function fileComplaint() {
    console.log('Filing complaint');
    
    // Get current invoice ID and date
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('id');
    const invoiceDate = document.getElementById('invoice-date').textContent;
    
    // Redirect to complaint page with invoice data
    window.location.href = `complaint.html?id=${invoiceId}&date=${invoiceDate}`;
}

// Export functions for global access
window.printInvoice = printInvoice;
window.downloadPDF = downloadPDF;
window.shareInvoice = shareInvoice;
window.goBack = goBack;
window.fileComplaint = fileComplaint;

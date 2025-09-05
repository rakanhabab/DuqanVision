// Inventory Management JavaScript with Database Integration
import { db } from '../js/database.js';

class InventoryService {
    constructor() {
        this.initializeInventory();
    }

    async initializeInventory() {
        try {
            // Load real data from database
            await Promise.all([
                this.loadInventoryData(),
                this.loadBranchesData()
            ]);
            
            // Initialize UI components
            this.initializeTableInteractions();
            this.initializeSearchAndFilter();
        } catch (error) {
            console.error('Error initializing inventory:', error);
        }
    }

    async loadBranchesData() {
        try {
            const branches = await db.getBranches();
            this.branches = branches || [];
            this.populateBranchDropdown();
        } catch (error) {
            console.error('Error loading branches data:', error);
            this.branches = [];
        }
    }

    populateBranchDropdown() {
        const branchSelect = document.getElementById('branchSelect');
        if (!branchSelect) return;

        // Clear existing options except "الكل"
        branchSelect.innerHTML = '<option value="">الكل</option>';

        // Sort branches by branch_num in ascending order
        const sortedBranches = [...this.branches].sort((a, b) => {
            const aNum = a.branch_num || '';
            const bNum = b.branch_num || '';
            return aNum.localeCompare(bNum);
        });

        // Add branch options
        sortedBranches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch.branch_num || branch.id;
            option.textContent = branch.branch_num || branch.name || `فرع ${branch.id}`;
            branchSelect.appendChild(option);
        });

        // Debug: Log branches for troubleshooting
        console.log('Available branches:', sortedBranches.map(b => ({ 
            id: b.id, 
            branch_num: b.branch_num, 
            name: b.name 
        })));
    }

    async loadInventoryData() {
        try {
            // Get products and all inventory data
            const [products, allInventoryData] = await Promise.all([
                db.getProducts(),
                db.getAllInventoryData() // Debug function
            ]);
            
            // Debug: Log raw data
            console.log('Raw products:', products);
            console.log('All inventory data:', allInventoryData);
            
            // Check if there are any BR003 entries in the raw data
            const br003Entries = allInventoryData.filter(item => item.branch_num === 'BR003');
            console.log('BR003 entries in raw inventory data:', br003Entries);
            
            // Build map product_id -> total quantity and branch quantities
            const idToInventory = new Map();
            
            // Group inventory data by product_id and calculate totals
            (allInventoryData || []).forEach(row => {
                if (row && row.product_id) {
                    const productId = row.product_id;
                    const quantity = Number(row.quantity) || 0;
                    const branchNum = row.branch_num || null;
                    
                    if (!idToInventory.has(productId)) {
                        idToInventory.set(productId, {
                            totalQuantity: 0,
                            branchQuantities: new Map(),
                            branches: []
                        });
                    }
                    
                    const inventory = idToInventory.get(productId);
                    inventory.totalQuantity += quantity;
                    inventory.branchQuantities.set(branchNum, quantity);
                    inventory.branches.push(branchNum);
                }
            });

            // Debug: Log inventory map
            console.log('Inventory map with totals:', Object.fromEntries(idToInventory));

            // Merge and sort by SKU
            this.inventoryData = (products || []).map(p => {
                const inventory = idToInventory.get(p.id) || { 
                    totalQuantity: 0, 
                    branchQuantities: new Map(), 
                    branches: [] 
                };
                return {
                    ...p,
                    quantity: inventory.totalQuantity, // Total quantity across all branches
                    branchQuantities: inventory.branchQuantities, // Quantities per branch
                    branches: inventory.branches, // List of branches
                    branch_num: null // Will be set during filtering
                };
            }).sort((a, b) => {
                const skuA = (a.id || '').toLowerCase();
                const skuB = (b.id || '').toLowerCase();
                return skuA.localeCompare(skuB);
            });
            
            // Debug: Log final inventory data
            console.log('Final inventory data with totals:', this.inventoryData.map(p => ({
                id: p.id,
                name: p.name,
                totalQuantity: p.quantity,
                branchQuantities: Object.fromEntries(p.branchQuantities),
                branches: p.branches
            })));
            
            // Debug: Check BR003 products specifically
            const br003Products = this.inventoryData.filter(p => p.branches.includes('BR003'));
            console.log('Products available in BR003:', br003Products);
            
            // Update UI with real data
            this.updateInventoryDisplay();
            
            if (!products || products.length === 0) {
                this.showNotification('لا توجد منتجات في قاعدة البيانات', 'info');
            }
        } catch (error) {
            console.error('Error loading inventory data:', error);
            this.showNotification('خطأ في تحميل البيانات من قاعدة البيانات', 'error');
        }
    }

    updateInventoryDisplay() {
        const tableBody = document.querySelector('.inventory-table tbody');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        // Sort inventory data by SKU (product.id) in ascending order
        const sortedData = [...this.inventoryData].sort((a, b) => {
            const skuA = (a.id || '').toLowerCase();
            const skuB = (b.id || '').toLowerCase();
            return skuA.localeCompare(skuB);
        });

        sortedData.forEach((product, index) => {
            const row = this.createProductRow(product, index);
            tableBody.appendChild(row);
        });

        this.initializeTableInteractions();
    }

    createProductRow(product, index) {
        const qty = Number(product.quantity) || 0;
        const statusInfo = this.calculateInventoryStatus(qty);
        const row = document.createElement('tr');
        
        row.setAttribute('data-product-id', product.id);
        
        row.innerHTML = `
            <td>${product.name || 'غير محدد'}</td>
            <td>${product.id || 'غير محدد'}</td>
            <td>${product.category || 'أخرى'}</td>
            <td>${product.shelf || 'غير محدد'}</td>
            <td>${db.formatCurrency(product.price || 0)}</td>
            <td>${qty}</td>
            <td>${this.createStatusBadge(statusInfo)}</td>
            <td><button class="edit-btn" onclick="editProduct('${product.id}')">تعديل</button></td>
        `;
        
        row.style.animationDelay = `${index * 0.1}s`;
        
        return row;
    }

    calculateInventoryStatus(quantity) {
        if (quantity === 0) {
            return { status: 'empty', text: 'نفذ', class: 'status-empty' };
        } else if (quantity <= 10) {
            return { status: 'low', text: 'منخفض', class: 'status-low' };
        } else if (quantity <= 50) {
            return { status: 'medium', text: 'متوسط', class: 'status-medium' };
        } else {
            return { status: 'high', text: 'متوفر', class: 'status-high' };
        }
    }

    createStatusBadge(statusInfo) {
        return `<span class="status-badge ${statusInfo.class}">
            <span class="status-dot"></span>${statusInfo.text}
        </span>`;
    }

    initializeTableInteractions() {
        // Add click event listeners to table rows
        const tableRows = document.querySelectorAll('.inventory-table tbody tr');
        tableRows.forEach(row => {
            row.addEventListener('click', (e) => {
                // Remove active class from all rows
                tableRows.forEach(r => r.classList.remove('active'));
                // Add active class to clicked row
                row.classList.add('active');
                
                // Get product details
                const productName = row.cells[0].textContent;
                const sku = row.cells[1].textContent;
                console.log('Selected product:', productName, 'SKU:', sku);
            });
        });

        // Add hover effects for table rows
        tableRows.forEach(row => {
            row.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f8fafc';
            });
            
            row.addEventListener('mouseleave', function() {
                if (!this.classList.contains('active')) {
                    this.style.backgroundColor = '';
                }
            });
        });
    }

    initializeSearchAndFilter() {
        const branchSelect = document.getElementById('branchSelect');
        const searchInput = document.getElementById('searchInput');
        
        if (!branchSelect || !searchInput) return;
        
        // Branch select change handler
        branchSelect.addEventListener('change', (e) => {
            const branchNum = e.target.value;
            const searchTerm = searchInput.value.trim();
            
            this.filterInventory(branchNum, searchTerm);
        });
        
        // Real-time search
        searchInput.addEventListener('input', (e) => {
            const branchNum = branchSelect.value;
            const searchTerm = e.target.value.trim();
            
            if (searchTerm.length >= 2 || searchTerm.length === 0) {
                this.filterInventory(branchNum, searchTerm);
            }
        });
    }

    filterInventory(branchNum, searchTerm) {
        const tableBody = document.querySelector('.inventory-table tbody');
        if (!tableBody) return;
        
        const rows = tableBody.querySelectorAll('tr');
        
        // Show loading state
        this.showLoadingState(true);
        
        // Debug: Log filtering parameters
        console.log('Filtering with:', { branchNum, searchTerm });
        
        // Simulate API call delay
        setTimeout(() => {
            let visibleCount = 0;
            
            rows.forEach(row => {
                const productName = row.cells[0].textContent.toLowerCase();
                const sku = row.cells[1].textContent.toLowerCase();
                const category = row.cells[2].textContent.toLowerCase();
                
                let shouldShow = true;
                let displayQuantity = 0;
                
                // Get the product data for this row
                const productId = row.getAttribute('data-product-id');
                const product = this.inventoryData.find(p => p.id === productId);
                
                if (product) {
                    // Branch filter (if provided)
                    if (branchNum) {
                        // Check if the product is available in the selected branch
                        shouldShow = product.branches.includes(branchNum);
                        
                        if (shouldShow) {
                            // Get quantity for this specific branch
                            displayQuantity = product.branchQuantities.get(branchNum) || 0;
                        }
                        
                        // Debug: Log product branch matching
                        console.log(`Product ${product.id} (${product.name}): branches=${product.branches}, selected=${branchNum}, shouldShow=${shouldShow}, branchQuantity=${displayQuantity}`);
                    } else {
                        // Show total quantity for all branches
                        displayQuantity = product.quantity;
                        console.log(`Product ${product.id} (${product.name}): totalQuantity=${displayQuantity}`);
                    }
                } else {
                    shouldShow = false;
                    console.log(`Product not found for row with data-product-id: ${productId}`);
                }
                
                // Search filter (if provided)
                if (shouldShow && searchTerm) {
                    shouldShow = productName.includes(searchTerm.toLowerCase()) || 
                               sku.includes(searchTerm.toLowerCase()) ||
                               category.includes(searchTerm.toLowerCase());
                }
                
                // Show/hide row with animation
                if (shouldShow) {
                    row.style.display = 'table-row';
                    row.classList.add('fade-in');
                    visibleCount++;
                    
                    // Update quantity display
                    const quantityCell = row.cells[5]; // Quantity column
                    if (quantityCell) {
                        quantityCell.textContent = displayQuantity;
                    }
                    
                    // Update status badge based on the displayed quantity
                    const statusCell = row.cells[6]; // Status column
                    if (statusCell) {
                        const statusInfo = this.calculateInventoryStatus(displayQuantity);
                        const newStatusBadge = this.createStatusBadge(statusInfo);
                        statusCell.innerHTML = newStatusBadge;
                        
                        // Debug: Log status update
                        console.log(`Updated status for ${product?.name || 'unknown'}: quantity=${displayQuantity}, status=${statusInfo.text}, color=${statusInfo.class}`);
                    } else {
                        console.log('Status cell not found for row');
                    }
                    
                    // Highlight search terms
                    if (searchTerm) {
                        this.highlightSearchTerms(row, searchTerm);
                    } else {
                        this.removeHighlights(row);
                    }
                } else {
                    row.style.display = 'none';
                    row.classList.remove('fade-in');
                    this.removeHighlights(row);
                }
            });
            
            // Show no results message if needed
            if (visibleCount === 0) {
                this.showNoResultsMessage();
            } else {
                this.hideNoResultsMessage();
            }
            
            // Hide loading state
            this.showLoadingState(false);
            
            // Show notification
            if (searchTerm || branchNum) {
                this.showNotification(`تم العثور على ${visibleCount} منتج`);
            }
            
        }, 500);
    }

    highlightSearchTerms(row, searchTerm) {
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
            const text = cell.textContent;
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            const highlightedText = text.replace(regex, '<span class="highlight">$1</span>');
            cell.innerHTML = highlightedText;
        });
    }

    removeHighlights(row) {
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
            const text = cell.textContent;
            cell.innerHTML = text;
        });
    }

    showLoadingState(show) {
        const tableBody = document.querySelector('.inventory-table tbody');
        if (!tableBody) return;
        
        if (show) {
            tableBody.style.opacity = '0.6';
            tableBody.style.pointerEvents = 'none';
        } else {
            tableBody.style.opacity = '1';
            tableBody.style.pointerEvents = 'auto';
        }
    }

    showNoResultsMessage() {
        let noResults = document.querySelector('.no-results-message');
        if (!noResults) {
            noResults = document.createElement('div');
            noResults.className = 'no-results-message';
            noResults.innerHTML = `
                <div class="no-results-content">
                    <i class="no-results-icon">🔍</i>
                    <h3>لا توجد نتائج</h3>
                    <p>جرب تغيير معايير البحث أو الفلترة</p>
                </div>
            `;
            document.querySelector('.inventory-table-section').appendChild(noResults);
        }
        noResults.style.display = 'block';
    }

    hideNoResultsMessage() {
        const noResults = document.querySelector('.no-results-message');
        if (noResults) {
            noResults.style.display = 'none';
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());
        
        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
        
        // Close button handler
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                notification.remove();
            });
        }
    }

    editProduct(productId) {
        // Find the product in the inventory data
        const product = this.inventoryData.find(item => item.id === productId);
        
        if (!product) {
            this.showNotification('لم يتم العثور على المنتج', 'error');
            return;
        }

        // Show edit modal
        this.showEditModal(product);
    }

    showEditModal(product) {
        // Remove existing modal
        const existingModal = document.querySelector('.edit-modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'edit-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="edit-modal">
                <div class="edit-modal-header">
                    <h3>تعديل المنتج: ${product.name}</h3>
                    <button class="modal-close" onclick="this.closest('.edit-modal-overlay').remove()">&times;</button>
                </div>
                <div class="edit-modal-body">
                    <form id="editProductForm">
                        <div class="form-group">
                            <label for="editProductName">اسم المنتج</label>
                            <input type="text" id="editProductName" value="${product.name}" required>
                        </div>
                                                 <div class="form-group">
                             <label for="editProductSku">SKU</label>
                             <input type="text" id="editProductSku" value="${product.id}" readonly>
                         </div>
                        <div class="form-group">
                            <label for="editProductCategory">الفئة</label>
                            <input type="text" id="editProductCategory" value="${product.category}" required>
                        </div>
                        <div class="form-group">
                            <label for="editProductShelf">الرف</label>
                            <input type="text" id="editProductShelf" value="${product.shelf}" required>
                        </div>
                        <div class="form-group">
                            <label for="editProductPrice">السعر</label>
                            <input type="number" id="editProductPrice" value="${product.price}" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label for="editProductQuantity">الكمية</label>
                            <input type="number" id="editProductQuantity" value="${product.quantity}" required>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="cancel-btn" onclick="this.closest('.edit-modal-overlay').remove()">إلغاء</button>
                            <button type="submit" class="save-btn">حفظ التغييرات</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.appendChild(modalOverlay);

        // Handle form submission
        const form = modalOverlay.querySelector('#editProductForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProductChanges(product.id, modalOverlay);
        });

        // Close modal when clicking overlay
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        });
    }

    async saveProductChanges(productId, modalOverlay) {
        try {
            const formData = {
                name: document.getElementById('editProductName').value,
                category: document.getElementById('editProductCategory').value,
                shelf: document.getElementById('editProductShelf').value,
                price: parseFloat(document.getElementById('editProductPrice').value),
                quantity: parseInt(document.getElementById('editProductQuantity').value)
            };

            // Update product in database
            const { error } = await db.supabase
                .from('products')
                .update({
                    name: formData.name,
                    category: formData.category,
                    price: formData.price
                })
                .eq('id', productId);

            if (error) {
                throw error;
            }

            // Update inventory quantity
            const { error: inventoryError } = await db.supabase
                .from('inventory')
                .update({ quantity: formData.quantity })
                .eq('product_id', productId);

            if (inventoryError) {
                throw inventoryError;
            }

            // Close modal
            modalOverlay.remove();

            // Show success message
            this.showNotification('تم حفظ التغييرات بنجاح', 'success');

            // Refresh inventory data
            await this.loadInventoryData();
            this.updateInventoryDisplay();

        } catch (error) {
            console.error('Error saving product changes:', error);
            this.showNotification('خطأ في حفظ التغييرات', 'error');
        }
    }
}

// Initialize inventory service when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.inventoryService = new InventoryService();
});

// Global function for edit button
window.editProduct = function(productId) {
    if (window.inventoryService) {
        window.inventoryService.editProduct(productId);
    }
};

// Global keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + F to focus search
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.focus();
        }
    }
    
    // Escape to clear filters
    if (event.key === 'Escape') {
        const branchSelect = document.getElementById('branchSelect');
        const searchInput = document.getElementById('searchInput');
        
        if (branchSelect && searchInput && (branchSelect.value || searchInput.value)) {
            branchSelect.value = '';
            searchInput.value = '';
            // Access the inventory service instance
            if (window.inventoryService) {
                window.inventoryService.filterInventory('', '');
            }
        }
    }
});


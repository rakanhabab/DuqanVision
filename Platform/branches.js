// Branches Management JavaScript with Database Integration
import { db } from './database.js';

class BranchesService {
    constructor() {
        this.initializeBranches();
    }

    async initializeBranches() {
        try {
            // Load real data from database
            await this.loadBranchesData();
            
            // Initialize UI components
            this.initializeBranchInteractions();
            // Remove modal/edit initialization since edit is disabled
        } catch (error) {
            console.error('Error initializing branches:', error);
        }
    }

    async loadBranchesData() {
        try {
            // Get branches from database
            const branches = await db.getBranches();
            
            // If no branches found, add sample data
            if (!branches || branches.length === 0) {
                console.log('📝 No branches found, adding sample data...');
                await this.addSampleBranches();
                this.branchesData = await db.getBranches();
            } else {
                this.branchesData = branches;
            }
            
            console.log('📋 Branches data loaded:', this.branchesData);
            
            // Update UI with real data
            this.updateBranchesDisplay();
        } catch (error) {
            console.error('Error loading branches data:', error);
        }
    }

    async addSampleBranches() {
        try {
            const sampleBranches = [
                {
                    name: 'فرع العليا',
                    address: 'طريق الملك فهد — حي العليا، الرياض',
                    lat: 24.6892013,
                    long: 46.6827285
                },
                {
                    name: 'فرع الياسمين',
                    address: 'طريق أنس بن مالك — حي الياسمين، الرياض',
                    lat: 24.7478125,
                    long: 46.7129375
                },
                {
                    name: 'فرع الملقا',
                    address: 'طريق عثمان بن عفان — حي الملقا، الرياض',
                    lat: 24.8053401,
                    long: 46.6095514
                }
            ];

            for (const branch of sampleBranches) {
                const { error } = await db.supabase
                    .from('branches')
                    .insert([branch]);
                
                if (error) {
                    console.error('Error adding sample branch:', error);
                } else {
                    console.log('✅ Added sample branch:', branch.name);
                }
            }
        } catch (error) {
            console.error('Error adding sample branches:', error);
        }
    }

    updateBranchesDisplay() {
        const branchesContainer = document.querySelector('#branchesGrid');
        if (!branchesContainer) return;

        // Clear existing content
        branchesContainer.innerHTML = '';

        if (!this.branchesData || this.branchesData.length === 0) {
            branchesContainer.innerHTML = `
                <div class="no-branches">
                    <p>لا توجد فروع متاحة</p>
                </div>
            `;
            return;
        }

        // Add real branches from database
        this.branchesData.forEach((branch, index) => {
            const branchCard = this.createBranchCard(branch, index);
            branchesContainer.appendChild(branchCard);
        });



        // Reinitialize interactions
        this.initializeBranchInteractions();
    }

    createBranchCard(branch, index) {
        const card = document.createElement('div');
        card.className = 'branch-card';
        card.dataset.branchId = branch.id;
        
        card.innerHTML = `
            <div class="branch-header">
                <h3>${branch.name || 'غير محدد'}</h3>
                <button class="edit-branch-btn" data-branch-id="${branch.id}">
                    تعديل
                </button>
            </div>
            <div class="branch-content">
                <div class="branch-location">
                    <span class="location-icon">📍</span>
                    <span>${branch.address || 'غير محدد'}</span>
                </div>
                <div class="branch-hours">
                    <div class="hours-row">
                        <span class="days">الأحد - الخميس:</span>
                        <span class="time">08:00-23:00</span>
                    </div>
                    <div class="hours-row">
                        <span class="days">الجمعة:</span>
                        <span class="time">16:00-23:00</span>
                    </div>
                </div>
                ${branch.lat && branch.long ? `
                <div class="branch-coordinates">
                    <span class="coord-label">الإحداثيات:</span>
                    <span class="coord-value">${branch.lat.toFixed(6)}, ${branch.long.toFixed(6)}</span>
                </div>
                <div class="branch-actions">
                    <button class="google-maps-btn" onclick="window.open('https://maps.google.com/?q=${branch.lat},${branch.long}', '_blank')" title="فتح في Google Maps">
                        <span class="maps-icon">🗺️</span>
                        فتح في الخريطة
                    </button>
                </div>` : ''}
            </div>
        `;
        
        // Add staggered animation
        card.style.animationDelay = `${index * 0.1}s`;
        
        return card;
    }

    initializeBranchInteractions() {
        // Add click event listeners to branch cards
        const branchCards = document.querySelectorAll('.branch-card');
        branchCards.forEach(card => {
            // Remove any existing event listeners first
            card.removeEventListener('click', this.handleCardClick);
            
            // Add new event listener
            card.addEventListener('click', this.handleCardClick.bind(this));
        });

        // Add hover effects for branch cards
        branchCards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                if (!this.classList.contains('active')) {
                    this.style.transform = 'translateY(-4px)';
                }
            });
            
            card.addEventListener('mouseleave', function() {
                if (!this.classList.contains('active')) {
                    this.style.transform = '';
                }
            });
        });

        // Add click event listeners to edit buttons
        const editButtons = document.querySelectorAll('.edit-branch-btn');
        editButtons.forEach(button => {
            // Remove any existing event listeners first
            button.removeEventListener('click', this.handleEditClick);
            
            // Create a bound function to avoid multiple listeners
            const boundHandler = this.handleEditClick.bind(this);
            button.addEventListener('click', boundHandler);
            
            // Store the bound handler for future removal
            button._editHandler = boundHandler;
        });
    }

    updateMapPins() {
        const mapPinsContainer = document.querySelector('.map-pins');
        if (!mapPinsContainer) return;

        // Clear existing pins
        mapPinsContainer.innerHTML = '';

        // Add pins for each branch from database
        this.branchesData.forEach(branch => {
            if (branch.lat && branch.long) {
                const pin = document.createElement('div');
                pin.className = 'map-pin';
                pin.setAttribute('data-branch', branch.id);
                pin.setAttribute('data-branch-name', branch.name);
                
                // Calculate position based on coordinates
                const lat = parseFloat(branch.lat);
                const long = parseFloat(branch.long);
                
                // Use fixed positions based on the map image
                // From the image: الملقا (northwest), الياسمين (northeast), العليا (south)
                let leftPercent, topPercent;
                
                if (branch.name === 'فرع الملقا') {
                    // الملقا في الشمال الغربي من الخريطة (وسط الخريطة)
                    leftPercent = 35;
                    topPercent = 35;
                } else if (branch.name === 'فرع الياسمين') {
                    // الياسمين في الشمال الشرقي من الخريطة (وسط الخريطة)
                    leftPercent = 65;
                    topPercent = 30;
                } else if (branch.name === 'فرع العليا') {
                    // العليا في الجنوب الشرقي من الخريطة (وسط الخريطة)
                    leftPercent = 60;
                    topPercent = 65;
                } else {
                    // للفروع الأخرى، استخدم حساب تقريبي
                    const minLat = 24.65;
                    const maxLat = 24.85;
                    const minLong = 46.55;
                    const maxLong = 46.75;
                    
                    const latPercent = ((lat - minLat) / (maxLat - minLat)) * 100;
                    const longPercent = ((long - minLong) / (maxLong - minLong)) * 100;
                    
                    leftPercent = longPercent;
                    topPercent = 100 - latPercent;
                }
                
                // Ensure pins stay within map bounds (very conservative limits)
                const clampedLeft = Math.max(15, Math.min(85, leftPercent));
                const clampedTop = Math.max(15, Math.min(85, topPercent));
                
                pin.style.left = `${clampedLeft}%`;
                pin.style.top = `${clampedTop}%`;
                
                pin.innerHTML = `
                    <div class="pin-icon">📍</div>
                    <div class="pin-label">${branch.name}</div>
                `;
                
                // Add debug info to console
                console.log(`📍 Pin for ${branch.name}:`, {
                    coordinates: `${lat}, ${long}`,
                    position: `${clampedLeft.toFixed(1)}%, ${clampedTop.toFixed(1)}%`,
                    method: branch.name.includes('الملقا') || branch.name.includes('الياسمين') || branch.name.includes('العليا') ? 'Fixed Position' : 'Calculated'
                });
                
                mapPinsContainer.appendChild(pin);
            }
        });


    }





    handleEditClick(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Check if modal is already open
        if (document.querySelector('.edit-modal-overlay')) {
            return;
        }
        
        const branchId = e.target.getAttribute('data-branch-id');
        this.showEditModal(branchId);
    }

    handleCardClick(e) {
        // Don't trigger if clicking on edit button or its children
        if (e.target.closest('.edit-branch-btn')) {
            return;
        }
        
        // Remove active class from all cards
        const allCards = document.querySelectorAll('.branch-card');
        allCards.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked card
        e.currentTarget.classList.add('active');
        
        // Get branch name
        const branchName = e.currentTarget.querySelector('h3').textContent;
        console.log('Selected branch:', branchName);
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #48bb78 0%, #38b2ac 100%);
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

    showEditModal(branchId) {
        // Check if modal is already open
        if (document.querySelector('.edit-modal-overlay')) {
            return;
        }
        
        const branch = this.branchesData.find(b => b.id === branchId);
        if (!branch) {
            this.showNotification('لم يتم العثور على الفرع');
            return;
        }

        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'edit-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="edit-modal">
                <div class="modal-header">
                    <h3>تعديل فرع ${branch.name}</h3>
                    <button class="close-modal-btn">✕</button>
                </div>
                <div class="modal-content">
                    <form id="editBranchForm">
                        <div class="form-group">
                            <label>اسم الفرع:</label>
                            <input type="text" id="branchName" value="${branch.name}" required>
                        </div>
                        <div class="form-group">
                            <label>العنوان:</label>
                            <input type="text" id="branchAddress" value="${branch.address || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>خط العرض (Latitude):</label>
                            <input type="number" id="branchLat" value="${branch.lat || ''}" step="0.000001" required>
                        </div>
                        <div class="form-group">
                            <label>خط الطول (Longitude):</label>
                            <input type="number" id="branchLong" value="${branch.long || ''}" step="0.000001" required>
                        </div>
                        <div class="form-group">
                            <label>أوقات العمل:</label>
                            <div class="hours-inputs">
                                <div class="hours-row">
                                    <span>الأحد - الخميس:</span>
                                    <input type="time" id="weekdayOpen" value="08:00">
                                    <span>إلى</span>
                                    <input type="time" id="weekdayClose" value="23:00">
                                </div>
                                <div class="hours-row">
                                    <span>الجمعة:</span>
                                    <input type="time" id="fridayOpen" value="16:00">
                                    <span>إلى</span>
                                    <input type="time" id="fridayClose" value="23:00">
                                </div>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-cancel">إلغاء</button>
                            <button type="submit" class="btn-save">حفظ التغييرات</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        // Add event listeners
        const closeBtn = modalOverlay.querySelector('.close-modal-btn');
        const cancelBtn = modalOverlay.querySelector('.btn-cancel');
        const form = modalOverlay.querySelector('#editBranchForm');

        closeBtn.addEventListener('click', () => this.closeEditModal(modalOverlay));
        cancelBtn.addEventListener('click', () => this.closeEditModal(modalOverlay));
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveBranchChanges(branchId, modalOverlay);
        });

        // Close modal when clicking overlay
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeEditModal(modalOverlay);
            }
        });
    }

    closeEditModal(modalOverlay) {
        if (!modalOverlay) return;
        
        modalOverlay.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => {
            if (modalOverlay && modalOverlay.parentNode) {
                modalOverlay.parentNode.removeChild(modalOverlay);
            }
        }, 300);
    }

    async saveBranchChanges(branchId, modalOverlay) {
        try {
            const form = modalOverlay.querySelector('#editBranchForm');
            const formData = {
                name: form.querySelector('#branchName').value.trim(),
                address: form.querySelector('#branchAddress').value.trim(),
                lat: parseFloat(form.querySelector('#branchLat').value),
                long: parseFloat(form.querySelector('#branchLong').value)
            };

            // Validate form data
            if (!formData.name || !formData.address || isNaN(formData.lat) || isNaN(formData.long)) {
                this.showNotification('يرجى ملء جميع الحقول المطلوبة');
                return;
            }

            // Update branch in database
            const { error } = await db.supabase
                .from('branches')
                .update(formData)
                .eq('id', branchId);

            if (error) {
                console.error('Error updating branch:', error);
                this.showNotification('حدث خطأ أثناء حفظ التغييرات');
                return;
            }

            // Update local data
            const branchIndex = this.branchesData.findIndex(b => b.id === branchId);
            if (branchIndex !== -1) {
                this.branchesData[branchIndex] = { ...this.branchesData[branchIndex], ...formData };
            }

            // Close modal and refresh display
            this.closeEditModal(modalOverlay);
            this.updateBranchesDisplay();
            this.showNotification('تم حفظ التغييرات بنجاح');

        } catch (error) {
            console.error('Error saving branch changes:', error);
            this.showNotification('حدث خطأ أثناء حفظ التغييرات');
        }
    }
}

// Initialize branches when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.branchesService = new BranchesService();
});

// Styles keep as before for active/hover states
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
    
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    
    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
    
    .branch-card.active {
        transform: translateY(-4px);
        box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
        border: 2px solid #667eea;
    }
    
    .map-pin.active .pin-icon {
        color: #667eea;
        animation: bounce 0.6s ease;
    }
    
    .map-pin.active .pin-label {
        background: rgba(102, 126, 234, 0.9);
    }
    
    /* Edit Button Styles */
    .branch-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }
    
    .branch-card {
        padding: 15px;
        margin-bottom: 15px;
        display: flex;
        flex-direction: column;
        min-height: 200px;
        justify-content: space-between;
    }
    
    .branch-card h3 {
        font-size: 1.1rem;
        margin: 0;
    }
    
    .branch-content {
        font-size: 0.9rem;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    
    .branch-location {
        margin-bottom: 10px;
    }
    
    .branch-hours {
        margin-bottom: 10px;
    }
    
    .hours-row {
        margin-bottom: 5px;
    }
    
    .branch-coordinates {
        font-size: 0.8rem;
        color: #666;
    }
    
    /* Grid Layout for Cards */
    #branchesGrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
        padding: 20px;
    }
    
    .branch-card {
        background: white;
        border-radius: 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
        border: 1px solid #e5e7eb;
    }
    
    .edit-branch-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-family: 'Cairo', sans-serif;
        font-size: 0.9rem;
        font-weight: 600;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        align-self: flex-end;
        margin-top: auto;
    }
    
    .edit-branch-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    /* Modal Styles */
    .edit-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease-out;
    }
    
    .edit-modal {
        background: white;
        border-radius: 0 20px 20px 0;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        width: 90%;
        max-width: 500px;
        height: auto;
        overflow: visible;
        font-family: 'Cairo', sans-serif;
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 15px;
        border-bottom: 1px solid #e5e7eb;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 0 20px 0 0;
    }
    
    .modal-header h3 {
        margin: 0;
        font-size: 0.9rem;
    }
    
    .close-modal-btn {
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.3s ease;
    }
    
    .close-modal-btn:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    
    .modal-content {
        padding: 12px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }
    
    .form-group {
        margin-bottom: 8px;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        color: #374151;
        font-size: 0.95rem;
    }
    
    .form-group input {
        width: 100%;
        padding: 6px 8px;
        border: 2px solid #e5e7eb;
        border-radius: 6px;
        font-family: 'Cairo', sans-serif;
        font-size: 0.8rem;
        transition: border-color 0.3s ease;
        box-sizing: border-box;
    }
    
    .form-group input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    .hours-inputs {
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        padding: 6px;
        background: #f9fafb;
        grid-column: 1 / -1;
    }
    
    .hours-inputs .hours-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
        justify-content: space-between;
    }
    
    .hours-inputs .hours-row:last-child {
        margin-bottom: 0;
    }
    
    .hours-inputs .hours-row span {
        font-weight: 600;
        color: #374151;
        min-width: 120px;
    }
    
    .hours-inputs .hours-row input {
        width: 120px;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-family: 'Cairo', sans-serif;
        text-align: center;
    }
    
    .form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 15px;
        padding-top: 10px;
        border-top: 1px solid #e5e7eb;
        grid-column: 1 / -1;
    }
    
    .btn-cancel, .btn-save {
        padding: 5px 10px;
        border: none;
        border-radius: 6px;
        font-family: 'Cairo', sans-serif;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 0.75rem;
    }
    
    .btn-cancel {
        background: #f3f4f6;
        color: #374151;
        border: 2px solid #d1d5db;
    }
    
    .btn-cancel:hover {
        background: #e5e7eb;
        border-color: #9ca3af;
    }
    
    .btn-save {
        background: linear-gradient(135deg, #48bb78 0%, #38b2ac 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(72, 187, 120, 0.3);
    }
    
    .btn-save:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
    }
    
    /* Responsive Design */
    @media (max-width: 768px) {
        #branchesGrid {
            grid-template-columns: 1fr;
            gap: 15px;
            padding: 15px;
        }
        
        .branch-card {
            min-height: 180px;
        }
        
        .edit-modal {
            width: 95%;
            max-width: 350px;
            margin: 20px;
        }
        
        .modal-content {
            padding: 15px;
            grid-template-columns: 1fr;
            gap: 10px;
        }
        
        .hours-inputs .hours-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
        }
        
        .hours-inputs .hours-row input {
            width: 100%;
        }
        
        .form-actions {
            flex-direction: column;
        }
        
        .btn-cancel, .btn-save {
            width: 100%;
        }
    }
`;
document.head.appendChild(style);

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + M to focus on map
    if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
        event.preventDefault();
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.scrollIntoView({ behavior: 'smooth' });
        }
    }
});

// Export for potential use
window.branchesModule = {
    showNotification: (message) => {
        const branchesService = window.branchesService;
        if (branchesService) {
            branchesService.showNotification(message);
        }
    },
    highlightBranchOnMap: (branchId) => {
        const branchesService = window.branchesService;
        if (branchesService) {
            branchesService.highlightBranchOnMap(branchId);
        }
    }
};

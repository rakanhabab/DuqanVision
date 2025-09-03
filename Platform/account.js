import { db } from './database.js';

class AccountService {
    constructor() {
        this.form = document.getElementById('accountForm');
        this.paymentForm = document.getElementById('paymentForm');
        this.saveBtn = document.getElementById('saveBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.applyBtn = document.getElementById('applyBtn');
        this.savePaymentBtn = document.getElementById('savePaymentBtn');
        this.cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
        this.applyPaymentBtn = document.getElementById('applyPaymentBtn');
        this.inputs = Array.from(this.form.querySelectorAll('input'));
        this.paymentInputs = Array.from(this.paymentForm.querySelectorAll('input, select'));
        this.userData = null;
        this.paymentData = null;
        this.isEditing = false;
        this.isPaymentEditing = false;
        
        this.init();
    }

    async init() {
        await this.loadUserData();
        await this.loadPaymentData();
        this.setupEventListeners();
        this.setupPaymentEventListeners();
        this.setEditing(false);
        this.setPaymentEditing(false);
    }

    async loadUserData() {
        try {
            // Get current user from localStorage first
            const currentUserStr = localStorage.getItem('current_user');
            if (!currentUserStr) {
                this.showNotification('يرجى تسجيل الدخول أولاً', 'error');
                window.location.href = 'login.html';
                return;
            }

            const currentUser = JSON.parse(currentUserStr);
            
            // Set user ID in database service
            db.setCurrentUser(currentUser.id);
            
            // Get user data from database
            this.userData = await db.getCurrentUser();
            
            if (!this.userData) {
                // If user doesn't exist in database, use localStorage data
                this.userData = {
                    id: currentUser.id,
                    first_name: currentUser.first_name || '',
                    last_name: currentUser.last_name || '',
                    email: currentUser.email || '',
                    phone: currentUser.phone || '',
                    city: currentUser.city || '',
                    birthdate: currentUser.birthdate || null
                };
            }

            this.populateForm();
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showNotification('خطأ في تحميل بيانات المستخدم', 'error');
        }
    }

    async loadPaymentData() {
        try {
            // Get payment data from localStorage
            const paymentDataStr = localStorage.getItem('payment_data');
            if (paymentDataStr) {
                this.paymentData = JSON.parse(paymentDataStr);
            } else {
                // Initialize empty payment data
                this.paymentData = {
                    cardHolderName: '',
                    cardNumber: '',
                    expiryDate: '',
                    cvv: ''
                };
            }
            this.populatePaymentForm();
        } catch (error) {
            console.error('Error loading payment data:', error);
            this.showNotification('خطأ في تحميل بيانات الدفع', 'error');
        }
    }

    populateForm() {
        if (!this.userData) return;

        const fieldMappings = {
            'firstName': 'first_name',
            'lastName': 'last_name',
            'email': 'email',
            'phone': 'phone',
            'city': 'city',
            'birthdate': 'birthdate'
        };

        for (const [formField, dbField] of Object.entries(fieldMappings)) {
            const element = document.getElementById(formField);
            if (element) {
                // Set value even if it's empty to clear any previous data
                element.value = this.userData[dbField] || '';
            }
        }
    }

    populatePaymentForm() {
        if (!this.paymentData) return;

        const fieldMappings = {
            'cardHolderName': 'cardHolderName',
            'cardNumber': 'cardNumber',
            'expiryDate': 'expiryDate',
            'cvv': 'cvv'
        };

        for (const [formField, dataField] of Object.entries(fieldMappings)) {
            const element = document.getElementById(formField);
            if (element) {
                element.value = this.paymentData[dataField] || '';
            }
        }
    }

    setupEventListeners() {
        if (this.applyBtn) {
            this.applyBtn.addEventListener('click', () => this.setEditing(true));
        }

        this.cancelBtn.addEventListener('click', () => {
            this.populateForm();
            this.clearPasswordFields();
            this.setEditing(false);
            this.showNotification('تم إلغاء التغييرات', 'info');
        });

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUserData();
        });
    }

    setupPaymentEventListeners() {
        if (this.applyPaymentBtn) {
            this.applyPaymentBtn.addEventListener('click', () => this.setPaymentEditing(true));
        }

        this.cancelPaymentBtn.addEventListener('click', () => {
            this.populatePaymentForm();
            this.setPaymentEditing(false);
            this.showNotification('تم إلغاء تغييرات الدفع', 'info');
        });

        this.paymentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePaymentData();
        });

        // Card number formatting
        const cardNumberInput = document.getElementById('cardNumber');
        if (cardNumberInput) {
            cardNumberInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
                value = value.replace(/(\d{4})/g, '$1 ').trim();
                e.target.value = value;
            });
        }

        // Expiry year formatting
        const expiryInput = document.getElementById('expiryDate');
        if (expiryInput) {
            expiryInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                // Limit to 4 digits
                value = value.substring(0, 4);
                e.target.value = value;
            });
        }

        // CVV validation
        const cvvInput = document.getElementById('cvv');
        if (cvvInput) {
            cvvInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '');
            });
        }
    }

    setEditing(editing) {
        this.isEditing = editing;
        this.inputs.forEach(input => {
            input.disabled = !editing;
        });
        
        this.saveBtn.disabled = !editing;
        this.cancelBtn.disabled = !editing;
        
        if (this.applyBtn) {
            this.applyBtn.disabled = editing;
        }

        // إضافة تأثيرات بصرية
        if (editing) {
            this.form.classList.add('editing');
            this.showNotification('يمكنك الآن تعديل البيانات', 'info');
        } else {
            this.form.classList.remove('editing');
        }
    }

    setPaymentEditing(editing) {
        this.isPaymentEditing = editing;
        this.paymentInputs.forEach(input => {
            input.disabled = !editing;
        });
        
        this.savePaymentBtn.disabled = !editing;
        this.cancelPaymentBtn.disabled = !editing;
        
        if (this.applyPaymentBtn) {
            this.applyPaymentBtn.disabled = editing;
        }

        // إضافة تأثيرات بصرية
        if (editing) {
            this.paymentForm.classList.add('editing');
            this.showNotification('يمكنك الآن تعديل بيانات الدفع', 'info');
        } else {
            this.paymentForm.classList.remove('editing');
        }
    }

    clearPasswordFields() {
        document.getElementById('password').value = '';
        document.getElementById('confirmPassword').value = '';
    }

    validatePassword() {
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password && password !== confirmPassword) {
            this.showNotification('كلمة المرور وتأكيد كلمة المرور غير متطابقين', 'error');
            return false;
        }

        if (password && password.length < 6) {
            this.showNotification('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
            return false;
        }

        return true;
    }

    validatePaymentData() {
        const cardHolderName = document.getElementById('cardHolderName').value.trim();
        const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
        const expiryDate = document.getElementById('expiryDate').value;
        const cvv = document.getElementById('cvv').value;

        if (!cardHolderName) {
            this.showNotification('يرجى إدخال اسم حامل البطاقة', 'error');
            return false;
        }

        if (cardNumber.length < 13 || cardNumber.length > 19) {
            this.showNotification('رقم البطاقة غير صحيح', 'error');
            return false;
        }

        if (!expiryDate || !/^\d{4}$/.test(expiryDate)) {
            this.showNotification('سنة انتهاء الصلاحية غير صحيحة', 'error');
            return false;
        }

        const currentYear = new Date().getFullYear();
        const expiryYear = parseInt(expiryDate);
        if (expiryYear < currentYear) {
            this.showNotification('سنة انتهاء الصلاحية يجب أن تكون في المستقبل', 'error');
            return false;
        }

        if (cvv.length < 3 || cvv.length > 4) {
            this.showNotification('رمز الأمان غير صحيح', 'error');
            return false;
        }

        return true;
    }

    async saveUserData() {
        if (!this.validatePassword()) {
            return;
        }

        // إظهار حالة التحميل
        this.saveBtn.disabled = true;
        this.saveBtn.textContent = 'جاري الحفظ...';

        try {
            const formData = {};
            this.inputs.forEach(input => {
                if (input.id === 'password' || input.id === 'confirmPassword') {
                    if (input.value) {
                        formData.password = input.value;
                    }
                } else {
                    formData[input.id] = input.value;
                }
            });

            // التحقق من البيانات المطلوبة
            if (!formData.firstName || !formData.lastName || !formData.email) {
                this.showNotification('يرجى ملء الحقول المطلوبة', 'error');
                return;
            }

            // Map form fields to database fields
            const userData = {
                first_name: formData.firstName,
                last_name: formData.lastName,
                email: formData.email,
                phone: formData.phone,
                city: formData.city,
                birthdate: formData.birthdate
            };

            // Update user in database
            const updatedUser = await db.updateUser(userData);
            
            if (updatedUser) {
                this.userData = updatedUser;
                
                // Update localStorage with new user data
                const currentUserStr = localStorage.getItem('current_user');
                if (currentUserStr) {
                    const currentUser = JSON.parse(currentUserStr);
                    const updatedLocalUser = { ...currentUser, ...userData };
                    localStorage.setItem('current_user', JSON.stringify(updatedLocalUser));
                }
                
                this.showNotification('تم حفظ البيانات بنجاح', 'success');
                this.clearPasswordFields();
                this.setEditing(false);
            } else {
                this.showNotification('خطأ في حفظ البيانات', 'error');
            }
        } catch (error) {
            console.error('Error saving user data:', error);
            this.showNotification('خطأ في حفظ البيانات', 'error');
        } finally {
            // إعادة تفعيل الزر
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = 'حفظ التغييرات';
        }
    }

    async savePaymentData() {
        if (!this.validatePaymentData()) {
            return;
        }

        // إظهار حالة التحميل
        this.savePaymentBtn.disabled = true;
        this.savePaymentBtn.textContent = 'جاري الحفظ...';

        try {
            const paymentData = {
                cardHolderName: document.getElementById('cardHolderName').value.trim(),
                cardNumber: document.getElementById('cardNumber').value.replace(/\s/g, ''),
                expiryDate: document.getElementById('expiryDate').value,
                cvv: document.getElementById('cvv').value
            };

            // Save to localStorage (in real app, this would be encrypted and sent to server)
            localStorage.setItem('payment_data', JSON.stringify(paymentData));
            this.paymentData = paymentData;

            this.showNotification('تم حفظ بيانات الدفع بنجاح', 'success');
            this.setPaymentEditing(false);
        } catch (error) {
            console.error('Error saving payment data:', error);
            this.showNotification('خطأ في حفظ بيانات الدفع', 'error');
        } finally {
            // إعادة تفعيل الزر
            this.savePaymentBtn.disabled = false;
            this.savePaymentBtn.textContent = 'حفظ معلومات الدفع';
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;

        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        // Add to page
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize account service when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AccountService();
});



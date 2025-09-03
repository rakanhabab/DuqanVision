// ===== PAYMENT SYSTEM WITH DATABASE INTEGRATION =====
import { db } from './database.js'

class PaymentService {
    constructor() {
        this.currentInvoice = null
        this.setupEventListeners()
        this.init()
    }

    async init() {
        await this.loadPaymentMethods()
        this.setupPaymentForm()
    }

    setupEventListeners() {
        // Add payment method form
        const addPaymentForm = document.getElementById('add-payment-form')
        if (addPaymentForm) {
            addPaymentForm.addEventListener('submit', this.handleAddPaymentMethod.bind(this))
        }

        // Payment method selection
        const paymentMethodsContainer = document.getElementById('payment-methods-container')
        if (paymentMethodsContainer) {
            paymentMethodsContainer.addEventListener('click', this.handlePaymentMethodAction.bind(this))
        }
    }

    async loadPaymentMethods() {
        try {
            // Get current user from localStorage
            const currentUserStr = localStorage.getItem('current_user');
            if (!currentUserStr) {
                this.showError('يرجى تسجيل الدخول أولاً');
                return;
            }

            const currentUser = JSON.parse(currentUserStr);
            
            // Get payment methods for current user
            const { data: methods, error } = await db.supabase
                .from('payment_methods')
                .select('*')
                .eq('user_id', currentUser.id)
                .eq('is_deleted', false)
                .order('is_default', { ascending: false });

            if (error) {
                console.error('Error loading payment methods:', error);
                this.showError('خطأ في تحميل طرق الدفع');
                return;
            }

            this.displayPaymentMethods(methods || []);
        } catch (error) {
            console.error('Error loading payment methods:', error);
            this.showError('خطأ في تحميل طرق الدفع');
        }
    }

    displayPaymentMethods(methods) {
        const container = document.getElementById('payment-methods-container')
        if (!container) return

        if (methods.length === 0) {
            container.innerHTML = `
                <div class="no-payment-methods">
                    <p>لا توجد طرق دفع محفوظة</p>
                    <button onclick="showAddPaymentForm()" class="btn btn-primary">إضافة طريقة دفع</button>
                </div>
            `
            return
        }

        container.innerHTML = methods.map(method => `
            <div class="payment-method-card" data-id="${method.id}">
                <div class="card-info">
                    <div class="card-number">**** **** **** ${method.card_number.slice(-4)}</div>
                    <div class="card-holder">${method.card_holder_name}</div>
                    <div class="card-expiry">${method.expiry_month}/${method.expiry_year}</div>
                    ${method.is_default ? '<span class="default-badge">افتراضي</span>' : ''}
                </div>
                <div class="card-actions">
                    <button class="btn btn-select" onclick="selectPaymentMethod('${method.id}')">اختر</button>
                    <button class="btn btn-delete" onclick="deletePaymentMethod('${method.id}')">حذف</button>
                </div>
            </div>
        `).join('')
    }

    async handleAddPaymentMethod(event) {
        event.preventDefault()
        
        const formData = new FormData(event.target)
        const paymentData = {
            card_number: formData.get('card_number'),
            card_holder_name: formData.get('card_holder_name'),
            expiry_month: parseInt(formData.get('expiry_month')),
            expiry_year: parseInt(formData.get('expiry_year')),
            cvv: formData.get('cvv')
        }

        // Validate payment data
        const errors = this.validatePaymentData(paymentData)
        if (errors.length > 0) {
            this.showError(errors.join(', '))
            return
        }

        try {
            // Get current user from localStorage
            const currentUserStr = localStorage.getItem('current_user');
            if (!currentUserStr) {
                this.showError('يرجى تسجيل الدخول أولاً');
                return;
            }

            const currentUser = JSON.parse(currentUserStr);
            
            // Add payment method to database
            const { data: newMethod, error } = await db.supabase
                .from('payment_methods')
                .insert([{
                    user_id: currentUser.id,
                    ...paymentData,
                    is_default: false,
                    is_deleted: false
                }])
                .select();

            if (error) {
                console.error('Error adding payment method:', error);
                this.showError('فشل في إضافة طريقة الدفع');
                return;
            }

            if (newMethod && newMethod.length > 0) {
                this.showSuccess('تم إضافة طريقة الدفع بنجاح!');
                event.target.reset();
                await this.loadPaymentMethods();
            } else {
                this.showError('فشل في إضافة طريقة الدفع');
            }
        } catch (error) {
            console.error('Error adding payment method:', error);
            this.showError('حدث خطأ في إضافة طريقة الدفع');
        }
    }

    async handlePaymentMethodAction(event) {
        const target = event.target
        
        if (target.classList.contains('btn-select')) {
            const methodId = target.closest('.payment-method-card').dataset.id
            await this.selectPaymentMethod(methodId)
        } else if (target.classList.contains('btn-delete')) {
            const methodId = target.closest('.payment-method-card').dataset.id
            await this.deletePaymentMethod(methodId)
        }
    }

    async selectPaymentMethod(methodId) {
        try {
            // Store selected payment method
            this.selectedPaymentMethod = methodId
            this.showSuccess('تم اختيار طريقة الدفع')
            
            // Update UI to show selected method
            document.querySelectorAll('.payment-method-card').forEach(card => {
                card.classList.remove('selected')
            })
            document.querySelector(`[data-id="${methodId}"]`).classList.add('selected')
            
        } catch (error) {
            console.error('Error selecting payment method:', error)
            this.showError('خطأ في اختيار طريقة الدفع')
        }
    }

    async deletePaymentMethod(methodId) {
        if (!confirm('هل أنت متأكد من حذف طريقة الدفع هذه؟')) {
            return
        }

        try {
            // Soft delete payment method
            const { error } = await db.supabase
                .from('payment_methods')
                .update({ is_deleted: true })
                .eq('id', methodId);

            if (error) {
                console.error('Error deleting payment method:', error);
                this.showError('فشل في حذف طريقة الدفع');
                return;
            }

            this.showSuccess('تم حذف طريقة الدفع');
            await this.loadPaymentMethods();
        } catch (error) {
            console.error('Error deleting payment method:', error);
            this.showError('حدث خطأ في حذف طريقة الدفع');
        }
    }

    async processPayment(invoiceId, amount) {
        if (!this.selectedPaymentMethod) {
            this.showError('يرجى اختيار طريقة دفع')
            return
        }

        try {
            // Simulate payment processing
            this.showSuccess('جاري معالجة الدفع...')
            
            // Update invoice status to paid
            const { data: updatedInvoice, error } = await db.supabase
                .from('invoices')
                .update({ status: 'paid' })
                .eq('id', invoiceId)
                .select();
            
            if (error) {
                console.error('Error updating invoice:', error);
                this.showError('فشل في معالجة الدفع');
                return;
            }
            
            if (updatedInvoice && updatedInvoice.length > 0) {
                this.showSuccess('تم الدفع بنجاح!')
                setTimeout(() => {
                    window.location.href = 'user.html'
                }, 2000)
            } else {
                this.showError('فشل في معالجة الدفع')
            }
        } catch (error) {
            console.error('Error processing payment:', error)
            this.showError('حدث خطأ في معالجة الدفع')
        }
    }

    setupPaymentForm() {
        const form = document.getElementById('add-payment-form')
        if (!form) return

        // Add card number formatting
        const cardNumberInput = form.querySelector('input[name="card_number"]')
        if (cardNumberInput) {
            cardNumberInput.addEventListener('input', this.formatCardNumber.bind(this))
        }

        // Add expiry date formatting
        const expiryMonthInput = form.querySelector('input[name="expiry_month"]')
        const expiryYearInput = form.querySelector('input[name="expiry_year"]')
        
        if (expiryMonthInput) {
            expiryMonthInput.addEventListener('input', this.formatExpiryMonth.bind(this))
        }
        
        if (expiryYearInput) {
            expiryYearInput.addEventListener('input', this.formatExpiryYear.bind(this))
        }
    }

    formatCardNumber(event) {
        let value = event.target.value.replace(/\D/g, '')
        value = value.replace(/(\d{4})(?=\d)/g, '$1 ')
        event.target.value = value.substring(0, 19)
    }

    formatExpiryMonth(event) {
        let value = event.target.value.replace(/\D/g, '')
        if (value > 12) value = 12
        event.target.value = value
    }

    formatExpiryYear(event) {
        let value = event.target.value.replace(/\D/g, '')
        if (value.length === 2) {
            const currentYear = new Date().getFullYear().toString().slice(-2)
            if (value < currentYear) {
                value = currentYear
            }
        }
        event.target.value = value
    }

    validatePaymentData(data) {
        const errors = []

        if (!data.card_number || data.card_number.replace(/\s/g, '').length < 16) {
            errors.push('رقم البطاقة غير صحيح')
        }

        if (!data.card_holder_name || data.card_holder_name.length < 3) {
            errors.push('اسم حامل البطاقة غير صحيح')
        }

        if (!data.expiry_month || data.expiry_month < 1 || data.expiry_month > 12) {
            errors.push('شهر انتهاء الصلاحية غير صحيح')
        }

        if (!data.expiry_year || data.expiry_year < new Date().getFullYear()) {
            errors.push('سنة انتهاء الصلاحية غير صحيحة')
        }

        if (!data.cvv || data.cvv.length < 3) {
            errors.push('رمز الأمان غير صحيح')
        }

        return errors
    }

    showSuccess(message) {
        this.showMessage(message, 'success')
    }

    showError(message) {
        this.showMessage(message, 'error')
    }

    showMessage(message, type) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message')
        existingMessages.forEach(msg => msg.remove())

        // Create new message
        const messageDiv = document.createElement('div')
        messageDiv.className = `message ${type}`
        messageDiv.textContent = message

        // Add to page
        const container = document.querySelector('.payment-container') || document.body
        container.appendChild(messageDiv)

        // Auto remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove()
        }, 5000)
    }
}

// Initialize payment service when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PaymentService()
})

// Global functions for HTML onclick handlers
window.selectPaymentMethod = function(methodId) {
    // This will be handled by the PaymentService class
}

window.deletePaymentMethod = function(methodId) {
    // This will be handled by the PaymentService class
}

window.processPayment = function(invoiceId, amount) {
    // This will be handled by the PaymentService class
}

// Export for potential use in other modules
export { PaymentService }

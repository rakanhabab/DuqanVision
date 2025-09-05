// ===== AUTHENTICATION WITH DATABASE INTEGRATION =====
import { db } from './database.js'

class AuthService {
    constructor() {
        this.setupEventListeners()
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginFormElement')
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this))
        }

        // Signup form
        const signupForm = document.getElementById('signupFormElement')
        if (signupForm) {
            signupForm.addEventListener('submit', this.handleSignup.bind(this))
        }

        // Password toggle
        const passwordToggles = document.querySelectorAll('.password-toggle')
        passwordToggles.forEach(toggle => {
            toggle.addEventListener('click', this.togglePassword.bind(this))
        })
    }

    async handleLogin(event) {
        event.preventDefault()
        
        // Get form data from input fields
        const email = document.getElementById('loginEmail')?.value?.trim()
        const password = document.getElementById('loginPassword')?.value?.trim()

        if (!email || !password) {
            this.showError('يرجى ملء جميع الحقول')
            return
        }

        try {
            // Get user from database by email
            const { data: user, error } = await db.supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single()
            
            if (error || !user) {
                this.showError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
                return
            }

            // Simple password check (stored in plaintext currently)
            // TODO: Replace with secure hashing (e.g., bcrypt) on both signup and login
            if (String(user.password || '').trim() !== password) {
                this.showError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
                return
            }

            this.showSuccess('تم تسجيل الدخول بنجاح!')
            
            // Store user info in localStorage for session management
            localStorage.setItem('current_user', JSON.stringify(user))
            
            // Check if user is admin and redirect accordingly
            const isAdmin = user.email?.includes('admin') || user.role === 'admin' || user.is_admin === true;
            
            // Store admin status in localStorage
            if (isAdmin) {
                localStorage.setItem('twq_is_admin', 'true')
            }
            
            setTimeout(() => {
                if (isAdmin) {
                    window.location.href = '../admin/dashboard.html'
                } else {
                    window.location.href = '../user.html'
                }
            }, 1500)
            
        } catch (error) {
            console.error('Login error:', error)
            this.showError('حدث خطأ في تسجيل الدخول')
        }
    }

    async handleSignup(event) {
        event.preventDefault()
        
        // Get form data from input fields
        const firstName = document.getElementById('signupFirst')?.value?.trim()
        const lastName = document.getElementById('signupLast')?.value?.trim()
        const email = document.getElementById('signupEmail')?.value?.trim()
        const password = document.getElementById('signupPassword')?.value?.trim()
        const confirmPassword = document.getElementById('signupConfirm')?.value?.trim()
        const agreeTerms = document.getElementById('agreeTerms')?.checked

        // Validate form data
        if (!firstName || !lastName || !email || !password || !confirmPassword) {
            this.showError('يرجى ملء جميع الحقول')
            return
        }

        if (password !== confirmPassword) {
            this.showError('كلمة المرور غير متطابقة')
            return
        }

        if (!agreeTerms) {
            this.showError('يجب الموافقة على الشروط والأحكام')
            return
        }

        try {
            // Check if user already exists
            const { data: existingUser } = await db.supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .single()

            if (existingUser) {
                this.showError('البريد الإلكتروني مستخدم بالفعل')
                return
            }

            // Create new user
            const { data: newUser, error } = await db.supabase
                .from('users')
                .insert([{
                    email: email,
                    first_name: firstName,
                    last_name: lastName,
                    password: password, // In real app, hash this
                    phone: '+966501234567', // Default phone
                    city: 'الرياض', // Default city
                    is_admin: false,
                    num_visits: 0,
                    owed_balance: 0
                }])
                .select()
            
            if (error) {
                console.error('Error creating user:', error)
                this.showError('فشل في إنشاء الحساب')
                return
            }

            if (newUser && newUser.length > 0) {
                this.showSuccess('تم إنشاء الحساب بنجاح!')
                
                // Store user info in localStorage
                localStorage.setItem('current_user', JSON.stringify(newUser[0]))
                
                setTimeout(() => {
                    window.location.href = 'user.html'
                }, 1500)
            } else {
                this.showError('فشل في إنشاء الحساب')
            }
        } catch (error) {
            console.error('Signup error:', error)
            this.showError('حدث خطأ في إنشاء الحساب')
        }
    }

    togglePassword(event) {
        const button = event.currentTarget
        const input = button.previousElementSibling
        
        if (input.type === 'password') {
            input.type = 'text'
            button.textContent = 'إخفاء'
        } else {
            input.type = 'password'
            button.textContent = 'إظهار'
        }
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
        const container = document.querySelector('.auth-container') || document.body
        container.appendChild(messageDiv)

        // Auto remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove()
        }, 5000)
    }

    // Validate form
    validateForm(formData) {
        const errors = []

        if (!formData.get('email') || !formData.get('email').includes('@')) {
            errors.push('البريد الإلكتروني غير صحيح')
        }

        if (!formData.get('password') || formData.get('password').length < 6) {
            errors.push('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
        }

        if (!formData.get('first_name') || formData.get('first_name').length < 2) {
            errors.push('الاسم الأول يجب أن يكون حرفين على الأقل')
        }

        if (!formData.get('last_name') || formData.get('last_name').length < 2) {
            errors.push('الاسم الأخير يجب أن يكون حرفين على الأقل')
        }

        return errors
    }
}

// Initialize auth service when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthService()
})

// Global logout function
window.logout = function() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        localStorage.removeItem('current_user');
        localStorage.removeItem('twq_is_admin');
        window.location.href = 'index.html';
    }
}

// Export for potential use in other modules
export { AuthService } 
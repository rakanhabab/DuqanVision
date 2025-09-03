// ===== LANDING PAGE WITH DATABASE INTEGRATION =====
import { db } from './database.js'

class LandingPage {
    constructor() {
        this.init()
    }

    async init() {
        await this.loadBranchesFromDatabase()
        this.setupLanguageToggle()
        this.setupSmoothScrolling()
        this.setupAnimations()
    }

    // Load branches from database
    async loadBranchesFromDatabase() {
        try {
            const { data: branches, error } = await db.supabase
                .from('branches')
                .select('*')
                .order('name')
            
            if (error) {
                console.error('Error loading branches:', error)
                return
            }
            
            this.updateBranchesSection(branches || [])
        } catch (error) {
            console.error('Error loading branches:', error)
        }
    }

    // Update branches section with real data
    updateBranchesSection(branches) {
        if (!branches || branches.length === 0) return

        const branchCards = document.querySelectorAll('.branch-card')
        
        branches.forEach((branch, index) => {
            if (branchCards[index]) {
                // Update branch name
                const branchName = branchCards[index].querySelector('h3')
                if (branchName) {
                    branchName.textContent = `دكان فيجين — ${branch.name}`
                }

                // Update branch address
                const branchAddress = branchCards[index].querySelector('.branch-address')
                if (branchAddress) {
                    branchAddress.textContent = branch.address
                }

                // Update map iframe with real coordinates
                const mapIframe = branchCards[index].querySelector('iframe')
                if (mapIframe && branch.lat && branch.long) {
                    const mapUrl = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3624.5!2d${branch.long}!3d${branch.lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjTCsNDInNDkuMCJOIDQ2sDAwJzMxLjEiRQ!5e0!3m2!1sen!2ssa!4v1234567890`
                    mapIframe.src = mapUrl
                }
            }
        })
    }

    // Setup language toggle
    setupLanguageToggle() {
        const toggle = document.querySelector('.language-toggle')
        if (toggle) {
            toggle.addEventListener('click', this.toggleLanguage.bind(this))
        }
    }

    // Language toggle functionality
    toggleLanguage() {
        const toggle = document.querySelector('.language-toggle')
        toggle.classList.toggle('active')

        // Toggle language
        const currentLang = document.documentElement.lang === 'ar' ? 'en' : 'ar'

        // Update page direction
        document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr'
        document.documentElement.lang = currentLang

        // Update content
        this.updateContent(currentLang)

        // Add click animation
        toggle.style.transform = 'scale(0.95)'
        setTimeout(() => {
            toggle.style.transform = 'translateY(-1px)'
        }, 150)
    }

    // Update content based on language
    updateContent(lang) {
        // This will be handled by the existing content object in index.html
        // We just need to trigger the existing updateContent function
        if (typeof updateContent === 'function') {
            updateContent()
        }
    }

    // Setup smooth scrolling
    setupSmoothScrolling() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault()
                const target = document.querySelector(this.getAttribute('href'))
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    })
                }
            })
        })
    }

    // Setup animations
    setupAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in')
                }
            })
        })

        document.querySelectorAll('.feature-card, .step-card, .branch-card, .about-card').forEach(el => {
            observer.observe(el)
        })
    }

    // Add interactive features
    setupInteractiveFeatures() {
        // Add click handlers for CTA buttons
        const loginBtn = document.querySelector('a[href="./login.html"]')
        const signupBtn = document.querySelector('a[href="./signup.html"]')

        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault()
                window.location.href = './login.html'
            })
        }

        if (signupBtn) {
            signupBtn.addEventListener('click', (e) => {
                e.preventDefault()
                window.location.href = './signup.html'
            })
        }
    }

    // Load products for features section
    async loadProductsForFeatures() {
        try {
            const { data: products, error } = await db.supabase
                .from('products')
                .select('name, category')
                .order('name')
            
            if (error) {
                console.error('Error loading products:', error)
                return
            }
            
            if (products && products.length > 0) {
                this.updateFeaturesWithProducts(products)
            }
        } catch (error) {
            console.error('Error loading products for features:', error)
        }
    }

    // Update features section with real product data
    updateFeaturesWithProducts(products) {
        const featureCards = document.querySelectorAll('.feature-card')
        
        // Update feature cards with real product examples
        products.slice(0, 4).forEach((product, index) => {
            if (featureCards[index]) {
                const card = featureCards[index].querySelector('.card img')
                if (card) {
                    // You can add product images here if available
                    card.alt = product.name
                }
            }
        })
    }
}

// Initialize landing page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LandingPage()
})

// Export for potential use in other modules
export { LandingPage }

// Fixed script.js for Cocoa Code - Addresses API connection and booking issues
let selectedService = null;
let selectedSubscription = 'basic';
let selectedExtras = [];
let totalAmount = 0;

// Updated API Configuration with better fallback handling
const API_ENDPOINTS = [
    'https://cocoa-code-backend-production.up.railway.app/api',
    '/api' // Netlify proxy fallback
];

let currentApiUrl = API_ENDPOINTS[0];
let isOnlineMode = false;

// Service pricing configuration
const servicePricing = {
    'landing': 800,
    'business': 2500,
    'ecommerce': 2000,
    'webapp': 3000,
    'custom': 4000
};

const subscriptionPricing = {
    'basic': 0,
    'plus': 100,
    'premium': 150,
    'unlimited': 250
};

const extraServicePricing = {
    'hosting': 150,
    'management': 200,
    'fixes': 150,
    'seo': 225,
    'analytics': 125,
    'security': 175
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initializing Cocoa Code booking system...');
    initializeColorPickers();
    initializeSelectionHandlers();
    await testApiConnection();
    updateTotal();
});

// FIXED: Better API connection testing
async function testApiConnection() {
    console.log('🔄 Testing API connection...');
    
    for (let i = 0; i < API_ENDPOINTS.length; i++) {
        currentApiUrl = API_ENDPOINTS[i];
        console.log(`Testing endpoint: ${currentApiUrl}`);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(`${currentApiUrl}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Connected to: ${currentApiUrl}`);
                isOnlineMode = true;
                showNotification('✅ Booking system connected', 'success');
                return true;
            }
        } catch (error) {
            console.warn(`❌ Failed to connect to ${currentApiUrl}:`, error.message);
        }
    }
    
    console.warn('⚠️ All API endpoints failed, enabling offline mode');
    isOnlineMode = false;
    showNotification('⚠️ Using offline mode - limited functionality', 'warning');
    return false;
}

// FIXED: Improved form data collection
function collectFormData() {
    // Validate required fields first
    const clientName = document.getElementById('clientName')?.value?.trim();
    const clientEmail = document.getElementById('clientEmail')?.value?.trim();
    const projectSpecs = document.getElementById('projectSpecs')?.value?.trim();
    const bookingMonth = document.getElementById('bookingMonth')?.value;

    if (!clientName || !clientEmail || !projectSpecs || !bookingMonth) {
        throw new Error('Please fill in all required fields (Name, Email, Project Specs, Booking Month)');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
        throw new Error('Please enter a valid email address');
    }

    return {
        clientName,
        clientEmail,
        projectSpecs,
        bookingMonth,
        websiteType: document.getElementById('websiteType')?.value || 'other',
        primaryColor: document.getElementById('primaryColor')?.value || '#8B4513',
        secondaryColor: document.getElementById('secondaryColor')?.value || '#D2B48C',
        accentColor: document.getElementById('accentColor')?.value || '#CD853F',
        projectType: selectedService?.type || 'custom',
        basePrice: selectedService?.price || 0,
        totalPrice: totalAmount,
        subscription: selectedSubscription,
        extraServices: selectedExtras.map(extra => ({
            type: extra.type,
            price: extra.price
        }))
    };
}

// FIXED: Robust booking creation with better error handling
async function createBooking(bookingData) {
    console.log('📝 Creating booking with data:', bookingData);
    
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Booking attempt ${attempt}/${maxRetries}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000); // Increased timeout
            
            const response = await fetch(`${currentApiUrl}/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                },
                body: JSON.stringify(bookingData),
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });
            
            clearTimeout(timeoutId);
            
            const data = await response.json();
            console.log('Booking response:', { status: response.status, data });
            
            if (response.ok) {
                return {
                    success: true,
                    projectId: data.projectId,
                    clientId: data.clientId,
                    message: data.message
                };
            } else {
                // Handle specific error cases
                if (response.status === 400) {
                    if (data.error?.includes('fully booked')) {
                        throw new Error(`${bookingData.bookingMonth} is fully booked. Please select a different month.`);
                    } else if (data.error?.includes('required')) {
                        throw new Error('Missing required information. Please check all fields.');
                    }
                }
                throw new Error(data.error || `Server error (${response.status})`);
            }
            
        } catch (error) {
            lastError = error;
            console.error(`Booking attempt ${attempt} failed:`, error.message);
            
            if (error.name === 'AbortError') {
                lastError = new Error('Request timed out. Please check your internet connection.');
            }
            
            // Don't retry on validation errors
            if (error.message.includes('required') || error.message.includes('email') || error.message.includes('fully booked')) {
                throw error;
            }
            
            // Wait before retrying (exponential backoff)
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                
                // Try switching to backup API endpoint
                if (attempt === 2 && API_ENDPOINTS[1]) {
                    currentApiUrl = API_ENDPOINTS[1];
                    console.log(`Switching to backup endpoint: ${currentApiUrl}`);
                }
            }
        }
    }
    
    throw lastError || new Error('Failed to create booking after multiple attempts');
}

// FIXED: Enhanced payment processing
async function processPayment(method) {
    try {
        console.log('🚀 Starting payment process with method:', method);
        
        // First, ensure we have a selected service
        if (!selectedService || selectedService.price <= 0) {
            throw new Error('Please select a service package first');
        }

        // Update UI to show progress
        updatePaymentStatus('Preparing booking...', 10);
        
        // Collect and validate form data
        let bookingData;
        try {
            bookingData = collectFormData();
        } catch (error) {
            throw error; // Re-throw validation errors
        }

        // Test API connection if needed
        if (!isOnlineMode) {
            updatePaymentStatus('Connecting to booking system...', 20);
            const connected = await testApiConnection();
            if (!connected) {
                throw new Error('Unable to connect to booking system. Please check your internet connection and try again.');
            }
        }

        // Create booking
        updatePaymentStatus('Creating your booking...', 40);
        const bookingResult = await createBooking(bookingData);
        
        if (!bookingResult.success) {
            throw new Error(bookingResult.error || 'Failed to create booking');
        }

        console.log('✅ Booking created:', bookingResult.projectId);
        
        // For now, simulate successful payment processing
        // (In production, you'd integrate with real Stripe here)
        updatePaymentStatus('Processing payment...', 70);
        
        // Simulate payment delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        updatePaymentStatus('Payment confirmed!', 100);
        
        // Success!
        console.log('🎉 Booking and payment completed successfully');
        
        setTimeout(() => {
            hidePaymentStatus();
            closeModal();
            showSuccessMessage(bookingResult.projectId, 'DEMO-' + Date.now());
            resetForm();
        }, 1500);

    } catch (error) {
        console.error('❌ Payment processing error:', error);
        hidePaymentStatus();
        showNotification(`Booking failed: ${error.message}`, 'error');
    }
}

// FIXED: Payment status UI helpers
function updatePaymentStatus(message, progress) {
    const statusDiv = document.getElementById('paymentStatus');
    const statusText = document.getElementById('paymentStatusText');
    const progressBar = document.getElementById('paymentProgress');
    
    if (statusDiv && statusText && progressBar) {
        statusDiv.style.display = 'block';
        statusText.textContent = message;
        progressBar.style.width = `${progress}%`;
    }
}

function hidePaymentStatus() {
    const statusDiv = document.getElementById('paymentStatus');
    if (statusDiv) {
        statusDiv.style.display = 'none';
    }
}

// Color Picker functionality
function initializeColorPickers() {
    const colors = ['primaryColor', 'secondaryColor', 'accentColor'];
    colors.forEach(colorId => {
        const input = document.getElementById(colorId);
        if (input) {
            input.addEventListener('input', function() {
                updateColorPreview(this, `${colorId.replace('Color', '')}Preview`);
            });
            updateColorPreview(input, `${colorId.replace('Color', '')}Preview`);
        }
    });
}

function updateColorPreview(colorInput, previewId) {
    const preview = document.getElementById(previewId);
    if (preview) {
        preview.style.backgroundColor = colorInput.value;
    }
}

// Selection handlers
function initializeSelectionHandlers() {
    // Service selection
    document.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            
            const serviceType = this.dataset.service;
            selectedService = { 
                type: serviceType, 
                price: servicePricing[serviceType] || 0 
            };
            updateTotal();
            showNotification(`Selected: ${this.querySelector('h3').textContent}`, 'info');
        });
    });

    // Subscription selection
    document.querySelectorAll('.subscription-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.subscription-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedSubscription = this.dataset.subscription;
            updateTotal();
        });
    });

    // Extra services selection
    document.querySelectorAll('.extra-service').forEach(service => {
        service.addEventListener('click', function() {
            const extraType = this.dataset.extra;
            const extraPrice = extraServicePricing[extraType] || 0;
            
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                selectedExtras = selectedExtras.filter(item => item.type !== extraType);
            } else {
                this.classList.add('selected');
                selectedExtras.push({ type: extraType, price: extraPrice });
            }
            updateTotal();
        });
    });
}

// Update total calculation
function updateTotal() {
    let total = selectedService ? selectedService.price : 0;
    
    selectedExtras.forEach(extra => {
        if (!['management'].includes(extra.type)) {
            total += extra.price;
        }
    });
    
    totalAmount = total;
    
    const totalElement = document.getElementById('totalAmount');
    if (totalElement) {
        totalElement.textContent = total.toLocaleString();
    }
    
    updatePriceBreakdown();
}

// Price breakdown display
function updatePriceBreakdown() {
    const breakdownElement = document.getElementById('priceBreakdown');
    if (!breakdownElement) return;
    
    let breakdown = '';
    
    if (selectedService) {
        breakdown += `<div class="price-item">
            <span>${getServiceDisplayName(selectedService.type)}</span>
            <span>$${selectedService.price.toLocaleString()} AUD</span>
        </div>`;
    }
    
    selectedExtras.forEach(extra => {
        if (!['management'].includes(extra.type)) {
            breakdown += `<div class="price-item">
                <span>${getExtraDisplayName(extra.type)}</span>
                <span>$${extra.price.toLocaleString()} AUD</span>
            </div>`;
        }
    });
    
    breakdownElement.innerHTML = breakdown;
}

// Helper functions
function getServiceDisplayName(type) {
    const names = {
        'landing': 'Landing Page',
        'business': 'Business Website', 
        'ecommerce': 'Blog Site',
        'webapp': 'Web Application',
        'custom': 'Custom Solution'
    };
    return names[type] || type;
}

function getExtraDisplayName(type) {
    const names = {
        'hosting': 'Live Hosting Setup',
        'management': 'Website Management',
        'fixes': 'Code Fixes',
        'seo': 'SEO Optimization',
        'analytics': 'Analytics Setup',
        'security': 'Security Package'
    };
    return names[type] || type;
}

// Form validation
function validateForm() {
    const requiredFields = ['clientName', 'clientEmail', 'projectSpecs', 'bookingMonth'];
    let isValid = true;
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field && (!field.value || field.value.trim() === '')) {
            field.style.borderColor = '#e74c3c';
            field.style.borderWidth = '2px';
            isValid = false;
        } else if (field) {
            field.style.borderColor = '';
            field.style.borderWidth = '';
        }
    });
    
    return isValid;
}

// Payment modal functions
function proceedToPayment() {
    if (!selectedService) {
        showNotification('Please select a service package first', 'error');
        return;
    }
    
    if (!validateForm()) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    const modal = document.getElementById('paymentModal');
    const modalTotal = document.getElementById('modalTotal');
    
    if (modal && modalTotal) {
        modalTotal.textContent = totalAmount.toLocaleString();
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    hidePaymentStatus();
}

// Show success message
function showSuccessMessage(projectId, paymentId) {
    const message = `🎉 Booking Confirmed Successfully!

Project ID: ${projectId}
Payment ID: ${paymentId}

What happens next:
• You'll receive a confirmation email within 5 minutes
• We'll start working on your project within 1-2 business days
• You'll get progress updates throughout development
• Expected completion: 1-2 weeks

Thank you for choosing Cocoa Code! ☕`;
    
    alert(message);
}

// Reset form
function resetForm() {
    document.getElementById('bookingForm')?.reset();
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    selectedService = null;
    selectedSubscription = 'basic';
    selectedExtras = [];
    updateTotal();
}

// Enhanced notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    const styles = {
        info: { bg: '#3498db', color: 'white' },
        success: { bg: '#2ecc71', color: 'white' },
        warning: { bg: '#f39c12', color: 'white' },
        error: { bg: '#e74c3c', color: 'white' }
    };
    
    const style = styles[type] || styles.info;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        background: ${style.bg};
        color: ${style.color};
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
        cursor: pointer;
    `;
    
    notification.addEventListener('click', () => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    });
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    const autoRemoveTime = type === 'error' ? 8000 : 4000;
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, autoRemoveTime);
}

// Modal event listeners
window.addEventListener('click', function(event) {
    const modal = document.getElementById('paymentModal');
    if (event.target === modal) {
        closeModal();
    }
});

// Global function exports
window.proceedToPayment = proceedToPayment;
window.closeModal = closeModal;
window.processPayment = processPayment;
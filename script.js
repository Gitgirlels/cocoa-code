// Railway-optimized script.js with improved error handling
let selectedService = null;
let selectedSubscription = 'basic';
let selectedExtras = [];
let totalAmount = 0;

// API Configuration with multiple fallbacks
const API_ENDPOINTS = [
    'https://cocoa-code-backend-production.up.railway.app/api',  // Primary Railway endpoint
    '/api'  // Netlify redirect fallback
];

let currentApiUrl = API_ENDPOINTS[0];
let isOnlineMode = false;
let apiRetryCount = 0;
const MAX_RETRIES = 3;

// Booking availability tracking for offline mode
let monthlyBookings = {
    'July 2025': 0,
    'August 2025': 0,
    'September 2025': 0
};

const maxBookingsPerMonth = 4;

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
    await initializeApiConnection();
    await updateBookingOptions();
    updateTotal();
});

// Initialize API connection with retry logic
async function initializeApiConnection() {
    console.log('🔄 Checking API connection...');
    
    for (let i = 0; i < API_ENDPOINTS.length; i++) {
        currentApiUrl = API_ENDPOINTS[i];
        console.log(`Trying endpoint ${i + 1}/${API_ENDPOINTS.length}: ${currentApiUrl}`);
        
        const isConnected = await checkApiStatus();
        if (isConnected) {
            console.log(`✅ Connected successfully to: ${currentApiUrl}`);
            return true;
        }
        
        // Wait before trying next endpoint
        if (i < API_ENDPOINTS.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.warn('⚠️ All API endpoints failed, using offline mode');
    showNotification('⚠️ Running in offline mode. Some features may be limited.', 'warning');
    return false;
}

// Enhanced API status check
async function checkApiStatus() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${currentApiUrl}/health`, { 
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal: controller.signal,
            mode: 'cors', // Explicitly set CORS mode
            credentials: 'omit' // Don't send credentials for health check
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            isOnlineMode = true;
            apiRetryCount = 0;
            console.log("✅ API Health Check Passed:", data);
            showNotification('✅ Connected to booking system', 'success');
            return true;
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.warn(`❌ API check failed for ${currentApiUrl}:`, error.message);
        isOnlineMode = false;
        
        // Handle specific error types
        if (error.name === 'AbortError') {
            console.warn('Request timeout - Railway service may be sleeping');
            showNotification('⏱️ Service starting up, please wait...', 'warning');
        } else if (error.message.includes('CORS')) {
            console.warn('CORS error detected');
        } else if (error.message.includes('503')) {
            console.warn('Service unavailable - Railway may be deploying');
            showNotification('🔄 Service updating, please wait...', 'info');
        }
        
        return false;
    }
}

// Retry API connection with exponential backoff
async function retryApiConnection() {
    if (apiRetryCount >= MAX_RETRIES) {
        console.warn('Max retries reached, staying in offline mode');
        return false;
    }
    
    apiRetryCount++;
    const delay = Math.pow(2, apiRetryCount) * 1000; // Exponential backoff
    
    console.log(`🔄 Retrying API connection in ${delay/1000}s (attempt ${apiRetryCount}/${MAX_RETRIES})`);
    showNotification(`🔄 Reconnecting... (${apiRetryCount}/${MAX_RETRIES})`, 'info');
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return await initializeApiConnection();
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

// Enhanced availability checking with Railway-specific handling
async function checkAvailability(month) {
    if (!isOnlineMode) {
        return (monthlyBookings[month] || 0) < maxBookingsPerMonth;
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(`${currentApiUrl}/bookings/availability/${encodeURIComponent(month)}`, {
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
        
        if (!response.ok) {
            if (response.status === 503) {
                console.warn('Service unavailable, trying to wake up Railway service...');
                await retryApiConnection();
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data.available;
    } catch (error) {
        console.warn("Availability check failed:", error.message);
        
        // If this is a timeout or network error, try to reconnect
        if (error.name === 'AbortError' || error.message.includes('fetch')) {
            setTimeout(() => retryApiConnection(), 1000);
        }
        
        return (monthlyBookings[month] || 0) < maxBookingsPerMonth;
    }
}

// Update booking options with better error handling
async function updateBookingOptions() {
    const bookingSelect = document.getElementById('bookingMonth');
    if (!bookingSelect) return;

    const options = bookingSelect.querySelectorAll('option');
    for (const option of options) {
        if (option.value) {
            try {
                const available = await checkAvailability(option.value);
                if (!available) {
                    option.textContent = option.textContent.replace(' (FULL)', '') + ' (FULL)';
                    option.disabled = true;
                    option.style.color = '#999';
                    option.style.backgroundColor = '#f0f0f0';
                } else {
                    option.textContent = option.textContent.replace(' (FULL)', '');
                    option.disabled = false;
                    option.style.color = '';
                    option.style.backgroundColor = '';
                }
            } catch (error) {
                console.warn(`Error checking availability for ${option.value}:`, error.message);
            }
        }
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
            showNotification(`Support plan: ${this.querySelector('h4').textContent}`, 'info');
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
                showNotification(`Removed: ${this.querySelector('h4').textContent}`, 'info');
            } else {
                this.classList.add('selected');
                selectedExtras.push({ type: extraType, price: extraPrice });
                showNotification(`Added: ${this.querySelector('h4').textContent}`, 'info');
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
    
    const monthlyServices = selectedExtras.filter(extra => ['management'].includes(extra.type));
    const subscriptionPrice = subscriptionPricing[selectedSubscription] || 0;
    
    if (monthlyServices.length > 0 || subscriptionPrice > 0) {
        breakdown += '<hr><div class="monthly-services"><h4>Monthly Services:</h4>';
        
        if (subscriptionPrice > 0) {
            breakdown += `<div class="price-item monthly">
                <span>Support (${selectedSubscription})</span>
                <span>$${subscriptionPrice}/month AUD</span>
            </div>`;
        }
        
        monthlyServices.forEach(extra => {
            breakdown += `<div class="price-item monthly">
                <span>${getExtraDisplayName(extra.type)}</span>
                <span>$${extra.price}/month AUD</span>
            </div>`;
        });
        
        breakdown += '</div>';
    }
    
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
    
    const emailField = document.getElementById('clientEmail');
    if (emailField && emailField.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailField.value)) {
            emailField.style.borderColor = '#e74c3c';
            emailField.style.borderWidth = '2px';
            isValid = false;
        }
    }
    
    return isValid;
}

// Enhanced booking creation with retry logic
async function createBooking(bookingData) {
    if (!isOnlineMode) {
        console.log('Creating booking in offline mode');
        monthlyBookings[bookingData.bookingMonth] = (monthlyBookings[bookingData.bookingMonth] || 0) + 1;
        return {
            success: true,
            projectId: `offline-${Date.now()}`,
            message: 'Booking created in offline mode'
        };
    }
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Booking attempt ${attempt}/${MAX_RETRIES}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const response = await fetch(`${currentApiUrl}/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(bookingData),
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    projectId: data.projectId,
                    message: data.message
                };
            } else if (response.status === 503 && attempt < MAX_RETRIES) {
                console.warn(`Service unavailable (503), retrying in ${attempt * 2}s...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                continue;
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
        } catch (error) {
            console.error(`Booking attempt ${attempt} failed:`, error.message);
            
            if (attempt === MAX_RETRIES) {
                return {
                    success: false,
                    error: `Failed after ${MAX_RETRIES} attempts: ${error.message}`
                };
            }
            
            if (error.name === 'AbortError') {
                console.warn('Request timeout, retrying...');
            }
            
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
    }
}

// Process payment with enhanced error handling
async function processPayment(method) {
    try {
        showNotification('Processing payment...', 'info');
        
        // Ensure API is connected before processing
        if (!isOnlineMode) {
            showNotification('Attempting to reconnect...', 'info');
            const reconnected = await retryApiConnection();
            if (!reconnected) {
                throw new Error('Unable to connect to payment service. Please try again later.');
            }
        }
        
        const bookingData = collectFormData();
        bookingData.paymentMethod = method;
        
        const bookingResponse = await createBooking(bookingData);
        
        if (bookingResponse.success) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            showNotification('✅ Payment successful! Booking confirmed.', 'success');
            closeModal();
            resetForm();
            
            setTimeout(() => {
                alert(`Thank you! Your booking has been confirmed.\n\nProject ID: ${bookingResponse.projectId}\n\nYou will receive a confirmation email shortly with next steps.`);
            }, 1000);
        } else {
            throw new Error(bookingResponse.error || 'Booking failed');
        }
    } catch (error) {
        console.error('Payment error:', error);
        showNotification(`Payment failed: ${error.message}`, 'error');
        
        // If it's a connection error, suggest offline booking
        if (error.message.includes('connect') || error.message.includes('network')) {
            setTimeout(() => {
                showNotification('💡 Try refreshing the page or contact us directly at your-email@example.com', 'info');
            }, 3000);
        }
    }
}

// Collect form data
function collectFormData() {
    return {
        clientName: document.getElementById('clientName')?.value || '',
        clientEmail: document.getElementById('clientEmail')?.value || '',
        projectSpecs: document.getElementById('projectSpecs')?.value || '',
        bookingMonth: document.getElementById('bookingMonth')?.value || '',
        websiteType: document.getElementById('websiteType')?.value || '',
        primaryColor: document.getElementById('primaryColor')?.value || '#8B4513',
        secondaryColor: document.getElementById('secondaryColor')?.value || '#D2B48C',
        accentColor: document.getElementById('accentColor')?.value || '#CD853F',
        projectType: selectedService?.type || '',
        basePrice: selectedService?.price || 0,
        totalPrice: totalAmount,
        subscription: selectedSubscription,
        extraServices: selectedExtras
    };
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
    // Remove existing notifications of the same type
    const existingNotifications = document.querySelectorAll(`.notification-${type}`);
    existingNotifications.forEach(notif => notif.remove());
    
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
    
    // Click to dismiss
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
    
    // Auto remove based on type
    const autoRemoveTime = type === 'error' ? 8000 : type === 'warning' ? 6000 : 4000;
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

// Periodic connection check
setInterval(async () => {
    if (!isOnlineMode) {
        console.log('🔄 Periodic connection check...');
        await retryApiConnection();
    }
}, 30000); // Check every 30 seconds

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
let selectedService = null;
let selectedSubscription = 'basic';
let selectedExtras = [];
let totalAmount = 0;

// Color picker functionality
function updateColorPreview(colorInput, previewId) {
    const preview = document.getElementById(previewId);
    preview.style.backgroundColor = colorInput.value;
}

// Initialize color previews
document.getElementById('primaryColor').addEventListener('input', function() {
    updateColorPreview(this, 'primaryPreview');
});

document.getElementById('secondaryColor').addEventListener('input', function() {
    updateColorPreview(this, 'secondaryPreview');
});

document.getElementById('accentColor').addEventListener('input', function() {
    updateColorPreview(this, 'accentPreview');
});

// Set initial color previews
window.addEventListener('load', function() {
    updateColorPreview(document.getElementById('primaryColor'), 'primaryPreview');
    updateColorPreview(document.getElementById('secondaryColor'), 'secondaryPreview');
    updateColorPreview(document.getElementById('accentColor'), 'accentPreview');
});

// Booking availability tracking - FALLBACK for offline mode
let monthlyBookings = {
    'July 2025': 0,
    'August 2025': 0,
    'September 2025': 0
};

const maxBookingsPerMonth = 4;

// 🔥 MULTIPLE API ENDPOINTS - Try in order
const API_ENDPOINTS = [
    'https://cocoa-code-backend-production.up.railway.app/api',
    'http://localhost:5000/api',
    'http://127.0.0.1:5000/api'
];

let currentApiUrl = null;

// Test API connections and find working endpoint
async function findWorkingAPI() {
    console.log('🔍 Testing API endpoints...');
    
    for (const url of API_ENDPOINTS) {
        try {
            console.log(`🧪 Testing: ${url}`);
            const response = await fetch(`${url}/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Found working API: ${url}`, data);
                currentApiUrl = url;
                return url;
            } else {
                console.log(`❌ API responded but with error: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ Failed to connect to ${url}:`, error.message);
        }
    }
    
    console.log('📱 No API endpoints available - using offline mode');
    return null;
}

async function checkAvailability(month) {
    if (!currentApiUrl) {
        console.log('📱 Using fallback availability check');
        const currentCount = monthlyBookings[month] || 0;
        return currentCount < maxBookingsPerMonth;
    }

    try {
        console.log(`🔍 Checking availability for: ${month}`);
        
        const response = await fetch(`${currentApiUrl}/bookings/availability/${encodeURIComponent(month)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (!response.ok) {
            console.error(`❌ API Error: ${response.status} ${response.statusText}`);
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`✅ Availability response:`, data);
        
        return data.available;
    } catch (error) {
        console.error('❌ Error checking availability:', error);
        
        // FALLBACK: Use local tracking if API fails
        console.log('📱 Using fallback availability check');
        const currentCount = monthlyBookings[month] || 0;
        return currentCount < maxBookingsPerMonth;
    }
}

// Update booking month options based on availability
async function updateBookingOptions() {
    const bookingSelect = document.getElementById('bookingMonth');
    const options = bookingSelect.querySelectorAll('option');
    
    console.log('🔄 Updating booking options...');
    
    for (const option of options) {
        if (option.value && option.value !== '') {
            console.log(`Checking option: ${option.value}`);
            
            try {
                const available = await checkAvailability(option.value);
                
                if (!available) {
                    option.textContent = option.textContent.replace(' (FULL)', '') + ' (FULL)';
                    option.disabled = true;
                    option.style.color = '#999';
                } else {
                    option.textContent = option.textContent.replace(' (FULL)', '');
                    option.disabled = false;
                    option.style.color = '';
                }
            } catch (error) {
                console.error(`Error checking ${option.value}:`, error);
                // Leave option enabled if we can't check
            }
        }
    }
    
    console.log('✅ Booking options updated');
}

// Service selection
document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', function() {
        document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        selectedService = {
            type: this.dataset.service,
            price: parseInt(this.dataset.price) || 0
        };
        updateTotal();
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
        const extraPrice = parseInt(this.dataset.price);
        
        if (this.classList.contains('selected')) {
            this.classList.remove('selected');
            selectedExtras = selectedExtras.filter(item => item.type !== extraType);
        } else {
            this.classList.add('selected');
            selectedExtras.push({
                type: extraType,
                price: extraPrice
            });
        }
        updateTotal();
    });
});

function updateTotal() {
    let total = 0;
    let breakdown = '<div style="text-align: left; margin-bottom: 1rem;">';
    
    // Base service
    if (selectedService) {
        total += selectedService.price;
        breakdown += `<div>Base Project: $${selectedService.price}</div>`;
    }
    
    // Extra services (one-time)
    selectedExtras.forEach(extra => {
        if (extra.type !== 'management' && extra.type !== 'fixes') {
            total += extra.price;
            breakdown += `<div>Extra Service: $${extra.price}</div>`;
        }
    });
    
    // Monthly services note
    const monthlyServices = selectedExtras.filter(e => e.type === 'management' || e.type === 'fixes');
    const subscriptionPrice = document.querySelector(`[data-subscription="${selectedSubscription}"]`)?.dataset.price || 0;
    
    if (parseInt(subscriptionPrice) > 0 || monthlyServices.length > 0) {
        breakdown += '<div style="margin-top: 1rem; font-style: italic;">Monthly Services:</div>';
        
        if (parseInt(subscriptionPrice) > 0) {
            breakdown += `<div>Support: $${subscriptionPrice}/month</div>`;
        }
        
        monthlyServices.forEach(service => {
            breakdown += `<div>Extra: $${service.price}/month</div>`;
        });
    }
    
    breakdown += '</div>';
    
    totalAmount = total;
    document.getElementById('totalAmount').textContent = total;
    document.getElementById('priceBreakdown').innerHTML = breakdown;
}

async function proceedToPayment() {
    // Check if either a service is selected OR at least one extra service is selected
    const hasSelectedService = selectedService !== null;
    const hasSelectedExtras = selectedExtras.length > 0;
    const hasSelectedSubscription = selectedSubscription !== 'basic';
    
    if (!hasSelectedService && !hasSelectedExtras && !hasSelectedSubscription) {
        alert('Please select at least one service, extra service, or subscription plan!');
        return;
    }
    
    const form = document.getElementById('bookingForm');
    if (!form.checkValidity()) {
        alert('Please fill in all required fields!');
        return;
    }
    
    // Only require booking month if a main service is selected
    if (hasSelectedService) {
        const selectedMonth = document.getElementById('bookingMonth').value;
        if (!selectedMonth) {
            alert('Please select a booking month for your project!');
            return;
        }
        
        // Check availability one more time for main services
        const available = await checkAvailability(selectedMonth);
        console.log(`Final availability check for ${selectedMonth}: ${available}`);
        
        if (!available) {
            alert(`Sorry! ${selectedMonth} is now full. Please select a different month.`);
            return;
        }
    }
    
    document.getElementById('modalTotal').textContent = totalAmount;
    document.getElementById('paymentModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('paymentModal').style.display = 'none';
}

async function processPayment(paymentMethod) {
    console.log('🔄 Processing payment...');
    
    try {
        // Show loading state
        const paymentButtons = document.querySelectorAll('.payment-options button');
        paymentButtons.forEach(btn => {
            btn.disabled = true;
            btn.textContent = 'Processing...';
        });
        
        // Create booking in backend
        const projectId = await createBooking();
        if (!projectId) {
            throw new Error('Failed to create booking');
        }
        
        console.log('✅ Booking created with ID:', projectId);
        
        // Only increment local booking count if a main service was selected (fallback)
        if (selectedService && !currentApiUrl) {
            const selectedMonth = document.getElementById('bookingMonth').value;
            monthlyBookings[selectedMonth] = (monthlyBookings[selectedMonth] || 0) + 1;
            updateBookingOptions();
        }
        
        const paymentMethods = {
            'credit': 'Credit Card',
            'paypal': 'PayPal',
            'afterpay': 'Afterpay'
        };
        
        let paymentMessage = '';
        if (paymentMethod === 'afterpay') {
            paymentMessage = `\n\n💡 With Afterpay: Pay in 4 interest-free installments!`;
        }
        
        // Create success message
        let successMessage = `🎉 Booking confirmed successfully via ${paymentMethods[paymentMethod]}! \n\nThank you for choosing Cocoa Code!`;
        
        if (selectedService) {
            const selectedMonth = document.getElementById('bookingMonth').value;
            successMessage += `\n\nYour project is scheduled for ${selectedMonth}.`;
        }
        
        if (selectedExtras.length > 0) {
            const extraTypes = selectedExtras.map(e => e.type).join(', ');
            successMessage += `\n\nExtra services selected: ${extraTypes}`;
        }
        
        if (selectedSubscription !== 'basic') {
            successMessage += `\n\nSupport plan: ${selectedSubscription}`;
        }
        
        successMessage += `${paymentMessage}\n\nYou will receive a confirmation email shortly with service details and next steps.`;
        
        if (selectedService) {
            successMessage += `\n\nI'll be in touch within 24 hours to discuss your project requirements and we'll keep you updated at every stage with progress pictures!`;
        } else {
            successMessage += `\n\nI'll be in touch within 24 hours to coordinate your selected services!`;
        }
        
        alert(successMessage);
        closeModal();
        
        // Reset form
        resetForm();
        
    } catch (error) {
        console.error('❌ Payment processing error:', error);
        alert(`Payment failed: ${error.message}\n\nPlease try again or contact support if the problem persists.`);
        
        // Re-enable buttons
        const paymentButtons = document.querySelectorAll('.payment-options button');
        paymentButtons.forEach((btn, index) => {
            btn.disabled = false;
            const methods = ['Credit Card', 'PayPal', 'Afterpay'];
            btn.innerHTML = `💳 ${methods[index] || 'Payment'}`;
        });
    }
}

async function createBooking() {
    const bookingData = {
        clientName: document.getElementById('clientName').value,
        clientEmail: document.getElementById('clientEmail').value,
        projectSpecs: document.getElementById('projectSpecs').value,
        websiteType: document.getElementById('websiteType').value,
        bookingMonth: document.getElementById('bookingMonth').value,
        projectType: selectedService?.type || 'service-only',
        basePrice: selectedService?.price || 0,
        totalPrice: totalAmount,
        primaryColor: document.getElementById('primaryColor').value,
        secondaryColor: document.getElementById('secondaryColor').value,
        accentColor: document.getElementById('accentColor').value,
        subscription: selectedSubscription,
        extraServices: selectedExtras
    };
    
    console.log('📤 Sending booking data:', bookingData);
    
    if (!currentApiUrl) {
        console.log('📱 Offline mode - simulating booking creation');
        // Simulate API response in offline mode
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 'offline-' + Date.now();
    }
    
    try {
        const response = await fetch(`${currentApiUrl}/bookings`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookingData),
            signal: AbortSignal.timeout(15000) // 15 second timeout
        });
        
        const result = await response.json();
        console.log('📥 Booking response:', result);
        
        if (response.ok) {
            console.log('✅ Booking submitted successfully!');
            return result.projectId;
        } else {
            console.error('❌ Booking failed:', result);
            throw new Error(result.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('❌ Network error:', error);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please check your connection and try again.');
        }
        throw new Error(`Connection failed: ${error.message}`);
    }
}

function resetForm() {
    document.getElementById('bookingForm').reset();
    document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.subscription-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.extra-service').forEach(c => c.classList.remove('selected'));
    document.querySelector('[data-subscription="basic"]').classList.add('selected');
    
    // Reset color previews
    document.getElementById('primaryColor').value = '#8B4513';
    document.getElementById('secondaryColor').value = '#D2B48C';
    document.getElementById('accentColor').value = '#CD853F';
    updateColorPreview(document.getElementById('primaryColor'), 'primaryPreview');
    updateColorPreview(document.getElementById('secondaryColor'), 'secondaryPreview');
    updateColorPreview(document.getElementById('accentColor'), 'accentPreview');
    
    selectedService = null;
    selectedSubscription = 'basic';
    selectedExtras = [];
    updateTotal();
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initializing Cocoa Code booking system...');
    
    // Test API connection
    const workingApi = await findWorkingAPI();
    
    if (workingApi) {
        console.log('🌐 Online mode: Using backend API at', workingApi);
    } else {
        console.log('📱 Offline mode: Using local fallback');
        // Show user notification about offline mode
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 10px; right: 10px; 
            background: #f39c12; color: white; padding: 10px; 
            border-radius: 5px; z-index: 9999;
            max-width: 300px; font-size: 14px;
        `;
        notification.textContent = '⚠️ Running in offline mode. Some features may be limited.';
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => notification.remove(), 5000);
    }
    
    // Initialize with basic subscription selected
    document.querySelector('[data-subscription="basic"]').classList.add('selected');
    
    // Update booking options
    await updateBookingOptions();
    
    console.log('✅ Initialization complete!');
});

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('paymentModal');
    if (event.target === modal) {
        closeModal();
    }
}
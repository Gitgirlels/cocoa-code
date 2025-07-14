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

// Booking availability tracking
let monthlyBookings = {
    'current': 2,  // Current bookings for this month
    'next': 1,     // Current bookings for next month
    'future': 0    // Current bookings for future month
};

const maxBookingsPerMonth = 4;
const API_BASE_URL = 'https://cocoa-code-backend-production.up.railway.app';


async function checkAvailability(month) {
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/availability/${month}`);
      const data = await response.json();
      return data.available;
    } catch (error) {
      console.error('Error checking availability:', error);
      return false;
    }
  }
  

// Update booking month options based on availability
async function updateBookingOptions() {
    const bookingSelect = document.getElementById('bookingMonth');
    const options = bookingSelect.querySelectorAll('option');
    
    for (const option of options) {
        if (option.value && option.value !== '') {
            const available = await checkAvailability(option.value);
            if (!available) {
                option.textContent = option.textContent + ' (FULL)';
                option.disabled = true;
            } else {
                option.textContent = option.textContent.replace(' (FULL)', '');
                option.disabled = false;
            }
        }
    }
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
    
    // Allow booking if any of the following are true:
    // 1. A main service is selected
    // 2. Extra services are selected
    // 3. A paid subscription is selected
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
        if (!(await checkAvailability(selectedMonth))) {
            const monthNames = {
                'current': 'July 2025',
                'next': 'August 2025',
                'future': 'September 2025'
            };
            
            const projectId = await createBooking();
            if (!projectId) return;
            

            // Find next available month
            let nextAvailable = null;
            for (const [month, count] of Object.entries(monthlyBookings)) {
                if (count < maxBookingsPerMonth && month !== selectedMonth) {
                    nextAvailable = month;
                    break;
                }
            }
            
            if (nextAvailable) {
                const nextMonthName = monthNames[nextAvailable];
                const result = confirm(`Sorry! ${monthNames[selectedMonth]} is now full. Would you like to book for ${nextMonthName} instead?`);
                
                if (result) {
                    document.getElementById('bookingMonth').value = nextAvailable;
                    // Continue with payment
                    document.getElementById('modalTotal').textContent = totalAmount;
                    document.getElementById('paymentModal').style.display = 'block';
                }
            } else {
                alert('Sorry! All available months are currently full. Please check back later or contact me directly.');
            }
            return;
        }
    }
    
    document.getElementById('modalTotal').textContent = totalAmount;
    document.getElementById('paymentModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('paymentModal').style.display = 'none';
}

function processPayment(paymentMethod) {
    // Only increment booking count if a main service was selected
    if (selectedService) {
        const selectedMonth = document.getElementById('bookingMonth').value;
        monthlyBookings[selectedMonth]++;
        updateBookingOptions();
    }
    
    const monthNames = {
        'current': 'July 2025',
        'next': 'August 2025',
        'future': 'September 2025'
    };
    
    const paymentMethods = {
        'credit': 'Credit Card',
        'paypal': 'PayPal',
        'afterpay': 'Afterpay'
    };
    
    let paymentMessage = '';
    if (paymentMethod === 'afterpay') {
        paymentMessage = `\n\n💡 With Afterpay: Pay in 4 interest-free installments!`;
    }
    
    // Create different success messages based on what was booked
    let successMessage = `🎉 Payment processed successfully via ${paymentMethods[paymentMethod]}! \n\nThank you for choosing Cocoa Code!`;
    
    if (selectedService) {
        const selectedMonth = document.getElementById('bookingMonth').value;
        successMessage += `\n\nYour project is scheduled for ${monthNames[selectedMonth]}.`;
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

async function createBooking() {
    const bookingData = {
      clientName: document.getElementById('clientName').value,
      clientEmail: document.getElementById('clientEmail').value,
      projectSpecs: document.getElementById('projectSpecs').value,
      websiteType: document.getElementById('websiteType').value,
      bookingMonth: document.getElementById('bookingMonth').value,
      projectType: selectedService?.type,
      basePrice: selectedService?.price,
      totalPrice: totalAmount,
      primaryColor: document.getElementById('primaryColor').value,
      secondaryColor: document.getElementById('secondaryColor').value,
      accentColor: document.getElementById('accentColor').value,
      subscription: selectedSubscription,
      extraServices: selectedExtras
    };
  
    try {
      const response = await fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });
  
      const result = await response.json();
  
      if (response.ok) {
        alert('🎉 Booking submitted successfully!');
        return result.projectId; // You’ll use this for payment (Step 8)
      } else {
        alert('❌ Booking failed: ' + result.error);
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('An unexpected error occurred');
    }
  }
  

// Initialize with basic subscription selected and update booking options
document.querySelector('[data-subscription="basic"]').classList.add('selected');
updateBookingOptions();

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('paymentModal');
    if (event.target === modal) {
        closeModal();
    }
}
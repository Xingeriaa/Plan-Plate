document.addEventListener('DOMContentLoaded', function() {
    // Load cart items from localStorage
    loadCartItems();
    
    // Calculate and update order summary
    updateOrderSummary();
    
    // Payment method toggle
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', function() {
            // Hide all payment details first
            document.getElementById('bankDetails').classList.add('d-none');
            document.getElementById('eWalletDetails').classList.add('d-none');
            
            // Show the selected payment details
            if (this.value === 'ChuyenKhoan') {
                document.getElementById('bankDetails').classList.remove('d-none');
            } else if (this.value === 'ViDienTu') {
                document.getElementById('eWalletDetails').classList.remove('d-none');
            }
        });
    });
    
    // Place order button click
    document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);
});

function loadCartItems() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const orderItemsContainer = document.getElementById('orderItems');
    
    if (cart.length === 0) {
        orderItemsContainer.innerHTML = '<p class="text-center text-muted">Your cart is empty</p>';
        document.getElementById('placeOrderBtn').disabled = true;
        return;
    }
    
    let html = '';
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        
        html += `
            <div class="order-item">
                <div class="order-item-image">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="order-item-details">
                    <div class="order-item-name">${item.name}</div>
                    <div class="order-item-price">₫${item.price.toLocaleString('vi-VN')} × ${item.quantity}</div>
                </div>
                <div class="order-item-total">₫${itemTotal.toLocaleString('vi-VN')}</div>
            </div>
        `;
    });
    
    orderItemsContainer.innerHTML = html;
}

function updateOrderSummary() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Calculate subtotal
    const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    // Fixed shipping cost
    const shipping = 30000;
    
    // Calculate tax (10%)
    const tax = subtotal * 0.1;
    
    // Calculate total
    const total = subtotal + shipping + tax;
    
    // Update the DOM
    document.getElementById('subtotal').textContent = `₫${subtotal.toLocaleString('vi-VN')}`;
    document.getElementById('shipping').textContent = `₫${shipping.toLocaleString('vi-VN')}`;
    document.getElementById('tax').textContent = `₫${tax.toLocaleString('vi-VN')}`;
    document.getElementById('total').textContent = `₫${total.toLocaleString('vi-VN')}`;
}

function placeOrder() {
    // Get cart items
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    if (cart.length === 0) {
        alert('Your cart is empty');
        return;
    }
    
    // Get form data
    const orderData = {
        contactInfo: {
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value
        },
        shippingAddress: {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            address: document.getElementById('address').value,
            addressLine2: document.getElementById('addressLine2').value,
            city: document.getElementById('city').value,
            province: document.getElementById('province').value,
            postalCode: document.getElementById('postalCode').value,
            country: document.getElementById('country').value,
            deliveryNotes: document.getElementById('deliveryNotes').value
        },
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
        items: cart,
        subtotal: parseFloat(document.getElementById('subtotal').textContent.replace('₫', '').replace(/,/g, '')),
        shipping: parseFloat(document.getElementById('shipping').textContent.replace('₫', '').replace(/,/g, '')),
        tax: parseFloat(document.getElementById('tax').textContent.replace('₫', '').replace(/,/g, '')),
        total: parseFloat(document.getElementById('total').textContent.replace('₫', '').replace(/,/g, ''))
    };
    
    // Validate form
    if (!validateOrderForm(orderData)) {
        return;
    }
    
    // Simulate order placement (in a real app, you would send this to your server)
    // For demo purposes, we'll just show a success message and clear the cart
    
    // Generate a random order ID
    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    document.getElementById('orderIdConfirmation').textContent = orderId;
    
    // Show confirmation modal
    const orderConfirmationModal = new bootstrap.Modal(document.getElementById('orderConfirmationModal'));
    orderConfirmationModal.show();
    
    // Clear cart
    localStorage.removeItem('cart');
    
    // In a real application, you would send the order data to your server here
    console.log('Order placed:', orderData);
}

function validateOrderForm(orderData) {
    // Basic validation
    if (!orderData.contactInfo.email || !orderData.contactInfo.phone) {
        alert('Please provide your contact information');
        return false;
    }
    
    if (!orderData.shippingAddress.firstName || !orderData.shippingAddress.lastName || 
        !orderData.shippingAddress.address || !orderData.shippingAddress.city || 
        !orderData.shippingAddress.province || !orderData.shippingAddress.postalCode) {
        alert('Please fill in all required shipping address fields');
        return false;
    }
    
    return true;
}
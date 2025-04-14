document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    checkAuthStatus();
    
    // Get DOM elements
    const orderItems = document.getElementById('orderItems');
    const subtotalElement = document.getElementById('subtotal');
    const shippingElement = document.getElementById('shipping');
    const taxElement = document.getElementById('tax');
    const totalElement = document.getElementById('total');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    
    // Load cart items
    function loadOrderItems() {
        if (!window.cartService) {
            console.error('Cart service not found. Make sure cart-service.js is loaded before checkout.js');
            return;
        }
        
        const items = window.cartService.getItems();
        
        if (items.length === 0) {
            // Redirect to product listing if cart is empty
            window.location.href = '/product-listing.html';
            return;
        }
        
        let itemsHTML = '';
        
        items.forEach(item => {
            itemsHTML += `
                <div class="order-item mb-3">
                    <div class="d-flex">
                        <div class="order-item-image me-3">
                            <img src="${item.image || '/images/placeholder.png'}" alt="${item.name}" class="img-fluid" 
                                 style="width: 60px; height: 60px; object-fit: cover;" onerror="this.src='/images/placeholder.png'">
                        </div>
                        <div class="order-item-details flex-grow-1">
                            <div class="d-flex justify-content-between">
                                <h6 class="mb-1">${item.name}</h6>
                                <span>${formatPrice(item.price)}</span>
                            </div>
                            <div class="text-muted small">${item.unit || ''}</div>
                            <div class="d-flex justify-content-between align-items-center mt-1">
                                <span>Số lượng: ${item.quantity}</span>
                                <span>${formatPrice(item.price * item.quantity)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        if (orderItems) {
            orderItems.innerHTML = itemsHTML;
        }
        
        // Update totals
        updateOrderTotals();
    }
    
    // Format price in VND
    function formatPrice(price) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    }
    
    // Update order totals
    function updateOrderTotals() {
        if (!window.cartService) return;
        
        const subtotal = window.cartService.getSubtotal();
        const shipping = 30000; // Fixed shipping cost of 30,000 VND
        const tax = Math.round(subtotal * 0.1); // 10% tax
        const total = subtotal + shipping + tax;
        
        if (subtotalElement) subtotalElement.textContent = formatPrice(subtotal);
        if (shippingElement) shippingElement.textContent = formatPrice(shipping);
        if (taxElement) taxElement.textContent = formatPrice(tax);
        if (totalElement) totalElement.textContent = formatPrice(total);
    }
    
    // Show payment method details
    const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
    if (paymentMethods) {
        paymentMethods.forEach(method => {
            method.addEventListener('change', function() {
                // Hide all payment details first
                document.getElementById('bankDetails').classList.add('d-none');
                document.getElementById('eWalletDetails').classList.add('d-none');
                
                // Show selected payment details
                if (this.id === 'bankTransfer') {
                    document.getElementById('bankDetails').classList.remove('d-none');
                } else if (this.id === 'eWallet') {
                    document.getElementById('eWalletDetails').classList.remove('d-none');
                }
            });
        });
    }
    
    // Check authentication status
    function checkAuthStatus() {
        fetch('/api/auth/status')
            .then(response => response.json())
            .then(data => {
                if (!data.isAuthenticated) {
                    document.getElementById('authPrompt').classList.remove('d-none');
                    document.querySelector('.checkout-section').classList.add('d-none');
                    document.querySelector('.order-summary-card').classList.add('d-none');
                }
            })
            .catch(error => {
                console.error('Error checking auth status:', error);
            });
    }
    
    // Place order button
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Basic form validation
            if (!validateForm()) {
                return;
            }
            
            // Process order
            processOrder();
        });
    }
    
    // Validate form
    function validateForm() {
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const address = document.getElementById('address').value;
        const city = document.getElementById('city').value;
        const province = document.getElementById('province').value;
        const postalCode = document.getElementById('postalCode').value;
        const country = document.getElementById('country').value;
    
        // Simple validation
        if (!email || !phone || !firstName || !lastName || !address || !city || !province || !postalCode || !country) {
            showToast('Vui lòng điền đầy đủ thông tin', 'error');
            return false;
        }
    
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast('Email không hợp lệ', 'error');
            return false;
        }
    
        // Phone validation (simple check for at least 10 digits)
        const phoneRegex = /^\d{10,}$/;
        if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
            showToast('Số điện thoại không hợp lệ', 'error');
            return false;
        }
    
        return true;
    }
    
    // Process order
    async function processOrder() {
        try {
            // Show loading state
            placeOrderBtn.disabled = true;
            placeOrderBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang xử lý...';
            
            // Get form data and validate it
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const firstName = document.getElementById('firstName').value;
            const lastName = document.getElementById('lastName').value;
            const address = document.getElementById('address').value;
            const addressLine2 = document.getElementById('addressLine2').value || '';
            const city = document.getElementById('city').value;
            const province = document.getElementById('province').value;
            const postalCode = document.getElementById('postalCode').value;
            const country = document.getElementById('country').value;
            const deliveryNotes = document.getElementById('deliveryNotes').value || '';
            
            // Validate required fields again
            if (!email || !phone || !firstName || !lastName || !address || !city || !province || !postalCode || !country) {
                showToast('Vui lòng điền đầy đủ thông tin', 'error');
                placeOrderBtn.disabled = false;
                placeOrderBtn.textContent = 'Đặt Hàng';
                return;
            }
            
            const orderData = {
                shippingInfo: {
                    email: email,
                    phone: phone,
                    firstName: firstName,
                    lastName: lastName,
                    address: address,
                    addressLine2: addressLine2,
                    city: city,
                    province: province,
                    postalCode: postalCode,
                    country: country,
                    deliveryNotes: deliveryNotes
                },
                paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
                items: window.cartService.getItems(),
                subtotal: window.cartService.getSubtotal(),
                shipping: 30000, // Fixed shipping cost
                tax: Math.round(window.cartService.getSubtotal() * 0.1), // 10% tax
                total: window.cartService.getSubtotal() + 30000 + Math.round(window.cartService.getSubtotal() * 0.1)
            };
            
            console.log('Sending order data:', orderData); // Add this for debugging
            
            // Send order to server
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to create order');
            }
            
            // Show success message
            showToast('Đơn hàng đã được đặt thành công!', 'success');
            
            // Clear cart
            window.cartService.clearCart();
            
            // Redirect to confirmation page or home page
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            
        } catch (error) {
            console.error('Error processing order:', error);
            showToast('Có lỗi xảy ra khi xử lý đơn hàng: ' + error.message, 'error');
            
            // Reset button state
            placeOrderBtn.disabled = false;
            placeOrderBtn.textContent = 'Đặt Hàng';
        }
    }
    
    // Show toast notification
    function showToast(message, type = 'success') {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        const toastId = 'toast-' + Date.now();
        const toastHTML = `
            <div id="${toastId}" class="toast ${type === 'error' ? 'bg-danger text-white' : 'bg-success text-white'}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <strong class="me-auto">PlannPlate</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
        toast.show();
        
        // Remove toast after it's hidden
        toastElement.addEventListener('hidden.bs.toast', function() {
            toastElement.remove();
        });
    }
    
    // Initialize
    loadOrderItems();
});
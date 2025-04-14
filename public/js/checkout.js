document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const orderItems = document.getElementById('orderItems');
    const subtotalElement = document.getElementById('subtotal');
    const shippingElement = document.getElementById('shipping');
    const taxElement = document.getElementById('tax');
    const totalElement = document.getElementById('total');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const continueShoppingBtn = document.getElementById('continueShoppingBtn');
    
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
                                <span>${window.cartService.formatPrice(item.price)}</span>
                            </div>
                            <div class="text-muted small">${item.unit || ''}</div>
                            <div class="d-flex justify-content-between align-items-center mt-1">
                                <span>Số lượng: ${item.quantity}</span>
                                <span>${window.cartService.formatPrice(item.price * item.quantity)}</span>
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
    
    // Update order totals
    function updateOrderTotals() {
        if (!window.cartService) return;
        
        const subtotal = window.cartService.getSubtotal();
        const shipping = window.cartService.getShipping();
        const tax = window.cartService.getTax();
        const total = window.cartService.getTotal();
        
        if (subtotalElement) subtotalElement.textContent = window.cartService.formatPrice(subtotal);
        if (shippingElement) shippingElement.textContent = window.cartService.formatPrice(shipping);
        if (taxElement) taxElement.textContent = window.cartService.formatPrice(tax);
        if (totalElement) totalElement.textContent = window.cartService.formatPrice(total);
    }
    
    // Place order button
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Basic form validation
            if (!validateForm()) {
                return;
            }
            
            // Process order (this would typically involve an API call)
            processOrder();
        });
    }
    
    // Continue shopping button
    if (continueShoppingBtn) {
        continueShoppingBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/product-listing.html';
        });
    }
    
    // Validate form
    function validateForm() {
        // Implement form validation logic here
        return true;
    }
    
    // Process order
    function processOrder() {
        // This would typically involve an API call to create an order
        // For now, we'll just clear the cart and show a success message
        
        // Generate a random order ID
        const orderId = 'ORD-' + Math.floor(Math.random() * 1000000);
        
        // Show success message
        alert(`Đặt hàng thành công! Mã đơn hàng của bạn là: ${orderId}`);
        
        // Clear cart
        if (window.cartService) {
            window.cartService.clearCart();
        }
        
        // Redirect to home page
        window.location.href = '/';
    }
    
    // Initialize
    loadOrderItems();
});
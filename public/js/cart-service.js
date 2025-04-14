// Cart Service - Manages shopping cart functionality
window.cartService = (function() {
    // Initialize cart from localStorage or create empty cart
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Update cart badge count
    function updateCartBadge() {
        const cartBadge = document.getElementById('cartBadge');
        if (cartBadge) {
            const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
            cartBadge.textContent = itemCount;
            
            if (itemCount > 0) {
                cartBadge.classList.remove('d-none');
            } else {
                cartBadge.classList.add('d-none');
            }
        }
    }
    
    // Save cart to localStorage
    function saveCart() {
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartBadge();
    }
    
    // Format price in VND
    function formatPrice(price) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    }
    
    // Add item to cart
    function addItem(product, quantity = 1) {
        // Check if product already exists in cart
        const existingItemIndex = cart.findIndex(item => item.id === product.id);
        
        if (existingItemIndex !== -1) {
            // Update quantity if product already in cart
            cart[existingItemIndex].quantity += quantity;
        } else {
            // Add new item to cart
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                unit: product.unit,
                quantity: quantity
            });
        }
        
        saveCart();
        showAddToCartToast(product.name, quantity);
    }
    
    // Remove item from cart
    function removeItem(productId) {
        cart = cart.filter(item => item.id !== productId);
        saveCart();
    }
    
    // Update item quantity
    function updateQuantity(productId, quantity) {
        const itemIndex = cart.findIndex(item => item.id === productId);
        
        if (itemIndex !== -1) {
            if (quantity > 0) {
                cart[itemIndex].quantity = quantity;
            } else {
                // Remove item if quantity is 0 or negative
                cart.splice(itemIndex, 1);
            }
            
            saveCart();
        }
    }
    
    // Get all items in cart
    function getItems() {
        return cart;
    }
    
    // Get cart subtotal
    function getSubtotal() {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }
    
    // Clear cart
    function clearCart() {
        cart = [];
        saveCart();
    }
    
    // Show toast notification when adding to cart
    function showAddToCartToast(productName, quantity) {
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
            <div id="${toastId}" class="toast bg-success text-white" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <strong class="me-auto">Giỏ Hàng</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    Đã thêm ${quantity} ${productName} vào giỏ hàng.
                    <div class="mt-2">
                        <a href="/checkout.html" class="btn btn-sm btn-light">Thanh Toán</a>
                    </div>
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
    
    // Initialize cart badge on page load
    document.addEventListener('DOMContentLoaded', updateCartBadge);
    
    // Public API
    return {
        addItem,
        removeItem,
        updateQuantity,
        getItems,
        getSubtotal,
        clearCart,
        formatPrice
    };
})();
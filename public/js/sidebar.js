document.addEventListener('DOMContentLoaded', function() {
    // Cart sidebar functionality
    const cartBtn = document.getElementById('cartBtn');
    const cartSidebar = document.getElementById('cartSidebar');
    const cartSidebarOverlay = document.getElementById('cartSidebarOverlay');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const cartItems = document.getElementById('cartItems');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartTotal = document.getElementById('cartTotal');
    const cartNotes = document.getElementById('cartNotes');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    // Account sidebar functionality
    const accountBtn = document.getElementById('accountBtn');
    const accountSidebar = document.getElementById('accountSidebar');
    const accountSidebarOverlay = document.getElementById('accountSidebarOverlay');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const returnToStoreBtn = document.getElementById('returnToStoreBtn');
    
    // Render cart items
    function renderCartItems() {
        if (!cartItems) return;
        
        const items = window.cartService ? window.cartService.getItems() : [];
        
        if (items.length === 0) {
            cartItems.innerHTML = `
                <div class="empty-cart text-center py-4">
                    <i class="bi bi-cart-x" style="font-size: 3rem; color: #ccc;"></i>
                    <p class="mt-3">Giỏ hàng của bạn đang trống</p>
                    <a href="/product-listing.html" class="btn btn-outline-primary mt-2">Tiếp tục mua sắm</a>
                </div>
            `;
        } else {
            let itemsHTML = '';
            
            items.forEach(item => {
                itemsHTML += `
                    <div class="cart-item" data-product-id="${item.id}">
                        <div class="cart-item-image">
                            <img src="${item.image || 'images/placeholder.png'}" alt="${item.name}" 
                                 onerror="this.src='images/placeholder.png'">
                        </div>
                        <div class="cart-item-details">
                            <div class="cart-item-name">${item.name}</div>
                            <div class="cart-item-category">${item.category || 'Sản phẩm'}</div>
                            <div class="cart-item-price">₫${item.price.toLocaleString('vi-VN')}</div>
                            <div class="cart-item-quantity">
                                <button class="quantity-btn minus-btn" data-id="${item.id}">-</button>
                                <input type="text" class="quantity-input" value="${item.quantity}" readonly>
                                <button class="quantity-btn plus-btn" data-id="${item.id}">+</button>
                            </div>
                            <a href="#" class="cart-item-remove" data-id="${item.id}">Xóa</a>
                        </div>
                    </div>
                `;
            });
            
            cartItems.innerHTML = itemsHTML;
            
            // Add event listeners for quantity buttons and remove links
            document.querySelectorAll('.minus-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    const item = items.find(item => item.id === id);
                    if (item && item.quantity > 1 && window.cartService) {
                        window.cartService.updateItemQuantity(id, item.quantity - 1);
                        renderCartItems();
                        updateCartTotals();
                    }
                });
            });
            
            document.querySelectorAll('.plus-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    const item = items.find(item => item.id === id);
                    if (item && window.cartService) {
                        window.cartService.updateItemQuantity(id, item.quantity + 1);
                        renderCartItems();
                        updateCartTotals();
                    }
                });
            });
            
            document.querySelectorAll('.cart-item-remove').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const id = this.getAttribute('data-id');
                    if (window.cartService) {
                        window.cartService.removeItem(id);
                        renderCartItems();
                        updateCartTotals();
                    }
                });
            });
        }
    }
    
    // Update cart totals
    function updateCartTotals() {
        if (!window.cartService) return;
        
        if (cartSubtotal) {
            cartSubtotal.textContent = window.cartService.formatPrice(window.cartService.getSubtotal());
        }
        
        if (cartTotal) {
            cartTotal.textContent = window.cartService.formatPrice(window.cartService.getTotal());
        }
    }
    
    // Update cart notes
    function updateCartNotes() {
        if (!cartNotes || !window.cartService) return;
        
        cartNotes.value = window.cartService.getNotes();
        
        // Save notes when changed
        cartNotes.addEventListener('change', () => {
            window.cartService.setNotes(cartNotes.value);
        });
    }
    
    // Open cart sidebar
    if (cartBtn) {
        cartBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (cartSidebar) {
                cartSidebar.classList.add('active');
                document.body.classList.add('sidebar-open');
                renderCartItems();
                updateCartTotals();
                updateCartNotes();
            }
        });
    }
    
    // Close cart sidebar
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', function() {
            if (cartSidebar) {
                cartSidebar.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        });
    }
    
    // Close cart sidebar when clicking overlay
    if (cartSidebarOverlay) {
        cartSidebarOverlay.addEventListener('click', function() {
            if (cartSidebar) {
                cartSidebar.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        });
    }
    
    // Checkout button
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function() {
            window.location.href = '/checkout.html';
        });
    }
    
    // Account sidebar functionality
    if (accountBtn) {
        accountBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (accountSidebar) {
                accountSidebar.classList.add('active');
                document.body.classList.add('sidebar-open');
            }
        });
    }
    
    // Close account sidebar
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', function() {
            if (accountSidebar) {
                accountSidebar.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        });
    }
    
    // Close account sidebar when clicking overlay
    if (accountSidebarOverlay) {
        accountSidebarOverlay.addEventListener('click', function() {
            if (accountSidebar) {
                accountSidebar.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        });
    }
    
    // Return to store button
    if (returnToStoreBtn) {
        returnToStoreBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (accountSidebar) {
                accountSidebar.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        });
    }
    
    // Listen for cart updates
    document.addEventListener('cartUpdated', function() {
        renderCartItems();
        updateCartTotals();
        
        // Update cart count badge
        const cartCountElement = document.getElementById('cartCount');
        if (cartCountElement && window.cartService) {
            const count = window.cartService.getCount();
            cartCountElement.textContent = count;
            
            // Show/hide badge based on count
            if (count > 0) {
                cartCountElement.classList.remove('d-none');
            } else {
                cartCountElement.classList.add('d-none');
            }
        }
    });
    
    // Initial render if cart sidebar is visible
    if (cartSidebar && cartSidebar.classList.contains('active')) {
        renderCartItems();
        updateCartTotals();
        updateCartNotes();
    }
    
    // Initial cart count update
    const cartCountElement = document.getElementById('cartCount');
    if (cartCountElement && window.cartService) {
        const count = window.cartService.getCount();
        cartCountElement.textContent = count;
        
        // Show/hide badge based on count
        if (count > 0) {
            cartCountElement.classList.remove('d-none');
        } else {
            cartCountElement.classList.add('d-none');
        }
    }
});
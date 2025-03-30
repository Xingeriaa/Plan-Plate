document.addEventListener('DOMContentLoaded', function() {
    const accountBtn = document.getElementById('accountBtn');
    const accountSidebar = document.getElementById('accountSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const accountSidebarOverlay = document.getElementById('accountSidebarOverlay');
    const returnToStoreBtn = document.getElementById('returnToStoreBtn');
    
    const cartBtn = document.getElementById('cartBtn');
    const cartSidebar = document.getElementById('cartSidebar');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const cartSidebarOverlay = document.getElementById('cartSidebarOverlay');
    const cartItemsContainer = document.getElementById('cartItems');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const cartCount = document.getElementById('cartCount');
    
    let cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
    
    function openSidebar() {
        if (cartSidebar.classList.contains('active')) {
            closeCartSidebar();
        }
        accountSidebar.classList.add('active');
        accountSidebarOverlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    function closeSidebar() {
        accountSidebar.classList.remove('active');
        accountSidebarOverlay.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    function openCartSidebar() {
        if (accountSidebar.classList.contains('active')) {
            closeSidebar();
        }
        cartSidebar.classList.add('active');
        cartSidebarOverlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
        renderCartItems();
    }
    
    function closeCartSidebar() {
        cartSidebar.classList.remove('active');
        cartSidebarOverlay.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    function checkAuthStatus() {
        return fetch('/auth/check', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => response.json())
        .catch(error => {
            console.error('Authentication check failed:', error);
            return { authenticated: false };
        });
    }
    
    function renderCartItems() {
        cartItemsContainer.innerHTML = '';
        
        if (cartItems.length === 0) {
            cartItemsContainer.innerHTML = '<p class="text-center my-5">Your cart is empty</p>';
            cartSubtotal.textContent = '₫0';
            cartTotal.textContent = '₫0';
            return;
        }
        
        let subtotal = 0;
        
        cartItems.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;
            
            const cartItemElement = document.createElement('div');
            cartItemElement.className = 'cart-item';
            cartItemElement.innerHTML = `
                <div class="cart-item-image">
                    <img src="${item.image || 'images/placeholder.png'}" alt="${item.name}" onerror="this.src='images/placeholder.png'">
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-type">${item.category || 'Product'}</div>
                    <div class="cart-item-total">Total: ₫${(itemTotal).toLocaleString('vi-VN')}</div>
                    <div class="cart-item-quantity">
                        <button class="quantity-btn minus-btn" data-index="${index}">-</button>
                        <input type="text" class="quantity-input" value="${item.quantity}" readonly>
                        <button class="quantity-btn plus-btn" data-index="${index}">+</button>
                    </div>
                    <a href="#" class="cart-item-remove" data-index="${index}">Remove</a>
                </div>
            `;
            
            cartItemsContainer.appendChild(cartItemElement);
        });
        
        cartSubtotal.textContent = '₫' + subtotal.toLocaleString('vi-VN');
        cartTotal.textContent = '₫' + subtotal.toLocaleString('vi-VN');

        document.querySelectorAll('.minus-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                if (cartItems[index].quantity > 1) {
                    cartItems[index].quantity -= 1;
                    updateCart();
                }
            });
        });
        
        document.querySelectorAll('.plus-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                cartItems[index].quantity += 1;
                updateCart();
            });
        });
        
        document.querySelectorAll('.cart-item-remove').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const index = parseInt(this.getAttribute('data-index'));
                cartItems.splice(index, 1);
                updateCart();
            });
        });
    }
    
    function updateCart() {
        localStorage.setItem('cartItems', JSON.stringify(cartItems));
        updateCartCount();
        renderCartItems();
    }
    
    function updateCartCount() {
        const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
        if (cartCount) {
            cartCount.textContent = totalItems;
        }
    }
    
    if (accountBtn) {
        accountBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            checkAuthStatus().then(data => {
                if (data.authenticated) {
                    window.location.href = '/profile';
                } else {
                    openSidebar();
                }
            });
        });
    }
    
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }
    
    if (accountSidebarOverlay) {
        accountSidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    if (returnToStoreBtn) {
        returnToStoreBtn.addEventListener('click', function(e) {
            e.preventDefault();
            closeSidebar();
        });
    }
    
    if (cartBtn) {
        cartBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openCartSidebar();
        });
    }
    
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', closeCartSidebar);
    }
    
    if (cartSidebarOverlay) {
        cartSidebarOverlay.addEventListener('click', closeCartSidebar);
    }
    
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function() {
            if (cartItems.length === 0) {
                alert('Your cart is empty');
            } else {
                window.location.href = '/checkout.html';
            }
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (accountSidebar && accountSidebar.classList.contains('active')) {
                closeSidebar();
            }
            if (cartSidebar && cartSidebar.classList.contains('active')) {
                closeCartSidebar();
            }
        }
    });
    
    updateCartCount();
});
document.addEventListener('DOMContentLoaded', function() {
    // Get product ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
        showError('Product ID is missing');
        return;
    }
    
    // Fetch product details
    fetchProductDetails(productId);
    
    // Setup quantity buttons
    document.getElementById('decreaseQuantity').addEventListener('click', function() {
        const quantityInput = document.getElementById('quantity');
        const currentValue = parseInt(quantityInput.value);
        if (currentValue > 1) {
            quantityInput.value = currentValue - 1;
        }
    });
    
    document.getElementById('increaseQuantity').addEventListener('click', function() {
        const quantityInput = document.getElementById('quantity');
        const currentValue = parseInt(quantityInput.value);
        const stockQuantity = parseInt(document.getElementById('stockQuantity').getAttribute('data-stock') || 0);
        
        if (currentValue < stockQuantity) {
            quantityInput.value = currentValue + 1;
        } else {
            alert('Cannot add more than available stock');
        }
    });
    
    // Add to cart button
    document.getElementById('addToCartBtn').addEventListener('click', function() {
        const quantity = parseInt(document.getElementById('quantity').value);
        addToCart(productId, quantity);
    });
    
    // Buy now button
    document.getElementById('buyNowBtn').addEventListener('click', function() {
        const quantity = parseInt(document.getElementById('quantity').value);
        addToCart(productId, quantity, true);
    });
});

async function fetchProductDetails(productId) {
    try {
        const response = await fetch(`/api/product/${productId}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch product details');
        }
        
        const product = await response.json();
        
        if (!product) {
            showError('Product not found');
            return;
        }
        
        // Update product details in the UI
        updateProductUI(product);
        
        // Fetch related products from the same category
        if (product.IDDanhMuc) {
            fetchRelatedProducts(product.IDDanhMuc, productId);
        } else {
            // If no category ID, show a message
            document.getElementById('relatedProductsContainer').innerHTML = 
                '<div class="col-12"><p class="text-muted">No related products available</p></div>';
        }
        
    } catch (error) {
        console.error('Error fetching product details:', error);
        showError('Failed to load product details');
    }
}

function updateProductUI(product) {
    // Update product name
    document.getElementById('productName').textContent = product.TenSanPham;
    document.getElementById('productBreadcrumb').textContent = product.TenSanPham;
    
    // Update product image
    const productImage = document.getElementById('productImage');
    productImage.src = product.HinhAnhSanPham;
    productImage.alt = product.TenSanPham;
    
    // Update product category
    document.getElementById('productCategory').textContent = product.TenDanhMuc || 'Unknown';
    
    // Update product price
    document.getElementById('productPrice').textContent = `₫${product.Gia.toLocaleString('vi-VN')}`;
    document.getElementById('productUnit').textContent = `/ ${product.DonViBan || 'unit'}`;
    
    // Update product description
    document.getElementById('productDescription').textContent = product.MoTa || 'No description available';
    
    // Update stock information
    const stockStatus = document.getElementById('stockStatus');
    const stockQuantity = document.getElementById('stockQuantity');
    
    if (product.SoLuongTon > 0) {
        stockStatus.textContent = 'Còn hàng';
        stockStatus.className = 'badge bg-success';
        stockQuantity.textContent = `Available: ${product.SoLuongTon}`;
        stockQuantity.setAttribute('data-stock', product.SoLuongTon);
        
        // Enable add to cart and buy now buttons
        document.getElementById('addToCartBtn').disabled = false;
        document.getElementById('buyNowBtn').disabled = false;
    } else {
        stockStatus.textContent = 'Hết hàng';
        stockStatus.className = 'badge bg-danger';
        stockQuantity.textContent = 'Not available';
        stockQuantity.setAttribute('data-stock', 0);
        
        // Disable add to cart and buy now buttons
        document.getElementById('addToCartBtn').disabled = true;
        document.getElementById('buyNowBtn').disabled = true;
    }
    
    // Update page title
    document.title = `${product.TenSanPham} - PlannPlate`;
}

async function fetchRelatedProducts(categoryId, currentProductId) {
    try {
        // Fix: Use the correct API endpoint from app.js
        const response = await fetch(`/api/products/${categoryId}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch related products');
        }
        
        const products = await response.json();
        
        // Filter out the current product and limit to 4 related products
        const relatedProducts = products
            .filter(product => product.IDSanPham != currentProductId)
            .slice(0, 4);
        
        displayRelatedProducts(relatedProducts);
        
    } catch (error) {
        console.error('Error fetching related products:', error);
        document.getElementById('relatedProductsContainer').innerHTML = 
            '<div class="col-12"><p class="text-muted">Failed to load related products</p></div>';
    }
}

function displayRelatedProducts(products) {
    const container = document.getElementById('relatedProductsContainer');
    
    if (!products || products.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-muted">Không tìm thấy sản phẩm liên quan</p></div>';
        return;
    }
    
    let html = '';
    
    products.forEach(product => {
        // Format price with Vietnamese locale
        const formattedPrice = product.Gia.toLocaleString('vi-VN');
        
        html += `
            <div class="col-md-3 col-sm-6 mb-4">
                <div class="related-product-card">
                    <div class="product-image">
                        <img src="${product.HinhAnhSanPham}" alt="${product.TenSanPham}">
                        <div class="product-overlay">
                            <button class="quick-add-btn" onclick="addToCart('${product.IDSanPham}', 1)">
                                <i class="bi bi-cart-plus"></i>
                            </button>
                        </div>
                    </div>
                    <div class="product-info">
                        <h5 class="product-title">${product.TenSanPham}</h5>
                        <div class="product-meta">
                            <span class="product-unit">${product.DonViBan || ''}</span>
                            <span class="product-price">₫${formattedPrice}</span>
                        </div>
                        <a href="/product-detail.html?id=${product.IDSanPham}" class="view-details-btn">Xem chi tiết</a>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Update the addToCart function to handle the buyNow parameter
function addToCart(productId, quantity, buyNow = false) {
    // Get current cart from localStorage
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Check if product already exists in cart
    const existingProductIndex = cart.findIndex(item => item.id === productId);
    
    if (existingProductIndex > -1) {
        // Update quantity if product already in cart
        cart[existingProductIndex].quantity += quantity;
        
        // Save updated cart to localStorage
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Update cart count
        updateCartCount();
        
        // Show cart sidebar or redirect to checkout
        if (buyNow) {
            window.location.href = '/checkout.html';
        } else {
            document.getElementById('cartSidebar').classList.add('active');
            updateCartItems();
        }
    } else {
        // Add new product to cart
        fetch(`/api/product/${productId}`)
            .then(response => response.json())
            .then(product => {
                cart.push({
                    id: productId,
                    name: product.TenSanPham,
                    price: product.Gia,
                    image: product.HinhAnhSanPham,
                    quantity: quantity,
                    unit: product.DonViBan
                });
                
                // Save updated cart to localStorage
                localStorage.setItem('cart', JSON.stringify(cart));
                
                // Update cart count
                updateCartCount();
                
                // Show cart sidebar or redirect to checkout
                if (buyNow) {
                    window.location.href = '/checkout.html';
                } else {
                    document.getElementById('cartSidebar').classList.add('active');
                    updateCartItems();
                }
            })
            .catch(error => {
                console.error('Error fetching product details for cart:', error);
                alert('Failed to add product to cart');
            });
    }
}

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById('cartCount').textContent = totalItems;
}

function updateCartItems() {
    const cartItemsContainer = document.getElementById('cartItems');
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
        document.getElementById('cartSubtotal').textContent = '₫0';
        document.getElementById('cartTotal').textContent = '₫0';
        return;
    }
    
    let html = '';
    let subtotal = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        html += `
            <div class="cart-item">
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <div class="cart-item-price">₫${item.price.toLocaleString('vi-VN')} × ${item.quantity}</div>
                    <div class="cart-item-unit">${item.unit || ''}</div>
                </div>
                <div class="cart-item-actions">
                    <button class="btn btn-sm btn-outline-danger" onclick="removeCartItem(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    cartItemsContainer.innerHTML = html;
    document.getElementById('cartSubtotal').textContent = `₫${subtotal.toLocaleString('vi-VN')}`;
    document.getElementById('cartTotal').textContent = `₫${subtotal.toLocaleString('vi-VN')}`;
}

function removeCartItem(index) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    if (index >= 0 && index < cart.length) {
        cart.splice(index, 1);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        updateCartItems();
    }
}

function showError(message) {
    const container = document.getElementById('productDetailContainer');
    container.innerHTML = `
        <div class="col-12">
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i> ${message}
            </div>
            <a href="/product-listing.html" class="btn btn-primary">
                <i class="bi bi-arrow-left me-2"></i> Back to Products
            </a>
        </div>
    `;
}

// Initialize cart count when page loads
updateCartCount();
document.addEventListener('DOMContentLoaded', function() {
    // Get product ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
        window.location.href = '/product-listing.html';
        return;
    }
    
    // Elements
    const productImage = document.getElementById('productImage');
    const productName = document.getElementById('productName');
    const productCategory = document.getElementById('productCategory');
    const productPrice = document.getElementById('productPrice');
    const productUnit = document.getElementById('productUnit');
    const productDescription = document.getElementById('productDescription');
    const stockStatus = document.getElementById('stockStatus');
    const stockQuantity = document.getElementById('stockQuantity');
    const quantityInput = document.getElementById('quantity');
    const decreaseBtn = document.getElementById('decreaseQuantity');
    const increaseBtn = document.getElementById('increaseQuantity');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const buyNowBtn = document.getElementById('buyNowBtn');
    const productBreadcrumb = document.getElementById('productBreadcrumb');
    const relatedProductsContainer = document.getElementById('relatedProductsContainer');
    
    // Fetch product details
    fetchProductDetails(productId);
    
    // Event listeners for quantity buttons
    decreaseBtn.addEventListener('click', function() {
        let currentValue = parseInt(quantityInput.value);
        if (currentValue > 1) {
            quantityInput.value = currentValue - 1;
        }
    });
    
    increaseBtn.addEventListener('click', function() {
        let currentValue = parseInt(quantityInput.value);
        let maxStock = parseInt(quantityInput.getAttribute('max') || 999);
        if (currentValue < maxStock) {
            quantityInput.value = currentValue + 1;
        }
    });
    
    // Prevent manual input of invalid quantities
    quantityInput.addEventListener('change', function() {
        let value = parseInt(this.value);
        let min = parseInt(this.getAttribute('min') || 1);
        let max = parseInt(this.getAttribute('max') || 999);
        
        if (isNaN(value) || value < min) {
            this.value = min;
        } else if (value > max) {
            this.value = max;
        }
    });
    
    // Add to cart button
    addToCartBtn.addEventListener('click', function() {
        const product = addToCartBtn.dataset;
        const quantity = parseInt(quantityInput.value);
        
        if (product.id && product.name && product.price) {
            addToCart(
                parseInt(product.id),
                product.name,
                parseFloat(product.price),
                product.image || 'images/placeholder.png',
                quantity,
                product.category
            );
            
            // Show success message
            alert('Product added to cart!');
        }
    });
    
    // Buy now button
    buyNowBtn.addEventListener('click', function() {
        const product = addToCartBtn.dataset;
        const quantity = parseInt(quantityInput.value);
        
        if (product.id && product.name && product.price) {
            addToCart(
                parseInt(product.id),
                product.name,
                parseFloat(product.price),
                product.image || 'images/placeholder.png',
                quantity,
                product.category
            );
            
            // Redirect to checkout
            window.location.href = '/checkout.html';
        }
    });
    
    // Function to fetch product details
    async function fetchProductDetails(id) {
        try {
            const response = await fetch(`/api/products/${id}`);
            if (!response.ok) {
                throw new Error('Product not found');
            }
            
            const product = await response.json();
            
            // Update UI with product details
            displayProductDetails(product);
            
            // Fetch related products
            fetchRelatedProducts(product.IDDanhMuc, product.IDSanPham);
            
        } catch (error) {
            console.error('Error fetching product details:', error);
            alert('Failed to load product details. Please try again later.');
        }
    }
    
    // Function to display product details
    // Function to display product details
    function displayProductDetails(product) {
        console.log('Product data received:', product); // Debug log
        
        if (!product || typeof product !== 'object') {
            console.error('Invalid product data received:', product);
            alert('Error loading product details. Please try again later.');
            return;
        }
        
        // Update breadcrumb
        productBreadcrumb.textContent = product.TenSanPham || 'Product Detail';
        
        // Update page title
        document.title = `PlannPlate - ${product.TenSanPham || 'Product Detail'}`;
        
        // Update product details
        productImage.src = product.HinhAnhSanPham || 'images/placeholder.png';
        productImage.alt = product.TenSanPham || 'Product Image';
        
        productName.textContent = product.TenSanPham || 'Product Name';
        productCategory.textContent = product.TenDanhMuc || 'Uncategorized';
        
        // Handle price formatting safely
        const price = typeof product.Gia === 'number' ? product.Gia : 0;
        productPrice.textContent = `₫${price.toLocaleString('vi-VN')}`;
        productUnit.textContent = `/ ${product.DonViBan || 'unit'}`;
        productDescription.textContent = product.MoTa || 'No description available for this product.';
        
        // Update stock information
        const stockQuantityValue = typeof product.SoLuongTon === 'number' ? product.SoLuongTon : 0;
        const inStock = stockQuantityValue > 0;
        stockStatus.textContent = inStock ? 'In Stock' : 'Out of Stock';
        stockStatus.className = inStock ? 'badge bg-success' : 'badge bg-danger';
        stockQuantity.textContent = `Available: ${stockQuantityValue}`;
        
        // Set max quantity to stock amount
        quantityInput.setAttribute('max', stockQuantityValue);
        
        // Disable add to cart and buy now buttons if out of stock
        if (!inStock) {
            addToCartBtn.disabled = true;
            addToCartBtn.classList.add('disabled');
            buyNowBtn.disabled = true;
            buyNowBtn.classList.add('disabled');
            quantityInput.disabled = true;
            decreaseBtn.disabled = true;
            increaseBtn.disabled = true;
        }
        
        // Store product data for add to cart functionality
        addToCartBtn.dataset.id = product.IDSanPham || '';
        addToCartBtn.dataset.name = product.TenSanPham || '';
        addToCartBtn.dataset.price = price;
        addToCartBtn.dataset.image = product.HinhAnhSanPham || 'images/placeholder.png';
        addToCartBtn.dataset.category = product.TenDanhMuc || 'Product';
    }
    
    // Function to fetch related products
    async function fetchRelatedProducts(categoryId, currentProductId) {
        if (!categoryId) return;
        
        try {
            const response = await fetch(`/api/categories/${categoryId}/products`);
            if (!response.ok) {
                throw new Error('Failed to fetch related products');
            }
            
            let products = await response.json();
            
            // Filter out current product and limit to 4 related products
            products = products
                .filter(p => p.IDSanPham != currentProductId)
                .slice(0, 4);
            
            displayRelatedProducts(products);
            
        } catch (error) {
            console.error('Error fetching related products:', error);
        }
    }
    
    // Function to display related products
    function displayRelatedProducts(products) {
        relatedProductsContainer.innerHTML = '';
        
        if (!Array.isArray(products) || products.length === 0) {
            relatedProductsContainer.innerHTML = '<div class="col-12 text-center"><p>No related products found.</p></div>';
            return;
        }
        
        products.forEach(product => {
            if (!product) return;
            
            const stockQuantity = typeof product.SoLuongTon === 'number' ? product.SoLuongTon : 0;
            const isOutOfStock = stockQuantity <= 0;
            const price = typeof product.Gia === 'number' ? product.Gia : 0;
            
            const productCard = document.createElement('div');
            productCard.className = 'col-md-3 col-sm-6 mb-4';
            productCard.innerHTML = `
                <div class="related-product-card ${isOutOfStock ? 'out-of-stock' : ''}">
                    ${isOutOfStock ? '<div class="out-of-stock-label">Out of Stock</div>' : ''}
                    <div class="related-product-img">
                        <img src="${product.HinhAnhSanPham || 'images/placeholder.png'}" alt="${product.TenSanPham || 'Product'}" onerror="this.src='images/placeholder.png'">
                    </div>
                    <div class="related-product-info">
                        <h6 class="related-product-title">${product.TenSanPham || 'Product'}</h6>
                        <div class="related-product-price">₫${price.toLocaleString('vi-VN')}</div>
                        <div class="d-flex justify-content-between mt-3">
                            <a href="/product-detail.html?id=${product.IDSanPham}" class="btn btn-outline-primary btn-sm">View</a>
                            <button class="btn btn-primary btn-sm ${isOutOfStock ? 'disabled' : ''}" 
                                ${isOutOfStock ? 'disabled' : ''} 
                                onclick="addToCart(${product.IDSanPham}, '${product.TenSanPham || 'Product'}', ${price}, '${product.HinhAnhSanPham || 'images/placeholder.png'}', 1)">
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            `;
            relatedProductsContainer.appendChild(productCard);
        });
    }
    
    // Function to add product to cart
    function addToCart(id, name, price, image, quantity, category) {
        // Get existing cart items from localStorage
        let cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
        
        // Check if product already exists in cart
        const existingItemIndex = cartItems.findIndex(item => item.id === id);
        
        if (existingItemIndex !== -1) {
            // Update quantity if product already in cart
            cartItems[existingItemIndex].quantity += quantity;
        } else {
            // Add new item to cart
            cartItems.push({
                id: id,
                name: name,
                price: price,
                image: image,
                quantity: quantity,
                category: category || 'Product'
            });
        }
        
        // Save updated cart to localStorage
        localStorage.setItem('cartItems', JSON.stringify(cartItems));
        
        // Update cart count in header
        updateCartCount();
    }
    
    // Function to update cart count
    function updateCartCount() {
        const cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
        const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
        
        const cartCountElement = document.getElementById('cartCount');
        if (cartCountElement) {
            cartCountElement.textContent = totalItems;
        }
    }
    
    // Initialize cart count
    updateCartCount();
});
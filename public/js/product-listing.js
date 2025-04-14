document.addEventListener('DOMContentLoaded', function() {
    let allProducts = [];
    let categories = [];
    let currentCategoryId = 'all';
    let currentPage = 1;
    const productsPerPage = 9; // Show 9 products per page (3x3 grid)
    
    // Check URL parameters for category and page
    function getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }
    
    // Get category from URL if present
    const urlCategory = getUrlParameter('category');
    if (urlCategory) {
        currentCategoryId = urlCategory;
    }
    
    // Get page from URL if present
    const urlPage = getUrlParameter('page');
    if (urlPage && !isNaN(parseInt(urlPage))) {
        currentPage = parseInt(urlPage);
    }
    
    // Load categories
    function loadCategories() {
        fetch('/api/categories')
            .then(response => response.json())
            .then(data => {
                categories = data;
                renderCategories();
                loadAllProducts();
            })
            .catch(error => console.error('Error loading categories:', error));
    }
    
    // Render categories in sidebar
    function renderCategories() {
        const categoryList = document.getElementById('categoryList');
        if (!categoryList) return;
        
        // Keep the "All" category
        let html = `
            <div class="category-item ${currentCategoryId === 'all' ? 'active' : ''}" data-category-id="all">
                Tất Cả (<span id="allProductCount">0</span>)
            </div>
        `;
        
        categories.forEach(category => {
            html += `
                <div class="category-item ${currentCategoryId === category.IDDanhMuc ? 'active' : ''}" 
                     data-category-id="${category.IDDanhMuc}">
                    ${category.TenDanhMuc} (<span id="category-${category.IDDanhMuc}-count">0</span>)
                </div>
            `;
        });
        
        categoryList.innerHTML = html;
        
        // Add event listeners to category items
        document.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', function() {
                const categoryId = this.getAttribute('data-category-id');
                currentCategoryId = categoryId;
                currentPage = 1; // Reset to first page when changing category
                
                // Update active class
                document.querySelectorAll('.category-item').forEach(el => {
                    el.classList.remove('active');
                });
                this.classList.add('active');
                
                // Update breadcrumb
                updateBreadcrumb();
                
                // Update URL parameters
                updateUrlParams();
                
                // Filter and render products
                filterProducts();
            });
        });
    }
    
    // Update URL parameters without reloading the page
    function updateUrlParams() {
        const url = new URL(window.location);
        
        if (currentCategoryId === 'all') {
            url.searchParams.delete('category');
        } else {
            url.searchParams.set('category', currentCategoryId);
        }
        
        if (currentPage === 1) {
            url.searchParams.delete('page');
        } else {
            url.searchParams.set('page', currentPage);
        }
        
        window.history.pushState({}, '', url);
    }
    
    // Update breadcrumb based on current category
    function updateBreadcrumb() {
        const breadcrumb = document.getElementById('categoryBreadcrumb');
        if (!breadcrumb) return;
        
        if (currentCategoryId === 'all') {
            breadcrumb.textContent = 'Tất Cả Sản Phẩm';
        } else {
            const category = categories.find(c => c.IDDanhMuc === currentCategoryId);
            if (category) {
                breadcrumb.textContent = category.TenDanhMuc;
            }
        }
    }
    
    // Load all products from all categories
    function loadAllProducts() {
        fetch('/api/products')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text().then(text => {
                    try {
                        return JSON.parse(text);
                    } catch (err) {
                        console.error('Failed to parse JSON:', text);
                        throw new Error('Invalid JSON response');
                    }
                });
            })
            .then(data => {
                allProducts = data;
                
                // Update category counts
                updateCategoryCounts();
                
                // Set up search functionality
                setupSearch();
                
                // Filter and render products
                filterProducts();
                
                // Update breadcrumb
                updateBreadcrumb();
            })
            .catch(error => {
                console.error('Error loading products:', error);
                showToast('Không thể tải danh sách sản phẩm. Vui lòng thử lại sau.', 'error');
            });
    }
    
    // Update category counts
    function updateCategoryCounts() {
        // Update all products count
        const allProductCount = document.getElementById('allProductCount');
        if (allProductCount) {
            allProductCount.textContent = allProducts.length;
        }
        
        // Update individual category counts
        categories.forEach(category => {
            const count = allProducts.filter(product => product.IDDanhMuc === category.IDDanhMuc).length;
            const countElement = document.getElementById(`category-${category.IDDanhMuc}-count`);
            if (countElement) {
                countElement.textContent = count;
            }
        });
    }
    
    // Set up search functionality
    function setupSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');
        
        if (!searchInput || !searchResults) return;
        
        searchInput.addEventListener('input', debounce(function() {
            const query = this.value.trim().toLowerCase();
            
            if (query.length < 2) {
                searchResults.innerHTML = '';
                searchResults.classList.add('d-none');
                return;
            }
            
            const filteredProducts = allProducts.filter(product => 
                product.TenSanPham.toLowerCase().includes(query)
            ).slice(0, 5); // Limit to 5 results
            
            if (filteredProducts.length === 0) {
                searchResults.innerHTML = '<div class="p-3">Không tìm thấy sản phẩm nào</div>';
            } else {
                let html = '';
                filteredProducts.forEach(product => {
                    html += `
                        <a href="/product-detail.html?id=${product.IDSanPham}" class="search-result-item">
                            <div class="search-result-img">
                                <img src="${product.HinhAnhSanPham || 'images/placeholder.png'}" alt="${product.TenSanPham}">
                            </div>
                            <div class="search-result-info">
                                <div class="search-result-name">${product.TenSanPham}</div>
                                <div class="search-result-price">₫${product.Gia.toLocaleString('vi-VN')}</div>
                            </div>
                        </a>
                    `;
                });
                searchResults.innerHTML = html;
            }
            
            searchResults.classList.remove('d-none');
        }, 300));
        
        // Hide search results when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.add('d-none');
            }
        });
    }
    
    // Debounce function to limit API calls
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    // Filter and sort products based on current category and sort option
    function filterProducts() {
        let filteredProducts = [...allProducts];
        
        // Filter by category if not "all"
        if (currentCategoryId !== 'all') {
            filteredProducts = filteredProducts.filter(product => product.IDDanhMuc === currentCategoryId);
        }
        
        // Get sort option
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            const sortOption = sortSelect.value;
            
            // Sort products based on selected option
            switch (sortOption) {
                case 'name-asc':
                    filteredProducts.sort((a, b) => a.TenSanPham.localeCompare(b.TenSanPham));
                    break;
                case 'name-desc':
                    filteredProducts.sort((a, b) => b.TenSanPham.localeCompare(a.TenSanPham));
                    break;
                case 'price-asc':
                    filteredProducts.sort((a, b) => a.Gia - b.Gia);
                    break;
                case 'price-desc':
                    filteredProducts.sort((a, b) => b.Gia - a.Gia);
                    break;
            }
        }
        
        // Update product count
        const productCountElement = document.getElementById('productCount');
        if (productCountElement) {
            productCountElement.textContent = filteredProducts.length;
        }
        
        // Calculate pagination
        const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
        
        // Adjust current page if it's out of bounds
        if (currentPage > totalPages) {
            currentPage = totalPages > 0 ? totalPages : 1;
            updateUrlParams();
        }
        
        // Get products for current page
        const startIndex = (currentPage - 1) * productsPerPage;
        const endIndex = startIndex + productsPerPage;
        const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
        
        // Render products and pagination
        renderProducts(paginatedProducts);
        renderPagination(totalPages);
    }
    
    // Render pagination controls
    function renderPagination(totalPages) {
        const paginationContainer = document.getElementById('paginationContainer');
        if (!paginationContainer) return;
        
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Previous button
        html += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
        `;
        
        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // Adjust start page if end page is at max
        if (endPage === totalPages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // First page if not visible
        if (startPage > 1) {
            html += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="1">1</a>
                </li>
            `;
            
            if (startPage > 2) {
                html += `
                    <li class="page-item disabled">
                        <a class="page-link" href="#">...</a>
                    </li>
                `;
            }
        }
        
        // Visible page numbers
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        // Last page if not visible
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `
                    <li class="page-item disabled">
                        <a class="page-link" href="#">...</a>
                    </li>
                `;
            }
            
            html += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
                </li>
            `;
        }
        
        // Next button
        html += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;
        
        paginationContainer.innerHTML = html;
        
        // Add event listeners to pagination links
        document.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                if (this.parentElement.classList.contains('disabled')) {
                    return;
                }
                
                const page = parseInt(this.getAttribute('data-page'));
                if (!isNaN(page)) {
                    currentPage = page;
                    
                    // Update URL parameters
                    updateUrlParams();
                    
                    // Filter and render products
                    filterProducts();
                    
                    // Scroll to top of product container
                    const productContainer = document.getElementById('productContainer');
                    if (productContainer) {
                        productContainer.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });
    }
    
    // Render products to the product container
    function renderProducts(products) {
        const productContainer = document.getElementById('productContainer');
        if (!productContainer) return;
        
        if (products.length === 0) {
            productContainer.innerHTML = '<div class="col-12 text-center py-5"><p>Không tìm thấy sản phẩm trong danh mục này.</p></div>';
            return;
        }
        
        let html = '';
        
        products.forEach(product => {
            const isOutOfStock = product.SoLuongTon <= 0;
            const isNew = isProductNew(product);
            const discountedPrice = product.GiamGia ? 
                product.Gia - (product.Gia * product.GiamGia / 100) : 
                product.Gia;
            
            html += `
                <div class="col-md-4 mb-4">
                    <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}">
                        ${isOutOfStock ? '<div class="out-of-stock-label">Hết hàng</div>' : ''}
                        ${isNew ? '<div class="product-badge badge-new">Mới</div>' : ''}
                        ${product.GiamGia ? `<div class="product-badge badge-sale">-${product.GiamGia}%</div>` : ''}
                        <div class="product-img-container">
                            <img src="${product.HinhAnhSanPham || 'images/placeholder.png'}" alt="${product.TenSanPham}" 
                                 onerror="this.src='images/placeholder.png'">
                        </div>
                        <div class="product-info">
                            <h5 class="product-title">${product.TenSanPham}</h5>
                            <div class="product-price">
                                ${product.GiamGia ? 
                                    `<span class="original-price">₫${product.Gia.toLocaleString('vi-VN')}</span>` : ''}
                                <span class="current-price">₫${discountedPrice.toLocaleString('vi-VN')}</span>
                            </div>
                            <div class="product-unit">${product.DonViBan || 'Đơn vị'}</div>
                            <div class="d-flex justify-content-between mt-3">
                                <a href="/product-detail.html?id=${product.IDSanPham}" class="btn btn-outline-success btn-sm">Chi tiết</a>
                                <button class="btn btn-success btn-sm ${isOutOfStock ? 'disabled' : ''}" 
                                    ${isOutOfStock ? 'disabled' : ''} 
                                    onclick="addToCart(${JSON.stringify(product).replace(/"/g, '&quot;')})">
                                    Thêm vào giỏ hàng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        productContainer.innerHTML = html;
    }
    
    // Check if product is new (added within last 30 days)
    function isProductNew(product) {
        if (!product.NgayThem) return false;
        
        const addedDate = new Date(product.NgayThem);
        const currentDate = new Date();
        const diffTime = currentDate - addedDate;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        return diffDays <= 30;
    }
    
    // Add product to cart
    function addToCart(product) {
        if (window.cartService) {
            // Calculate final price considering discounts
            const finalPrice = product.GiamGia ? 
                product.Gia - (product.Gia * product.GiamGia / 100) : 
                product.Gia;
            
            // Convert product to cart item format
            const cartItem = {
                id: product.IDSanPham,
                name: product.TenSanPham,
                price: finalPrice,
                originalPrice: product.Gia,
                discount: product.GiamGia || 0,
                image: product.HinhAnhSanPham || '/images/placeholder.png',
                category: getCategoryName(product.IDDanhMuc),
                unit: product.DonViBan || 'Đơn vị',
            };
            
            window.cartService.addItem(cartItem, 1);
            
            // Show toast notification
            showToast(`${product.TenSanPham} đã được thêm vào giỏ hàng!`);
        } else {
            console.error('Cart service not found. Make sure cart-service.js is loaded before product-listing.js');
            showToast('Có lỗi xảy ra khi thêm sản phẩm vào giỏ hàng', 'error');
        }
    }
    
    // Get category name by ID
    function getCategoryName(categoryId) {
        const category = categories.find(c => c.IDDanhMuc === categoryId);
        return category ? category.TenDanhMuc : '';
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
            <div id="${toastId}" class="toast ${type === 'error' ? 'bg-danger text-white' : ''}" role="alert" aria-live="assertive" aria-atomic="true">
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
    
    // Add event listener to sort select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            filterProducts();
        });
    }
    
    // Make addToCart function available globally
    window.addToCart = addToCart;
    
    // Initialize
    loadCategories();
    
    // Update cart count when cart is updated
    document.addEventListener('cartUpdated', function() {
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
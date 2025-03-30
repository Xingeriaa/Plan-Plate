document.addEventListener('DOMContentLoaded', function() {
    let allProducts = [];
    let categories = [];
    let currentCategoryId = 'all';
    let currentPage = 1;
    const productsPerPage = 9; // Show 9 products per page (3x3 grid)
    
    // Prevent default action for cart and account buttons to avoid navigation
    const cartBtn = document.getElementById('cartBtn');
    const accountBtn = document.getElementById('accountBtn');
    
    if (cartBtn) {
        cartBtn.addEventListener('click', function(e) {
            e.preventDefault();
        });
    }
    
    if (accountBtn) {
        accountBtn.addEventListener('click', function(e) {
            e.preventDefault();
        });
    }
    
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
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                categories = data;
                renderCategories();
                loadAllProducts();
                
                // Set active category based on URL parameter
                if (urlCategory && urlCategory !== 'all') {
                    const categoryElement = document.querySelector(`.category-item[data-category-id="${urlCategory}"]`);
                    if (categoryElement) {
                        document.querySelectorAll('.category-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        categoryElement.classList.add('active');
                        
                        // Update breadcrumb
                        const category = categories.find(c => c.IDDanhMuc == urlCategory);
                        if (category) {
                            document.getElementById('categoryBreadcrumb').textContent = category.TenDanhMuc;
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Error loading categories:', error);
                document.getElementById('categoryList').innerHTML += 
                    '<div class="alert alert-danger mt-3">Failed to load categories. Please try again later.</div>';
            });
    }
    
    // Render categories in sidebar
    function renderCategories() {
        const categoryList = document.getElementById('categoryList');
        const existingAll = categoryList.querySelector('[data-category-id="all"]');
        
        categories.forEach(category => {
            const categoryItem = document.createElement('div');
            categoryItem.className = 'category-item';
            categoryItem.setAttribute('data-category-id', category.IDDanhMuc);
            categoryItem.innerHTML = `${category.TenDanhMuc} (<span id="category-${category.IDDanhMuc}-count">0</span>)`;
            
            categoryItem.addEventListener('click', () => {
                document.querySelectorAll('.category-item').forEach(item => {
                    item.classList.remove('active');
                });
                categoryItem.classList.add('active');
                currentCategoryId = category.IDDanhMuc;
                currentPage = 1; // Reset to first page when changing category
                filterProducts();
                
                // Update URL with new category
                updateUrlParams();
                
                // Update breadcrumb
                document.getElementById('categoryBreadcrumb').textContent = category.TenDanhMuc;
                
                // Scroll to top on category change
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
            
            categoryList.appendChild(categoryItem);
        });
        
        // Add click event to "All" category
        if (existingAll) {
            existingAll.addEventListener('click', () => {
                document.querySelectorAll('.category-item').forEach(item => {
                    item.classList.remove('active');
                });
                existingAll.classList.add('active');
                currentCategoryId = 'all';
                currentPage = 1; // Reset to first page when changing category
                filterProducts();
                
                // Update URL with new category
                updateUrlParams();
                
                // Update breadcrumb
                document.getElementById('categoryBreadcrumb').textContent = 'All Products';
                
                // Scroll to top on category change
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
        }
    }
    
    // Update URL parameters without reloading the page
    function updateUrlParams() {
        const url = new URL(window.location);
        
        // Update category parameter
        if (currentCategoryId === 'all') {
            url.searchParams.delete('category');
        } else {
            url.searchParams.set('category', currentCategoryId);
        }
        
        // Update page parameter
        if (currentPage === 1) {
            url.searchParams.delete('page');
        } else {
            url.searchParams.set('page', currentPage);
        }
        
        // Update URL without reloading the page
        window.history.pushState({}, '', url);
    }
    
    // Load all products from all categories
    function loadAllProducts() {
        // Show loading state
        document.getElementById('productContainer').innerHTML = 
            '<div class="col-12 text-center py-5"><div class="spinner-border text-success" role="status"></div><p class="mt-3">Loading products...</p></div>';
        
        const productPromises = categories.map(category => 
            fetch(`/api/products/${category.IDDanhMuc}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error fetching products for category ${category.IDDanhMuc}`);
                    }
                    return response.json();
                })
                .then(products => {
                    // Update category product count
                    const countElement = document.getElementById(`category-${category.IDDanhMuc}-count`);
                    if (countElement) {
                        countElement.textContent = products.length;
                    }
                    
                    // Add category info to each product
                    return products.map(product => ({
                        ...product,
                        categoryName: category.TenDanhMuc,
                        categoryId: category.IDDanhMuc
                    }));
                })
                .catch(error => {
                    console.error(`Error loading products for category ${category.IDDanhMuc}:`, error);
                    return [];
                })
        );
        
        Promise.all(productPromises)
            .then(productsArrays => {
                allProducts = productsArrays.flat();
                
                // Update total product count
                document.getElementById('allProductCount').textContent = allProducts.length;
                
                // Initial render
                filterProducts();
                
                // Set up sort functionality
                document.getElementById('sortSelect').addEventListener('change', () => {
                    currentPage = 1; // Reset to first page when sorting
                    filterProducts();
                });
                
                // Set up search functionality
                setupSearch();
            })
            .catch(error => {
                console.error('Error loading products:', error);
                document.getElementById('productContainer').innerHTML = 
                    '<div class="col-12 text-center py-5"><div class="alert alert-danger">Failed to load products. Please try again later.</div></div>';
            });
    }
    
    // Set up search functionality
    function setupSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');
        
        searchInput.addEventListener('input', debounce(function() {
            const query = searchInput.value.trim();
            
            if (query.length < 3) {
                searchResults.classList.add('d-none');
                return;
            }
            
            fetch(`/api/search?q=${encodeURIComponent(query)}`)
                .then(response => response.json())
                .then(results => {
                    if (results.length === 0) {
                        searchResults.innerHTML = '<div class="p-3">No products found</div>';
                    } else {
                        searchResults.innerHTML = results.map(product => `
                            <div class="search-item" data-product-id="${product.IDSanPham}">
                                <img src="${product.HinhAnhSanPham || 'images/placeholder.png'}" alt="${product.TenSanPham}" class="search-item-img">
                                <div class="search-item-info">
                                    <div class="search-item-title">${product.TenSanPham}</div>
                                    <div class="search-item-category">${product.TenDanhMuc}</div>
                                    <div class="search-item-price">${new Intl.NumberFormat('vi-VN').format(product.Gia)}₫</div>
                                </div>
                            </div>
                        `).join('');
                        
                        // Add click event to search results
                        document.querySelectorAll('.search-item').forEach(item => {
                            item.addEventListener('click', () => {
                                const productId = item.getAttribute('data-product-id');
                                window.location.href = `/product/${productId}`;
                            });
                        });
                    }
                    
                    searchResults.classList.remove('d-none');
                })
                .catch(error => {
                    console.error('Search error:', error);
                    searchResults.innerHTML = '<div class="p-3 text-danger">Error searching products</div>';
                    searchResults.classList.remove('d-none');
                });
        }, 300));
        
        // Hide search results when clicking outside
        document.addEventListener('click', function(event) {
            if (!searchInput.contains(event.target) && !searchResults.contains(event.target)) {
                searchResults.classList.add('d-none');
            }
        });
        
        // Show search results when focusing on search input
        searchInput.addEventListener('focus', function() {
            if (searchInput.value.trim().length >= 3) {
                searchResults.classList.remove('d-none');
            }
        });
    }
    
    // Debounce function to limit API calls
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
    
    // Filter and sort products based on current category and sort option
    function filterProducts() {
        let filteredProducts = allProducts;
        
        // Filter by category if not "all"
        if (currentCategoryId !== 'all') {
            filteredProducts = allProducts.filter(product => product.categoryId == currentCategoryId);
        }
        
        // Update product count
        document.getElementById('productCount').textContent = filteredProducts.length;
        
        // Sort products
        const sortOption = document.getElementById('sortSelect').value;
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
        
        // Calculate pagination
        const totalProducts = filteredProducts.length;
        const totalPages = Math.ceil(totalProducts / productsPerPage);
        
        // Adjust current page if it's out of bounds
        if (currentPage > totalPages) {
            currentPage = Math.max(1, totalPages);
        }
        
        // Get products for current page
        const startIndex = (currentPage - 1) * productsPerPage;
        const endIndex = startIndex + productsPerPage;
        const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
        
        // Render products and pagination
        renderProducts(paginatedProducts);
        renderPagination(totalPages);
        
        // Update URL parameters
        updateUrlParams();
    }
    
    // Render pagination controls
    function renderPagination(totalPages) {
        const paginationContainer = document.getElementById('paginationContainer');
        paginationContainer.innerHTML = '';
        
        if (totalPages <= 1) {
            return; // Don't show pagination if there's only one page
        }
        
        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous">
            <span aria-hidden="true">&laquo;</span>
        </a>`;
        
        if (currentPage > 1) {
            prevLi.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage--;
                filterProducts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
        
        paginationContainer.appendChild(prevLi);
        
        // Page numbers
        const maxVisiblePages = 5; // Maximum number of page links to show
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // Adjust start page if we're near the end
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // First page link if not visible
        if (startPage > 1) {
            const firstLi = document.createElement('li');
            firstLi.className = 'page-item';
            firstLi.innerHTML = '<a class="page-link" href="#">1</a>';
            firstLi.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = 1;
                filterProducts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            paginationContainer.appendChild(firstLi);
            
            // Ellipsis if needed
            if (startPage > 2) {
                const ellipsisLi = document.createElement('li');
                ellipsisLi.className = 'page-item disabled';
                ellipsisLi.innerHTML = '<a class="page-link" href="#">...</a>';
                paginationContainer.appendChild(ellipsisLi);
            }
        }
        
        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
            pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            
            if (i !== currentPage) {
                pageLi.addEventListener('click', (e) => {
                    e.preventDefault();
                    currentPage = i;
                    filterProducts();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            }
            
            paginationContainer.appendChild(pageLi);
        }
        
        // Last page link if not visible
        if (endPage < totalPages) {
            // Ellipsis if needed
            if (endPage < totalPages - 1) {
                const ellipsisLi = document.createElement('li');
                ellipsisLi.className = 'page-item disabled';
                ellipsisLi.innerHTML = '<a class="page-link" href="#">...</a>';
                paginationContainer.appendChild(ellipsisLi);
            }
            
            const lastLi = document.createElement('li');
            lastLi.className = 'page-item';
            lastLi.innerHTML = `<a class="page-link" href="#">${totalPages}</a>`;
            lastLi.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = totalPages;
                filterProducts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            paginationContainer.appendChild(lastLi);
        }
        
        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Next">
            <span aria-hidden="true">&raquo;</span>
        </a>`;
        
        if (currentPage < totalPages) {
            nextLi.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage++;
                filterProducts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
        
        paginationContainer.appendChild(nextLi);
    }
    
    // Render products to the product container
    // Find the function that renders products and update the "View" button to redirect to product-detail.html
    function renderProducts(products) {
        const productContainer = document.getElementById('productContainer');
        productContainer.innerHTML = '';
        
        if (products.length === 0) {
            productContainer.innerHTML = '<div class="col-12 text-center py-5"><p>No products found in this category.</p></div>';
            return;
        }
        
        products.forEach(product => {
            const isOutOfStock = product.SoLuongTon <= 0;
            const productCard = document.createElement('div');
            productCard.className = 'col-md-4 mb-4';
            productCard.innerHTML = `
                <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}">
                    ${isOutOfStock ? '<div class="out-of-stock-label">Out of Stock</div>' : ''}
                    <div class="product-img-container">
                        <img src="${product.HinhAnhSanPham || 'images/placeholder.png'}" alt="${product.TenSanPham}" onerror="this.src='images/placeholder.png'">
                    </div>
                    <div class="product-info">
                        <h5 class="product-title">${product.TenSanPham}</h5>
                        <div class="product-price">₫${product.Gia.toLocaleString('vi-VN')}</div>
                        <div class="product-unit">${product.DonViBan || 'unit'}</div>
                        <div class="d-flex justify-content-between mt-3">
                            <a href="/product-detail.html?id=${product.IDSanPham}" class="btn btn-outline-primary btn-sm">View</a>
                            <button class="btn btn-primary btn-sm ${isOutOfStock ? 'disabled' : ''}" 
                                ${isOutOfStock ? 'disabled' : ''} 
                                onclick="addToCart(${product.IDSanPham}, '${product.TenSanPham}', ${product.Gia}, '${product.HinhAnhSanPham || 'images/placeholder.png'}', 1)">
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            `;
            productContainer.appendChild(productCard);
        });
    }
    
    // Check if product is new (added within last 30 days)
    function isProductNew(product) {
        if (!product.NgayThem) return false;
        
        const addedDate = new Date(product.NgayThem);
        const today = new Date();
        const diffTime = Math.abs(today - addedDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays <= 30;
    }
    
    // Add product to cart
    function addToCart(product) {
        // Get cart from localStorage
        let cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
        
        // Check if product already in cart
        const existingItemIndex = cartItems.findIndex(item => item.id === product.IDSanPham);
        
        if (existingItemIndex > -1) {
            cartItems[existingItemIndex].quantity += 1;
        } else {
            // Calculate final price considering discounts
            const finalPrice = product.GiamGia ? 
                product.Gia - (product.Gia * product.GiamGia / 100) : 
                product.Gia;
                
            cartItems.push({
                id: product.IDSanPham,
                name: product.TenSanPham,
                price: finalPrice,
                originalPrice: product.Gia,
                discount: product.GiamGia || 0,
                image: product.HinhAnhSanPham,
                category: product.categoryName,
                unit: product.DonViBan || 'Unit',
                quantity: 1
            });
        }
        
        // Save to localStorage
        localStorage.setItem('cartItems', JSON.stringify(cartItems));
        
        // Update cart count
        updateCartCount();
        
        // Show toast notification
        showToast(`${product.TenSanPham} added to cart!`);
    }
    
    // Show toast notification
    function showToast(message) {
        // Check if toast container exists, if not create it
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.className = 'toast show';
        toast.id = toastId;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="toast-header bg-success text-white">
                <strong class="me-auto">PlannPlate</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;
        
        // Add toast to container
        toastContainer.appendChild(toast);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            const toastElement = document.getElementById(toastId);
            if (toastElement) {
                toastElement.remove();
            }
        }, 3000);
        
        // Add close button functionality
        const closeBtn = toast.querySelector('.btn-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toast.remove();
            });
        }
    }
    
    // Update cart count from localStorage
    function updateCartCount() {
        const cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
        const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
        document.getElementById('cartCount').textContent = totalItems;
    }
    
    // Add event listeners for header buttons
    function setupHeaderButtons() {
        // Cart button
        const cartBtn = document.getElementById('cartBtn');
        if (cartBtn) {
            cartBtn.addEventListener('click', (e) => {
                e.preventDefault();
            });
        }
        
        // Account button
        const accountBtn = document.getElementById('accountBtn');
        if (accountBtn) {
            accountBtn.addEventListener('click', (e) => {
                e.preventDefault();
            });
        }
    }
    
    // Initialize
    loadCategories();
    updateCartCount();
    setupHeaderButtons();
});
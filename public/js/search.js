document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            const query = searchInput.value.trim();
            
            if (query.length < 2) {
                searchResults.innerHTML = '';
                searchResults.classList.add('d-none');
                return;
            }
            
            fetch(`/api/search?q=${encodeURIComponent(query)}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Lỗi tìm kiếm: ' + response.statusText);
                    }
                    return response.json();
                })
                .then(products => {
                    displaySearchResults(products);
                })
                .catch(error => {
                    console.error('Lỗi tìm kiếm:', error);
                    searchResults.innerHTML = `<div class="p-3 text-danger">Lỗi tìm kiếm: ${error.message}</div>`;
                    searchResults.classList.remove('d-none');
                });
        }, 300));
        
        // Close search results when clicking outside
        document.addEventListener('click', function(event) {
            if (!searchInput.contains(event.target) && !searchResults.contains(event.target)) {
                searchResults.classList.add('d-none');
            }
        });
    }
    
    function displaySearchResults(products) {
        if (products.length === 0) {
            searchResults.innerHTML = '<div class="p-3">Không tìm thấy sản phẩm.</div>';
        } else {
            let html = '<div class="list-group">';
            products.forEach(product => {
                html += `
                    <a href="/product.html?id=${product.IDSanPham}" class="list-group-item list-group-item-action">
                        <div class="d-flex align-items-center">
                            <img src="${product.HinhAnhSanPham}" alt="${product.TenSanPham}" class="search-result-img me-3">
                            <div>
                                <h6 class="mb-1">${product.TenSanPham}</h6>
                                <p class="mb-1 text-muted small">${product.TenDanhMuc}</p>
                                <p class="mb-0 text-primary">₫${product.Gia.toLocaleString('vi-VN')}</p>
                            </div>
                        </div>
                    </a>
                `;
            });
            html += '</div>';
            searchResults.innerHTML = html;
        }
        searchResults.classList.remove('d-none');
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
});
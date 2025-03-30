document.addEventListener('DOMContentLoaded', function() {
    const accountBtn = document.getElementById('accountBtn');
    const accountSidebar = document.getElementById('accountSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const returnToStoreBtn = document.getElementById('returnToStoreBtn');
    
    // Function to open sidebar
    function openSidebar() {
        accountSidebar.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }
    
    // Function to close sidebar
    function closeSidebar() {
        accountSidebar.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
    
    // Function to check if user is logged in
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
    
    // Event listeners
    if (accountBtn) {
        accountBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Check authentication status
            checkAuthStatus().then(data => {
                if (data.authenticated) {
                    // If logged in, redirect to profile
                    window.location.href = '/profile';
                } else {
                    // If not logged in, show sidebar
                    openSidebar();
                }
            });
        });
    }
    
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    if (returnToStoreBtn) {
        returnToStoreBtn.addEventListener('click', function(e) {
            e.preventDefault();
            closeSidebar();
        });
    }
    
    // Close sidebar when pressing Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && accountSidebar && accountSidebar.classList.contains('active')) {
            closeSidebar();
        }
    });
    
    // Search functionality
    const searchInput = document.querySelector('input[placeholder="What are you looking for?"]');
    const searchResults = document.getElementById('searchResults');
    
    if (searchInput && searchResults) {
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            if (query.length > 2) {
                // Simulate search results (in a real app, this would be an API call)
                searchProducts(query);
            } else {
                searchResults.classList.add('d-none');
            }
        });
        
        // Hide search results when clicking outside
        document.addEventListener('click', function(e) {
            if (searchResults && !searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.add('d-none');
            }
        });
    }
    
    function searchProducts(query) {
        // This would be replaced with an actual API call in production
        // For now, we'll simulate results
        setTimeout(() => {
            if (!searchResults) return;
            
            searchResults.innerHTML = '';
            searchResults.classList.remove('d-none');
            
            // Sample results based on query
            const sampleProducts = [
                { name: 'Organic ' + query + ' Seeds', price: '$4.99' },
                { name: 'Premium ' + query + ' Oil', price: '$12.99' },
                { name: 'Raw ' + query + ' Powder', price: '$8.49' }
            ];
            
            if (sampleProducts.length > 0) {
                sampleProducts.forEach(product => {
                    const resultItem = document.createElement('div');
                    resultItem.className = 'search-result-item';
                    resultItem.innerHTML = `
                        <div class="product-name">${product.name}</div>
                        <div class="product-price">${product.price}</div>
                    `;
                    resultItem.addEventListener('click', function() {
                        // Navigate to product page (would be implemented in production)
                        alert(`You selected: ${product.name}`);
                        searchResults.classList.add('d-none');
                    });
                    searchResults.appendChild(resultItem);
                });
            } else {
                searchResults.innerHTML = '<div class="no-results">No products found</div>';
            }
        }, 300); // Simulate network delay
    }
    
    // Cart functionality
    const cartBtn = document.querySelector('.btn.btn-outline-primary.position-relative');
    const cartCount = document.querySelector('.badge.bg-danger.position-absolute');
    let cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
    
    // Update cart count on page load
    updateCartCount();
    
    if (cartBtn && cartCount) {
        cartBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // In a real app, this would navigate to a cart page
            // For now, we'll just show an alert with the cart contents
            if (cartItems.length === 0) {
                alert('Your cart is empty');
            } else {
                let cartMessage = 'Cart Contents:\n';
                cartItems.forEach((item, index) => {
                    cartMessage += `${index + 1}. ${item.name} - ${item.price} (Qty: ${item.quantity})\n`;
                });
                alert(cartMessage);
            }
        });
    }
    
    // Function to update cart count
    function updateCartCount() {
        if (!cartCount) return;
        
        const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
        cartCount.textContent = totalItems;
        
        // Store cart in localStorage
        localStorage.setItem('cartItems', JSON.stringify(cartItems));
    }
    
    // Add functionality to the Live Chat button
    const liveChatSection = document.querySelector('.col-md-4:last-child');
    if (liveChatSection) {
        liveChatSection.style.cursor = 'pointer';
        liveChatSection.addEventListener('click', function() {
            alert('Live chat is currently offline. Please email us at support@plannplate.com or call us at (123) 456-7890.');
        });
    }
    
    // Make email and phone links functional
    const emailLink = document.querySelector('a[href^="mailto"]');
    if (emailLink) {
        emailLink.addEventListener('click', function(e) {
            // This is already functional with the mailto: link, but we could add tracking
            console.log('Email support clicked');
        });
    }
    
    const phoneLink = document.querySelector('a[href^="tel"]');
    if (phoneLink) {
        phoneLink.addEventListener('click', function(e) {
            // This is already functional with the tel: link, but we could add tracking
            console.log('Phone support clicked');
        });
    }
    
    // Add functionality to social media links in footer
    const socialLinks = document.querySelectorAll('.col-md-4:last-child .d-flex a');
    socialLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const platform = this.textContent.trim();
            alert(`You'll be redirected to our ${platform} page in a real implementation.`);
        });
    });
    
    // Add functionality to Quick Links in footer
    const quickLinks = document.querySelectorAll('.col-md-4:nth-child(2) .list-unstyled a');
    quickLinks.forEach(link => {
        if (link.getAttribute('href') === '#') {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const linkText = this.textContent.trim();
                alert(`The ${linkText} page is coming soon!`);
            });
        }
    });
});
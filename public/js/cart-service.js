/**
 * Cart Service - Centralized cart management for PlannPlate
 */
class CartService {
    constructor() {
        this.cartItems = [];
        this.cartNotes = '';
        this.loadCart();
        
        // Custom event for cart updates
        this.cartUpdateEvent = new CustomEvent('cartUpdated');
    }
    
    // Load cart from localStorage
    loadCart() {
        try {
            const savedCart = localStorage.getItem('cartItems');
            if (savedCart) {
                this.cartItems = JSON.parse(savedCart);
            }
            
            const savedNotes = localStorage.getItem('cartNotes');
            if (savedNotes) {
                this.cartNotes = savedNotes;
            }
        } catch (error) {
            console.error('Error loading cart from localStorage:', error);
            this.cartItems = [];
            this.cartNotes = '';
        }
    }
    
    // Save cart to localStorage
    saveCart() {
        try {
            localStorage.setItem('cartItems', JSON.stringify(this.cartItems));
            localStorage.setItem('cartNotes', this.cartNotes);
            
            // Dispatch custom event
            document.dispatchEvent(this.cartUpdateEvent);
        } catch (error) {
            console.error('Error saving cart to localStorage:', error);
        }
    }
    
    // Get all cart items
    getItems() {
        return [...this.cartItems];
    }
    
    // Get cart notes
    getNotes() {
        return this.cartNotes;
    }
    
    // Set cart notes
    setNotes(notes) {
        this.cartNotes = notes;
        this.saveCart();
    }
    
    // Add item to cart
    addItem(product, quantity = 1) {
        // Check if product already exists in cart
        const existingItemIndex = this.cartItems.findIndex(item => item.id === product.id);
        
        if (existingItemIndex >= 0) {
            // Update quantity if product already exists
            this.cartItems[existingItemIndex].quantity += quantity;
        } else {
            // Add new product to cart
            this.cartItems.push({
                id: product.id,
                name: product.name,
                price: product.price,
                originalPrice: product.originalPrice || product.price,
                discount: product.discount || 0,
                image: product.image,
                category: product.category || '',
                unit: product.unit || '',
                quantity: quantity
            });
        }
        
        this.saveCart();
    }
    
    // Update item quantity
    updateItemQuantity(productId, quantity) {
        const itemIndex = this.cartItems.findIndex(item => item.id === productId);
        
        if (itemIndex >= 0) {
            if (quantity > 0) {
                this.cartItems[itemIndex].quantity = quantity;
            } else {
                // Remove item if quantity is 0 or negative
                this.cartItems.splice(itemIndex, 1);
            }
            
            this.saveCart();
            return true;
        }
        
        return false;
    }
    
    // Remove item from cart
    removeItem(productId) {
        const itemIndex = this.cartItems.findIndex(item => item.id === productId);
        
        if (itemIndex >= 0) {
            this.cartItems.splice(itemIndex, 1);
            this.saveCart();
            return true;
        }
        
        return false;
    }
    
    // Clear cart
    clearCart() {
        this.cartItems = [];
        this.cartNotes = '';
        this.saveCart();
    }
    
    // Get cart count
    getCount() {
        return this.cartItems.reduce((total, item) => total + item.quantity, 0);
    }
    
    // Get cart subtotal
    getSubtotal() {
        return this.cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    }
    
    // Calculate tax (10%)
    getTax() {
        return this.getSubtotal() * 0.1;
    }
    
    // Get shipping cost (fixed at 30,000₫)
    getShipping() {
        return this.cartItems.length > 0 ? 30000 : 0;
    }
    
    // Get cart total
    getTotal() {
        return this.getSubtotal() + this.getTax() + this.getShipping();
    }
    
    // Format price with Vietnamese currency
    formatPrice(price) {
        return '₫' + price.toLocaleString('vi-VN');
    }
}

// Create a global cart instance
window.cartService = new CartService();
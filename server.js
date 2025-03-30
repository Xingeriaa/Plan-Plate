// Get product by ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await db.getProductById(productId);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get products by category
app.get('/api/categories/:id/products', async (req, res) => {
    try {
        const categoryId = req.params.id;
        const products = await db.getProductsByCategory(categoryId);
        res.json(products);
    } catch (error) {
        console.error('Error fetching products by category:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
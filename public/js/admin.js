// User Management
function setupUserManagement() {
  // Add User Form
  const addUserForm = document.getElementById('addUserForm');
  if (addUserForm) {
    addUserForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData(this);
      const userData = {
        fullName: formData.get('fullName'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role')
      };
      
      fetch('/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showToast('User added successfully', 'success');
          // Reload page or update user list
          window.location.reload();
        } else {
          showToast(data.message || 'Error adding user', 'error');
        }
      })
      .catch(error => {
        console.error('Error adding user:', error);
        showToast('Error adding user', 'error');
      });
    });
  }
  
  // Edit User
  const editUserButtons = document.querySelectorAll('.edit-user-btn');
  if (editUserButtons.length > 0) {
    editUserButtons.forEach(button => {
      button.addEventListener('click', function() {
        const userId = this.getAttribute('data-user-id');
        
        // Fetch user data
        fetch(`/admin/users/${userId}`)
          .then(response => response.json())
          .then(user => {
            // Populate edit form
            document.getElementById('editUserId').value = user.IDTaiKhoan;
            document.getElementById('editFullName').value = user.TenNguoiDung;
            document.getElementById('editEmail').value = user.Email;
            document.getElementById('editRole').value = user.VaiTro;
            
            // Show edit modal
            const editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
            editModal.show();
          })
          .catch(error => {
            console.error('Error fetching user:', error);
            showToast('Error fetching user data', 'error');
          });
      });
    });
  }
  
  // Edit User Form
  const editUserForm = document.getElementById('editUserForm');
  if (editUserForm) {
    editUserForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData(this);
      const userId = formData.get('userId');
      const userData = {
        fullName: formData.get('fullName'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role')
      };
      
      // If password is empty, don't update it
      if (!userData.password) {
        delete userData.password;
      }
      
      fetch(`/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showToast('User updated successfully', 'success');
          // Reload page or update user list
          window.location.reload();
        } else {
          showToast(data.message || 'Error updating user', 'error');
        }
      })
      .catch(error => {
        console.error('Error updating user:', error);
        showToast('Error updating user', 'error');
      });
    });
  }
  
  // Delete User
  const deleteUserButtons = document.querySelectorAll('.delete-user-btn');
  if (deleteUserButtons.length > 0) {
    deleteUserButtons.forEach(button => {
      button.addEventListener('click', function() {
        const userId = this.getAttribute('data-user-id');
        const userName = this.getAttribute('data-user-name');
        
        if (confirm(`Are you sure you want to delete user "${userName}"?`)) {
          fetch(`/admin/users/${userId}`, {
            method: 'DELETE'
          })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              showToast('User deleted successfully', 'success');
              // Remove user row from table
              document.getElementById(`user-row-${userId}`).remove();
            } else {
              showToast(data.error || 'Error deleting user', 'error');
            }
          })
          .catch(error => {
            console.error('Error deleting user:', error);
            showToast('Error deleting user', 'error');
          });
        }
      });
    });
  }
}

// Product Management
function setupProductManagement() {
  // Add Product Form
  const addProductForm = document.getElementById('addProductForm');
  if (addProductForm) {
    addProductForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData(this);
      
      fetch('/admin/products', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showToast('Product added successfully', 'success');
          // Reload page or update product list
          window.location.reload();
        } else {
          showToast(data.message || 'Error adding product', 'error');
        }
      })
      .catch(error => {
        console.error('Error adding product:', error);
        showToast('Error adding product', 'error');
      });
    });
  }
  
  // Edit Product
  const editProductButtons = document.querySelectorAll('.edit-product-btn');
  if (editProductButtons.length > 0) {
    editProductButtons.forEach(button => {
      button.addEventListener('click', function() {
        const productId = this.getAttribute('data-product-id');
        
        // Fetch product data
        fetch(`/admin/products/${productId}`)
          .then(response => response.json())
          .then(product => {
            // Populate edit form
            document.getElementById('editProductId').value = product.IDSanPham;
            document.getElementById('editProductName').value = product.TenSanPham;
            document.getElementById('editProductCategory').value = product.IDDanhMuc;
            document.getElementById('editProductPrice').value = product.Gia;
            document.getElementById('editProductStock').value = product.SoLuongTon;
            document.getElementById('editProductUnit').value = product.DonVi;
            document.getElementById('editProductDescription').value = product.MoTa;
            
            // Show current image if available
            const currentImageElement = document.getElementById('currentProductImage');
            if (currentImageElement && product.HinhAnhSanPham) {
              currentImageElement.src = product.HinhAnhSanPham;
              currentImageElement.parentElement.classList.remove('d-none');
            }
            
            // Show edit modal
            const editModal = new bootstrap.Modal(document.getElementById('editProductModal'));
            editModal.show();
          })
          .catch(error => {
            console.error('Error fetching product:', error);
            showToast('Error fetching product data', 'error');
          });
      });
    });
  }
  
  // Edit Product Form
  const editProductForm = document.getElementById('editProductForm');
  if (editProductForm) {
    editProductForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData(this);
      const productId = formData.get('productId');
      
      fetch(`/admin/products/${productId}`, {
        method: 'PUT',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showToast('Product updated successfully', 'success');
          // Reload page or update product list
          window.location.reload();
        } else {
          showToast(data.message || 'Error updating product', 'error');
        }
      })
      .catch(error => {
        console.error('Error updating product:', error);
        showToast('Error updating product', 'error');
      });
    });
  }
  
  // Delete Product
  const deleteProductButtons = document.querySelectorAll('.delete-product-btn');
  if (deleteProductButtons.length > 0) {
    deleteProductButtons.forEach(button => {
      button.addEventListener('click', function() {
        const productId = this.getAttribute('data-product-id');
        const productName = this.getAttribute('data-product-name');
        
        if (confirm(`Are you sure you want to delete product "${productName}"?`)) {
          fetch(`/admin/products/${productId}`, {
            method: 'DELETE'
          })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              showToast('Product deleted successfully', 'success');
              // Remove product row from table
              document.getElementById(`product-row-${productId}`).remove();
            } else {
              showToast(data.error || 'Error deleting product', 'error');
            }
          })
          .catch(error => {
            console.error('Error deleting product:', error);
            showToast('Error deleting product', 'error');
          });
        }
      });
    });
  }
}

// Category Management
function setupCategoryManagement() {
  // Add Category Form
  const addCategoryForm = document.getElementById('addCategoryForm');
  if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData(this);
      
      fetch('/admin/categories', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showToast('Category added successfully', 'success');
          // Reload page or update category list
          window.location.reload();
        } else {
          showToast(data.message || 'Error adding category', 'error');
        }
      })
      .catch(error => {
        console.error('Error adding category:', error);
        showToast('Error adding category', 'error');
      });
    });
  }
  
  // Edit Category
  const editCategoryButtons = document.querySelectorAll('.edit-category-btn');
  if (editCategoryButtons.length > 0) {
    editCategoryButtons.forEach(button => {
      button.addEventListener('click', function() {
        const categoryId = this.getAttribute('data-category-id');
        const categoryName = this.getAttribute('data-category-name');
        const categoryDesc = this.getAttribute('data-category-desc') || '';
        
        // Populate edit form
        document.getElementById('editCategoryId').value = categoryId;
        document.getElementById('editCategoryName').value = categoryName;
        document.getElementById('editCategoryDescription').value = categoryDesc;
        
        // Show edit modal
        const editModal = new bootstrap.Modal(document.getElementById('editCategoryModal'));
        editModal.show();
      });
    });
  }
  
  // Edit Category Form
  const editCategoryForm = document.getElementById('editCategoryForm');
  if (editCategoryForm) {
    editCategoryForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData(this);
      const categoryId = formData.get('categoryId');
      
      fetch(`/admin/categories/${categoryId}`, {
        method: 'PUT',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showToast('Category updated successfully', 'success');
          // Reload page or update category list
          window.location.reload();
        } else {
          showToast(data.message || 'Error updating category', 'error');
        }
      })
      .catch(error => {
        console.error('Error updating category:', error);
        showToast('Error updating category', 'error');
      });
    });
  }
  
  // Delete Category
  const deleteCategoryButtons = document.querySelectorAll('.delete-category-btn');
  if (deleteCategoryButtons.length > 0) {
    deleteCategoryButtons.forEach(button => {
      button.addEventListener('click', function() {
        const categoryId = this.getAttribute('data-category-id');
        const categoryName = this.getAttribute('data-category-name');
        
        if (confirm(`Are you sure you want to delete category "${categoryName}"?`)) {
          fetch(`/admin/categories/${categoryId}`, {
            method: 'DELETE'
          })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              showToast('Category deleted successfully', 'success');
              // Remove category row from table
              document.getElementById(`category-row-${categoryId}`).remove();
            } else {
              showToast(data.error || 'Error deleting category', 'error');
            }
          })
          .catch(error => {
            console.error('Error deleting category:', error);
            showToast('Error deleting category', 'error');
          });
        }
      });
    });
  }
}

// Order Management
function setupOrderManagement() {
  // View Order Details
  const viewOrderButtons = document.querySelectorAll('.view-order-btn');
  if (viewOrderButtons.length > 0) {
    viewOrderButtons.forEach(button => {
      button.addEventListener('click', function() {
        const orderId = this.getAttribute('data-order-id');
        
        // Fetch order details
        fetch(`/admin/orders/${orderId}`)
          .then(response => response.json())
          .then(orderData => {
            // Populate order details modal
            const orderDetailsContainer = document.getElementById('orderDetailsContainer');
            
            // Format order details HTML
            let orderItems = '';
            let totalAmount = 0;
            
            orderData.items.forEach(item => {
              const itemTotal = item.Gia * item.SoLuong;
              totalAmount += itemTotal;
              
              orderItems += `
                <div class="d-flex justify-content-between mb-2">
                  <div>
                    <span class="fw-bold">${item.TenSanPham}</span>
                    <small class="d-block text-muted">${item.SoLuong} x ${formatPrice(item.Gia)}</small>
                  </div>
                  <div>${formatPrice(itemTotal)}</div>
                </div>
              `;
            });
            
            // Customer info
            const customerInfo = `
              <div class="mb-3">
                <h6>Customer Information</h6>
                <p class="mb-1">${orderData.customer.TenNguoiDung}</p>
                <p class="mb-1">${orderData.customer.Email}</p>
                <p class="mb-0">${orderData.customer.SoDienThoai || 'No phone'}</p>
              </div>
            `;
            
            // Shipping info if available
            let shippingInfo = '';
            if (orderData.shipping) {
              shippingInfo = `
                <div class="mb-3">
                  <h6>Shipping Information</h6>
                  <p class="mb-1">${orderData.shipping.DiaChi}</p>
                  <p class="mb-1">${orderData.shipping.ThanhPho}, ${orderData.shipping.TinhThanh}</p>
                  <p class="mb-0">${orderData.shipping.QuocGia}</p>
                </div>
              `;
            }
            
            // Order summary
            const orderSummary = `
              <div class="mb-3">
                <h6>Order Summary</h6>
                <div class="d-flex justify-content-between mb-2">
                  <span>Subtotal:</span>
                  <span>${formatPrice(totalAmount)}</span>
                </div>
                <div class="d-flex justify-content-between mb-2">
                  <span>Shipping:</span>
                  <span>${formatPrice(orderData.PhiVanChuyen || 0)}</span>
                </div>
                <div class="d-flex justify-content-between fw-bold">
                  <span>Total:</span>
                  <span>${formatPrice(totalAmount + (orderData.PhiVanChuyen || 0))}</span>
                </div>
              </div>
            `;
            
            // Order status
            const orderStatus = `
              <div class="mb-3">
                <h6>Order Status</h6>
                <div class="mb-2">
                  <select id="orderStatusSelect" class="form-select">
                    <option value="ChoXuLy" ${orderData.TrangThai === 'ChoXuLy' ? 'selected' : ''}>Pending</option>
                    <option value="DaXacNhan" ${orderData.TrangThai === 'DaXacNhan' ? 'selected' : ''}>Confirmed</option>
                    <option value="DangGiao" ${orderData.TrangThai === 'DangGiao' ? 'selected' : ''}>Shipping</option>
                    <option value="DaGiao" ${orderData.TrangThai === 'DaGiao' ? 'selected' : ''}>Delivered</option>
                    <option value="DaHuy" ${orderData.TrangThai === 'DaHuy' ? 'selected' : ''}>Cancelled</option>
                  </select>
                </div>
                <button id="updateOrderStatusBtn" class="btn btn-primary" data-order-id="${orderId}">Update Status</button>
              </div>
            `;
            
            // Combine all sections
            orderDetailsContainer.innerHTML = `
              <div class="order-details p-3">
                <h5 class="mb-3">Order #${orderId} - ${new Date(orderData.NgayDatHang).toLocaleDateString()}</h5>
                ${customerInfo}
                ${shippingInfo}
                <div class="mb-3">
                  <h6>Order Items</h6>
                  ${orderItems}
                </div>
                ${orderSummary}
                ${orderStatus}
              </div>
            `;
            
            // Show order details modal
            const orderModal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
            orderModal.show();
            
            // Setup status update button
            document.getElementById('updateOrderStatusBtn').addEventListener('click', function() {
              const newStatus = document.getElementById('orderStatusSelect').value;
              updateOrderStatus(orderId, newStatus);
            });
          })
          .catch(error => {
            console.error('Error fetching order details:', error);
            showToast('Error fetching order details', 'error');
          });
      });
    });
  }
  
  // Update order status
  function updateOrderStatus(orderId, status) {
    fetch(`/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('Order status updated successfully', 'success');
        // Update status in the orders table
        const statusCell = document.querySelector(`#order-row-${orderId} .order-status`);
        if (statusCell) {
          statusCell.textContent = getStatusLabel(status);
          statusCell.className = `order-status badge ${getStatusBadgeClass(status)}`;
        }
      } else {
        showToast(data.error || 'Error updating order status', 'error');
      }
    })
    .catch(error => {
      console.error('Error updating order status:', error);
      showToast('Error updating order status', 'error');
    });
  }
  
  // Get status label
  function getStatusLabel(status) {
    switch (status) {
      case 'ChoXuLy': return 'Pending';
      case 'DaXacNhan': return 'Confirmed';
      case 'DangGiao': return 'Shipping';
      case 'DaGiao': return 'Delivered';
      case 'DaHuy': return 'Cancelled';
      default: return status;
    }
  }
  
  // Get status badge class
  function getStatusBadgeClass(status) {
    switch (status) {
      case 'ChoXuLy': return 'bg-warning';
      case 'DaXacNhan': return 'bg-info';
      case 'DangGiao': return 'bg-primary';
      case 'DaGiao': return 'bg-success';
      case 'DaHuy': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }
}

// Report Filters
function setupReportFilters() {
  const reportTypeSelect = document.getElementById('reportType');
  const periodSelect = document.getElementById('reportPeriod');
  const dateRangeContainer = document.getElementById('dateRangeContainer');
  
  if (reportTypeSelect && periodSelect) {
    // Handle report type change
    reportTypeSelect.addEventListener('change', function() {
      updateReportView();
    });
    
    // Handle period change
    periodSelect.addEventListener('change', function() {
      if (this.value === 'custom') {
        dateRangeContainer.classList.remove('d-none');
      } else {
        dateRangeContainer.classList.add('d-none');
        updateReportView();
      }
    });
    
    // Handle date range apply
    const applyDateRangeBtn = document.getElementById('applyDateRange');
    if (applyDateRangeBtn) {
      applyDateRangeBtn.addEventListener('click', function() {
        updateReportView();
      });
    }
  }
  
  // Update report view based on filters
  function updateReportView() {
    const reportType = reportTypeSelect.value;
    const period = periodSelect.value;
    let url = `/admin/reports?type=${reportType}&period=${period}`;
    
    if (period === 'custom') {
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
      
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
    }
    
    window.location.href = url;
  }
  
  // Export report button
  const exportReportBtn = document.getElementById('exportReportBtn');
  if (exportReportBtn) {
    exportReportBtn.addEventListener('click', function() {
      const reportType = reportTypeSelect.value;
      const period = periodSelect.value;
      const format = document.getElementById('exportFormat').value;
      
      let url = `/admin/reports/export?type=${reportType}&period=${period}&format=${format}`;
      
      if (period === 'custom') {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        if (startDate && endDate) {
          url += `&startDate=${startDate}&endDate=${endDate}`;
        }
      }
      
      window.location.href = url;
    });
  }
}

// Helper function to format price
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

// Audit Log Management
function setupAuditLogManagement() {
  // Initialize date pickers if they exist
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  
  if (startDateInput && typeof flatpickr !== 'undefined') {
    flatpickr(startDateInput, {
      locale: 'vn',
      dateFormat: 'Y-m-d'
    });
  }
  
  if (endDateInput && typeof flatpickr !== 'undefined') {
    flatpickr(endDateInput, {
      locale: 'vn',
      dateFormat: 'Y-m-d'
    });
  }
  
  // Log detail modal
  const logDetailModal = document.getElementById('logDetailModal');
  if (logDetailModal) {
    logDetailModal.addEventListener('show.bs.modal', function(event) {
      const button = event.relatedTarget;
      
      // Extract data
      const logId = button.getAttribute('data-log-id');
      const logUser = button.getAttribute('data-log-user');
      const logAction = button.getAttribute('data-log-action');
      const logDescription = button.getAttribute('data-log-description');
      const logEntityType = button.getAttribute('data-log-entity-type');
      const logEntityId = button.getAttribute('data-log-entity-id');
      const logTimestamp = button.getAttribute('data-log-timestamp');
      const logIp = button.getAttribute('data-log-ip');
      const logOldData = button.getAttribute('data-log-old-data');
      const logNewData = button.getAttribute('data-log-new-data');
      
      // Update modal content
      document.getElementById('logDetailId').textContent = logId;
      document.getElementById('logDetailUser').textContent = logUser;
      
      // Format action with badge
      let actionBadge = '';
      if (logAction === 'CREATE') {
        actionBadge = '<span class="badge bg-success">Tạo Mới</span>';
      } else if (logAction === 'UPDATE') {
        actionBadge = '<span class="badge bg-primary">Cập Nhật</span>';
      } else if (logAction === 'DELETE') {
        actionBadge = '<span class="badge bg-danger">Xóa</span>';
      } else if (logAction === 'LOGIN') {
        actionBadge = '<span class="badge bg-info">Đăng Nhập</span>';
      } else if (logAction === 'LOGOUT') {
        actionBadge = '<span class="badge bg-warning">Đăng Xuất</span>';
      } else {
        actionBadge = `<span class="badge bg-secondary">${logAction}</span>`;
      }
      document.getElementById('logDetailAction').innerHTML = actionBadge;
      
      document.getElementById('logDetailDescription').textContent = logDescription;
      document.getElementById('logDetailEntityType').textContent = logEntityType;
      document.getElementById('logDetailEntityId').textContent = logEntityId;
      document.getElementById('logDetailTimestamp').textContent = logTimestamp;
      document.getElementById('logDetailIp').textContent = logIp;
      
      // Show data diff if available
      const dataContainer = document.getElementById('logDetailDataContainer');
      const diffView = document.getElementById('logDetailDiff');
      
      if ((logOldData && logOldData !== 'null' && logOldData !== 'undefined') || 
          (logNewData && logNewData !== 'null' && logNewData !== 'undefined')) {
        dataContainer.classList.remove('d-none');
        
        let diffContent = '';
        
        try {
          if (logOldData && logOldData !== 'null' && logOldData !== 'undefined') {
            const oldData = JSON.parse(logOldData);
            diffContent += '<div class="diff-removed mb-2"><strong>Dữ liệu cũ:</strong><br>';
            diffContent += JSON.stringify(oldData, null, 2);
            diffContent += '</div>';
          }
          
          if (logNewData && logNewData !== 'null' && logNewData !== 'undefined') {
            const newData = JSON.parse(logNewData);
            diffContent += '<div class="diff-added"><strong>Dữ liệu mới:</strong><br>';
            diffContent += JSON.stringify(newData, null, 2);
            diffContent += '</div>';
          }
        } catch (e) {
          diffContent = '<div class="alert alert-warning">Không thể hiển thị dữ liệu thay đổi</div>';
        }
        
        diffView.innerHTML = diffContent;
      } else {
        dataContainer.classList.add('d-none');
      }
    });
  }
  
  // Filter form handling
  const filterForm = document.getElementById('filterForm');
  if (filterForm) {
    // Clear filters button
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = '/admin/audit-logs';
      });
    }
  }
  
  // Export logs button
  const exportLogsBtn = document.getElementById('exportLogsBtn');
  if (exportLogsBtn) {
    exportLogsBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Get current filters from URL
      const urlParams = new URLSearchParams(window.location.search);
      const exportUrl = `/admin/audit-logs/export${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
      
      window.location.href = exportUrl;
    });
  }
}

// Initialize all admin functions when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Call setup functions based on the current page
  const currentPath = window.location.pathname;
  
  // Common setup for all admin pages
  setupToasts();
  
  if (currentPath.includes('/admin/users')) {
    setupUserManagement();
  } else if (currentPath.includes('/admin/products')) {
    setupProductManagement();
  } else if (currentPath.includes('/admin/categories')) {
    setupCategoryManagement();
  } else if (currentPath.includes('/admin/orders')) {
    setupOrderManagement();
  } else if (currentPath.includes('/admin/reports')) {
    setupReportFilters();
  } else if (currentPath.includes('/admin/audit-logs')) {
    setupAuditLogManagement();
  }
});

// Setup toast notifications
function setupToasts() {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(toastContainer);
  }
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
    <div id="${toastId}" class="toast ${type === 'error' ? 'bg-danger text-white' : 'bg-success text-white'}" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header">
        <strong class="me-auto">PlannPlate Admin</strong>
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
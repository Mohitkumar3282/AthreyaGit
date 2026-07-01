import axiosInstance from '@core/api/axios';

export const sellerApi = {
    login: (data) => axiosInstance.post('/seller/login', data),
    signup: (data) => axiosInstance.post('/seller/signup', data),
    sendVerificationOtp: (data) => axiosInstance.post('/seller/verification/send-otp', data),
    verifyVerificationOtp: (data) => axiosInstance.post('/seller/verification/verify-otp', data),
    // Products
    getProducts: (params) => axiosInstance.get('/products/seller/me', { params }),
    getProductById: (id) => axiosInstance.get(`/products/${id}`),
    createProduct: (data) => axiosInstance.post('/products', data),
    updateProduct: (id, data) => axiosInstance.put(`/products/${id}`, data),
    deleteProduct: (id) => axiosInstance.delete(`/products/${id}`),

    // Categories (Public)
    getCategories: () => axiosInstance.get('/admin/categories'),
    getCategoryTree: () => axiosInstance.get('/admin/categories?tree=true'),

    // Others
    getStats: (range) => axiosInstance.get('/seller/stats', { params: { range } }),
    getOrders: (params) => axiosInstance.get('/orders/seller-orders', { params }),
    updateOrderStatus: (orderId, data) => axiosInstance.put(`/orders/status/${orderId}`, data),
    getEarnings: () => axiosInstance.get('/seller/earnings'),
    getWalletSummary: () => axiosInstance.get('/seller/wallet/summary'),
    getProfile: () => axiosInstance.get('/seller/profile'),
    updateProfile: (data) => axiosInstance.put('/seller/profile', data),

    // Stock
    adjustStock: (data) => axiosInstance.post('/products/adjust-stock', data),
    getStockHistory: () => axiosInstance.get('/products/stock-history'),

    // Notifications
    getNotifications: () => axiosInstance.get('/notifications'),
    markNotificationRead: (id) => axiosInstance.put(`/notifications/${id}/read`),
    markAllNotificationsRead: () => axiosInstance.put('/notifications/mark-all-read'),

    // Money Requests
    requestWithdrawal: (data) => axiosInstance.post('/seller/request-withdrawal', data),

    // Returns
    getReturns: (params) => axiosInstance.get('/orders/seller-returns', { params }),
    getReturnDetails: (orderId) => axiosInstance.get(`/orders/${orderId}/returns`),
    approveReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/approve`, data),
    rejectReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/reject`, data),
    assignReturnDelivery: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/assign-delivery`, data),

    // Return Requests (New System)
    getSellerReturnRequests: (params) => axiosInstance.get('/seller/return-requests', { params }),
    getSellerReturnRequestDetail: (returnRequestId) => axiosInstance.get(`/seller/return-requests/${returnRequestId}`),
    approveSellerReturnRequest: (returnRequestId, data) => axiosInstance.post(`/seller/return-requests/${returnRequestId}/approve`, data),
    rejectSellerReturnRequest: (returnRequestId, data) => axiosInstance.post(`/seller/return-requests/${returnRequestId}/reject`, data),
    getAvailableDeliveryBoys: (params) => axiosInstance.get('/seller/delivery-boys/available', { params }),
    assignDeliveryBoy: (returnRequestId, data) => axiosInstance.post(`/seller/return-requests/${returnRequestId}/assign-delivery-boy`, data),
    reassignDeliveryBoy: (returnRequestId, data) => axiosInstance.put(`/seller/return-requests/${returnRequestId}/reassign-delivery-boy`, data),

    // Cancellation Requests
    getSellerCancellationRequests: (params) => axiosInstance.get('/seller/cancellation-requests', { params }),
    getSellerCancellationRequestDetail: (cancellationRequestId) => axiosInstance.get(`/seller/cancellation-requests/${cancellationRequestId}`),
    approveSellerCancellationRequest: (cancellationRequestId, data) => axiosInstance.post(`/seller/cancellation-requests/${cancellationRequestId}/approve`, data),
    rejectSellerCancellationRequest: (cancellationRequestId, data) => axiosInstance.post(`/seller/cancellation-requests/${cancellationRequestId}/reject`, data),
    getAvailableCancellationDeliveryBoys: (params) => axiosInstance.get('/seller/cancellation-requests/delivery-boys/available', { params }),
    assignCancellationDeliveryBoy: (cancellationRequestId, data) => axiosInstance.post(`/seller/cancellation-requests/${cancellationRequestId}/assign-delivery-boy`, data),
    reassignCancellationDeliveryBoy: (cancellationRequestId, data) => axiosInstance.put(`/seller/cancellation-requests/${cancellationRequestId}/reassign-delivery-boy`, data),

    // Media
    uploadMedia: (formData) => axiosInstance.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
};

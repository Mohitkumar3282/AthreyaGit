import axiosInstance from '@core/api/axios';

/**
 * Admin order and return endpoints.
 * Per-domain split (P4.5).
 */
export const adminOrdersApi = {
    getOrders: (params) =>
        axiosInstance.get('/orders/seller-orders', { params }),
    getOrderDetails: (orderId) =>
        axiosInstance.get(`/orders/details/${orderId}`),
    updateOrderStatus: (orderId, data) =>
        axiosInstance.put(`/orders/status/${orderId}`, data),
    createManualOrder: (data) =>
        axiosInstance.post('/orders/manual', data),
    assignRiderToOrder: (orderId, data) =>
        axiosInstance.put(`/orders/${orderId}/assign-rider`, data),

    getReturns: (params) =>
        axiosInstance.get('/orders/seller-returns', { params }),
    getReturnDetails: (orderId) =>
        axiosInstance.get(`/orders/${orderId}/returns`),
    approveReturn: (orderId, data) =>
        axiosInstance.put(`/orders/returns/${orderId}/approve`, data),
    rejectReturn: (orderId, data) =>
        axiosInstance.put(`/orders/returns/${orderId}/reject`, data),
    assignReturnDelivery: (orderId, data) =>
        axiosInstance.put(`/orders/returns/${orderId}/assign-delivery`, data),
    updateReturnQc: (orderId, data) =>
        axiosInstance.put(`/orders/returns/${orderId}/qc`, data),

    // New Return Requests & Delivery Boys System endpoints
    getAdminReturnRequests: (params) =>
        axiosInstance.get('/admin/return-requests', { params }),
    getAdminReturnRequestDetail: (returnRequestId) =>
        axiosInstance.get(`/admin/return-requests/${returnRequestId}`),
    overrideReturnRequest: (returnRequestId, data) =>
        axiosInstance.post(`/admin/return-requests/${returnRequestId}/override`, data),
    initiateRefund: (returnRequestId, data) =>
        axiosInstance.post(`/admin/return-requests/${returnRequestId}/initiate-refund`, data),
    getAdminReturnStats: () =>
        axiosInstance.get('/admin/return-requests/stats'),
};

export default adminOrdersApi;

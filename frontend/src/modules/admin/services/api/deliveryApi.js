import axiosInstance from '@core/api/axios';

/**
 * Admin delivery-partner endpoints (lifecycle, active fleet).
 * Per-domain split (P4.5).
 */
export const adminDeliveryApi = {
    getDeliveryPartners: (params) =>
        axiosInstance.get('/admin/delivery-partners', { params }),
    approveDeliveryPartner: (id) =>
        axiosInstance.patch(`/admin/delivery-partners/approve/${id}`),
    rejectDeliveryPartner: (id) =>
        axiosInstance.delete(`/admin/delivery-partners/reject/${id}`),
    getActiveFleet: (params) =>
        axiosInstance.get('/admin/active-fleet', { params }),
    reviewRiderCancellations: (id, data) =>
        axiosInstance.post(`/admin/delivery-partners/${id}/review-cancellations`, data),
    updateRiderCashLimit: (id, cashLimit) =>
        axiosInstance.put(`/admin/delivery-partners/${id}/cash-limit`, { cashLimit }),
    awardRiderIncentive: (id, data) =>
        axiosInstance.post(`/admin/delivery-partners/${id}/incentive`, data),
};

export default adminDeliveryApi;

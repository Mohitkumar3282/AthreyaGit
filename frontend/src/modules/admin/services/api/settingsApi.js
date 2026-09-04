import axiosInstance from '@core/api/axios';

/**
 * Admin platform / delivery / centralized settings endpoints.
 * Per-domain split (P4.5).
 */
export const adminSettingsApi = {
    getPlatformSettings: () => axiosInstance.get('/admin/settings/platform'),
    updatePlatformSettings: (data) =>
        axiosInstance.put('/admin/settings/platform', data),

    getDeliveryFinanceSettings: () =>
        axiosInstance.get('/admin/settings/delivery'),
    updateDeliveryFinanceSettings: (data) =>
        axiosInstance.put('/admin/settings/delivery', data),

    // Athreya Coins — read-only views over the customer loyalty wallet.
    getCoinWallets: (params) =>
        axiosInstance.get('/admin/coins/wallets', { params }),
    getCoinTransactions: (params) =>
        axiosInstance.get('/admin/coins/transactions', { params }),

    // Centralized settings (public GET, admin PUT)
    getSettings: () => axiosInstance.get('/settings'),
    updateSettings: (data) => axiosInstance.put('/settings', data),
    uploadSettingsImage: (formData, type = 'logo') =>
        axiosInstance.post(`/settings/upload?type=${type}`, formData),
};

export default adminSettingsApi;

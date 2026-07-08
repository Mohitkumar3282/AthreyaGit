import axiosInstance from "@core/api/axios";

export const deliveryApi = {
  sendLoginOtp: (data) => axiosInstance.post("/delivery/send-login-otp", data),
  sendSignupOtp: (data) =>
    axiosInstance.post("/delivery/send-signup-otp", data),
  verifyOtp: (data) => axiosInstance.post("/delivery/verify-otp", data),
  getProfile: () => axiosInstance.get("/delivery/profile"),
  updateProfile: (data) => axiosInstance.put("/delivery/profile", data),
  getStats: () => axiosInstance.get("/delivery/stats"),
  getEarnings: () => axiosInstance.get("/delivery/earnings"),
  getCodCashSummary: () => axiosInstance.get("/delivery/cod/summary"),
  payCodCashToAdmin: (data) => axiosInstance.post("/delivery/cod/pay", data),
  getWalletSummary: () => axiosInstance.get("/delivery/wallet/summary"),
  getOrderHistory: (params, config = {}) =>
    axiosInstance.get("/delivery/order-history", { params, ...config }),
  getAvailableOrders: (params = {}, config = {}) =>
    axiosInstance.get("/orders/available", { params, ...config }),
  acceptOrder: (orderId, idempotencyKey) =>
    axiosInstance.put(
      `/orders/accept/${encodeURIComponent(String(orderId))}`,
      {},
      {
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
      },
    ),
  skipOrder: (orderId) =>
    axiosInstance.put(`/orders/skip/${encodeURIComponent(String(orderId))}`),
  postLocation: (body, config = {}) =>
    axiosInstance.post("/delivery/location", body, config),
  confirmPickup: (orderId, body) =>
    axiosInstance.post(`/orders/workflow/${orderId}/pickup/confirm`, body),
  markArrivedAtStore: (orderId, body) =>
    axiosInstance.post(`/orders/workflow/${orderId}/pickup/ready`, body),
  advanceDeliveryRiderUi: (orderId) =>
    axiosInstance.post(`/orders/workflow/${orderId}/rider/advance-ui`, {}),
  requestDeliveryOtp: (orderId, body) =>
    axiosInstance.post(`/orders/workflow/${orderId}/otp/request`, body),
  verifyDeliveryOtp: (orderId, body) =>
    axiosInstance.post(`/orders/workflow/${orderId}/otp/verify`, body),
  getOrderRoute: (orderId, params, config = {}) =>
    axiosInstance.get(`/orders/workflow/${orderId}/route`, { params, ...config }),
  getOrderDetails: (orderId) =>
    axiosInstance.get(
      `/orders/details/${encodeURIComponent(String(orderId))}`,
    ),
  getNotifications: (config = {}) => axiosInstance.get("/notifications", config),
  markNotificationRead: (id) => axiosInstance.put(`/notifications/${id}/read`),
  markAllNotificationsRead: () =>
    axiosInstance.put("/notifications/mark-all-read"),
  requestWithdrawal: (data) =>
    axiosInstance.post("/delivery/request-withdrawal", data),
  updateStatus: (orderId, data) =>
    axiosInstance.put(`/orders/status/${orderId}`, data),
  updateReturnStatus: (orderId, data) =>
    axiosInstance.put(`/orders/return-status/${orderId}`, data),
  acceptReturnPickup: (orderId) =>
    axiosInstance.put(`/orders/returns/${orderId}/accept-pickup`),
  rejectReturnPickup: (orderId) =>
    axiosInstance.put(`/orders/returns/${orderId}/reject-pickup`),
  requestReturnOtp: (orderId, body) =>
    axiosInstance.post(`/orders/workflow/${orderId}/return-otp/request`, body),
  verifyReturnOtp: (orderId, body) =>
    axiosInstance.post(`/orders/workflow/${orderId}/return-otp/verify`, body),
  uploadReturnPickupProof: (orderId, data) =>
    axiosInstance.post(`/orders/returns/${orderId}/pickup-proof`, data),
  requestReturnDropOtp: (orderId, body) =>
    axiosInstance.post(`/orders/workflow/${orderId}/return-drop-otp/request`, body),
  verifyReturnDropOtp: (orderId, body) =>
    axiosInstance.post(`/orders/workflow/${orderId}/return-drop-otp/verify`, body),

  // Cancellation OTP Handlers
  requestCancellationOtp: (orderId, body) =>
    axiosInstance.post(`/orders/workflow/${orderId}/cancellation-otp/request`, body),
  verifyCancellationOtp: (orderId, body) =>
    axiosInstance.post(`/orders/workflow/${orderId}/cancellation-otp/verify`, body),
  requestCancellationDropOtp: (orderId, body) =>
    axiosInstance.post(`/orders/workflow/${orderId}/cancellation-drop-otp/request`, body),
  verifyCancellationDropOtp: (orderId, body) =>
    axiosInstance.post(`/orders/workflow/${orderId}/cancellation-drop-otp/verify`, body),

  // Return Requests (New System)
  getMyReturnTasks: () => axiosInstance.get('/delivery-boy/return-tasks'),
  getReturnTaskDetail: (returnRequestId) => axiosInstance.get(`/return-requests/${returnRequestId}`),
  acceptReturnTask: (returnRequestId) => axiosInstance.post(`/delivery-boy/return-tasks/${returnRequestId}/accept`),
  declineReturnTask: (returnRequestId) => axiosInstance.post(`/delivery-boy/return-tasks/${returnRequestId}/decline`),
  markReturnPickedUp: (returnRequestId, formData) => axiosInstance.post(`/delivery-boy/return-tasks/${returnRequestId}/picked-up`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  markReturnDeliveredToSeller: (returnRequestId) => axiosInstance.post(`/delivery-boy/return-tasks/${returnRequestId}/delivered-to-seller`),
  updateReturnRiderLocation: (data) => axiosInstance.put('/delivery-boy/location', data),

  // Cancellation Requests Logistics
  getMyCancellationTasks: () => axiosInstance.get('/delivery-boy/cancellation-tasks'),
  getCancellationTaskDetail: (cancellationRequestId) => axiosInstance.get(`/cancellation-requests/${cancellationRequestId}`),
  acceptCancellationTask: (cancellationRequestId) => axiosInstance.post(`/delivery-boy/cancellation-tasks/${cancellationRequestId}/accept`),
  declineCancellationTask: (cancellationRequestId, data) => axiosInstance.post(`/delivery-boy/cancellation-tasks/${cancellationRequestId}/decline`, data),
 
  // Shop Bill Upload
  uploadBillImage: (orderId, billImage) =>
    axiosInstance.post(`/orders/workflow/${orderId}/bill/upload`, { billImage }),
};

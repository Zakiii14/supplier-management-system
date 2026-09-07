import apiClient from "./client";

const getPaymentSettingsRequest = async () => {
  const response = await apiClient.get("/payment-settings");
  return response.data.data;
};

const updatePaymentSettingsRequest = async (payload) => {
  const response = await apiClient.put("/payment-settings", payload);
  return response.data.data;
};

export {
  getPaymentSettingsRequest,
  updatePaymentSettingsRequest,
};

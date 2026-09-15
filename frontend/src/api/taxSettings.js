import apiClient from "./client";

const getTaxSettingsRequest = async () => {
  const response = await apiClient.get("/tax-settings");
  return response.data.data;
};

const updateTaxSettingsRequest = async (payload) => {
  const response = await apiClient.put("/tax-settings", payload);
  return response.data.data;
};

export { getTaxSettingsRequest, updateTaxSettingsRequest };

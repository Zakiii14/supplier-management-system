import apiClient from "./client";

const getStockOpnamesRequest = async (params = {}) => {
  const response = await apiClient.get("/stock-opnames", { params });
  return response.data;
};

const getStockOpnameByIdRequest = async (id) => {
  const response = await apiClient.get(`/stock-opnames/${id}`);
  return response.data.data;
};

const createStockOpnameRequest = async (payload) => {
  const response = await apiClient.post("/stock-opnames", payload);
  return response.data.data;
};

const submitStockOpnameRequest = async (id) => {
  const response = await apiClient.post(`/stock-opnames/${id}/submit`);
  return response.data.data;
};

const decideStockOpnameRequest = async (id, decision, reason = "") => {
  const response = await apiClient.post(`/stock-opnames/${id}/decision`, { decision, reason });
  return response.data.data;
};

const cancelStockOpnameRequest = async (id) => {
  const response = await apiClient.patch(`/stock-opnames/${id}/cancel`);
  return response.data.data;
};

export {
  cancelStockOpnameRequest,
  createStockOpnameRequest,
  decideStockOpnameRequest,
  getStockOpnameByIdRequest,
  getStockOpnamesRequest,
  submitStockOpnameRequest,
};

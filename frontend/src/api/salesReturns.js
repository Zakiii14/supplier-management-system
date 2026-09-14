import apiClient from "./client";

const getSalesReturnsRequest = async (params = {}) => {
  const response = await apiClient.get("/sales-returns", { params });
  return response.data;
};

const getSalesReturnByIdRequest = async (id) => {
  const response = await apiClient.get(`/sales-returns/${id}`);
  return response.data.data;
};

const getReturnableDeliveriesRequest = async (params = {}) => {
  const response = await apiClient.get("/sales-returns/deliveries", { params });
  return response.data.data;
};

const getReturnableDeliveryItemsRequest = async (id) => {
  const response = await apiClient.get(`/sales-returns/deliveries/${id}/items`);
  return response.data.data;
};

const createSalesReturnRequest = async (payload) => {
  const response = await apiClient.post("/sales-returns", payload);
  return response.data.data;
};

const submitSalesReturnRequest = async (id) => {
  const response = await apiClient.post(`/sales-returns/${id}/submit`);
  return response.data.data;
};

const decideSalesReturnRequest = async (id, decision, reason = "") => {
  const response = await apiClient.post(`/sales-returns/${id}/decision`, { decision, reason });
  return response.data.data;
};

const cancelSalesReturnRequest = async (id) => {
  const response = await apiClient.patch(`/sales-returns/${id}/cancel`);
  return response.data.data;
};

const getSalesReturnSettlementInvoicesRequest = async (id) => {
  const response = await apiClient.get(`/sales-returns/${id}/settlement-invoices`);
  return response.data.data;
};

const createSalesReturnSettlementRequest = async (id, payload) => {
  const response = await apiClient.post(`/sales-returns/${id}/settlements`, payload);
  return response.data.data;
};

export {
  cancelSalesReturnRequest,
  createSalesReturnRequest,
  createSalesReturnSettlementRequest,
  decideSalesReturnRequest,
  getSalesReturnByIdRequest,
  getSalesReturnsRequest,
  getSalesReturnSettlementInvoicesRequest,
  getReturnableDeliveryItemsRequest,
  getReturnableDeliveriesRequest,
  submitSalesReturnRequest,
};

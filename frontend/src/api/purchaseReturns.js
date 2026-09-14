import apiClient from "./client";

const getPurchaseReturnsRequest = async (params = {}) => {
  const response = await apiClient.get("/purchase-returns", { params });
  return response.data;
};

const getPurchaseReturnByIdRequest = async (id) => {
  const response = await apiClient.get(`/purchase-returns/${id}`);
  return response.data.data;
};

const getReturnableGoodsReceiptsRequest = async (params = {}) => {
  const response = await apiClient.get("/purchase-returns/goods-receipts", { params });
  return response.data.data;
};

const getReturnableGoodsReceiptItemsRequest = async (id) => {
  const response = await apiClient.get(`/purchase-returns/goods-receipts/${id}/items`);
  return response.data.data;
};

const createPurchaseReturnRequest = async (payload) => {
  const response = await apiClient.post("/purchase-returns", payload);
  return response.data.data;
};

const submitPurchaseReturnRequest = async (id) => {
  const response = await apiClient.post(`/purchase-returns/${id}/submit`);
  return response.data.data;
};

const decidePurchaseReturnRequest = async (id, decision, reason = "") => {
  const response = await apiClient.post(`/purchase-returns/${id}/decision`, { decision, reason });
  return response.data.data;
};

const cancelPurchaseReturnRequest = async (id) => {
  const response = await apiClient.patch(`/purchase-returns/${id}/cancel`);
  return response.data.data;
};

const getPurchaseReturnSettlementInvoicesRequest = async (id) => {
  const response = await apiClient.get(`/purchase-returns/${id}/settlement-invoices`);
  return response.data.data;
};

const createPurchaseReturnSettlementRequest = async (id, payload) => {
  const response = await apiClient.post(`/purchase-returns/${id}/settlements`, payload);
  return response.data.data;
};

export {
  cancelPurchaseReturnRequest,
  createPurchaseReturnRequest,
  createPurchaseReturnSettlementRequest,
  decidePurchaseReturnRequest,
  getPurchaseReturnByIdRequest,
  getPurchaseReturnsRequest,
  getPurchaseReturnSettlementInvoicesRequest,
  getReturnableGoodsReceiptItemsRequest,
  getReturnableGoodsReceiptsRequest,
  submitPurchaseReturnRequest,
};

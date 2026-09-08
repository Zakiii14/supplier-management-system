import apiClient from "./client";

const getPurchaseOrdersRequest = async (
  params = {},
) => {
  const response = await apiClient.get(
    "/purchase-orders",
    { params },
  );

  return response.data;
};

const getReceivablePurchaseOrdersRequest =
  async () => {
    const [
      submittedResponse,
      partiallyReceivedResponse,
    ] = await Promise.all([
      getPurchaseOrdersRequest({
        status: "SUBMITTED",
        page: 1,
        limit: 100,
      }),
      getPurchaseOrdersRequest({
        status: "PARTIALLY_RECEIVED",
        page: 1,
        limit: 100,
      }),
    ]);

    return [
      ...submittedResponse.data,
      ...partiallyReceivedResponse.data,
    ].sort(
      (firstPurchaseOrder, secondPurchaseOrder) =>
        new Date(
          secondPurchaseOrder.created_at,
        ).getTime() -
        new Date(
          firstPurchaseOrder.created_at,
        ).getTime(),
    );
  };

const getPurchaseOrderByIdRequest = async (
  purchaseOrderId,
) => {
  const [response, historyResponse] = await Promise.all([
    apiClient.get(`/purchase-orders/${purchaseOrderId}`),
    apiClient.get(`/purchase-orders/${purchaseOrderId}/approval-history`),
  ]);

  return {
    ...response.data.data,
    approval_history: historyResponse.data.data,
  };
};

const submitPurchaseOrderApprovalRequest = async (purchaseOrderId) => {
  const response = await apiClient.post(
    `/purchase-orders/${purchaseOrderId}/approval/submit`,
  );
  return response.data.data;
};

const decidePurchaseOrderApprovalRequest = async (purchaseOrderId, decision, reason = "") => {
  const response = await apiClient.post(
    `/purchase-orders/${purchaseOrderId}/approval/decision`,
    { decision, reason },
  );
  return response.data.data;
};

const createPurchaseOrderRequest = async (
  payload,
) => {
  const response = await apiClient.post(
    "/purchase-orders",
    payload,
  );

  return response.data.data;
};

const updatePurchaseOrderStatusRequest = async (
  purchaseOrderId,
  status,
) => {
  const response = await apiClient.patch(
    `/purchase-orders/${purchaseOrderId}/status`,
    { status },
  );

  return response.data.data;
};

const createSupplierPaymentRequest = async (
  purchaseOrderId,
  payload,
) => {
  const { proofs = [], ...fields } = payload;
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, String(value));
    }
  });
  proofs.forEach((file) => formData.append("proofs", file));
  const response = await apiClient.post(
    `/purchase-orders/${purchaseOrderId}/supplier-payments`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data.data;
};

const addSupplierPaymentProofsRequest = async (
  purchaseOrderId,
  paymentId,
  files,
) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("proofs", file));
  const response = await apiClient.post(
    `/purchase-orders/${purchaseOrderId}/supplier-payments/${paymentId}/proofs`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data.data;
};

const replaceSupplierPaymentProofRequest = async (
  purchaseOrderId,
  paymentId,
  proofId,
  file,
) => {
  const formData = new FormData();
  formData.append("proof", file);
  const response = await apiClient.put(
    `/purchase-orders/${purchaseOrderId}/supplier-payments/${paymentId}/proofs/${proofId}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data.data;
};

const deleteSupplierPaymentProofRequest = async (
  purchaseOrderId,
  paymentId,
  proofId,
) => {
  const response = await apiClient.delete(
    `/purchase-orders/${purchaseOrderId}/supplier-payments/${paymentId}/proofs/${proofId}`,
  );
  return response.data.data;
};

const openSupplierPaymentProofRequest = async (
  purchaseOrderId,
  paymentId,
  proofId,
) => {
  const response = await apiClient.get(
    `/purchase-orders/${purchaseOrderId}/supplier-payments/${paymentId}/proofs/${proofId}/content`,
    { responseType: "blob" },
  );
  return response.data;
};

export {
  addSupplierPaymentProofsRequest,
  createPurchaseOrderRequest,
  createSupplierPaymentRequest,
  deleteSupplierPaymentProofRequest,
  decidePurchaseOrderApprovalRequest,
  getPurchaseOrderByIdRequest,
  getPurchaseOrdersRequest,
  getReceivablePurchaseOrdersRequest,
  openSupplierPaymentProofRequest,
  replaceSupplierPaymentProofRequest,
  submitPurchaseOrderApprovalRequest,
  updatePurchaseOrderStatusRequest,
};

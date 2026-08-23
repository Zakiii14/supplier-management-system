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
  const response = await apiClient.get(
    `/purchase-orders/${purchaseOrderId}`,
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

export {
  createPurchaseOrderRequest,
  getPurchaseOrderByIdRequest,
  getPurchaseOrdersRequest,
  getReceivablePurchaseOrdersRequest,
  updatePurchaseOrderStatusRequest,
};

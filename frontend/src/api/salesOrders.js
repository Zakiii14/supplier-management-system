import apiClient from "./client";

const getSalesOrdersRequest = async (params = {}) => {
  const response = await apiClient.get(
    "/sales-orders",
    { params },
  );

  return response.data;
};

const getSalesOrderByIdRequest = async (
  salesOrderId,
) => {
  const [response, historyResponse] = await Promise.all([
    apiClient.get(`/sales-orders/${salesOrderId}`),
    apiClient.get(`/sales-orders/${salesOrderId}/approval-history`),
  ]);

  return {
    ...response.data.data,
    approval_history: historyResponse.data.data,
  };
};

const submitSalesOrderApprovalRequest = async (salesOrderId) => {
  const response = await apiClient.post(
    `/sales-orders/${salesOrderId}/approval/submit`,
  );
  return response.data.data;
};

const decideSalesOrderApprovalRequest = async (salesOrderId, decision, reason = "") => {
  const response = await apiClient.post(
    `/sales-orders/${salesOrderId}/approval/decision`,
    { decision, reason },
  );
  return response.data.data;
};

const getDeliverableSalesOrdersRequest =
  async () => {
    const [
      confirmedResponse,
      partiallyDeliveredResponse,
    ] = await Promise.all([
      getSalesOrdersRequest({
        status: "CONFIRMED",
        page: 1,
        limit: 100,
      }),
      getSalesOrdersRequest({
        status: "PARTIALLY_DELIVERED",
        page: 1,
        limit: 100,
      }),
    ]);

    return [
      ...confirmedResponse.data,
      ...partiallyDeliveredResponse.data,
    ].sort((firstOrder, secondOrder) =>
      firstOrder.so_number.localeCompare(
        secondOrder.so_number,
      ),
    );
  };

const createSalesOrderRequest = async (payload) => {
  const response = await apiClient.post(
    "/sales-orders",
    payload,
  );

  return response.data.data;
};

const updateSalesOrderStatusRequest = async (
  salesOrderId,
  status,
) => {
  const response = await apiClient.patch(
    `/sales-orders/${salesOrderId}/status`,
    { status },
  );

  return response.data.data;
};

export {
  createSalesOrderRequest,
  decideSalesOrderApprovalRequest,
  getDeliverableSalesOrdersRequest,
  getSalesOrderByIdRequest,
  getSalesOrdersRequest,
  submitSalesOrderApprovalRequest,
  updateSalesOrderStatusRequest,
};

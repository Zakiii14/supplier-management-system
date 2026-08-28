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
  const response = await apiClient.get(
    `/sales-orders/${salesOrderId}`,
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
  getDeliverableSalesOrdersRequest,
  getSalesOrderByIdRequest,
  getSalesOrdersRequest,
  updateSalesOrderStatusRequest,
};
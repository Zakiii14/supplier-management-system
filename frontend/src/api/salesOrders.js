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
  getSalesOrderByIdRequest,
  getSalesOrdersRequest,
  updateSalesOrderStatusRequest,
};
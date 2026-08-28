import apiClient from "./client";

const getDeliveriesRequest = async (
  params = {},
) => {
  const response = await apiClient.get(
    "/deliveries",
    { params },
  );

  return response.data;
};

const getDeliveryByIdRequest = async (
  deliveryId,
) => {
  const response = await apiClient.get(
    `/deliveries/${deliveryId}`,
  );

  return response.data.data;
};

const createDeliveryRequest = async (
  payload,
) => {
  const response = await apiClient.post(
    "/deliveries",
    payload,
  );

  return response.data.data;
};

const updateDeliveryStatusRequest = async (
  deliveryId,
  status,
) => {
  const response = await apiClient.patch(
    `/deliveries/${deliveryId}/status`,
    { status },
  );

  return response.data.data;
};

export {
  createDeliveryRequest,
  getDeliveriesRequest,
  getDeliveryByIdRequest,
  updateDeliveryStatusRequest,
};
import apiClient from "./client";

const getInventoryMovementsRequest = async (
  params = {},
) => {
  const response = await apiClient.get(
    "/inventory-movements",
    { params },
  );

  return response.data;
};

const getInventoryMovementByIdRequest = async (
  inventoryMovementId,
) => {
  const response = await apiClient.get(
    `/inventory-movements/${inventoryMovementId}`,
  );

  return response.data.data;
};

export {
  getInventoryMovementByIdRequest,
  getInventoryMovementsRequest,
};
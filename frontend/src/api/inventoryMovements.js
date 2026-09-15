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

const getQuarantineStocksRequest = async () => {
  const response = await apiClient.get(
    "/inventory-movements/quarantine-stocks",
  );

  return response.data.data;
};

const createStockInspectionRequest = async (payload) => {
  const response = await apiClient.post(
    "/inventory-movements/stock-inspections",
    payload,
  );

  return response.data.data;
};

const getDamagedStocksRequest = async () => {
  const response = await apiClient.get(
    "/inventory-movements/damaged-stocks",
  );
  return response.data.data;
};

const createDamageResolutionRequest = async (payload) => {
  const response = await apiClient.post(
    "/inventory-movements/damage-resolutions",
    payload,
  );
  return response.data.data;
};

export {
  createDamageResolutionRequest,
  createStockInspectionRequest,
  getDamagedStocksRequest,
  getInventoryMovementByIdRequest,
  getInventoryMovementsRequest,
  getQuarantineStocksRequest,
};

import apiClient from "./client";

const getSuppliersRequest = async (params = {}) => {
  const response = await apiClient.get("/suppliers", {
    params,
  });

  return response.data;
};

const getActiveSuppliersRequest = async () => {
  const response = await getSuppliersRequest({
    status: "ACTIVE",
    page: 1,
    limit: 100,
  });

  return response.data;
};

const getSupplierByIdRequest = async (
  supplierId,
) => {
  const response = await apiClient.get(
    `/suppliers/${supplierId}`,
  );

  return response.data.data;
};

const createSupplierRequest = async (payload) => {
  const response = await apiClient.post(
    "/suppliers",
    payload,
  );

  return response.data.data;
};

const updateSupplierRequest = async (
  supplierId,
  payload,
) => {
  const response = await apiClient.put(
    `/suppliers/${supplierId}`,
    payload,
  );

  return response.data.data;
};

const updateSupplierStatusRequest = async (
  supplierId,
  status,
) => {
  const response = await apiClient.patch(
    `/suppliers/${supplierId}/status`,
    { status },
  );

  return response.data.data;
};

export {
  createSupplierRequest,
  getActiveSuppliersRequest,
  getSupplierByIdRequest,
  getSuppliersRequest,
  updateSupplierRequest,
  updateSupplierStatusRequest,
};
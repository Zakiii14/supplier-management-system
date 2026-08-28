import apiClient from "./client";

const getProductsRequest = async (params = {}) => {
  const response = await apiClient.get("/products", {
    params,
  });

  return response.data;
};

const getActiveProductsRequest = async () => {
  const response = await getProductsRequest({
    status: "ACTIVE",
    page: 1,
    limit: 100,
  });

  return response.data;
};

const getActiveProductsBySupplierRequest = async (
  supplierId,
) => {
  if (!supplierId) {
    return [];
  }

  const response = await getProductsRequest({
    supplier_id: supplierId,
    status: "ACTIVE",
    page: 1,
    limit: 100,
  });

  return response.data;
};

const getProductByIdRequest = async (productId) => {
  const response = await apiClient.get(
    `/products/${productId}`,
  );

  return response.data.data;
};

const createProductRequest = async (payload) => {
  const response = await apiClient.post(
    "/products",
    payload,
  );

  return response.data.data;
};

const updateProductRequest = async (
  productId,
  payload,
) => {
  const response = await apiClient.put(
    `/products/${productId}`,
    payload,
  );

  return response.data.data;
};

const updateProductStatusRequest = async (
  productId,
  status,
) => {
  const response = await apiClient.patch(
    `/products/${productId}/status`,
    { status },
  );

  return response.data.data;
};

export {
  createProductRequest,
  getActiveProductsBySupplierRequest,
  getProductByIdRequest,
  getProductsRequest,
  getActiveProductsRequest,
  updateProductRequest,
  updateProductStatusRequest,
};
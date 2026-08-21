import apiClient from "./client";

const getProductsRequest = async (params = {}) => {
  const response = await apiClient.get("/products", {
    params,
  });

  return response.data;
};

const getProductByIdRequest = async (productId) => {
  const response = await apiClient.get(
    `/products/${productId}`,
  );

  return response.data.data;
};

export {
  getProductsRequest,
  getProductByIdRequest,
};
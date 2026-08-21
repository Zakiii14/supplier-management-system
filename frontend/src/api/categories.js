import apiClient from "./client";

const getCategoriesRequest = async (
  params = {},
) => {
  const response = await apiClient.get(
    "/categories",
    { params },
  );

  return response.data;
};

const getCategoryOptionsRequest = async () => {
  const response = await apiClient.get(
    "/categories",
    {
      params: {
        page: 1,
        limit: 100,
      },
    },
  );

  return response.data.data;
};

const getCategoryByIdRequest = async (
  categoryId,
) => {
  const response = await apiClient.get(
    `/categories/${categoryId}`,
  );

  return response.data.data;
};

const createCategoryRequest = async (payload) => {
  const response = await apiClient.post(
    "/categories",
    payload,
  );

  return response.data.data;
};

const updateCategoryRequest = async (
  categoryId,
  payload,
) => {
  const response = await apiClient.put(
    `/categories/${categoryId}`,
    payload,
  );

  return response.data.data;
};

const updateCategoryStatusRequest = async (
  categoryId,
  status,
) => {
  const response = await apiClient.patch(
    `/categories/${categoryId}/status`,
    { status },
  );

  return response.data.data;
};

export {
  createCategoryRequest,
  getCategoriesRequest,
  getCategoryByIdRequest,
  getCategoryOptionsRequest,
  updateCategoryRequest,
  updateCategoryStatusRequest,
};
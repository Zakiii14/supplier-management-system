import apiClient from "./client";

const getCategoriesRequest = async () => {
  const response = await apiClient.get("/categories");
  return response.data.data;
};

export { getCategoriesRequest };
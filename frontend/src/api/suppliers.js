import apiClient from "./client";

const getActiveSuppliersRequest = async () => {
  const response = await apiClient.get("/suppliers", {
    params: {
      status: "ACTIVE",
      page: 1,
      limit: 100,
    },
  });

  return response.data.data;
};

export { getActiveSuppliersRequest };
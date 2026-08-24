import apiClient from "./client";

const getCustomersRequest = async (params = {}) => {
  const response = await apiClient.get("/customers", {
    params,
  });

  return response.data;
};

const getActiveCustomersRequest = async () => {
  const response = await getCustomersRequest({
    status: "ACTIVE",
    page: 1,
    limit: 100,
  });

  return response.data;
};

const getCustomerByIdRequest = async (
  customerId,
) => {
  const response = await apiClient.get(
    `/customers/${customerId}`,
  );

  return response.data.data;
};

const createCustomerRequest = async (payload) => {
  const response = await apiClient.post(
    "/customers",
    payload,
  );

  return response.data.data;
};

const updateCustomerRequest = async (
  customerId,
  payload,
) => {
  const response = await apiClient.put(
    `/customers/${customerId}`,
    payload,
  );

  return response.data.data;
};

const updateCustomerStatusRequest = async (
  customerId,
  status,
) => {
  const response = await apiClient.patch(
    `/customers/${customerId}/status`,
    { status },
  );

  return response.data.data;
};

export {
  createCustomerRequest,
  getActiveCustomersRequest,
  getCustomerByIdRequest,
  getCustomersRequest,
  updateCustomerRequest,
  updateCustomerStatusRequest,
};
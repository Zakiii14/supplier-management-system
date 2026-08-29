import apiClient from "./client";

const getPaymentsRequest = async (
  params = {},
) => {
  const response = await apiClient.get(
    "/payments",
    { params },
  );

  return response.data;
};

const getPaymentEligibleInvoicesRequest =
  async () => {
    const response = await apiClient.get(
      "/payments/eligible-invoices",
    );

    return response.data.data;
  };

const getPaymentByIdRequest = async (
  paymentId,
) => {
  const response = await apiClient.get(
    `/payments/${paymentId}`,
  );

  return response.data.data;
};

const createPaymentRequest = async (
  payload,
) => {
  const response = await apiClient.post(
    "/payments",
    payload,
  );

  return response.data.data;
};

export {
  createPaymentRequest,
  getPaymentByIdRequest,
  getPaymentEligibleInvoicesRequest,
  getPaymentsRequest,
};
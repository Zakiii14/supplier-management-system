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
  const { proofs = [], ...fields } = payload;
  const formData = new FormData();

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, String(value));
    }
  });
  proofs.forEach((file) => formData.append("proofs", file));

  const response = await apiClient.post(
    "/payments",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );

  return response.data.data;
};

const addPaymentProofsRequest = async (paymentId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("proofs", file));
  const response = await apiClient.post(
    `/payments/${paymentId}/proofs`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data.data;
};

const replacePaymentProofRequest = async (
  paymentId,
  proofId,
  file,
) => {
  const formData = new FormData();
  formData.append("proof", file);
  const response = await apiClient.put(
    `/payments/${paymentId}/proofs/${proofId}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data.data;
};

const deletePaymentProofRequest = async (paymentId, proofId) => {
  const response = await apiClient.delete(
    `/payments/${paymentId}/proofs/${proofId}`,
  );
  return response.data.data;
};

const openPaymentProofRequest = async (paymentId, proofId) => {
  const response = await apiClient.get(
    `/payments/${paymentId}/proofs/${proofId}/content`,
    { responseType: "blob" },
  );
  return response.data;
};

export {
  addPaymentProofsRequest,
  createPaymentRequest,
  deletePaymentProofRequest,
  getPaymentByIdRequest,
  getPaymentEligibleInvoicesRequest,
  getPaymentsRequest,
  openPaymentProofRequest,
  replacePaymentProofRequest,
};

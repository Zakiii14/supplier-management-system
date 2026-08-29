import apiClient from "./client";

const getInvoicesRequest = async (
  params = {},
) => {
  const response = await apiClient.get(
    "/invoices",
    { params },
  );

  return response.data;
};

const getInvoiceEligibleSalesOrdersRequest =
  async () => {
    const response = await apiClient.get(
      "/invoices/eligible-sales-orders",
    );

    return response.data.data;
  };

const getInvoiceByIdRequest = async (
  invoiceId,
) => {
  const response = await apiClient.get(
    `/invoices/${invoiceId}`,
  );

  return response.data.data;
};

const createInvoiceRequest = async (
  payload,
) => {
  const response = await apiClient.post(
    "/invoices",
    payload,
  );

  return response.data.data;
};

const cancelInvoiceRequest = async (
  invoiceId,
) => {
  const response = await apiClient.patch(
    `/invoices/${invoiceId}/cancel`,
  );

  return response.data.data;
};

export {
  cancelInvoiceRequest,
  createInvoiceRequest,
  getInvoiceByIdRequest,
  getInvoiceEligibleSalesOrdersRequest,
  getInvoicesRequest,
};
import apiClient from "./client";

const REPORT_ENDPOINTS = {
  purchasing: "/reports/purchasing",
  inventory: "/reports/inventory",
  sales: "/reports/sales",
  finance: "/reports/finance",
};

const REPORT_OPTION_ENDPOINTS = {
  supplier: "/reports/options/suppliers",
  category: "/reports/options/categories",
  customer: "/reports/options/customers",
};

const getReportRequest = async (
  reportType,
  params = {},
) => {
  const endpoint = REPORT_ENDPOINTS[reportType];

  if (!endpoint) {
    throw new Error("Invalid report type");
  }

  const response = await apiClient.get(
    endpoint,
    { params },
  );

  return response.data;
};

const getReportOptionsRequest = async (
  optionType,
) => {
  const endpoint =
    REPORT_OPTION_ENDPOINTS[optionType];

  if (!endpoint) {
    throw new Error(
      "Invalid report option type",
    );
  }

  const response = await apiClient.get(endpoint);

  return response.data.data;
};

export {
  getReportOptionsRequest,
  getReportRequest,
  REPORT_ENDPOINTS,
  REPORT_OPTION_ENDPOINTS,
};
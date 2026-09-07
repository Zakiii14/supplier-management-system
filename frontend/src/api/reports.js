import apiClient from "./client";

const REPORT_ENDPOINTS = {
  purchasing: "/reports/purchasing",
  inventory: "/reports/inventory",
  sales: "/reports/sales",
  finance: "/reports/finance",
  supplierFinance: "/reports/supplier-finance",
};

const REPORT_OPTION_ENDPOINTS = {
  supplier: "/reports/options/suppliers",
  category: "/reports/options/categories",
  customer: "/reports/options/customers",
};

const REPORT_EXPORT_ENDPOINTS = {
  purchasing: "/reports/purchasing/export",
  inventory: "/reports/inventory/export",
  sales: "/reports/sales/export",
  finance: "/reports/finance/export",
  supplierFinance: "/reports/supplier-finance/export",
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

const getReportExportRequest = async (
  reportType,
  format,
  params = {},
) => {
  const endpoint =
    REPORT_EXPORT_ENDPOINTS[reportType];

  if (!endpoint) {
    throw new Error("Invalid report export type");
  }

  try {
    const response = await apiClient.get(endpoint, {
      params: {
        ...params,
        format,
      },
      responseType: "blob",
    });
    const disposition =
      response.headers["content-disposition"] || "";
    const fileNameMatch = disposition.match(
      /filename="?([^";]+)"?/i,
    );

    return {
      blob: response.data,
      fileName:
        fileNameMatch?.[1] ||
        `laporan-${reportType}.${format}`,
    };
  } catch (error) {
    if (
      error.response?.data instanceof Blob &&
      error.response.data.type.includes("json")
    ) {
      try {
        error.response.data = JSON.parse(
          await error.response.data.text(),
        );
      } catch {
        // Pertahankan error asli jika respons gagal dibaca.
      }
    }

    throw error;
  }
};

export {
  getReportExportRequest,
  getReportOptionsRequest,
  getReportRequest,
  REPORT_ENDPOINTS,
  REPORT_EXPORT_ENDPOINTS,
  REPORT_OPTION_ENDPOINTS,
};

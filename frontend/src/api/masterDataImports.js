import apiClient from "./client";

const getImportModulesRequest = async () => {
  const response = await apiClient.get("/master-data-import/modules");
  return response.data.data;
};

const downloadImportTemplateRequest = async (moduleKey) => {
  const response = await apiClient.get(
    `/master-data-import/template/${moduleKey}`,
    { responseType: "blob" },
  );
  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return {
    blob: response.data,
    fileName: match?.[1] || `template-import-${moduleKey}.xlsx`,
  };
};

const previewMasterDataImportRequest = async (moduleKey, file) => {
  const formData = new FormData();
  formData.append("module", moduleKey);
  formData.append("file", file);
  const response = await apiClient.post(
    "/master-data-import/preview",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data.data;
};

const commitMasterDataImportRequest = async (moduleKey, rows) => {
  const response = await apiClient.post("/master-data-import/commit", {
    module: moduleKey,
    rows,
  });
  return response.data;
};

export {
  commitMasterDataImportRequest,
  downloadImportTemplateRequest,
  getImportModulesRequest,
  previewMasterDataImportRequest,
};

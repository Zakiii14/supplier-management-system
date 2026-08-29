import apiClient from "./client";

const getDashboardSummaryRequest = async () => {
  const response = await apiClient.get(
    "/dashboard/summary",
  );

  return response.data.data;
};

export { getDashboardSummaryRequest };
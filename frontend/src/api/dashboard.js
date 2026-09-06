import apiClient from "./client";

const getDashboardSummaryRequest = async () => {
  const response = await apiClient.get(
    "/dashboard/summary",
  );

  return response.data.data;
};

const getDashboardTrendsRequest = async (
  months = 6,
  signal,
) => {
  const response = await apiClient.get(
    "/dashboard/trends",
    {
      params: { months },
      signal,
    },
  );

  return response.data.data;
};

export {
  getDashboardSummaryRequest,
  getDashboardTrendsRequest,
};
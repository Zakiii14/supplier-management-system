import apiClient from "./client";

const getNotificationsRequest = async () => {
  const response = await apiClient.get("/notifications");
  return response.data;
};

const markNotificationsReadRequest = async (keys) => {
  const response = await apiClient.post("/notifications/read", { keys });
  return response.data;
};

export { getNotificationsRequest, markNotificationsReadRequest };

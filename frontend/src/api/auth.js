import apiClient from "./client";

const loginRequest = async (credentials) => {
  const response = await apiClient.post("/auth/login", credentials);

  return response.data.data;
};

const getCurrentUserRequest = async () => {
  const response = await apiClient.get("/auth/me");

  return response.data.data;
};

export { loginRequest, getCurrentUserRequest };
import apiClient from "./client";

const loginRequest = async (credentials) => {
  const response = await apiClient.post("/auth/login", credentials);
  return response.data.data;
};

const getCurrentUserRequest = async () => {
  const response = await apiClient.get("/auth/me");
  return response.data.data;
};

const forgotPasswordRequest = async (email) => {
  const response = await apiClient.post("/auth/forgot-password", {
    email,
  });
  return response.data;
};

const validateResetPasswordTokenRequest = async (token) => {
  const response = await apiClient.get(
    "/auth/reset-password/validate",
    { params: { token } },
  );
  return response.data.data;
};

const resetPasswordRequest = async (payload) => {
  const response = await apiClient.post(
    "/auth/reset-password",
    payload,
  );
  return response.data;
};

const validateActivationTokenRequest = async (token) => {
  const response = await apiClient.get(
    "/auth/activate-account/validate",
    { params: { token } },
  );
  return response.data.data;
};

const activateAccountRequest = async (payload) => {
  const response = await apiClient.post(
    "/auth/activate-account",
    payload,
  );
  return response.data;
};

export {
  loginRequest,
  getCurrentUserRequest,
  forgotPasswordRequest,
  validateResetPasswordTokenRequest,
  resetPasswordRequest,
  validateActivationTokenRequest,
  activateAccountRequest,
};

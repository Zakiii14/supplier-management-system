import apiClient from "./client";

const getUsersRequest = async (params = {}) => {
  const response = await apiClient.get("/users", {
    params,
  });

  return response.data;
};

const getUserByIdRequest = async (userId) => {
  const response = await apiClient.get(
    `/users/${userId}`,
  );

  return response.data.data;
};

const createUserRequest = async (payload) => {
  const response = await apiClient.post(
    "/users",
    payload,
  );

  return response.data.data;
};

const updateUserRequest = async (
  userId,
  payload,
) => {
  const response = await apiClient.patch(
    `/users/${userId}`,
    payload,
  );

  return response.data.data;
};

const updateUserStatusRequest = async (
  userId,
  status,
) => {
  return updateUserRequest(userId, { status });
};

const resetUserPasswordRequest = async (
  userId,
  password,
) => {
  const response = await apiClient.patch(
    `/users/${userId}/password`,
    { password },
  );

  return response.data.data;
};

const getUserAvatarRequest = async (userId) => {
  const response = await apiClient.get(`/users/${userId}/avatar`, {
    responseType: "blob",
  });
  return response.data;
};

const uploadUserAvatarRequest = async (userId, file) => {
  const formData = new FormData();
  formData.append("avatar", file);
  const response = await apiClient.put(`/users/${userId}/avatar`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data.data;
};

const deleteUserAvatarRequest = async (userId) => {
  const response = await apiClient.delete(`/users/${userId}/avatar`);
  return response.data.data;
};

export {
  createUserRequest,
  getUserByIdRequest,
  getUsersRequest,
  getUserAvatarRequest,
  uploadUserAvatarRequest,
  deleteUserAvatarRequest,
  resetUserPasswordRequest,
  updateUserRequest,
  updateUserStatusRequest,
};

import apiClient from "./client";

const getCodeNumberSettingsRequest = async () => {
  const response = await apiClient.get(
    "/code-number-settings",
  );

  return response.data.data;
};

const getCodeNumberSettingRequest = async (
  moduleKey,
) => {
  const response = await apiClient.get(
    `/code-number-settings/${moduleKey}`,
  );

  return response.data.data;
};

const updateCodeNumberSettingRequest = async (
  moduleKey,
  payload,
) => {
  const response = await apiClient.put(
    `/code-number-settings/${moduleKey}`,
    payload,
  );

  return response.data.data;
};

export {
  getCodeNumberSettingRequest,
  getCodeNumberSettingsRequest,
  updateCodeNumberSettingRequest,
};

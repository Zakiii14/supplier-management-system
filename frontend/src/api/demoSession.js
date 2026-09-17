import apiClient from "./client";

const prepareDemoSessionRequest = async () => {
  const response = await apiClient.post("/demo-session/prepare");
  return response.data.data;
};

const heartbeatDemoSessionRequest = async (clientId, accessToken) => {
  await apiClient.post("/demo-session/heartbeat", {
    client_id: clientId,
  }, { headers: { Authorization: `Bearer ${accessToken}` } });
};

const endDemoSessionRequest = async (clientId, accessToken = "") => {
  const response = await apiClient.post(
    "/demo-session/end",
    { client_id: clientId },
    accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  );
  return response.data.data;
};

export {
  prepareDemoSessionRequest,
  heartbeatDemoSessionRequest,
  endDemoSessionRequest,
};

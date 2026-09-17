import apiClient from "./client";

const prepareDemoSessionRequest = async () => {
  const response = await apiClient.post("/demo-session/prepare");
  return response.data.data;
};

const heartbeatDemoSessionRequest = async (clientId) => {
  await apiClient.post("/demo-session/heartbeat", {
    client_id: clientId,
  });
};

const endDemoSessionRequest = async (clientId) => {
  const response = await apiClient.post("/demo-session/end", {
    client_id: clientId,
  });
  return response.data.data;
};

export {
  prepareDemoSessionRequest,
  heartbeatDemoSessionRequest,
  endDemoSessionRequest,
};

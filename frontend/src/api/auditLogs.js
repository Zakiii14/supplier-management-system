import apiClient from "./client";
const getAuditLogsRequest=async(params={})=>(await apiClient.get("/audit-logs",{params})).data;
const getAuditLogRequest=async(id)=>(await apiClient.get(`/audit-logs/${id}`)).data.data;
export{getAuditLogsRequest,getAuditLogRequest};

import apiClient from "./client";

const getSupplierInvoicesRequest=async(params={})=>(await apiClient.get("/supplier-invoices",{params})).data;
const getSupplierInvoiceRequest=async(id)=>(await apiClient.get(`/supplier-invoices/${id}`)).data.data;
const saveSupplierInvoiceRequest=async(id,payload)=>{
  const {attachments=[],...fields}=payload; const form=new FormData();
  Object.entries(fields).forEach(([key,value])=>{if(value!==null&&value!==undefined)form.append(key,String(value));});
  attachments.forEach(file=>form.append("attachments",file));
  const response=id?await apiClient.put(`/supplier-invoices/${id}`,form,{headers:{"Content-Type":"multipart/form-data"}}):await apiClient.post("/supplier-invoices",form,{headers:{"Content-Type":"multipart/form-data"}});
  return response.data.data;
};
const openSupplierInvoiceAttachmentRequest=async(invoiceId,attachmentId)=>(await apiClient.get(`/supplier-invoices/${invoiceId}/attachments/${attachmentId}/content`,{responseType:"blob"})).data;
const deleteSupplierInvoiceAttachmentRequest=async(invoiceId,attachmentId)=>(await apiClient.delete(`/supplier-invoices/${invoiceId}/attachments/${attachmentId}`)).data;
export{getSupplierInvoicesRequest,getSupplierInvoiceRequest,saveSupplierInvoiceRequest,openSupplierInvoiceAttachmentRequest,deleteSupplierInvoiceAttachmentRequest};

import apiClient from "./client";

const getGoodsReceiptsRequest = async (
  params = {},
) => {
  const response = await apiClient.get(
    "/goods-receipts",
    { params },
  );

  return response.data;
};

const getGoodsReceiptByIdRequest = async (
  goodsReceiptId,
) => {
  const response = await apiClient.get(
    `/goods-receipts/${goodsReceiptId}`,
  );

  return response.data.data;
};

const createGoodsReceiptRequest = async (
  payload,
) => {
  const response = await apiClient.post(
    "/goods-receipts",
    payload,
  );

  return response.data.data;
};

export {
  createGoodsReceiptRequest,
  getGoodsReceiptByIdRequest,
  getGoodsReceiptsRequest,
};
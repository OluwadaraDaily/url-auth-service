export type ApiResponse<T> = {
  data: T;
  message: string;
  statusCode: number;
};

export type ApiError = {
  message: string;
  statusCode: number;
};

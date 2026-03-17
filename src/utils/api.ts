import axios, { AxiosError } from 'axios';

//最外层的Response body
interface ErrorResponse {
  detail: FastAPIError[];
}

// 响应错误模型定义
interface FastAPIError {
  loc: string[];
  msg: string;
  type: string;
}

// 响应拦截器定义部分
function formatErrorMessage(detail: FastAPIError[] | string | any): string {
  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    console.error('Backend Error:', detail);
    return detail[0]?.msg || 'Unknown Error';
  }

  // Handle object errors (e.g., if detail is a single object {msg: "..."})
  if (detail && typeof detail === 'object') {
     return detail.msg || detail.message || JSON.stringify(detail);
  }

  return 'Response Failed: ' + String(detail);
}

const error_catch = (error: AxiosError<ErrorResponse>) => {
  if (error.response?.data) {
    const detail  = error.response.data?.detail || 'Unknown Error';
    // 格式化错误信息
    const errorMessage = formatErrorMessage(detail);
    // 替换错误信息
    error.message = errorMessage;
  }
  return Promise.reject(error);
}

// 认证api
const auth_api = axios.create({baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:9000',});

//认证api token 注入
auth_api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

auth_api.interceptors.response.use(
  (response) => response,
  error_catch
);

//无认证api
const api = axios.create({baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:9000',});

// 无认证api 响应拦截器
api.interceptors.response.use(
  (response) => response,
  error_catch
);

export {auth_api, api};

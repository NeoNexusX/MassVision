import axios, { AxiosError } from 'axios';

// Top-level Response body
interface ErrorResponse {
  detail: FastAPIError[];
}

// Response error model definition
interface FastAPIError {
  loc: string[];
  msg: string;
  type: string;
}

// Response interceptor definition
function formatErrorMessage(detail: FastAPIError[] | string | any): string {
  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    console.error('Backend Error:', detail);
    const firstError = detail[0];
    if (firstError) {
        // Include location info like "body.password" or "query.id"
        const loc = firstError.loc ? firstError.loc.join('.') : '';
        return `${firstError.msg} ${loc ? `(${loc})` : ''}`;
    }
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
    // Format error message
    const errorMessage = formatErrorMessage(detail);
    // Replace error message
    error.message = errorMessage;
  }
  return Promise.reject(error);
}

// Authenticated API
const auth_api = axios.create({baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:9000',});

// Inject auth token
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

// Public API
const api = axios.create({baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:9000',});

// Public API response interceptor
api.interceptors.response.use(
  (response) => response,
  error_catch
);

export {auth_api, api};

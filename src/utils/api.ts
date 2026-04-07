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
export function formatErrorMessage(detail: FastAPIError[] | string | any): string {
  // Normalize various backend error shapes into a readable string.
  // Accepts FastAPI-style arrays, objects with msg/message, or strings (possibly JSON).
  const safeStringify = (o: any) => {
    try { return JSON.stringify(o); } catch { return String(o); }
  };

  let msg: any = detail ?? 'Unknown Error';

  // If it's an array (FastAPI validation errors), pick first message
  if (Array.isArray(msg)) {
    const first = msg[0];
    msg = (first && (first.msg || first.message)) ? (first.msg || first.message) : safeStringify(first);
  } else if (msg && typeof msg === 'object') {
    // If it's an object, prefer msg/message fields
    msg = msg.msg || msg.message || safeStringify(msg);
  } else {
    msg = String(msg);
  }

  // If msg is a JSON string, try parsing nested detail/msg
  if (typeof msg === 'string' && (msg.trim().startsWith('{') || msg.trim().startsWith('['))) {
    try {
      const parsed = JSON.parse(msg);
      const inner = parsed?.detail || parsed?.msg || parsed;
      if (Array.isArray(inner) && inner.length && inner[0].msg) {
        msg = inner[0].msg;
      } else if (typeof inner === 'object' && inner.msg) {
        msg = inner.msg;
      } else {
        msg = String(inner);
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  return String(msg || 'Response Failed');
}

const error_catch = (error: AxiosError<ErrorResponse>) => {
  if (error.response?.data) {
    const raw = (error.response.data as any) || {};
    const candidate = raw?.detail ?? raw?.message ?? raw?.msg ?? error.message ?? raw;
    const errorMessage = formatErrorMessage(candidate);
    // set formatted message on the error and also on response.data for callers
    try { error.message = errorMessage; } catch {}
    try { (error.response.data as any).message = errorMessage; } catch {}
  }
  return Promise.reject(error);
};

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

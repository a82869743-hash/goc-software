import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { usePermissionsStore } from '../stores/permissionsStore';

const getApiBaseUrl = (): string => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) {
    return 'http://localhost:4000/api/v1';
  }
  return `${window.location.origin}/api/v1`;
};

const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── REQUEST INTERCEPTOR — Attach JWT ─────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── RESPONSE INTERCEPTOR — Handle 401s ───────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — force logout
      const { logout } = useAuthStore.getState();
      logout();
      usePermissionsStore.getState().clearPermissions();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;

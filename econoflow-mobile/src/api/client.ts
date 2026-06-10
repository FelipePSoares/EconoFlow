import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import i18n from '../i18n';
import { useAuthStore } from '../store/authStore';
import { addBreadcrumb } from '../monitoring/sentry';
import i18n from '../i18n';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://localhost:7003';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}[] = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
};

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['Accept-Language'] = i18n.language ?? 'en';
  // Breadcrumb: method + URL only — never the body or the auth token.
  addBreadcrumb(
    `${(config.method ?? 'GET').toUpperCase()} ${config.url ?? ''}`,
    'http',
    { method: (config.method ?? 'GET').toUpperCase(), url: config.url },
  );
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      // Record non-401 HTTP failures (and exhausted 401 retries) as breadcrumbs.
      // Status code + URL only — no response body, no financial data.
      if (error.response?.status) {
        addBreadcrumb(
          `HTTP ${error.response.status} ${originalRequest?.url ?? ''}`,
          'http',
          { status: error.response.status, url: originalRequest?.url },
        );
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const { refreshToken, setTokens, clearAuth } = useAuthStore.getState();

    if (!refreshToken) {
      isRefreshing = false;
      clearAuth();
      return Promise.reject(error);
    }

    try {
      const response = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${BASE_URL}/api/AccessControl/mobile/refresh-token`,
        {
          accessToken: useAuthStore.getState().accessToken,
          refreshToken,
        }
      );

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
      setTokens(newAccessToken, newRefreshToken);
      processQueue(null, newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuth();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

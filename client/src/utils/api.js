import axios from 'axios';

// Use relative URL so Vite proxy forwards to backend (no CORS issues)
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

/*
 * Request interceptor
 *
 * Useful for:
 * - consistent request handling
 * - development debugging
 * - future auth/header additions
 */
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      const method = (config.method || 'GET').toUpperCase();
      console.debug(
        `[API] ${method} ${config.baseURL}${config.url || ''}`
      );
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/*
 * Response interceptor
 *
 * Keeps API errors consistent without interfering
 * with the existing AuthContext refresh/logout logic.
 */
api.interceptors.response.use(
  (response) => response,

  (error) => {
    if (import.meta.env.DEV) {
      if (error.response) {
        console.error(
          `[API] ${error.response.status} ${error.config?.url || ''}`,
          error.response.data
        );
      } else if (error.request) {
        console.error(
          '[API] Network error: backend is unreachable.'
        );
      } else {
        console.error('[API] Request setup error:', error.message);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
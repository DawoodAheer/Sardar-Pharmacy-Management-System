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
 *
 * Special handling for 502/503/504:
 * These occur when the Vite proxy can't reach the backend
 * (e.g. during nodemon restarts). We mark these with
 * error.isServerUnavailable = true so AuthContext
 * does NOT log the user out in this scenario.
 */
api.interceptors.response.use(
  (response) => response,

  (error) => {
    const status = error.response?.status;

    // 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
    // = Vite proxy could not reach the backend (nodemon is restarting).
    // This is NOT an auth error — do not clear tokens or log the user out.
    if (status === 502 || status === 503 || status === 504) {
      error.isServerUnavailable = true;
      if (import.meta.env.DEV) {
        console.warn(
          `[API] Server unavailable (${status}) — backend may be restarting. Request: ${error.config?.url || ''}`
        );
      }
      return Promise.reject(error);
    }

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
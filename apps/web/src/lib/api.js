import axios from 'axios';

let accessToken = null;
let csrfToken = null;
let csrfTokenPromise = null;

// Routes a guest is allowed to view — never bounce them to /login from here.
const PUBLIC_PATHS = [
  '/', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/catalogue',
  '/about', '/contact', '/pricing', '/trade-terms', '/help-centre', '/privacy', '/terms', '/status',
];
function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));
}

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const row = document.cookie
    .split('; ')
    .find((value) => value.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.split('=').slice(1).join('=')) : null;
}

function isUnsafeMethod(method = 'get') {
  return !['get', 'head', 'options'].includes(String(method).toLowerCase());
}

export async function ensureCsrfToken() {
  if (csrfToken) return csrfToken;

  const cookieToken = readCookie('xsrf_token');
  if (cookieToken) {
    csrfToken = cookieToken;
    return csrfToken;
  }

  if (!csrfTokenPromise) {
    csrfTokenPromise = axios
      .get('/api/csrf-token', {
        withCredentials: true,
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      .then((response) => {
        csrfToken = response.data?.csrfToken || readCookie('xsrf_token');
        return csrfToken;
      })
      .finally(() => {
        csrfTokenPromise = null;
      });
  }

  return csrfTokenPromise;
}

const api = axios.create({
  // Keep browser API traffic same-origin. Deployment environment values must
  // never become arbitrary browser request origins.
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  xsrfCookieName: 'xsrf_token',
  xsrfHeaderName: 'X-CSRF-Token',
});

api.interceptors.request.use(async (config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  if (isUnsafeMethod(config.method) && !config.headers['X-CSRF-Token']) {
    config.headers['X-CSRF-Token'] = await ensureCsrfToken();
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const token = await ensureCsrfToken();
        const response = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': token } }
        );
        const newToken = response.data.accessToken;
        accessToken = newToken;
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        accessToken = null;
        if (typeof window !== 'undefined' && !isPublicPath(window.location.pathname)) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

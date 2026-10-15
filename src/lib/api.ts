import { logNetworkError } from './networkLogger';

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const API_URL = import.meta.env.VITE_API_URL || '/api';

function extractHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// Global redirection guard to prevent multiple simultaneous redirects
let isRedirectingToLogin = false;

export const fetchApi = async <T = any>(
  endpoint: string, 
  options: RequestInit & { _retryCount?: number; sourceHook?: string; silent?: boolean } = {}
): Promise<T> => {
  const token = localStorage.getItem('token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  // If body is FormData or already binary, let fetch set boundary
  if (options.body && typeof FormData !== 'undefined' && options.body instanceof FormData) {
    delete (headers as Record<string, string>)['Content-Type'];
  }

  if (token) {
    const bearer = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    (headers as Record<string, string>)['Authorization'] = bearer;
  }

  // Robust URL normalization: Ensure base without trailing slash, clean endpoint without leading /api
  const base = (API_URL || '/api').replace(/\/+$/, '');
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.replace(/^\/api/, '');
  }
  const url = `${base}${cleanEndpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const responseHeaders = extractHeaders(response.headers);
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!response.ok) {
      let errorMessage = `Server responded with status ${response.status}`;
      let parsedErrorData: any = null;
      let rawErrorBody = '';
      
      if (isJson) {
        try {
          const errorData = await response.json();
          parsedErrorData = errorData;
          if (errorData) {
            if (typeof errorData === 'string') {
              errorMessage = errorData;
            } else if (typeof errorData.error === 'string') {
              errorMessage = errorData.error;
            } else if (errorData.error && typeof errorData.error === 'object') {
              errorMessage = errorData.error.message || errorData.error.code || JSON.stringify(errorData.error);
            } else if (typeof errorData.message === 'string') {
              errorMessage = errorData.message;
            } else if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
            } else {
              errorMessage = JSON.stringify(errorData);
            }
          }
        } catch {
          // ignore parsing error
        }
      } else {
        try {
          rawErrorBody = await response.text();
        } catch {}

        if (response.status === 404) {
          errorMessage = `API endpoint not found (404) for ${url}. Please ensure the backend server is running.`;
        } else if (response.status === 401) {
          errorMessage = 'Session expired or invalid credentials (401).';
        } else if (response.status === 403) {
          errorMessage = 'Access forbidden (403). Administrator privileges are required to perform this action.';
        } else if (response.status >= 500) {
          errorMessage = 'Internal server error. Please check server logs.';
        }
      }

      // If server is returning 502/503 during restart/warmup, retry before erroring
      const currentRetry = options._retryCount || 0;
      if ((response.status === 502 || response.status === 503 || response.status === 504) && currentRetry < 4) {
        await new Promise(res => setTimeout(res, 800 * (currentRetry + 1)));
        return await fetchApi<T>(endpoint, { ...options, _retryCount: currentRetry + 1 });
      }

      // GLOBAL 401 UNAUTHORIZED INTERCEPTOR:
      // Clear expired auth session and redirect user to /login gracefully
      if (response.status === 401) {
        if (!url.includes('/auth/login') && typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (!isRedirectingToLogin && !window.location.pathname.startsWith('/login')) {
            isRedirectingToLogin = true;
            setTimeout(() => {
              window.location.href = '/login?expired=true';
            }, 100);
          }
        }
        // Do NOT log standard 401 unauthorized as a network failure diagnostic
        throw new ApiError(errorMessage || 'Unauthorized', 401, parsedErrorData);
      }

      // Log network error for actual non-401 unexpected errors unless marked silent
      if (!options.silent) {
        logNetworkError({
          url,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          contentType,
          bodySnippet: rawErrorBody || JSON.stringify(parsedErrorData),
          sourceHook: options.sourceHook || 'fetchApi',
          isHtml: contentType.includes('text/html') || rawErrorBody.startsWith('<')
        });
      }

      throw new ApiError(errorMessage, response.status, parsedErrorData);
    }

    if (isJson) {
      return await response.json();
    }

    // Fallback text check
    const text = await response.text();
    if (!text || text.trim() === '') {
      return null as unknown as T;
    }

    if (text.trim().startsWith('<') || text.includes('<!DOCTYPE')) {
      const isStartingServer = text.includes('Starting Server...') || text.includes('Starting Server') || text.includes('Vite');
      const currentRetry = options._retryCount || 0;
      const maxRetries = isStartingServer ? 10 : 3;

      // If we received an HTML page (e.g. during Cloud Run container startup/restart or warmup),
      // retry with backoff before erroring out, without polluting the error console
      if (currentRetry < maxRetries) {
        const delay = isStartingServer ? 1000 : 500;
        await new Promise(res => setTimeout(res, delay));
        return await fetchApi<T>(endpoint, { ...options, _retryCount: currentRetry + 1 });
      }

      // For polling endpoints like notifications, return safe default rather than hard erroring
      if (cleanEndpoint.includes('notifications')) {
        return { notifications: [], unread_count: 0 } as unknown as T;
      }

      // Only log diagnostics error if retries are fully exhausted and not marked silent
      if (!options.silent) {
        logNetworkError({
          url,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          contentType,
          bodySnippet: text,
          sourceHook: options.sourceHook || 'fetchApi',
          isHtml: true
        });
      }

      throw new Error(`The backend service is currently initializing. Please refresh in a moment.`);
    }
    
    try {
      return JSON.parse(text);
    } catch {
      return text as unknown as T;
    }
  } catch (err: any) {
    if ((err.name === 'TypeError' && /fetch/i.test(err.message)) || err.message?.includes('Failed to fetch')) {
      const currentRetry = options._retryCount || 0;
      if (currentRetry < 3) {
        await new Promise(res => setTimeout(res, 800));
        return await fetchApi<T>(endpoint, { ...options, _retryCount: currentRetry + 1 });
      }
      throw new Error('Unable to connect to the server. Please check your network or server status.');
    }
    throw err;
  }
};

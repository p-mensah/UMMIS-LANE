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

export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
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

  // Ensure endpoint starts with a slash
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_URL}${cleanEndpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Check if the response is JSON
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!response.ok) {
      let errorMessage = `Server responded with status ${response.status}`;
      let parsedErrorData: any = null;
      
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
        if (response.status === 404) {
          errorMessage = 'API endpoint not found (404). Please ensure the backend server is running.';
        } else if (response.status === 401) {
          errorMessage = 'Invalid email or password credentials (401).';
        } else if (response.status === 403) {
          errorMessage = 'Access forbidden (403). Administrator privileges are required to perform this action.';
        } else if (response.status >= 500) {
          errorMessage = 'Internal server error. Please check server logs.';
        }
      }

      throw new ApiError(errorMessage, response.status, parsedErrorData);
    }

    if (isJson) {
      return await response.json();
    }

    // Fallback text check
    const text = await response.text();
    if (text.trim().startsWith('<') || text.includes('<!DOCTYPE')) {
      throw new Error('Received unexpected HTML page instead of API response. Check API configuration.');
    }
    
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (err: any) {
    if ((err.name === 'TypeError' && /fetch/i.test(err.message)) || err.message?.includes('Failed to fetch')) {
      throw new Error('Unable to connect to the server. Please check your network or server status.');
    }
    throw err;
  }
};

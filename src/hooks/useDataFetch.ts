import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchApi, ApiError } from '../lib/api';
import { logNetworkError } from '../lib/networkLogger';

export interface UseDataFetchOptions extends RequestInit {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  sourceHook?: string;
}

export interface UseDataFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<T | null>;
  execute: (overrideEndpoint?: string, overrideOptions?: RequestInit) => Promise<T | null>;
  responseHeaders: Record<string, string> | null;
}

/**
 * Custom Data Fetching Hook with built-in network response header interceptor and diagnostics.
 * When an error occurs or HTML is received instead of JSON, the actual response headers
 * and status details are automatically intercepted and logged.
 */
export function useDataFetch<T = any>(
  endpoint: string | null,
  options: UseDataFetchOptions = {}
): UseDataFetchResult<T> {
  const { immediate = true, onSuccess, onError, sourceHook = 'useDataFetch', ...fetchOptions } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(immediate && endpoint));
  const [error, setError] = useState<Error | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string> | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (overrideEndpoint?: string, overrideOptions?: RequestInit): Promise<T | null> => {
      const targetEndpoint = overrideEndpoint || endpoint;
      if (!targetEndpoint) {
        setLoading(false);
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await fetchApi<T>(targetEndpoint, {
          ...fetchOptions,
          ...overrideOptions,
          sourceHook,
        });

        if (isMountedRef.current) {
          setData(result);
          onSuccess?.(result);
        }
        return result;
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err);
          onError?.(err);
        }

        // Intercept and extract any attached headers or diagnostics from ApiError
        if (err instanceof ApiError && err.data?.headers) {
          setResponseHeaders(err.data.headers);
        }

        logNetworkError({
          url: targetEndpoint,
          status: err?.status || 500,
          statusText: err?.message || 'Data Fetch Error',
          headers: err?.data?.headers || {},
          sourceHook,
          bodySnippet: typeof err?.message === 'string' ? err.message : JSON.stringify(err),
          isHtml: typeof err?.message === 'string' && (err.message.includes('HTML') || err.message.includes('<!DOCTYPE'))
        });

        return null;
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [endpoint, sourceHook]
  );

  const refetch = useCallback(() => execute(), [execute]);

  useEffect(() => {
    if (immediate && endpoint) {
      execute();
    }
  }, [immediate, endpoint, execute]);

  return {
    data,
    loading,
    error,
    refetch,
    execute,
    responseHeaders
  };
}

export default useDataFetch;

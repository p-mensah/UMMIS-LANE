/**
 * Network and Response Diagnostics Logging Utility
 * Intercepts and logs detailed response headers and context when API requests fail
 * or receive unexpected HTML instead of JSON.
 */

export interface NetworkDiagnosticsContext {
  url: string;
  status: number;
  statusText?: string;
  headers: Record<string, string>;
  contentType?: string;
  bodySnippet?: string;
  sourceHook?: string;
  isHtml?: boolean;
}

// Global in-memory diagnostics log for inspection
declare global {
  interface Window {
    __networkDiagnosticsHistory?: NetworkDiagnosticsContext[];
  }
}

const diagnosticsHistory: NetworkDiagnosticsContext[] = [];

export function getNetworkDiagnosticsHistory(): NetworkDiagnosticsContext[] {
  return [...diagnosticsHistory];
}

export function clearNetworkDiagnosticsHistory(): void {
  diagnosticsHistory.length = 0;
  if (typeof window !== 'undefined') {
    window.__networkDiagnosticsHistory = [];
  }
}

export function logNetworkError(ctx: NetworkDiagnosticsContext) {
  // Save to history (keep latest 50 entries)
  diagnosticsHistory.unshift(ctx);
  if (diagnosticsHistory.length > 50) {
    diagnosticsHistory.pop();
  }
  if (typeof window !== 'undefined') {
    window.__networkDiagnosticsHistory = diagnosticsHistory;
  }

  const isHtml = 
    ctx.isHtml || 
    ctx.contentType?.toLowerCase().includes('text/html') || 
    (ctx.bodySnippet && (ctx.bodySnippet.trim().startsWith('<') || ctx.bodySnippet.includes('<!DOCTYPE')));

  const groupTitle = isHtml
    ? `🚨 [Network Diagnostics Interceptor] RECEIVED UNEXPECTED HTML INSTEAD OF JSON: ${ctx.url} (${ctx.status})`
    : `⚠️ [Network Diagnostics Interceptor] API ERROR: ${ctx.url} (${ctx.status})`;

  console.groupCollapsed(groupTitle);
  console.warn('Originating Hook/Context:', ctx.sourceHook || 'Data Fetching Hook');
  console.warn('Endpoint URL:', ctx.url);
  console.warn('HTTP Status:', `${ctx.status} ${ctx.statusText || ''}`);
  console.warn('Content-Type Header:', ctx.contentType || '(no content-type header returned)');
  
  // Log actual response headers in structured table and raw object format
  console.warn('Actual Response Headers (Key-Value Object):', ctx.headers);
  if (ctx.headers && Object.keys(ctx.headers).length > 0) {
    try {
      console.table(
        Object.entries(ctx.headers).map(([name, value]) => ({
          'Header Name': name,
          'Header Value': value
        }))
      );
    } catch {
      // ignore table formatting error if in restricted console
    }
  } else {
    console.warn('Headers: (no headers captured or empty headers object)');
  }

  if (ctx.bodySnippet) {
    console.warn('Response Body Snippet (first 400 chars):', ctx.bodySnippet.slice(0, 400));
  }

  if (isHtml) {
    console.error(
      'DIAGNOSIS: The endpoint returned an HTML document instead of JSON. Common causes:\n' +
      '1. The URL hit Vite SPA fallback middleware instead of the API route.\n' +
      '2. Proxy rewrite intercepted request and served document fallback.\n' +
      '3. Supabase URL misconfiguration or gateway returned an HTML error/auth page.'
    );
  }
  console.groupEnd();
}

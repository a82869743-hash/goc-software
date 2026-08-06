import { StructuredExternalApiError } from '../types/meta';

/**
 * Determine actionable recommendations based on Meta error codes & status
 */
export function getMetaErrorRecommendation(
  code: number | string,
  subcode: number | null,
  httpStatus: number
): string {
  const codeNum = typeof code === 'number' ? code : parseInt(String(code), 10);
  
  if (codeNum === 190 && subcode === 463) {
    return 'Session has expired. Generate a new Page Access Token in Meta Developer Console & update CRM Meta Settings.';
  }
  if (codeNum === 190 && subcode === 467) {
    return 'Session invalid / user logged out. Generate a fresh Page Access Token in Meta Developer Console.';
  }
  if (codeNum === 190) {
    return 'Page Access Token is expired or invalid. Generate a new Page Access Token.';
  }
  if (codeNum === 200 || codeNum === 10) {
    return 'Missing leads_retrieval or pages_read_engagement permission. Re-authorize Page Access Token with required permissions: leads_retrieval, pages_manage_metadata, pages_read_engagement, pages_show_list.';
  }
  if (codeNum === 104 || codeNum === 2500) {
    return 'An access token is required to request this resource. Configure a valid Page Access Token in Meta Settings.';
  }
  if (httpStatus === 404 || codeNum === 803 || codeNum === 33) {
    return 'Lead or object does not exist or is no longer accessible on Meta. Verify leadgen_id and Meta data retention policy.';
  }
  if (codeNum === 4 || codeNum === 17) {
    return 'Meta API Rate limit reached. Wait a few minutes before retrying request.';
  }
  
  return 'Verify Page Access Token, App ID, permissions, and network connectivity in CRM Meta Integration settings.';
}

/**
 * Parse an Axios/HTTP error into a fully transparent StructuredExternalApiError
 */
export function formatExternalApiError(
  provider: string,
  error: any,
  context: {
    leadgenId?: string;
    pageId?: string;
    formId?: string;
    executionTimeMs?: number;
    requestParams?: Record<string, any>;
    functionName?: string;
  } = {}
): StructuredExternalApiError {
  const httpStatus = error.response?.status || 500;
  const resData = error.response?.data;
  const metaError = resData?.error;

  const errorCode = metaError?.code || (resData?.code ?? 'UNKNOWN_ERROR');
  const errorSubcode = metaError?.error_subcode ?? null;
  const errorType = metaError?.type || error.name || 'ExternalApiError';
  const message = metaError?.message || resData?.message || error.message || 'External API call failed';
  const fbTraceId = metaError?.fbtrace_id || error.response?.headers?.['x-fb-trace-id'] || null;

  const recommendation = getMetaErrorRecommendation(errorCode, errorSubcode, httpStatus);

  // Mask access_token from params in output for safety
  const safeParams = { ...(context.requestParams || error.config?.params || {}) };
  if (safeParams.access_token) {
    safeParams.access_token = safeParams.access_token.substring(0, 10) + '...[MASKED]';
  }

  return {
    success: false,
    provider,
    httpStatus,
    errorType,
    errorCode,
    errorSubcode,
    message,
    fbTraceId,
    requestUrl: error.config?.url || 'N/A',
    requestParams: safeParams,
    requestHeaders: error.config?.headers ? { ...error.config.headers, Authorization: '[MASKED]' } : undefined,
    responseHeaders: error.response?.headers ? { ...error.response.headers } : undefined,
    responseBody: resData || null,
    stack: error.stack || undefined,
    timestamp: new Date().toISOString(),
    retryable: httpStatus >= 500 || errorCode === 4 || errorCode === 17,
    recommendation,
    leadgenId: context.leadgenId,
    pageId: context.pageId,
    formId: context.formId,
    executionTimeMs: context.executionTimeMs,
  };
}

/**
 * Format a structured error object into a readable terminal diagnostic card
 */
export function formatErrorDiagnosticCard(err: StructuredExternalApiError): string {
  return `--------------------------------------------------
${err.provider.toUpperCase()} ERROR
--------------------------------------------------

Provider:
${err.provider}

HTTP Status:
${err.httpStatus}

Error Type:
${err.errorType}

Error Code:
${err.errorCode}

Error Subcode:
${err.errorSubcode !== null ? err.errorSubcode : 'N/A'}

Message:
${err.message}

FB Trace ID:
${err.fbTraceId || 'N/A'}

Leadgen ID:
${err.leadgenId || 'N/A'}

Page ID:
${err.pageId || 'N/A'}

Form ID:
${err.formId || 'N/A'}

Request URL:
${err.requestUrl}

Recommendation:
${err.recommendation}

--------------------------------------------------`;
}

export class ExternalApiError extends Error {
  public structuredError: StructuredExternalApiError;

  constructor(structuredError: StructuredExternalApiError) {
    super(structuredError.message);
    this.name = 'ExternalApiError';
    this.structuredError = structuredError;
    Object.setPrototypeOf(this, ExternalApiError.prototype);
  }
}

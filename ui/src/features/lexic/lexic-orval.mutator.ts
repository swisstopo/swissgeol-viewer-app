import {
  LEXIC_API_BY_PAGE_HOST,
  LEXIC_API_VERSION,
  TIMEOUT_REQUEST_AFTER_MILLISECONDS,
} from 'src/constants';

const DEFAULT_BASE_URL = `https://dev-webmap-api.swissgeol.ch/${LEXIC_API_VERSION}`;

export async function lexicFetch<T>(
  requestUrl: string,
  requestOptions: RequestInit,
): Promise<T> {
  const headers = new Headers(requestOptions.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const baseUrl = LEXIC_API_BY_PAGE_HOST[getHost()] ?? DEFAULT_BASE_URL;
  const url = requestUrl.startsWith('http')
    ? requestUrl
    : `${baseUrl}${requestUrl}`;

  const response = await fetch(url, {
    ...requestOptions,
    headers,
    signal: AbortSignal.timeout(TIMEOUT_REQUEST_AFTER_MILLISECONDS),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to call Lexic API: [HTTP ${response.status}] ${await response.text()}`,
    );
  }

  const data = await parseResponseBody(response);

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as T;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if ([204, 205, 304].includes(response.status)) {
    return {};
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const text = await response.text();
    return text.length === 0 ? {} : JSON.parse(text);
  }

  if (contentType.startsWith('image/')) {
    return response.blob();
  }

  const text = await response.text();
  if (text.length === 0) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getHost(): string {
  if (typeof globalThis.location === 'undefined') {
    return 'localhost:8000';
  }
  return globalThis.location.host;
}

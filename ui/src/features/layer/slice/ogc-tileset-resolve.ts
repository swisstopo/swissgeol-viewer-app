/**
 * Resolve an OGC tileset download URL that 307-redirects to a public S3 cache.
 *
 * Browsers strip Authorization on cross-origin redirects. The follow-up request
 * to S3 then fails CORS when credentials were used (`Access-Control-Allow-Origin: *`
 * is incompatible with credentialed requests). We therefore load the tileset JSON
 * with `fetch` (auth only on the initial OGC hop; the browser drops it on the S3
 * redirect) and rewrite content URIs to the public S3 directory so Cesium never
 * issues credentialed requests against S3.
 *
 * Note: `redirect: 'manual'` cannot be used here — cross-origin 307s become
 * opaque redirects and the Location header is inaccessible.
 *
 * When the OGC gateway is down (e.g. 502), we fall back to a previously resolved
 * S3 URL (sessionStorage) or a known public cache entry for local/dev layers.
 */

const OGC_HOST = 'ogc-api.gst-viewer.swissgeol.ch';
const S3_CACHE_HOST =
  'swissgeol-ogc-api-cache-geometries.s3.eu-central-1.amazonaws.com';
const RESOLVED_URL_STORAGE_PREFIX = 'swissgeol:ogc-tileset-resolved:';
/** Give up on the OGC gateway quickly and use the public S3 cache instead. */
const OGC_FETCH_TIMEOUT_MS = 8_000;

/**
 * Known public S3 tileset URLs used when the OGC API is unavailable.
 * Keyed by OGC path suffix (`/collections/{id}/styles/{style}/download_format/tiles3d`).
 */
const KNOWN_S3_TILESET_FALLBACKS: Readonly<Record<string, string>> = {
  '/collections/14279/styles/5/download_format/tiles3d': `https://${S3_CACHE_HOST}/14279/tiles3d/5/Amplitude__2D_Seismic_data_.json`,
};

export interface ResolvedTileset {
  json: unknown;
  /** Final URL after redirects (typically the S3 cache object). */
  baseUrl: string;
  /** Headers for subsequent Cesium loads — empty when the final host is public. */
  headers: Record<string, string>;
}

export const resolveOgcTilesetResource = async (
  initialUrl: string,
  authHeaders: Record<string, string>,
): Promise<ResolvedTileset> => {
  // Prefer a known/remembered public S3 URL first — the OGC gateway currently
  // hangs or returns 502 for long periods, which blocked the whole layer load.
  const fallbackUrl = findFallbackUrl(initialUrl);
  if (fallbackUrl !== null) {
    try {
      return await fetchTilesetJson(fallbackUrl, {}, 60_000);
    } catch (fallbackError) {
      console.warn(
        'Public S3 tileset fallback failed; trying OGC API:',
        fallbackError,
      );
    }
  }

  try {
    const resolved = await fetchTilesetJson(initialUrl, authHeaders);
    rememberResolvedUrl(initialUrl, resolved.baseUrl);
    return resolved;
  } catch (primaryError) {
    if (fallbackUrl === null) {
      throw primaryError;
    }
    console.warn(
      'OGC tileset resolve failed; retrying public S3 fallback:',
      primaryError,
    );
    return fetchTilesetJson(fallbackUrl, {}, 60_000);
  }
};

const fetchTilesetJson = async (
  url: string,
  headers: Record<string, string>,
  timeoutMs: number = OGC_FETCH_TIMEOUT_MS,
): Promise<ResolvedTileset> => {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      credentials: 'omit',
      mode: 'cors',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(
      `Failed to fetch OGC tileset (network): ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OGC tileset: [${response.status} ${response.statusText}] ${url}`,
    );
  }

  const baseUrl = response.url !== '' ? response.url : url;
  const json: unknown = await response.json();
  const rewritten = rewriteOgcContentUrisToResolvedBase(json, baseUrl);
  return {
    json: rewritten,
    baseUrl,
    headers: shouldSendOgcAuth(baseUrl) ? { ...headers } : {},
  };
};

const findFallbackUrl = (initialUrl: string): string | null => {
  const remembered = readRememberedUrl(initialUrl);
  if (remembered !== null) {
    return remembered;
  }
  try {
    const path = new URL(initialUrl).pathname;
    return KNOWN_S3_TILESET_FALLBACKS[path] ?? null;
  } catch {
    return null;
  }
};

const rememberResolvedUrl = (initialUrl: string, resolvedUrl: string): void => {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  try {
    if (!resolvedUrl.includes('amazonaws.com')) {
      return;
    }
    sessionStorage.setItem(
      RESOLVED_URL_STORAGE_PREFIX + initialUrl,
      resolvedUrl,
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
};

const readRememberedUrl = (initialUrl: string): string | null => {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    return sessionStorage.getItem(RESOLVED_URL_STORAGE_PREFIX + initialUrl);
  } catch {
    return null;
  }
};

const shouldSendOgcAuth = (url: string): boolean => {
  try {
    return new URL(url).host === OGC_HOST;
  } catch {
    return false;
  }
};

/**
 * Content URIs in the tileset often still point at the OGC API (which 307s to
 * S3). Rewrite them to the same directory as the resolved tileset JSON so Cesium
 * loads public S3 objects directly without credentialed CORS issues.
 */
export const rewriteOgcContentUrisToResolvedBase = (
  tilesetJson: unknown,
  resolvedTilesetUrl: string,
): unknown => {
  if (tilesetJson === null || typeof tilesetJson !== 'object') {
    return tilesetJson;
  }

  let s3Directory: string;
  try {
    const resolved = new URL(resolvedTilesetUrl);
    if (!resolved.host.includes('amazonaws.com')) {
      return tilesetJson;
    }
    s3Directory = resolved.href.replace(/[^/]+$/, '');
  } catch {
    return tilesetJson;
  }

  const clone = structuredClone(tilesetJson) as {
    root?: TilesetNode;
  };

  const rewrite = (node: TilesetNode | undefined): void => {
    if (node === undefined) {
      return;
    }
    const uri = node.content?.uri;
    if (typeof uri === 'string' && uri.includes(OGC_HOST)) {
      const fileName = uri.split('/').pop();
      if (fileName !== undefined && fileName !== '') {
        node.content!.uri = `${s3Directory}${fileName}`;
      }
    }
    for (const child of node.children ?? []) {
      rewrite(child);
    }
  };

  rewrite(clone.root);
  return clone;
};

interface TilesetNode {
  content?: { uri?: string };
  children?: TilesetNode[];
}

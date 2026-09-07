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
 */

const OGC_HOST = 'ogc-api.gst-viewer.swissgeol.ch';
const S3_CACHE_HOST =
  'swissgeol-ogc-api-cache-geometries.s3.eu-central-1.amazonaws.com';
/** Give up on a hung/unresponsive OGC gateway rather than blocking indefinitely. */
const OGC_FETCH_TIMEOUT_MS = 8_000;

export interface ResolvedTileset {
  json: unknown;
  /** Final URL after redirects (typically the S3 cache object). */
  baseUrl: string;
  /** Headers for subsequent Cesium loads — empty when the final host is public. */
  headers: Record<string, string>;
}

export const resolveOgcTilesetResource = async (
  url: string,
  headers: Record<string, string>,
): Promise<ResolvedTileset> => {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      credentials: 'omit',
      mode: 'cors',
      signal: AbortSignal.timeout(OGC_FETCH_TIMEOUT_MS),
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

const shouldSendOgcAuth = (url: string): boolean => {
  try {
    return new URL(url).host === OGC_HOST;
  } catch {
    return false;
  }
};

/** Exact-host check — `includes()` would also match unrelated hosts that merely contain the substring. */
const isS3CacheUrl = (url: string): boolean => {
  try {
    return new URL(url).host === S3_CACHE_HOST;
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
    if (!isS3CacheUrl(resolvedTilesetUrl)) {
      return tilesetJson;
    }
    const resolved = new URL(resolvedTilesetUrl);
    const lastSlash = resolved.href.lastIndexOf('/');
    s3Directory = lastSlash >= 0 ? resolved.href.slice(0, lastSlash + 1) : '';
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
      const relativePath = ogcContentRelativePath(uri);
      if (relativePath !== null) {
        node.content!.uri = `${s3Directory}${relativePath}`;
      }
    }
    for (const child of node.children ?? []) {
      rewrite(child);
    }
  };

  rewrite(clone.root);
  return clone;
};

/**
 * `/collections/{id}/styles/{style}/...` is the OGC routing prefix; whatever
 * follows it is the content's actual storage path, which may be nested in
 * subdirectories rather than sitting flat next to the tileset JSON. Falls
 * back to just the file name when the URI does not match this shape (e.g. an
 * unexpected/older layout), matching the previous flat behaviour.
 */
const OGC_CONTENT_PATH_PREFIX = /^\/collections\/[^/]+\/styles\/[^/]+\/(.+)$/;

const ogcContentRelativePath = (uri: string): string | null => {
  let path: string;
  try {
    path = new URL(uri).pathname;
  } catch {
    path = uri;
  }
  const match = OGC_CONTENT_PATH_PREFIX.exec(path);
  if (match !== null) {
    return match[1];
  }
  const fileName = path.split('/').pop();
  return fileName !== undefined && fileName !== '' ? fileName : null;
};

interface TilesetNode {
  content?: { uri?: string };
  children?: TilesetNode[];
}

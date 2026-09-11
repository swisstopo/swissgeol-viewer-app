// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resolveOgcTilesetResource,
  rewriteOgcContentUrisToResolvedBase,
} from './ogc-tileset-resolve';

describe('rewriteOgcContentUrisToResolvedBase', () => {
  it('rewrites absolute OGC content URIs to the S3 tileset directory', () => {
    const tileset = {
      root: {
        children: [
          {
            content: {
              uri: 'https://ogc-api.gst-viewer.swissgeol.ch/collections/14279/styles/5/foo-slice-X-0.glb',
            },
          },
        ],
      },
    };
    const s3Url =
      'https://swissgeol-ogc-api-cache-geometries.s3.eu-central-1.amazonaws.com/14279/tiles3d/5/Amplitude.json';

    const rewritten = rewriteOgcContentUrisToResolvedBase(tileset, s3Url) as {
      root: { children: Array<{ content: { uri: string } }> };
    };

    expect(rewritten.root.children[0].content.uri).toBe(
      'https://swissgeol-ogc-api-cache-geometries.s3.eu-central-1.amazonaws.com/14279/tiles3d/5/foo-slice-X-0.glb',
    );
  });

  it('preserves nested content subdirectories instead of flattening to the file name', () => {
    const tileset = {
      root: {
        children: [
          {
            content: {
              uri: 'https://ogc-api.gst-viewer.swissgeol.ch/collections/14279/styles/5/nested/dir/foo-slice-X-0.glb',
            },
          },
        ],
      },
    };
    const s3Url =
      'https://swissgeol-ogc-api-cache-geometries.s3.eu-central-1.amazonaws.com/14279/tiles3d/5/Amplitude.json';

    const rewritten = rewriteOgcContentUrisToResolvedBase(tileset, s3Url) as {
      root: { children: Array<{ content: { uri: string } }> };
    };

    expect(rewritten.root.children[0].content.uri).toBe(
      'https://swissgeol-ogc-api-cache-geometries.s3.eu-central-1.amazonaws.com/14279/tiles3d/5/nested/dir/foo-slice-X-0.glb',
    );
  });

  it('leaves tilesets unchanged when not resolved to S3', () => {
    const tileset = {
      root: {
        content: {
          uri: 'https://ogc-api.gst-viewer.swissgeol.ch/collections/1/a.glb',
        },
      },
    };
    const result = rewriteOgcContentUrisToResolvedBase(
      tileset,
      'https://ogc-api.gst-viewer.swissgeol.ch/collections/1/tileset.json',
    );
    expect(result).toBe(tileset);
  });
});

describe('resolveOgcTilesetResource', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the tileset via the OGC gateway with auth headers', async () => {
    const ogcUrl =
      'https://ogc-api.gst-viewer.swissgeol.ch/collections/14279/styles/5/download_format/tiles3d';
    const tilesetJson = { root: { children: [] } };
    const fetchMock = vi.fn(async (url: string) => ({
      status: 200,
      ok: true,
      statusText: 'OK',
      url: String(url),
      json: async () => tilesetJson,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const resolved = await resolveOgcTilesetResource(ogcUrl, {
      Authorization: 'Basic test',
    });

    expect(resolved.baseUrl).toBe(ogcUrl);
    // Final host is still OGC, so auth headers are kept for subsequent loads.
    expect(resolved.headers).toEqual({ Authorization: 'Basic test' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      ogcUrl,
      expect.objectContaining({
        headers: { Authorization: 'Basic test' },
        redirect: 'follow',
        credentials: 'omit',
      }),
    );
  });

  it('rewrites content URIs and drops auth headers when fetch follows a redirect to S3', async () => {
    const ogcUrl =
      'https://ogc-api.gst-viewer.swissgeol.ch/collections/14279/styles/5/download_format/tiles3d';
    const s3Url =
      'https://swissgeol-ogc-api-cache-geometries.s3.eu-central-1.amazonaws.com/14279/tiles3d/5/Amplitude__2D_Seismic_data_.json';
    const tilesetJson = {
      root: {
        children: [
          {
            content: {
              uri: 'https://ogc-api.gst-viewer.swissgeol.ch/collections/14279/styles/5/a-slice-Z-1.glb',
            },
          },
        ],
      },
    };
    // `redirect: 'follow'` means the browser/fetch already resolved the 307
    // to S3 by the time we see the response — `response.url` is the final
    // (S3) URL, which is exactly what we key the content-URI rewrite on.
    const fetchMock = vi.fn(async () => ({
      status: 200,
      ok: true,
      statusText: 'OK',
      url: s3Url,
      json: async () => tilesetJson,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const resolved = await resolveOgcTilesetResource(ogcUrl, {
      Authorization: 'Basic test',
    });

    expect(resolved.baseUrl).toBe(s3Url);
    expect(resolved.headers).toEqual({});
    const rewritten = resolved.json as {
      root: { children: Array<{ content: { uri: string } }> };
    };
    expect(rewritten.root.children[0].content.uri).toBe(
      'https://swissgeol-ogc-api-cache-geometries.s3.eu-central-1.amazonaws.com/14279/tiles3d/5/a-slice-Z-1.glb',
    );
  });

  it('throws when the OGC request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 403,
        ok: false,
        statusText: 'Forbidden',
        url: 'https://ogc-api.gst-viewer.swissgeol.ch/x',
      })),
    );

    await expect(
      resolveOgcTilesetResource('https://ogc-api.gst-viewer.swissgeol.ch/x', {
        Authorization: 'Basic test',
      }),
    ).rejects.toThrow(/Failed to fetch OGC tileset/);
  });

  it('throws a descriptive error on a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await expect(
      resolveOgcTilesetResource('https://ogc-api.gst-viewer.swissgeol.ch/x', {
        Authorization: 'Basic test',
      }),
    ).rejects.toThrow(/Failed to fetch OGC tileset \(network\)/);
  });
});

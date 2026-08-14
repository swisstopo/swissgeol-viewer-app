// @vitest-environment jsdom
// (uses `sessionStorage`, which the default `node` test environment lacks.)
import { describe, expect, it, vi, afterEach } from 'vitest';
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
    sessionStorage.clear();
  });

  it('prefers the known S3 cache URL before calling OGC', async () => {
    const s3Url =
      'https://swissgeol-ogc-api-cache-geometries.s3.eu-central-1.amazonaws.com/14279/tiles3d/5/Amplitude__2D_Seismic_data_.json';
    const tilesetJson = {
      root: {
        children: [
          {
            content: {
              uri: 'https://ogc-api.gst-viewer.swissgeol.ch/collections/14279/styles/5/a-slice-Z-1.glb',
            },
            metadata: {
              properties: { sliceDirection: 'w', sliceNumber: 1 },
            },
          },
        ],
      },
    };

    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('ogc-api.gst-viewer')) {
        throw new Error('OGC should not be called when S3 succeeds');
      }
      return {
        status: 200,
        ok: true,
        statusText: 'OK',
        url: s3Url,
        json: async () => tilesetJson,
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const resolved = await resolveOgcTilesetResource(
      'https://ogc-api.gst-viewer.swissgeol.ch/collections/14279/styles/5/download_format/tiles3d',
      { Authorization: 'Basic test' },
    );

    expect(resolved.baseUrl).toBe(s3Url);
    expect(resolved.headers).toEqual({});
    const rewritten = resolved.json as {
      root: { children: Array<{ content: { uri: string } }> };
    };
    expect(rewritten.root.children[0].content.uri).toContain(
      'amazonaws.com/14279/tiles3d/5/a-slice-Z-1.glb',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('amazonaws.com/14279/tiles3d/5/'),
      expect.objectContaining({
        headers: {},
        redirect: 'follow',
        credentials: 'omit',
      }),
    );
  });

  it('falls back to OGC when the known S3 URL fails', async () => {
    const s3Url =
      'https://swissgeol-ogc-api-cache-geometries.s3.eu-central-1.amazonaws.com/14279/tiles3d/5/tileset.json';
    const tilesetJson = { root: { children: [] } };
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('amazonaws.com')) {
        return {
          status: 403,
          ok: false,
          statusText: 'Forbidden',
          url: String(url),
        };
      }
      return {
        status: 200,
        ok: true,
        statusText: 'OK',
        url: s3Url,
        json: async () => tilesetJson,
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const resolved = await resolveOgcTilesetResource(
      'https://ogc-api.gst-viewer.swissgeol.ch/collections/14279/styles/5/download_format/tiles3d',
      { Authorization: 'Basic test' },
    );

    expect(resolved.baseUrl).toBe(s3Url);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('ogc-api'),
      expect.objectContaining({
        headers: { Authorization: 'Basic test' },
      }),
    );
  });

  it('uses remembered S3 URL for unknown collections', async () => {
    const ogcUrl =
      'https://ogc-api.gst-viewer.swissgeol.ch/collections/999/styles/1/download_format/tiles3d';
    const s3Url =
      'https://swissgeol-ogc-api-cache-geometries.s3.eu-central-1.amazonaws.com/999/tiles3d/1/x.json';
    sessionStorage.setItem(`swissgeol:ogc-tileset-resolved:${ogcUrl}`, s3Url);

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

    expect(resolved.baseUrl).toBe(s3Url);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(s3Url);
  });

  it('throws when the tileset request fails and no fallback exists', async () => {
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
});

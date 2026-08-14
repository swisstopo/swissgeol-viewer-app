import { describe, expect, it } from 'vitest';
import {
  createDefaultSliceSelection,
  evenlySpacedSliceNumbers,
  hasSliceMetadata,
  isDefaultSliceSelection,
  neighborhoodSliceNumbers,
} from 'src/features/layer/slice/tiles3d-slice.types';
import { parseTilesetSliceMetadata } from 'src/features/layer/slice/tileset-slice-metadata';
import { pruneTilesetToSlices } from 'src/features/layer/slice/tileset-slice-prune';
import { collectSliceContentUris } from 'src/features/layer/slice/tileset-slice-prefetch';
import type { TilesetSliceMetadata } from 'src/features/layer/slice/tiles3d-slice.types';

describe('evenlySpacedSliceNumbers', () => {
  it('returns empty for empty input', () => {
    expect(evenlySpacedSliceNumbers([], 3)).toEqual([]);
  });

  it('returns the middle value for count 1', () => {
    expect(evenlySpacedSliceNumbers([0, 1, 2, 3, 4], 1)).toEqual([2]);
  });

  it('includes first and last when count >= 2', () => {
    expect(evenlySpacedSliceNumbers([0, 1, 2, 3, 4], 3)).toEqual([0, 2, 4]);
  });

  it('clamps count to available length', () => {
    expect(evenlySpacedSliceNumbers([10, 20], 5)).toEqual([10, 20]);
  });
});

describe('neighborhoodSliceNumbers', () => {
  it('returns a window around the center index', () => {
    expect(neighborhoodSliceNumbers([0, 1, 2, 3, 4, 5, 6], 3, 2)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('clamps to list bounds', () => {
    expect(neighborhoodSliceNumbers([10, 20, 30], 10, 5)).toEqual([10, 20, 30]);
  });

  it('returns empty when center is missing', () => {
    expect(neighborhoodSliceNumbers([0, 1, 2], 9, 2)).toEqual([]);
  });
});

describe('orderNumbersFromCenter', () => {
  it('orders by distance from center', async () => {
    const { orderNumbersFromCenter } = await import('./tileset-slice-prefetch');
    expect(orderNumbersFromCenter([0, 1, 2, 3, 4], 2)).toEqual([2, 1, 3, 0, 4]);
  });
});

describe('parseTilesetSliceMetadata', () => {
  it('parses directional metadata and counts', () => {
    const tileset = {
      root: {
        metadata: {
          properties: {
            u_slices: 3,
            v_slices: 2,
            w_slices: 2,
          },
        },
        children: [
          sliceTile('u', 0, 'a-slice-0.glb'),
          sliceTile('u', 1, 'a-slice-1.glb'),
          sliceTile('u', 2, 'a-slice-2.glb'),
          sliceTile('v', 0, 'a-slice-3.glb'),
          sliceTile('v', 1, 'a-slice-4.glb'),
          sliceTile('w', 0, 'a-slice-5.glb'),
          sliceTile('w', 1, 'a-slice-6.glb'),
        ],
      },
    };

    const metadata = parseTilesetSliceMetadata(tileset);
    expect(hasSliceMetadata(metadata)).toBe(true);
    expect(metadata!.axes.crossline?.numbers).toEqual([0, 1, 2]);
    expect(metadata!.axes.inline?.numbers).toEqual([0, 1]);
    expect(metadata!.axes.depth?.numbers).toEqual([0, 1]);
    expect(metadata!.counts).toEqual({
      crossline: 3,
      inline: 2,
      depth: 2,
    });
  });

  it('partitions URI-only slices by counts', () => {
    const tileset = {
      root: {
        metadata: {
          properties: {
            u_slices: 2,
            v_slices: 2,
            w_slices: 1,
          },
        },
        children: [
          uriTile('x-slice-0.glb'),
          uriTile('x-slice-1.glb'),
          uriTile('x-slice-2.glb'),
          uriTile('x-slice-3.glb'),
          uriTile('x-slice-4.glb'),
        ],
      },
    };

    const metadata = parseTilesetSliceMetadata(tileset);
    expect(metadata!.axes.crossline?.numbers).toEqual([0, 1]);
    expect(metadata!.axes.inline?.numbers).toEqual([2, 3]);
    expect(metadata!.axes.depth?.numbers).toEqual([4]);
  });

  it('returns null when no slice information is present', () => {
    expect(
      parseTilesetSliceMetadata({
        root: { children: [{ content: { uri: 'model.glb' } }] },
      }),
    ).toBeNull();
  });
});

describe('createDefaultSliceSelection', () => {
  it('uses middle slice per axis in single mode', () => {
    const metadata = {
      axes: {
        crossline: {
          direction: 'u',
          axis: 'crossline',
          numbers: [0, 1, 2, 3, 4],
        },
        inline: { direction: 'v', axis: 'inline', numbers: [0, 1, 2] },
        depth: { direction: 'w', axis: 'depth', numbers: [10, 20] },
      },
      counts: {},
    } satisfies TilesetSliceMetadata;

    const defaults = createDefaultSliceSelection(metadata);
    expect(defaults.mode).toBe('single');
    expect(defaults.single).toEqual({
      crossline: 2,
      inline: 1,
      depth: 20,
    });
    expect(isDefaultSliceSelection(defaults, defaults)).toBe(true);
    expect(
      isDefaultSliceSelection(
        { ...defaults, single: { ...defaults.single, crossline: 0 } },
        defaults,
      ),
    ).toBe(false);
  });
});

describe('pruneTilesetToSlices', () => {
  it('keeps selected directional slices and rewrites absolute URIs', () => {
    const tileset = {
      root: {
        geometricError: 100,
        children: [
          sliceTile('u', 0, 'data/a-slice-0.glb'),
          sliceTile('u', 1, 'data/a-slice-1.glb'),
          sliceTile('v', 0, 'data/a-slice-2.glb'),
        ],
      },
    };

    const pruned = pruneTilesetToSlices(
      tileset,
      { direction: 'u', numbers: new Set([1]) },
      'https://ogc.example/collections/1/tileset.json',
    );

    expect(pruned.root?.children).toHaveLength(1);
    expect(pruned.root?.children?.[0].content?.uri).toBe(
      'https://ogc.example/collections/1/data/a-slice-1.glb',
    );
    expect(pruned.root?.geometricError).toBe(100);
  });

  it('tightens parent region bounds to kept children', () => {
    const tileset = {
      root: {
        geometricError: 1000,
        boundingVolume: {
          region: [0, 0, 1, 1, -5000, 0],
        },
        children: [
          {
            ...sliceTile('u', 0, 'a-slice-0.glb'),
            boundingVolume: { region: [0.1, 0.1, 0.2, 0.9, -100, 0] },
            geometricError: 0,
          },
          {
            ...sliceTile('u', 1, 'a-slice-1.glb'),
            boundingVolume: { region: [0.4, 0.1, 0.5, 0.9, -100, 0] },
            geometricError: 0,
          },
        ],
      },
    };

    const pruned = pruneTilesetToSlices(
      tileset,
      { direction: 'u', numbers: new Set([0]) },
      'https://ogc.example/tileset.json',
    );

    expect((pruned.root as any).boundingVolume.region).toEqual([
      0.1, 0.1, 0.2, 0.9, -100, 0,
    ]);
    expect((pruned.root as any).geometricError).toBe(1000);
  });

  it('throws when no selected slices exist', () => {
    expect(() =>
      pruneTilesetToSlices(
        {
          root: {
            children: [sliceTile('u', 0, 'a-slice-0.glb')],
          },
        },
        { direction: 'u', numbers: new Set([99]) },
        'https://ogc.example/tileset.json',
      ),
    ).toThrow(/None of the selected slices/);
  });
});

describe('collectSliceContentUris', () => {
  it('returns absolute uris for matching direction and numbers', () => {
    const tileset = {
      root: {
        children: [
          sliceTile('u', 0, 'https://cdn.example/a-slice-0.glb'),
          sliceTile('u', 1, 'https://cdn.example/a-slice-1.glb'),
          sliceTile('v', 0, 'https://cdn.example/a-slice-2.glb'),
        ],
      },
    };

    expect(collectSliceContentUris(tileset, 'u', new Set([0, 1]))).toEqual([
      'https://cdn.example/a-slice-0.glb',
      'https://cdn.example/a-slice-1.glb',
    ]);
  });
});

function sliceTile(
  direction: 'u' | 'v' | 'w',
  number: number,
  uri: string,
): object {
  return {
    content: { uri },
    metadata: {
      class: 'slice-metadata',
      properties: {
        sliceDirection: direction,
        sliceNumber: number,
      },
    },
  };
}

function uriTile(uri: string): object {
  return { content: { uri } };
}

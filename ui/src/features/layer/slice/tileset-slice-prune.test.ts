import { describe, expect, it } from 'vitest';
import { pruneTilesetToSlices } from 'src/features/layer/slice/tileset-slice-prune';

const json = {
  asset: { version: '1.1' },
  geometricError: 500,
  root: {
    boundingVolume: { region: [0, 0, 1, 1, -100, 100] },
    geometricError: 250,
    refine: 'ADD',
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    children: [
      {
        boundingVolume: { region: [0, 0, 0.5, 1, -100, 0] },
        geometricError: 0,
        content: { uri: 'seismic-slice-X-1.glb' },
      },
      {
        boundingVolume: { region: [0.5, 0, 1, 1, -50, 100] },
        geometricError: 0,
        content: { uri: 'seismic-slice-X-2.glb' },
      },
      {
        boundingVolume: { region: [0, 0, 1, 1, -100, 100] },
        geometricError: 10,
        children: [
          {
            boundingVolume: { region: [0.2, 0.2, 0.4, 0.4, -10, 10] },
            geometricError: 0,
            content: { uri: 'seismic-slice-X-3.glb' },
          },
        ],
      },
    ],
  },
};

describe('pruneTilesetToSlices', () => {
  it('keeps only selected slices and does not mutate the source', () => {
    const before = structuredClone(json);
    const out = pruneTilesetToSlices(
      json,
      { numbers: new Set([2]) },
      'https://example.com/base/',
    );
    expect(json).toEqual(before);
    expect(out.asset).toEqual({ version: '1.1' });
    expect(out.geometricError).toBe(500);
    expect(out.root!.transform).toEqual(json.root.transform);
    expect(out.root!.children).toHaveLength(1);
    expect(out.root!.children![0].content!.uri).toBe(
      'https://example.com/base/seismic-slice-X-2.glb',
    );
    expect(out.root!.boundingVolume).toEqual({
      region: [0.5, 0, 1, 1, -50, 100],
    });
  });

  it('keeps nested slices and unions bounds', () => {
    const out = pruneTilesetToSlices(
      json,
      { numbers: new Set([1, 3]) },
      'https://example.com/base/',
    );
    expect(out.root!.children).toHaveLength(2);
    const nested = out.root!.children![1];
    expect(nested.children).toHaveLength(1);
    expect(nested.content).toBeUndefined();
    expect(nested.boundingVolume).toEqual({
      region: [0.2, 0.2, 0.4, 0.4, -10, 10],
    });
    expect(out.root!.boundingVolume).toEqual({
      region: [0, 0, 0.5, 1, -100, 10],
    });
  });

  it('throws when nothing matches', () => {
    expect(() =>
      pruneTilesetToSlices(json, { numbers: new Set([99]) }, 'https://e.com/'),
    ).toThrow();
  });

  it('leaves the parent volume alone when a kept child has no region', () => {
    const mixed = {
      root: {
        boundingVolume: { region: [0, 0, 1, 1, -100, 100] },
        geometricError: 10,
        children: [
          {
            boundingVolume: { region: [0, 0, 0.5, 1, -100, 0] },
            geometricError: 0,
            content: { uri: 'seismic-slice-X-1.glb' },
          },
          {
            boundingVolume: { box: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1] },
            geometricError: 0,
            content: { uri: 'seismic-slice-X-2.glb' },
          },
        ],
      },
    };
    const out = pruneTilesetToSlices(
      mixed,
      { numbers: new Set([1, 2]) },
      'https://example.com/base/',
    );
    expect(out.root!.children).toHaveLength(2);
    expect(out.root!.boundingVolume).toEqual({
      region: [0, 0, 1, 1, -100, 100],
    });
  });
});

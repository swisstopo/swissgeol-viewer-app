import { Resource } from 'cesium';
import { OgcSliceDirection } from 'src/features/layer/slice/tiles3d-slice.types';
import {
  parseSliceFromUri,
  readTileSliceKey,
} from 'src/features/layer/slice/tileset-slice-metadata';

interface TilesetTileNode {
  content?: { uri?: string };
  children?: TilesetTileNode[];
  metadata?: {
    class?: string;
    properties?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

interface TilesetJson {
  root?: TilesetTileNode;
  [key: string]: unknown;
}

export type SliceKeepSelector = {
  /** When set, only tiles matching this direction are eligible. */
  direction?: OgcSliceDirection;
  numbers: ReadonlySet<number>;
};

/**
 * Build a tileset JSON containing only the tiles whose slice identity is in
 * `keep`. Content URIs are rewritten to absolute URLs so blob-based roots
 * still resolve against the OGC base.
 *
 * Nodes are copied on keep rather than deep-cloning the whole document up
 * front: a single slice keeps a handful of nodes out of potentially thousands,
 * and this runs on every slider step.
 */
export const pruneTilesetToSlices = (
  original: unknown,
  keep: SliceKeepSelector,
  baseUrl: string,
): TilesetJson => {
  if (original === null || typeof original !== 'object') {
    throw new Error('Tileset JSON has no root.');
  }
  const source = original as TilesetJson;
  if (source.root === undefined) {
    throw new Error('Tileset JSON has no root.');
  }

  const prune = (tile: TilesetTileNode): TilesetTileNode | null => {
    let shouldKeepTile = false;
    const { children, content, ...rest } = tile;
    const next: TilesetTileNode = { ...rest };

    const uri = content?.uri;
    if (uri !== undefined) {
      const identity = resolveTileIdentity(tile, uri);
      if (identity !== null && shouldKeep(identity, keep)) {
        shouldKeepTile = true;
        next.content = { ...content, uri: new URL(uri, baseUrl).href };
      }
      // Otherwise the content is dropped so Cesium does not load it.
    } else if (content !== undefined) {
      next.content = { ...content };
    }

    if (children !== undefined && children.length > 0) {
      const keptChildren = children
        .map(prune)
        .filter((child): child is TilesetTileNode => child !== null);
      if (keptChildren.length > 0) {
        next.children = keptChildren;
        shouldKeepTile = true;
      }
    }

    return shouldKeepTile ? next : null;
  };

  const newRoot = prune(source.root);
  if (newRoot === null) {
    throw new Error('None of the selected slices were found in the tileset.');
  }
  tightenBoundingVolumes(newRoot);

  const { root: _root, ...restOfDocument } = source;
  return { ...restOfDocument, root: newRoot };
};

/**
 * After pruning, parent nodes still carry the full-cube bounding volume.
 * Recompute region bounds from kept children so Cesium zoom/culling match
 * the visible slices. Leave geometricError alone — collapsing it to the leaf
 * value (0) stops Cesium from refining and loading content.
 */
const tightenBoundingVolumes = (tile: TilesetTileNode): void => {
  if (tile.children !== undefined && tile.children.length > 0) {
    for (const child of tile.children) {
      tightenBoundingVolumes(child);
    }
    const childRegions = tile.children.map((child) => getRegion(child));
    // Only tighten when every kept child exposes a region. Unioning a subset
    // would produce a volume that culls the children we cannot account for
    // (e.g. box/sphere bounding volumes).
    if (
      childRegions.length > 0 &&
      childRegions.every((region): region is number[] => region !== null)
    ) {
      tile.boundingVolume = {
        region: childRegions.reduce(
          (acc, region) => unionRegions(acc, region),
          childRegions[0],
        ),
      };
    }
  }
};

const getRegion = (tile: TilesetTileNode): number[] | null => {
  const volume = tile.boundingVolume as { region?: number[] } | undefined;
  const region = volume?.region;
  if (
    region === undefined ||
    !Array.isArray(region) ||
    region.length < 6 ||
    region.some((value) => typeof value !== 'number')
  ) {
    return null;
  }
  return region;
};

const unionRegions = (a: number[], b: number[]): number[] => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
  Math.min(a[4], b[4]),
  Math.max(a[5], b[5]),
];

const resolveTileIdentity = (
  tile: TilesetTileNode,
  uri: string,
): { direction: OgcSliceDirection | null; number: number } | null => {
  const fromMeta = readTileSliceKey(tile);
  if (fromMeta !== null) {
    return fromMeta;
  }
  const fromUri = parseSliceFromUri(uri);
  if (fromUri === null) {
    return null;
  }
  return { direction: null, number: fromUri };
};

const shouldKeep = (
  identity: { direction: OgcSliceDirection | null; number: number },
  keep: SliceKeepSelector,
): boolean => {
  if (!keep.numbers.has(identity.number)) {
    return false;
  }
  if (keep.direction === undefined) {
    return true;
  }
  // URI-only identity has no direction — allow if number matches when pruning
  // a single-axis tileset built from partitioned URI numbers.
  if (identity.direction === null) {
    return true;
  }
  return identity.direction === keep.direction;
};

export const toBlobUrl = (json: unknown): string => {
  const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
  return URL.createObjectURL(blob);
};

/**
 * Rewrite every content URI in the tileset to an absolute URL so that a
 * blob-based root still resolves children against the OGC/S3 base.
 */
export const absolutizeTilesetUris = (
  original: unknown,
  baseUrl: string,
): unknown => {
  if (original === null || typeof original !== 'object') {
    return original;
  }
  const source = original as TilesetJson;
  if (source.root === undefined) {
    return original;
  }

  const rewrite = (tile: TilesetTileNode): TilesetTileNode => {
    const { children, content, ...rest } = tile;
    const next: TilesetTileNode = { ...rest };
    if (content !== undefined) {
      const { uri, ...restContent } = content;
      next.content =
        uri !== undefined && uri !== ''
          ? { ...restContent, uri: new URL(uri, baseUrl).href }
          : { ...restContent };
    }
    if (children !== undefined && children.length > 0) {
      next.children = children.map(rewrite);
    }
    return next;
  };

  return { ...source, root: rewrite(source.root) };
};

/**
 * Wrap a blob tileset URL in a Cesium Resource that carries the original OGC
 * auth headers so absolute child content URLs still authenticate.
 */
export const createAuthenticatedBlobResource = (
  blobUrl: string,
  headers: Record<string, string>,
): Resource =>
  new Resource({
    url: blobUrl,
    headers: { ...headers },
  });

export const extractResourceHeaders = (
  resource: Resource,
): Record<string, string> => {
  const headers = resource.headers;
  if (headers === undefined || headers === null) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
};

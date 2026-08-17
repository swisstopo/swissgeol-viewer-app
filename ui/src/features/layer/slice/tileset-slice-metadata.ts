import {
  AXIS_TO_DIRECTION,
  OgcSliceDirection,
  SEISMIC_SLICE_AXES,
  SeismicSliceAxis,
  TilesetSliceAxisInfo,
  TilesetSliceMetadata,
} from 'src/features/layer/slice/tiles3d-slice.types';

interface TilesetTileNode {
  content?: { uri?: string };
  children?: TilesetTileNode[];
  extras?: Record<string, unknown>;
  metadata?: {
    class?: string;
    properties?: Record<string, unknown>;
  };
}

interface TilesetJson {
  root?: TilesetTileNode;
  [key: string]: unknown;
}

const SLICE_URI_PATTERN = /-slice-(?:[XYZ]-)?(\d+)\.glb$/i;

const isOgcSliceDirection = (value: unknown): value is OgcSliceDirection =>
  value === 'u' || value === 'v' || value === 'w';

/**
 * Parse OGC 3D Tiles slice metadata from a tileset JSON.
 *
 * Prefers per-tile `sliceDirection` / `sliceNumber` and parent `u_slices` /
 * `v_slices` / `w_slices` counts. Falls back to partitioning URI-based
 * `-slice-N.glb` numbers by those counts when direction metadata is absent.
 */
export const parseTilesetSliceMetadata = (
  tilesetJson: unknown,
): TilesetSliceMetadata | null => {
  if (tilesetJson === null || typeof tilesetJson !== 'object') {
    return null;
  }

  const json = tilesetJson as TilesetJson;
  if (json.root === undefined) {
    return null;
  }

  const counts = collectSliceCounts(json.root);
  const byDirection: Record<OgcSliceDirection, Set<number>> = {
    u: new Set(),
    v: new Set(),
    w: new Set(),
  };
  const uriOnlyNumbers: number[] = [];

  const visit = (tile: TilesetTileNode): void => {
    const fromMeta = readSliceIdentity(tile);
    if (fromMeta !== null) {
      byDirection[fromMeta.direction].add(fromMeta.number);
    } else {
      const uri = tile.content?.uri;
      if (uri !== undefined) {
        const slice = parseSliceFromUri(uri);
        if (slice !== null) {
          uriOnlyNumbers.push(slice);
        }
      }
    }

    for (const child of tile.children ?? []) {
      visit(child);
    }
  };
  visit(json.root);

  const hasDirectionalMeta = (['u', 'v', 'w'] as OgcSliceDirection[]).some(
    (d) => byDirection[d].size > 0,
  );

  if (!hasDirectionalMeta && uriOnlyNumbers.length > 0) {
    partitionUriSlicesByCounts(uriOnlyNumbers, counts, byDirection);
  } else if (hasDirectionalMeta && uriOnlyNumbers.length > 0) {
    // Mixed tileset: some tiles carry `sliceDirection`/`sliceNumber`
    // metadata, others only have a `-slice-N.glb` URI. The count-based
    // partition below assumes slice numbers are laid out in contiguous,
    // sorted per-axis blocks across *all* slices — an assumption that only
    // holds when none of them are already claimed via metadata. We cannot
    // safely guess the axis of the remaining URI-only tiles here, so warn
    // loudly (instead of silently dropping them) rather than risk assigning
    // them to the wrong axis.
    console.warn(
      `[tileset-slice-metadata] ${uriOnlyNumbers.length} slice tile(s) have no ` +
        'sliceDirection/sliceNumber metadata in a partially annotated tileset; ' +
        'they cannot be safely assigned to an axis and will be omitted.',
    );
  }

  const axes: Partial<Record<SeismicSliceAxis, TilesetSliceAxisInfo>> = {};
  for (const axis of SEISMIC_SLICE_AXES) {
    const direction = AXIS_TO_DIRECTION[axis];
    const numbers = [...byDirection[direction]].sort((a, b) => a - b);
    if (numbers.length === 0) {
      continue;
    }
    axes[axis] = { direction, axis, numbers };
  }

  if (Object.keys(axes).length === 0) {
    return null;
  }

  return { axes, counts };
};

const collectSliceCounts = (
  root: TilesetTileNode,
): Partial<Record<SeismicSliceAxis, number>> => {
  const counts: Partial<Record<SeismicSliceAxis, number>> = {};

  const visit = (tile: TilesetTileNode): void => {
    const props = tile.metadata?.properties;
    if (props !== undefined) {
      assignCount(counts, 'crossline', props['u_slices']);
      assignCount(counts, 'inline', props['v_slices']);
      assignCount(counts, 'depth', props['w_slices']);
    }
    for (const child of tile.children ?? []) {
      visit(child);
    }
  };
  visit(root);
  return counts;
};

const assignCount = (
  counts: Partial<Record<SeismicSliceAxis, number>>,
  axis: SeismicSliceAxis,
  value: unknown,
): void => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    counts[axis] = value;
  }
};

const readSliceIdentity = (
  tile: TilesetTileNode,
): { direction: OgcSliceDirection; number: number } | null => {
  const props = tile.metadata?.properties;
  if (props === undefined) {
    return null;
  }
  const direction = props['sliceDirection'];
  const number = props['sliceNumber'];
  if (
    !isOgcSliceDirection(direction) ||
    typeof number !== 'number' ||
    !Number.isInteger(number)
  ) {
    return null;
  }
  return { direction, number };
};

export const parseSliceFromUri = (uri: string): number | null => {
  const match = SLICE_URI_PATTERN.exec(uri);
  return match === null ? null : Number(match[1]);
};

/**
 * When only URI slice numbers exist, partition the sorted list using
 * `u_slices` / `v_slices` / `w_slices` counts (crossline, then inline, then depth).
 */
const partitionUriSlicesByCounts = (
  uriNumbers: number[],
  counts: Partial<Record<SeismicSliceAxis, number>>,
  target: Record<OgcSliceDirection, Set<number>>,
): void => {
  const sorted = [...new Set(uriNumbers)].sort((a, b) => a - b);
  const uCount = counts.crossline;
  const vCount = counts.inline;
  const wCount = counts.depth;

  if (
    uCount === undefined ||
    vCount === undefined ||
    wCount === undefined ||
    uCount + vCount + wCount !== sorted.length
  ) {
    // Counts missing or inconsistent — cannot safely assign axes.
    return;
  }

  let offset = 0;
  const assign = (axis: SeismicSliceAxis, count: number): void => {
    const direction = AXIS_TO_DIRECTION[axis];
    for (let i = 0; i < count; i++) {
      target[direction].add(sorted[offset + i]);
    }
    offset += count;
  };

  assign('crossline', uCount);
  assign('inline', vCount);
  assign('depth', wCount);
};

export const readTileSliceKey = (
  tile: TilesetTileNode,
): { direction: OgcSliceDirection; number: number } | null => {
  const fromMeta = readSliceIdentity(tile);
  if (fromMeta !== null) {
    return fromMeta;
  }
  return null;
};

export { DIRECTION_TO_AXIS } from 'src/features/layer/slice/tiles3d-slice.types';

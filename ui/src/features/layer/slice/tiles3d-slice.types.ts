/** OGC tileset slice direction (collection metadata). */
export type OgcSliceDirection = 'u' | 'v' | 'w';

/** UI / layer-model axis names (Figma: Crossline / Inline / Depth). */
export type SeismicSliceAxis = 'crossline' | 'inline' | 'depth';

export type SliceViewMode = 'single' | 'multiple';

export const SEISMIC_SLICE_AXES: readonly SeismicSliceAxis[] = [
  'crossline',
  'inline',
  'depth',
] as const;

export const AXIS_TO_DIRECTION: Record<SeismicSliceAxis, OgcSliceDirection> = {
  crossline: 'u',
  inline: 'v',
  depth: 'w',
};

export const DIRECTION_TO_AXIS: Record<OgcSliceDirection, SeismicSliceAxis> = {
  u: 'crossline',
  v: 'inline',
  w: 'depth',
};

/** Soft limit shown as a warning in Multiple mode (Figma). */
export const RECOMMENDED_MAX_SLICES_BY_AXIS: Record<SeismicSliceAxis, number> =
  {
    crossline: 4,
    inline: 4,
    depth: 4,
  };

export interface TilesetSliceAxisInfo {
  direction: OgcSliceDirection;
  axis: SeismicSliceAxis;
  /** Sorted unique slice numbers available on this axis. */
  numbers: number[];
}

export interface TilesetSliceMetadata {
  axes: Partial<Record<SeismicSliceAxis, TilesetSliceAxisInfo>>;
  counts: Partial<Record<SeismicSliceAxis, number>>;
}

export interface Tiles3dSliceSelection {
  mode: SliceViewMode;
  /** Selected slice number per axis (Single mode). */
  single: Record<SeismicSliceAxis, number>;
  multiple: {
    axis: SeismicSliceAxis;
    count: number;
  };
}

export const hasSliceMetadata = (
  metadata: TilesetSliceMetadata | null,
): metadata is TilesetSliceMetadata => {
  if (metadata === null) {
    return false;
  }
  return SEISMIC_SLICE_AXES.some(
    (axis) => (metadata.axes[axis]?.numbers.length ?? 0) > 0,
  );
};

export const createDefaultSliceSelection = (
  metadata: TilesetSliceMetadata,
): Tiles3dSliceSelection => {
  const middle = (numbers: number[]): number =>
    numbers.length === 0 ? 0 : numbers[Math.floor(numbers.length / 2)];

  return {
    mode: 'single',
    single: {
      crossline: middle(metadata.axes.crossline?.numbers ?? []),
      inline: middle(metadata.axes.inline?.numbers ?? []),
      depth: middle(metadata.axes.depth?.numbers ?? []),
    },
    multiple: {
      axis: 'crossline',
      count: 1,
    },
  };
};

/**
 * Pick `count` evenly spaced numbers from a sorted list (linspace).
 * A single slice uses the middle value.
 */
export const evenlySpacedSliceNumbers = (
  numbers: number[],
  count: number,
): number[] => {
  if (numbers.length === 0 || count <= 0) {
    return [];
  }
  const n = Math.min(count, numbers.length);
  if (n === 1) {
    return [numbers[Math.floor(numbers.length / 2)]];
  }
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (numbers.length - 1)) / (n - 1));
    result.push(numbers[idx]);
  }
  return [...new Set(result)];
};

/**
 * Neighboring slice numbers around `center` by index in the sorted `available`
 * list (not by numeric ±radius, so gaps in numbering are handled).
 */
export const neighborhoodSliceNumbers = (
  available: readonly number[],
  center: number,
  radius: number,
): number[] => {
  if (available.length === 0 || radius < 0) {
    return [];
  }
  const index = available.indexOf(center);
  if (index < 0) {
    return [];
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(available.length - 1, index + radius);
  return available.slice(start, end + 1);
};

/** Default half-window for GLB prefetch around the current slider position. */
export const SLICE_PREFETCH_RADIUS = 8;

/**
 * Half-window of slices kept as fully loaded (hidden) tilesets around the
 * current slider position, so stepping to a neighbour needs no loading at all.
 *
 * Each warmed slice holds a decoded texture in GPU memory, and there are three
 * axes warming concurrently, so a radius of N means up to `(2N + 1) * 3`
 * tilesets are built/held at once — keep this modest; scrubbing rarely jumps
 * far in one step, and a too-large radius competes for network/GPU with the
 * interactive swap itself (the very thing this is meant to keep fast).
 */
export const SLICE_GPU_WARM_RADIUS = 3;

export const isDefaultSliceSelection = (
  selection: Tiles3dSliceSelection,
  defaults: Tiles3dSliceSelection,
): boolean => {
  if (selection.mode !== defaults.mode) {
    return false;
  }
  if (selection.mode === 'single') {
    return SEISMIC_SLICE_AXES.every(
      (axis) => selection.single[axis] === defaults.single[axis],
    );
  }
  return (
    selection.multiple.axis === defaults.multiple.axis &&
    selection.multiple.count === defaults.multiple.count
  );
};

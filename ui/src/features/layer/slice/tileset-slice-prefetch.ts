import {
  OgcSliceDirection,
  SeismicSliceAxis,
  SEISMIC_SLICE_AXES,
} from 'src/features/layer/slice/tiles3d-slice.types';
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
}

interface TilesetJson {
  root?: TilesetTileNode;
}

export const SLICE_PREFETCH_CONCURRENCY = 6;

export interface SliceAxisPreloadProgress {
  loaded: number;
  total: number;
}

export interface SlicePreloadProgress {
  status: 'idle' | 'loading' | 'done';
  loaded: number;
  total: number;
  axes: Record<SeismicSliceAxis, SliceAxisPreloadProgress>;
}

export const emptySlicePreloadProgress = (): SlicePreloadProgress => ({
  status: 'idle',
  loaded: 0,
  total: 0,
  axes: {
    crossline: { loaded: 0, total: 0 },
    inline: { loaded: 0, total: 0 },
    depth: { loaded: 0, total: 0 },
  },
});

const toAbsoluteUri = (uri: string, baseUrl: string): string => {
  if (!baseUrl) return uri;
  try {
    return new URL(uri, baseUrl).href;
  } catch {
    return uri;
  }
};

/**
 * Collect absolute content URIs for the given axis direction + slice numbers.
 */
export const collectSliceContentUris = (
  tilesetJson: unknown,
  direction: OgcSliceDirection,
  numbers: ReadonlySet<number>,
  baseUrl = '',
): string[] => {
  if (tilesetJson === null || typeof tilesetJson !== 'object') {
    return [];
  }
  const root = (tilesetJson as TilesetJson).root;
  if (root === undefined) {
    return [];
  }

  const uris: string[] = [];
  const visit = (tile: TilesetTileNode): void => {
    const uri = tile.content?.uri;
    if (uri !== undefined && uri !== '') {
      const identity = resolveIdentity(tile, uri);
      if (
        identity !== null &&
        numbers.has(identity.number) &&
        (identity.direction === null || identity.direction === direction)
      ) {
        uris.push(toAbsoluteUri(uri, baseUrl));
      }
    }
    for (const child of tile.children ?? []) {
      visit(child);
    }
  };
  visit(root);
  return [...new Set(uris)];
};

/**
 * Collect every content URI on an axis, keyed by slice number.
 */
export const collectAxisSliceUriMap = (
  tilesetJson: unknown,
  direction: OgcSliceDirection,
  baseUrl = '',
): Map<number, string> => {
  const map = new Map<number, string>();
  if (tilesetJson === null || typeof tilesetJson !== 'object') {
    return map;
  }
  const root = (tilesetJson as TilesetJson).root;
  if (root === undefined) {
    return map;
  }

  const visit = (tile: TilesetTileNode): void => {
    const uri = tile.content?.uri;
    if (uri !== undefined && uri !== '') {
      const identity = resolveIdentity(tile, uri);
      if (
        identity !== null &&
        (identity.direction === null || identity.direction === direction)
      ) {
        map.set(identity.number, toAbsoluteUri(uri, baseUrl));
      }
    }
    for (const child of tile.children ?? []) {
      visit(child);
    }
  };
  visit(root);
  return map;
};

/**
 * Order slice numbers by distance from `center` so the current slider
 * neighborhood is warmed first.
 */
export const orderNumbersFromCenter = (
  numbers: readonly number[],
  center: number,
): number[] =>
  [...numbers].sort(
    (a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b,
  );

const resolveIdentity = (
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

interface PrefetchJob {
  url: string;
  axis: SeismicSliceAxis;
}

/**
 * Background HTTP cache warmer with optional progress + a mutable priority
 * front-queue (used when the user scrubs a slider).
 */
export class SlicePreloadQueue {
  private readonly pending: PrefetchJob[] = [];
  private readonly pendingUrls = new Set<string>();
  private readonly inFlightUrls = new Set<string>();
  private readonly completedUrls = new Set<string>();
  /**
   * Every URL that has ever been counted towards `axisTotals`, kept across
   * pause/resume (unlike `pendingUrls`/`inFlightUrls`, which are cleared by
   * `abortAndClear`). Without this, re-enqueuing the same not-yet-finished
   * URLs after reopening the HUD would double-count them into the total,
   * permanently inflating the denominator so progress never reaches 100%.
   */
  private readonly queuedUrls = new Set<string>();
  private readonly axisTotals: Record<SeismicSliceAxis, number> = {
    crossline: 0,
    inline: 0,
    depth: 0,
  };
  private readonly axisLoaded: Record<SeismicSliceAxis, number> = {
    crossline: 0,
    inline: 0,
    depth: 0,
  };
  private running = false;
  private abort: AbortController | null = null;

  constructor(
    private readonly options: {
      concurrency?: number;
      headers?: Record<string, string>;
      onProgress?: (progress: SlicePreloadProgress) => void;
    } = {},
  ) {}

  get progress(): SlicePreloadProgress {
    const loaded = SEISMIC_SLICE_AXES.reduce(
      (sum, axis) => sum + this.axisLoaded[axis],
      0,
    );
    const total = SEISMIC_SLICE_AXES.reduce(
      (sum, axis) => sum + this.axisTotals[axis],
      0,
    );
    const axes = Object.fromEntries(
      SEISMIC_SLICE_AXES.map((axis) => [
        axis,
        { loaded: this.axisLoaded[axis], total: this.axisTotals[axis] },
      ]),
    ) as Record<SeismicSliceAxis, SliceAxisPreloadProgress>;

    let status: SlicePreloadProgress['status'] = 'idle';
    if (total > 0 && loaded >= total) {
      status = 'done';
    } else if (total > 0) {
      status = 'loading';
    }

    return { status, loaded, total, axes };
  }

  /**
   * Enqueue URLs for an axis (skips already completed / pending / in-flight).
   * `priority` inserts at the front of the queue.
   */
  enqueue(
    axis: SeismicSliceAxis,
    urls: readonly string[],
    priority = false,
  ): void {
    const fresh: PrefetchJob[] = [];
    for (const url of urls) {
      if (
        this.completedUrls.has(url) ||
        this.pendingUrls.has(url) ||
        this.inFlightUrls.has(url)
      ) {
        continue;
      }
      this.pendingUrls.add(url);
      if (!this.queuedUrls.has(url)) {
        this.queuedUrls.add(url);
        this.axisTotals[axis] += 1;
      }
      fresh.push({ url, axis });
    }
    if (fresh.length === 0) {
      this.emitProgress();
      return;
    }
    if (priority) {
      this.pending.unshift(...fresh);
    } else {
      this.pending.push(...fresh);
    }
    this.emitProgress();
    this.ensureRunning();
  }

  abortAndClear(): void {
    this.abort?.abort();
    this.abort = null;
    this.running = false;
    this.pending.length = 0;
    this.pendingUrls.clear();
    this.inFlightUrls.clear();
  }

  private ensureRunning(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const concurrency = Math.max(
      1,
      this.options.concurrency ?? SLICE_PREFETCH_CONCURRENCY,
    );
    const headers = this.options.headers ?? {};

    const worker = async (): Promise<void> => {
      while (!signal.aborted) {
        const job = this.pending.shift();
        if (job === undefined) {
          return;
        }
        this.pendingUrls.delete(job.url);
        this.inFlightUrls.add(job.url);
        let isFetched = false;
        try {
          const response = await fetch(job.url, {
            method: 'GET',
            headers,
            mode: 'cors',
            credentials: 'omit',
            signal,
            cache: 'force-cache',
          });
          if (response.ok) {
            await response.blob();
            isFetched = true;
          }
        } catch {
          if (signal.aborted) {
            this.inFlightUrls.delete(job.url);
            return;
          }
        }
        this.inFlightUrls.delete(job.url);
        if (isFetched && !this.completedUrls.has(job.url)) {
          this.completedUrls.add(job.url);
          this.axisLoaded[job.axis] += 1;
          this.emitProgress();
        }
      }
    };

    void Promise.all(
      Array.from({ length: concurrency }, () => worker()),
    ).finally(() => {
      if (this.abort?.signal === signal) {
        this.running = false;
        this.abort = null;
        if (this.pending.length > 0) {
          this.ensureRunning();
        } else {
          this.emitProgress();
        }
      }
    });
  }

  private emitProgress(): void {
    this.options.onProgress?.(this.progress);
  }
}

/**
 * Warm the browser HTTP cache for nearby slice GLBs without attaching Cesium
 * tilesets. Limited concurrency; cancellable via AbortSignal.
 */
export const prefetchUrls = async (
  urls: readonly string[],
  options: {
    concurrency?: number;
    signal?: AbortSignal;
    headers?: Record<string, string>;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<void> => {
  const concurrency = Math.max(
    1,
    options.concurrency ?? SLICE_PREFETCH_CONCURRENCY,
  );
  const headers = options.headers ?? {};
  const signal = options.signal;
  let nextIndex = 0;
  let done = 0;
  const total = urls.length;
  options.onProgress?.(0, total);

  const worker = async (): Promise<void> => {
    while (nextIndex < urls.length) {
      if (signal?.aborted) {
        return;
      }
      const index = nextIndex;
      nextIndex += 1;
      const url = urls[index];
      try {
        await fetch(url, {
          method: 'GET',
          headers,
          mode: 'cors',
          credentials: 'omit',
          signal,
          cache: 'force-cache',
        });
      } catch {
        if (signal?.aborted) {
          return;
        }
      }
      done += 1;
      options.onProgress?.(done, total);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, urls.length || 1) },
    () => worker(),
  );
  await Promise.all(workers);
};

export type PrefetchAxisRequest = {
  axis: SeismicSliceAxis;
  direction: OgcSliceDirection;
  numbers: readonly number[];
};

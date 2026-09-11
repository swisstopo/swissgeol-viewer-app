import {
  OgcSliceDirection,
  SeismicSliceAxis,
  SEISMIC_SLICE_AXES,
} from 'src/features/layer/slice/tiles3d-slice.types';
import { resolveSliceIdentity } from 'src/features/layer/slice/tileset-slice-metadata';

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
      const identity = resolveSliceIdentity(tile, uri);
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

interface PrefetchJob {
  url: string;
  axis: SeismicSliceAxis;
  /** Number of fetch attempts already made for this job. */
  attempts: number;
}

/**
 * Give up on a single prefetch request rather than tie up a worker slot
 * indefinitely — this is background cache warming, not a user-blocking load.
 */
const SLICE_PREFETCH_REQUEST_TIMEOUT_MS = 20_000;

/**
 * Retry a failed prefetch request up to this many times (in total) before
 * giving up on it for good. Failures here are typically transient (flaky
 * network, temporary gateway errors), and without a retry a single failure
 * used to permanently stall progress below 100%.
 */
const SLICE_PREFETCH_MAX_ATTEMPTS = 3;

/**
 * Abort `target` whenever `source` aborts. Manual wiring instead of
 * `AbortSignal.any([source, target.signal])`, which is unavailable in older
 * targeted browsers (see AGENTS.md: Edge 18 is a supported target).
 */
const forwardAbort = (
  source: AbortSignal,
  target: AbortController,
): (() => void) => {
  if (source.aborted) {
    target.abort();
    return () => {};
  }
  const onAbort = (): void => target.abort();
  source.addEventListener('abort', onAbort, { once: true });
  return () => source.removeEventListener('abort', onAbort);
};

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
      fresh.push({ url, axis, attempts: 0 });
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

  /**
   * Fetch a single job's URL, bounding it with its own abort controller/timeout
   * so a hung request cannot tie up a worker slot indefinitely, while still
   * honouring `abortAndClear()` via the outer `signal`.
   *
   * Returns `'aborted'` if the outer signal was aborted while fetching (the
   * caller must stop its loop), `'fetched'` on success, or `'failed'`
   * otherwise (network error, non-OK response, or per-request timeout).
   */
  private async runJob(
    job: PrefetchJob,
    signal: AbortSignal,
    headers: Record<string, string>,
  ): Promise<'fetched' | 'failed' | 'aborted'> {
    const requestController = new AbortController();
    const removeAbortForwarding = forwardAbort(signal, requestController);
    const timeoutId = setTimeout(
      () => requestController.abort(),
      SLICE_PREFETCH_REQUEST_TIMEOUT_MS,
    );
    try {
      const response = await fetch(job.url, {
        method: 'GET',
        headers,
        mode: 'cors',
        credentials: 'omit',
        signal: requestController.signal,
        cache: 'force-cache',
      });
      if (!response.ok) {
        return 'failed';
      }
      await response.blob();
      return 'fetched';
    } catch {
      return signal.aborted ? 'aborted' : 'failed';
    } finally {
      clearTimeout(timeoutId);
      removeAbortForwarding();
    }
  }

  /** Mark a job's URL as completed, updating progress at most once per URL. */
  private markJobCompleted(job: PrefetchJob): void {
    if (this.completedUrls.has(job.url)) {
      return;
    }
    this.completedUrls.add(job.url);
    this.axisLoaded[job.axis] += 1;
    this.emitProgress();
  }

  /**
   * Requeue a failed job for another attempt, or give up on it for good.
   * Without this, a single transient failure (flaky network, temporary
   * gateway error) used to permanently stall overall progress below 100%.
   */
  private requeueOrGiveUp(job: PrefetchJob): void {
    if (job.attempts + 1 < SLICE_PREFETCH_MAX_ATTEMPTS) {
      this.pendingUrls.add(job.url);
      this.pending.push({ ...job, attempts: job.attempts + 1 });
      return;
    }
    console.warn(
      `Giving up prefetching ${job.url} after ${SLICE_PREFETCH_MAX_ATTEMPTS} attempts`,
    );
    this.markJobCompleted(job);
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

        const result = await this.runJob(job, signal, headers);
        this.inFlightUrls.delete(job.url);

        if (result === 'aborted') {
          return;
        }
        if (result === 'fetched') {
          this.markJobCompleted(job);
          continue;
        }
        this.requeueOrGiveUp(job);
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

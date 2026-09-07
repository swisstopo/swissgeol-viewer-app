import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectAxisSliceUriMap,
  emptySlicePreloadProgress,
  orderNumbersFromCenter,
  SlicePreloadQueue,
} from './tileset-slice-prefetch';

const tilesetJson = {
  root: {
    children: [
      {
        content: { uri: 'https://x/foo-3.glb' },
        metadata: { properties: { sliceDirection: 'u', sliceNumber: 3 } },
        children: [],
      },
      {
        content: { uri: 'https://x/foo-7.glb' },
        metadata: { properties: { sliceDirection: 'u', sliceNumber: 7 } },
        children: [],
      },
      {
        content: { uri: 'https://x/foo-3-v.glb' },
        metadata: { properties: { sliceDirection: 'v', sliceNumber: 3 } },
        children: [],
      },
    ],
  },
};

describe('collectAxisSliceUriMap', () => {
  it('maps every slice number on the axis to its content URI', () => {
    const map = collectAxisSliceUriMap(tilesetJson, 'u');
    expect(map.get(3)).toBe('https://x/foo-3.glb');
    expect(map.get(7)).toBe('https://x/foo-7.glb');
    expect(map.has(3) && map.size).toBe(2);
  });
});

describe('orderNumbersFromCenter', () => {
  it('orders slice numbers by distance from the center', () => {
    expect(orderNumbersFromCenter([1, 10, 5, 6, 4], 5)).toEqual([
      5, 4, 6, 1, 10,
    ]);
  });
});

describe('emptySlicePreloadProgress', () => {
  it('starts idle with zeroed axis totals', () => {
    const progress = emptySlicePreloadProgress();
    expect(progress.status).toBe('idle');
    expect(progress.loaded).toBe(0);
    expect(progress.total).toBe(0);
    expect(progress.axes.crossline).toEqual({ loaded: 0, total: 0 });
  });
});

describe('SlicePreloadQueue', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('fetches enqueued URLs and reports progress up to done', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const progressUpdates: Array<{ loaded: number; total: number }> = [];
    const queue = new SlicePreloadQueue({
      onProgress: (progress) =>
        progressUpdates.push({ loaded: progress.loaded, total: progress.total }),
    });

    queue.enqueue('crossline', ['https://x/a.glb', 'https://x/b.glb']);

    await vi.waitFor(() => {
      expect(queue.progress.status).toBe('done');
    });

    expect(queue.progress).toEqual({
      status: 'done',
      loaded: 2,
      total: 2,
      axes: {
        crossline: { loaded: 2, total: 2 },
        inline: { loaded: 0, total: 0 },
        depth: { loaded: 0, total: 0 },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not enqueue the same URL twice while pending/in-flight/completed', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const queue = new SlicePreloadQueue();
    queue.enqueue('crossline', ['https://x/a.glb']);
    queue.enqueue('crossline', ['https://x/a.glb']);

    await vi.waitFor(() => {
      expect(queue.progress.status).toBe('done');
    });

    expect(queue.progress.total).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a failed request up to the attempt cap, then counts it as done anyway', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      return { ok: false, blob: async () => new Blob() };
    });
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const queue = new SlicePreloadQueue();
    queue.enqueue('inline', ['https://x/flaky.glb']);

    await vi.waitFor(() => {
      expect(queue.progress.status).toBe('done');
    });

    // 3 total attempts (1 initial + 2 retries), then given up on and still
    // counted so overall progress can reach 100%.
    expect(calls).toBe(3);
    expect(queue.progress).toMatchObject({
      status: 'done',
      loaded: 1,
      total: 1,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Giving up prefetching'),
    );
    warnSpy.mockRestore();
  });

  it('aborts in-flight requests on abortAndClear()', async () => {
    const fetchMock = vi.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const queue = new SlicePreloadQueue();
    queue.enqueue('depth', ['https://x/slow.glb']);
    queue.abortAndClear();

    // Give the aborted worker a tick to settle; it must not throw or hang.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queue.progress.status).not.toBe('done');
  });
});

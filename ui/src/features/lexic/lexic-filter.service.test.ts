import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LexicFilterService, LexicResultState } from './lexic-filter.service';
import { LexicApiService } from './lexic-api.service';
import { CesiumService } from 'src/services/cesium.service';
import { WmsRequestFiltersFilterId } from './generated/lexic-schemas';
import { showSnackbarError } from 'src/notifications';

vi.mock('src/notifications', () => ({
  showSnackbarError: vi.fn(),
}));

vi.mock('i18next', () => ({
  default: {
    t: (key: string) => key,
  },
}));

const LITHOLOGY_FILTER_ID = WmsRequestFiltersFilterId['f-lithology-term'];
const LITHOSTRAT_FILTER_ID = WmsRequestFiltersFilterId['f-lithostrat-term'];

function makeWmsResponse(body: string) {
  return {
    url: 'https://dev-webmap-api.swissgeol.ch/v1/wms',
    body,
    mimeType: 'image/png',
    note: '',
  };
}

/**
 * Creates a service instance with mocked dependencies,
 * bypassing the inject mechanism.
 */
function createService() {
  const service = new LexicFilterService();

  const mockViewer = {
    scene: {
      imageryLayers: {
        add: vi.fn(),
        remove: vi.fn(),
        raiseToTop: vi.fn(),
        layerAdded: {
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      },
      requestRender: vi.fn(),
    },
  };

  const cesiumService = {
    isReady: true,
    ready: Promise.resolve(),
    viewer: mockViewer,
    viewerOrNull: mockViewer,
  } as unknown as CesiumService;

  const apiService = new LexicApiService();

  // Set private fields directly to bypass context injection
  (service as any).cesiumService = cesiumService;
  (service as any).lexicApiService = apiService;

  // Cancel the subscription that waits for injection
  (service as any).servicesSubscription?.unsubscribe();

  return { service, cesiumService, apiService, mockViewer };
}

describe('LexicFilterService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('state management', () => {
    it('starts in idle state', () => {
      const { service } = createService();
      let state: LexicResultState = 'loading';
      service.resultState$.subscribe((s) => (state = s));
      expect(state).toBe('idle');
    });

    it('starts with default opacity of 70', () => {
      const { service } = createService();
      expect(service.resultOpacity).toBe(70);
    });

    it('starts closed', () => {
      const { service } = createService();
      expect(service.isOpen).toBe(false);
    });

    it('opens and closes', () => {
      const { service } = createService();
      service.open();
      expect(service.isOpen).toBe(true);
      service.close();
      expect(service.isOpen).toBe(false);
    });

    it('toggles open and closed', () => {
      const { service } = createService();
      service.toggle();
      expect(service.isOpen).toBe(true);
      service.toggle();
      expect(service.isOpen).toBe(false);
    });

    it('resets result state to idle on close', () => {
      const { service } = createService();
      let state: LexicResultState = 'idle';
      service.resultState$.subscribe((s) => (state = s));

      service.open();
      // Manually set state to simulate loaded result
      (service as any)._resultState$.next('ok');
      expect(state).toBe('ok');

      service.close();
      expect(state).toBe('idle');
    });
  });

  describe('filter list management', () => {
    it('starts with empty filter list', () => {
      const { service } = createService();
      expect(service.filterList).toEqual([]);
    });

    it('adds a filter and returns a local ID', () => {
      const { service } = createService();
      service.setSelectedLayer('layer1', 'webmap1');

      const localId = service.addFilter(
        {
          filterId: LITHOLOGY_FILTER_ID,
          parameters: { term: 'http://example.com/Marlstone' },
        },
        'Marlstone',
      );

      expect(localId).toMatch(/^lexic-filter-\d+$/);
      expect(service.filterList).toHaveLength(1);
      expect(service.filterList[0]).toEqual({
        localId,
        filterId: LITHOLOGY_FILTER_ID,
        parameters: { term: 'http://example.com/Marlstone' },
        displayLabel: 'Marlstone',
      });
    });

    it('generates unique local IDs', () => {
      const { service } = createService();
      service.setSelectedLayer('layer1', 'webmap1');

      const id1 = service.addFilter(
        { filterId: LITHOLOGY_FILTER_ID, parameters: { term: 'a' } },
        'A',
      );
      const id2 = service.addFilter(
        { filterId: LITHOLOGY_FILTER_ID, parameters: { term: 'b' } },
        'B',
      );

      expect(id1).not.toBe(id2);
    });

    it('removes a specific filter by local ID', () => {
      const { service } = createService();
      service.setSelectedLayer('layer1', 'webmap1');

      const id1 = service.addFilter(
        { filterId: LITHOLOGY_FILTER_ID, parameters: { term: 'a' } },
        'A',
      );
      service.addFilter(
        { filterId: LITHOLOGY_FILTER_ID, parameters: { term: 'b' } },
        'B',
      );

      service.removeFilter(id1);
      expect(service.filterList).toHaveLength(1);
      expect(service.filterList[0].displayLabel).toBe('B');
    });

    it('removes all filters of a category', () => {
      const { service } = createService();
      service.setSelectedLayer('layer1', 'webmap1');

      service.addFilter(
        { filterId: LITHOLOGY_FILTER_ID, parameters: { term: 'a' } },
        'A',
      );
      service.addFilter(
        { filterId: LITHOLOGY_FILTER_ID, parameters: { term: 'b' } },
        'B',
      );
      service.addFilter(
        { filterId: LITHOSTRAT_FILTER_ID, parameters: { term: 'c' } },
        'C',
      );

      service.removeCategory(LITHOLOGY_FILTER_ID);
      expect(service.filterList).toHaveLength(1);
      expect(service.filterList[0].filterId).toBe(LITHOSTRAT_FILTER_ID);
    });

    it('removes all filters', () => {
      const { service } = createService();
      service.setSelectedLayer('layer1', 'webmap1');

      service.addFilter(
        { filterId: LITHOLOGY_FILTER_ID, parameters: { term: 'a' } },
        'A',
      );
      service.addFilter(
        { filterId: LITHOSTRAT_FILTER_ID, parameters: { term: 'b' } },
        'B',
      );

      service.removeAllFilters();
      expect(service.filterList).toEqual([]);
    });
  });

  describe('opacity', () => {
    it('sets opacity and clamps to 0-100', () => {
      const { service } = createService();

      service.setResultOpacity(50);
      expect(service.resultOpacity).toBe(50);

      service.setResultOpacity(-10);
      expect(service.resultOpacity).toBe(0);

      service.setResultOpacity(150);
      expect(service.resultOpacity).toBe(100);
    });

    it('updates live imagery alpha when set', () => {
      const { service, mockViewer } = createService();

      const mockImagery = { alpha: 0.7 };
      (service as any).currentImagery = mockImagery;

      service.setResultOpacity(50);
      expect(mockImagery.alpha).toBe(0.5);
      expect(mockViewer.scene.requestRender).toHaveBeenCalled();
    });
  });

  describe('toWmsRequestFilters', () => {
    it('returns empty array when no filters', () => {
      const { service } = createService();
      expect(service.toWmsRequestFilters()).toEqual([]);
    });

    it('converts active filters to request format', () => {
      const { service } = createService();
      service.setSelectedLayer('layer1', 'webmap1');

      service.addFilter(
        {
          filterId: LITHOLOGY_FILTER_ID,
          parameters: { term: 'http://example.com/Marlstone' },
        },
        'Marlstone',
      );

      const result = service.toWmsRequestFilters();
      expect(result).toEqual([
        {
          filterId: LITHOLOGY_FILTER_ID,
          parameters: { term: 'http://example.com/Marlstone' },
        },
      ]);
    });
  });

  describe('parseWmsBodyParams (via parseWmsCustomParams)', () => {
    it('parses URL-encoded body params', () => {
      const { service } = createService();
      const body =
        'SERVICE=WMS&REQUEST=GetMap&LAYERS=layer1&STYLES=&SEMANTIC_FILTER=abc%3D123';

      const result = (service as any).parseWmsCustomParams(body);

      // Standard params should be stripped
      expect(result).not.toHaveProperty('SERVICE');
      expect(result).not.toHaveProperty('REQUEST');
      expect(result).not.toHaveProperty('LAYERS');

      // Custom params should remain
      expect(result).toHaveProperty('STYLES', '');
      expect(result).toHaveProperty('SEMANTIC_FILTER', 'abc=123');
    });

    it('keeps VERSION and FORMAT params (they override CesiumJS defaults)', () => {
      const { service } = createService();
      const body = 'VERSION=1.3.0&FORMAT=image%2Fpng&SERVICE=WMS&BBOX=1,2,3,4';

      const result = (service as any).parseWmsCustomParams(body);

      expect(result).toHaveProperty('VERSION', '1.3.0');
      expect(result).toHaveProperty('FORMAT', 'image/png');
      expect(result).not.toHaveProperty('SERVICE');
      expect(result).not.toHaveProperty('BBOX');
    });

    it('handles empty body', () => {
      const { service } = createService();
      const result = (service as any).parseWmsCustomParams('');
      expect(result).toEqual({});
    });

    it('strips CRS and SRS params', () => {
      const { service } = createService();
      const body = 'CRS=EPSG%3A4326&SRS=EPSG%3A4326&TILED=true';

      const result = (service as any).parseWmsCustomParams(body);

      expect(result).not.toHaveProperty('CRS');
      expect(result).not.toHaveProperty('SRS');
      expect(result).toHaveProperty('TILED', 'true');
    });
  });

  describe('map layer lifecycle', () => {
    it('transitions to idle and removes layer when all filters are removed', async () => {
      const { service, mockViewer } = createService();

      // Simulate an existing imagery layer
      const mockImagery = { alpha: 0.7 };
      (service as any).currentImagery = mockImagery;

      const states: LexicResultState[] = [];
      service.resultState$.subscribe((s) => states.push(s));

      service.setSelectedLayer('layer1', 'webmap1');
      service.removeAllFilters();

      // Wait for async operations
      await vi.waitFor(() => {
        expect(states).toContain('idle');
      });

      expect(mockViewer.scene.imageryLayers.remove).toHaveBeenCalledWith(
        mockImagery,
        true,
      );
    });

    it('transitions to load-error when API call fails', async () => {
      const { service, apiService } = createService();

      vi.spyOn(apiService, 'generateWmsRequest').mockRejectedValue(
        new Error('Network error'),
      );

      const states: LexicResultState[] = [];
      service.resultState$.subscribe((s) => states.push(s));

      service.setSelectedLayer('layer1', 'webmap1');
      service.addFilter(
        { filterId: LITHOLOGY_FILTER_ID, parameters: { term: 'a' } },
        'A',
      );

      await vi.waitFor(() => {
        expect(states).toContain('load-error');
      });

      expect(showSnackbarError).toHaveBeenCalledWith(
        'layout:lexic.errors.generateWmsRequest',
      );
    });

    it('shows a tile load error toast at most once per update version', () => {
      const { service } = createService();

      (service as any).showTileLoadError(1);
      (service as any).showTileLoadError(1);

      expect(showSnackbarError).toHaveBeenCalledTimes(1);
      expect(showSnackbarError).toHaveBeenCalledWith(
        'layout:lexic.errors.loadTiles',
      );

      (service as any).showTileLoadError(2);
      expect(showSnackbarError).toHaveBeenCalledTimes(2);
    });

    it('attaches imagery error listeners that surface tile load errors', () => {
      const { service } = createService();
      const listeners: Array<() => void> = [];
      const mockProvider = {
        errorEvent: {
          addEventListener: vi.fn((listener: () => void) => {
            listeners.push(listener);
          }),
          removeEventListener: vi.fn(),
        },
      };

      (service as any).updateVersion = 5;
      (service as any).attachImageryErrorHandler(mockProvider, 5);

      expect(mockProvider.errorEvent.addEventListener).toHaveBeenCalled();

      vi.mocked(showSnackbarError).mockClear();
      listeners[0]();
      listeners[0]();

      expect(showSnackbarError).toHaveBeenCalledTimes(1);
      expect(showSnackbarError).toHaveBeenCalledWith(
        'layout:lexic.errors.loadTiles',
      );
    });

    it('transitions through loading → ok on successful WMS response', async () => {
      const { service, apiService } = createService();

      vi.spyOn(apiService, 'generateWmsRequest').mockResolvedValue(
        makeWmsResponse(
          'VERSION=1.3.0&FORMAT=image%2Fpng&SEMANTIC_FILTER=test',
        ),
      );

      const states: LexicResultState[] = [];
      service.resultState$.subscribe((s) => states.push(s));

      service.setSelectedLayer('layer1', 'webmap1');
      service.addFilter(
        { filterId: LITHOLOGY_FILTER_ID, parameters: { term: 'a' } },
        'A',
      );

      await vi.waitFor(() => {
        expect(states).toContain('ok');
      });

      expect(states).toContain('loading');
    });

    it('discards stale responses when a newer update is triggered', async () => {
      const { service, apiService } = createService();

      let resolveFirst: (value: any) => void;
      const firstCall = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      vi.spyOn(apiService, 'generateWmsRequest')
        .mockImplementationOnce(() => firstCall as any)
        .mockResolvedValueOnce(makeWmsResponse('SEMANTIC_FILTER=second'));

      service.setSelectedLayer('layer1', 'webmap1');

      // First filter triggers first API call
      service.addFilter(
        { filterId: LITHOLOGY_FILTER_ID, parameters: { term: 'a' } },
        'A',
      );

      // Second filter triggers second API call (supersedes first)
      service.addFilter(
        { filterId: LITHOLOGY_FILTER_ID, parameters: { term: 'b' } },
        'B',
      );

      // Resolve the first call after the second has been triggered
      resolveFirst!(makeWmsResponse('SEMANTIC_FILTER=first'));

      await vi.waitFor(() => {
        const states: LexicResultState[] = [];
        service.resultState$.subscribe((s) => states.push(s));
        expect(states[0]).toBe('ok');
      });
    });
  });

  describe('retranslateFilters', () => {
    it('updates display labels using the resolve function', async () => {
      const { service } = createService();
      service.setSelectedLayer('layer1', 'webmap1');

      service.addFilter(
        {
          filterId: LITHOLOGY_FILTER_ID,
          parameters: { term: 'http://example.com/Marlstone' },
        },
        'Marlstone (en)',
      );

      const resolve = vi.fn().mockResolvedValue('Marne (fr)');

      await service.retranslateFilters(resolve);

      expect(resolve).toHaveBeenCalledWith('http://example.com/Marlstone');
      expect(service.filterList[0].displayLabel).toBe('Marne (fr)');
    });

    it('keeps original label if resolve returns null', async () => {
      const { service } = createService();
      service.setSelectedLayer('layer1', 'webmap1');

      service.addFilter(
        {
          filterId: LITHOLOGY_FILTER_ID,
          parameters: { term: 'http://example.com/Unknown' },
        },
        'Unknown',
      );

      const resolve = vi.fn().mockResolvedValue(null);

      await service.retranslateFilters(resolve);

      expect(service.filterList[0].displayLabel).toBe('Unknown');
    });

    it('does nothing when filter list is empty', async () => {
      const { service } = createService();
      const resolve = vi.fn();
      await service.retranslateFilters(resolve);
      expect(resolve).not.toHaveBeenCalled();
    });
  });

  describe('dataset selection', () => {
    it('sets and consumes requested dataset ID', () => {
      const { service } = createService();
      service.open(LITHOLOGY_FILTER_ID);

      expect(service.consumeRequestedDatasetId()).toBe(LITHOLOGY_FILTER_ID);
      // Consumed — second call returns null
      expect(service.consumeRequestedDatasetId()).toBeNull();
    });
  });
});

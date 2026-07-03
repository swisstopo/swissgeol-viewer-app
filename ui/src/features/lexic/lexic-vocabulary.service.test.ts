import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LexicVocabularyService } from './lexic-vocabulary.service';
import { LexicApiService } from './lexic-api.service';
import { LexicVocabularyTermsResponse } from './lexic-api.model';

const MARLSTONE_URL = 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone';
const ST_GALLEN_URL =
  'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation';

function makeTerm(term: string, label: string) {
  return { term, label, description: '' };
}

function makeTermsResponse(
  ...terms: Array<{ term: string; label: string; description: string }>
): LexicVocabularyTermsResponse {
  return { terms };
}

describe('LexicVocabularyService', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function createServiceWithMockApi(): {
    service: LexicVocabularyService;
    apiService: LexicApiService;
  } {
    const service = new LexicVocabularyService();
    const apiService = new LexicApiService();
    // Bypass the inject mechanism by setting the private field directly
    (service as any).lexicApi = apiService;
    return { service, apiService };
  }

  function mockTerms(
    apiService: LexicApiService,
    ...terms: Array<{ term: string; label: string; description: string }>
  ) {
    return vi
      .spyOn(apiService, 'getVocabularyTerms')
      .mockResolvedValue(makeTermsResponse(...terms));
  }

  it('resolves a label by matching the full term URL', async () => {
    const { service, apiService } = createServiceWithMockApi();
    mockTerms(
      apiService,
      makeTerm(ST_GALLEN_URL, 'St-Gallen-Formation'),
      makeTerm(
        'https://dev-lexic.swissgeol.ch/Lithostratigraphy/OtherTerm',
        'Other',
      ),
    );

    const label = await service.getLabelForTermUrl({
      termUrl: ST_GALLEN_URL,
      language: 'de',
    });

    expect(label).toBe('St-Gallen-Formation');
    expect(apiService.getVocabularyTerms).toHaveBeenCalledWith(
      'lithostratigraphy',
      'de',
    );
  });

  it('returns null when term is not found in vocabulary', async () => {
    const { service, apiService } = createServiceWithMockApi();
    mockTerms(
      apiService,
      makeTerm(
        'https://dev-lexic.swissgeol.ch/Lithostratigraphy/Other',
        'Other',
      ),
    );

    const label = await service.getLabelForTermUrl({
      termUrl: 'https://dev-lexic.swissgeol.ch/Lithostratigraphy/NonExistent',
      language: 'de',
    });

    expect(label).toBeNull();
  });

  it('caches vocabulary responses by vocabularyId + language', async () => {
    const { service, apiService } = createServiceWithMockApi();
    const spy = mockTerms(apiService, makeTerm(MARLSTONE_URL, 'Mergel'));

    await service.getLabelForTermUrl({
      termUrl: MARLSTONE_URL,
      language: 'de',
    });
    await service.getLabelForTermUrl({
      termUrl: MARLSTONE_URL,
      language: 'de',
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fetches separately for different languages', async () => {
    const { service, apiService } = createServiceWithMockApi();
    const spy = mockTerms(apiService, makeTerm(MARLSTONE_URL, 'Marne'));

    await service.getLabelForTermUrl({
      termUrl: MARLSTONE_URL,
      language: 'de',
    });
    await service.getLabelForTermUrl({
      termUrl: MARLSTONE_URL,
      language: 'fr',
    });

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('returns null for non-Lexic URLs', async () => {
    const { service } = createServiceWithMockApi();

    const label = await service.getLabelForTermUrl({
      termUrl: 'https://example.com/something',
      language: 'de',
    });

    expect(label).toBeNull();
  });

  it('normalizes URL before matching (strips query/hash)', async () => {
    const { service, apiService } = createServiceWithMockApi();
    mockTerms(apiService, makeTerm(MARLSTONE_URL, 'Mergel'));

    const label = await service.getLabelForTermUrl({
      termUrl: `${MARLSTONE_URL}?lang=en#x`,
      language: 'de',
    });

    expect(label).toBe('Mergel');
  });

  it('preloadVocabularies fetches all four vocabularies', async () => {
    const { service, apiService } = createServiceWithMockApi();
    const spy = mockTerms(apiService);

    await service.preloadVocabularies('de');

    expect(spy).toHaveBeenCalledTimes(4);
    expect(spy).toHaveBeenCalledWith('chronostratigraphy', 'de');
    expect(spy).toHaveBeenCalledWith('tectonic-units', 'de');
    expect(spy).toHaveBeenCalledWith('lithostratigraphy', 'de');
    expect(spy).toHaveBeenCalledWith('lithology', 'de');
  });

  it('preloadVocabularies does not re-fetch already cached vocabularies', async () => {
    const { service, apiService } = createServiceWithMockApi();
    const spy = mockTerms(apiService, makeTerm(MARLSTONE_URL, 'Mergel'));

    // First fetch one vocabulary via getLabelForTermUrl
    await service.getLabelForTermUrl({
      termUrl: MARLSTONE_URL,
      language: 'de',
    });
    expect(spy).toHaveBeenCalledTimes(1);

    // Then preload all — lithology:de should already be cached
    await service.preloadVocabularies('de');

    // Only 3 more calls (the other 3 vocabularies)
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('preloadVocabularies handles partial failures gracefully', async () => {
    const { service, apiService } = createServiceWithMockApi();
    let callCount = 0;
    vi.spyOn(apiService, 'getVocabularyTerms').mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ terms: [] });
    });

    // Should not throw even if one vocabulary fails
    await expect(service.preloadVocabularies('en')).resolves.toBeUndefined();
  });

  describe('localStorage caching', () => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    };

    beforeEach(() => {
      storage.clear();
      vi.stubGlobal('localStorage', localStorageMock);
    });

    afterEach(() => {
      storage.clear();
    });

    it('persists fetched vocabulary to localStorage', async () => {
      const { service, apiService } = createServiceWithMockApi();
      mockTerms(apiService, makeTerm(MARLSTONE_URL, 'Mergel'));

      await service.getLabelForTermUrl({
        termUrl: MARLSTONE_URL,
        language: 'de',
      });

      const stored = localStorage.getItem('lexic-vocab:lithology:de');
      expect(stored).not.toBeNull();
      const entry = JSON.parse(stored!);
      expect(entry.data.terms[0].label).toBe('Mergel');
      expect(entry.timestamp).toBeTypeOf('number');
    });

    it('restores vocabulary from localStorage on a new service instance', async () => {
      const { service, apiService } = createServiceWithMockApi();
      mockTerms(apiService, makeTerm(MARLSTONE_URL, 'Mergel'));

      await service.getLabelForTermUrl({
        termUrl: MARLSTONE_URL,
        language: 'de',
      });

      // Create a new service instance (simulates page reload)
      const { service: service2, apiService: apiService2 } =
        createServiceWithMockApi();
      const spy2 = mockTerms(apiService2);

      const label = await service2.getLabelForTermUrl({
        termUrl: MARLSTONE_URL,
        language: 'de',
      });

      expect(label).toBe('Mergel');
      expect(spy2).not.toHaveBeenCalled();
    });

    it('ignores expired localStorage entries', async () => {
      const expiredEntry = {
        data: makeTermsResponse(makeTerm(MARLSTONE_URL, 'Old')),
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      localStorage.setItem(
        'lexic-vocab:lithology:de',
        JSON.stringify(expiredEntry),
      );

      const { service, apiService } = createServiceWithMockApi();
      const spy = mockTerms(apiService, makeTerm(MARLSTONE_URL, 'Fresh'));

      const label = await service.getLabelForTermUrl({
        termUrl: MARLSTONE_URL,
        language: 'de',
      });

      expect(label).toBe('Fresh');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('handles corrupted localStorage entries gracefully', async () => {
      localStorage.setItem('lexic-vocab:lithology:de', 'not-valid-json{{{');

      const { service, apiService } = createServiceWithMockApi();
      const spy = mockTerms(apiService, makeTerm(MARLSTONE_URL, 'Mergel'));

      const label = await service.getLabelForTermUrl({
        termUrl: MARLSTONE_URL,
        language: 'de',
      });

      expect(label).toBe('Mergel');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  it('toLexicLanguage falls back to en for unknown languages', async () => {
    const { service, apiService } = createServiceWithMockApi();
    const spy = mockTerms(apiService, makeTerm(MARLSTONE_URL, 'Marlstone'));

    await service.getLabelForTermUrl({
      termUrl: MARLSTONE_URL,
      language: 'ja',
    });

    expect(spy).toHaveBeenCalledWith('lithology', 'en');
  });
});

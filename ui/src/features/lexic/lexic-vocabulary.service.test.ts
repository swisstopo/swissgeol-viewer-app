import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LexicVocabularyService } from './lexic-vocabulary.service';
import { LexicApiService } from './lexic-api.service';

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

  it('resolves a label by matching the full term URL', async () => {
    const { service, apiService } = createServiceWithMockApi();
    vi.spyOn(apiService, 'getVocabularyTerms').mockResolvedValue({
      terms: [
        {
          term: 'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation',
          label: 'St-Gallen-Formation',
          description: '',
        },
        {
          term: 'https://dev-lexic.swissgeol.ch/Lithostratigraphy/OtherTerm',
          label: 'Other',
          description: '',
        },
      ],
    });

    const label = await service.getLabelForTermUrl({
      termUrl:
        'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation',
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
    vi.spyOn(apiService, 'getVocabularyTerms').mockResolvedValue({
      terms: [
        {
          term: 'https://dev-lexic.swissgeol.ch/Lithostratigraphy/Other',
          label: 'Other',
          description: '',
        },
      ],
    });

    const label = await service.getLabelForTermUrl({
      termUrl: 'https://dev-lexic.swissgeol.ch/Lithostratigraphy/NonExistent',
      language: 'de',
    });

    expect(label).toBeNull();
  });

  it('caches vocabulary responses by vocabularyId + language', async () => {
    const { service, apiService } = createServiceWithMockApi();
    const spy = vi.spyOn(apiService, 'getVocabularyTerms').mockResolvedValue({
      terms: [
        {
          term: 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone',
          label: 'Mergel',
          description: '',
        },
      ],
    });

    await service.getLabelForTermUrl({
      termUrl: 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone',
      language: 'de',
    });
    await service.getLabelForTermUrl({
      termUrl: 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone',
      language: 'de',
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fetches separately for different languages', async () => {
    const { service, apiService } = createServiceWithMockApi();
    const spy = vi.spyOn(apiService, 'getVocabularyTerms').mockResolvedValue({
      terms: [
        {
          term: 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone',
          label: 'Marne',
          description: '',
        },
      ],
    });

    await service.getLabelForTermUrl({
      termUrl: 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone',
      language: 'de',
    });
    await service.getLabelForTermUrl({
      termUrl: 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone',
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
    vi.spyOn(apiService, 'getVocabularyTerms').mockResolvedValue({
      terms: [
        {
          term: 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone',
          label: 'Mergel',
          description: '',
        },
      ],
    });

    const label = await service.getLabelForTermUrl({
      termUrl: 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone?lang=en#x',
      language: 'de',
    });

    expect(label).toBe('Mergel');
  });

  it('preloadVocabularies fetches all four vocabularies', async () => {
    const { service, apiService } = createServiceWithMockApi();
    const spy = vi.spyOn(apiService, 'getVocabularyTerms').mockResolvedValue({
      terms: [],
    });

    await service.preloadVocabularies('de');

    expect(spy).toHaveBeenCalledTimes(4);
    expect(spy).toHaveBeenCalledWith('chronostratigraphy', 'de');
    expect(spy).toHaveBeenCalledWith('tectonic-units', 'de');
    expect(spy).toHaveBeenCalledWith('lithostratigraphy', 'de');
    expect(spy).toHaveBeenCalledWith('lithology', 'de');
  });

  it('preloadVocabularies does not re-fetch already cached vocabularies', async () => {
    const { service, apiService } = createServiceWithMockApi();
    const spy = vi.spyOn(apiService, 'getVocabularyTerms').mockResolvedValue({
      terms: [
        {
          term: 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone',
          label: 'Mergel',
          description: '',
        },
      ],
    });

    // First fetch one vocabulary via getLabelForTermUrl
    await service.getLabelForTermUrl({
      termUrl: 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone',
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

  it('toLexicLanguage falls back to en for unknown languages', async () => {
    const { service, apiService } = createServiceWithMockApi();
    const spy = vi.spyOn(apiService, 'getVocabularyTerms').mockResolvedValue({
      terms: [
        {
          term: 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone',
          label: 'Marlstone',
          description: '',
        },
      ],
    });

    await service.getLabelForTermUrl({
      termUrl: 'https://dev-lexic.swissgeol.ch/Lithology/Marlstone',
      language: 'ja',
    });

    expect(spy).toHaveBeenCalledWith('lithology', 'en');
  });
});

import { BaseService } from 'src/services/base.service';
import { LexicApiService } from './lexic-api.service';
import { LexicLanguage, LexicVocabularyTermsResponse } from './lexic-api.model';
import {
  LEXIC_VOCABULARY_IDS,
  parseLexicTermUrl,
  toLexicLanguage,
} from './lexic-url';

/**
 * Service that resolves translated labels for Lexic term URLs.
 * Caches full vocabulary responses by `vocabularyId:language`.
 */
export class LexicVocabularyService extends BaseService {
  private readonly cache = new Map<string, LexicVocabularyTermsResponse>();
  private readonly pending = new Map<
    string,
    Promise<LexicVocabularyTermsResponse>
  >();
  private lexicApi: LexicApiService | null = null;

  constructor() {
    super();
  }

  /**
   * Resolves the translated label for a given Lexic term URL.
   * Returns `null` if the term is not found or the URL is not a valid Lexic URL.
   * Throws if the vocabulary request fails.
   */
  async getLabelForTermUrl(params: {
    termUrl: string;
    language: string;
  }): Promise<string | null> {
    const parsed = parseLexicTermUrl(params.termUrl);
    if (parsed == null) {
      return null;
    }
    const { vocabularyId, normalizedTermUrl } = parsed;
    const language = toLexicLanguage(params.language);
    const terms = await this.fetchVocabulary(vocabularyId, language);
    const match = terms.terms?.find((t) => t.term === normalizedTermUrl);
    return match?.label ?? null;
  }

  private async getLexicApiService(): Promise<LexicApiService> {
    this.lexicApi ??= await LexicApiService.inject();
    return this.lexicApi;
  }

  private async fetchVocabulary(
    vocabularyId: string,
    language: LexicLanguage,
  ): Promise<LexicVocabularyTermsResponse> {
    const cacheKey = `${vocabularyId}:${language}`;
    const cached = this.cache.get(cacheKey);
    if (cached != null) {
      return cached;
    }
    const pendingRequest = this.pending.get(cacheKey);
    if (pendingRequest != null) {
      return pendingRequest;
    }
    const request = this.getLexicApiService()
      .then((lexicApi) => lexicApi.getVocabularyTerms(vocabularyId, language))
      .then((response) => {
        this.cache.set(cacheKey, response);
        this.pending.delete(cacheKey);
        return response;
      })
      .catch((error) => {
        this.pending.delete(cacheKey);
        throw error;
      });
    this.pending.set(cacheKey, request);
    return request;
  }

  async preloadVocabularies(language: string): Promise<void> {
    const lexicLanguage = toLexicLanguage(language);

    await Promise.allSettled(
      LEXIC_VOCABULARY_IDS.map((vocabularyId) =>
        this.fetchVocabulary(vocabularyId, lexicLanguage),
      ),
    );
  }
}

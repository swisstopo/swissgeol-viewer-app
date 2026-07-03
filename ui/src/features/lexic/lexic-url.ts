import { LexicLanguage } from 'src/features/lexic/lexic-api.model';

const LEXIC_HOSTS = new Set([
  'dev-lexic.swissgeol.ch',
  'int-lexic.swissgeol.ch',
  'lexic.swissgeol.ch',
]);

/** Example
 * 'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation?lang=de'
 * vocabularyId = 'lithostratigraphy'
 * normalizedTermUrl = 'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation'
 * (language query parameter removed)
 */
export interface ParsedLexicTermUrl {
  vocabularyId: LexicVocabularyId;
  normalizedTermUrl: string;
}

export const LEXIC_VOCABULARY_IDS = [
  'chronostratigraphy',
  'tectonic-units',
  'lithostratigraphy',
  'lithology',
] as const;

export type LexicVocabularyId = (typeof LEXIC_VOCABULARY_IDS)[number];

/**
 * Mapping from the first path segment of a Lexic URL to the vocabulary id
 * used by the API.
 */
const VOCABULARY_PATH_MAP: Record<string, LexicVocabularyId> = {
  Chronostratigraphy: 'chronostratigraphy',
  TectonicUnits: 'tectonic-units',
  Lithostratigraphy: 'lithostratigraphy',
  Lithology: 'lithology',
};

/**
 * Parses a Lexic term URL into its vocabulary id and normalized form.
 * Returns `null` if the URL is not a recognized Lexic term URL.
 */
export function parseLexicTermUrl(termUrl: string): ParsedLexicTermUrl | null {
  let url: URL;
  try {
    url = new URL(termUrl);
  } catch {
    return null;
  }
  if (!LEXIC_HOSTS.has(url.hostname)) {
    return null;
  }
  const segments = url.pathname.split('/').filter((s) => s.length > 0);
  if (segments.length < 2) {
    return null;
  }
  const vocabularyPath = segments[0];
  const vocabularyId = VOCABULARY_PATH_MAP[vocabularyPath];
  if (vocabularyId == null) {
    return null;
  }
  // Normalize: strip query and hash
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/$/, '');
  return { vocabularyId, normalizedTermUrl: url.toString() };
}

/**
 * Builds a Lexic href with the `lang` query parameter set.
 */
export function getLexicHref(termUrl: string, language: string): string {
  const url = new URL(termUrl);
  url.searchParams.set('lang', language);
  return url.toString();
}

/**
 * Checks if a string value is a Lexic term URL.
 */
export function isLexicTermUrl(value: string): boolean {
  return parseLexicTermUrl(value) !== null;
}

export function toLexicLanguage(language: string): LexicLanguage {
  const normalized = language.split('-')[0];

  switch (normalized) {
    case 'en':
    case 'de':
    case 'fr':
    case 'it':
      return normalized;
    default:
      return 'en';
  }
}

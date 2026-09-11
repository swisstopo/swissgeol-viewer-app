import { describe, expect, it } from 'vitest';
import {
  getLexicHref,
  isLexicTermUrl,
  parseLexicTermUrl,
  toLexicLanguage,
} from './lexic-url';

const CHRONOSTRATIGRAPHY_URL =
  'https://dev-lexic.swissgeol.ch/Chronostratigraphy/LateBurdigalian';
const TECTONIC_UNITS_URL =
  'https://dev-lexic.swissgeol.ch/TectonicUnits/InternalFoldedJuraAndForelandPlateau';
const LITHOSTRATIGRAPHY_URL =
  'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation';
const LITHOLOGY_URL =
  'https://dev-lexic.swissgeol.ch/Lithology/SandstoneGlauconite';
const LITHOLOGY_MARLSTONE_URL =
  'https://dev-lexic.swissgeol.ch/Lithology/Marlstone';

describe('parseLexicTermUrl', () => {
  it('parses a Chronostratigraphy URL', () => {
    const result = parseLexicTermUrl(CHRONOSTRATIGRAPHY_URL);
    expect(result).toEqual({
      vocabularyId: 'chronostratigraphy',
      normalizedTermUrl: CHRONOSTRATIGRAPHY_URL,
    });
  });

  it('parses a TectonicUnits URL', () => {
    const result = parseLexicTermUrl(TECTONIC_UNITS_URL);
    expect(result).toEqual({
      vocabularyId: 'tectonic-units',
      normalizedTermUrl: TECTONIC_UNITS_URL,
    });
  });

  it('parses a Lithostratigraphy URL', () => {
    const result = parseLexicTermUrl(LITHOSTRATIGRAPHY_URL);
    expect(result).toEqual({
      vocabularyId: 'lithostratigraphy',
      normalizedTermUrl: LITHOSTRATIGRAPHY_URL,
    });
  });

  it('parses a Lithology URL', () => {
    const result = parseLexicTermUrl(LITHOLOGY_URL);
    expect(result).toEqual({
      vocabularyId: 'lithology',
      normalizedTermUrl: LITHOLOGY_URL,
    });
  });

  it('accepts dev-lexic.swissgeol.ch URLs', () => {
    const result = parseLexicTermUrl(LITHOLOGY_MARLSTONE_URL);
    expect(result).not.toBeNull();
    expect(result!.vocabularyId).toBe('lithology');
  });

  it('accepts int-lexic.swissgeol.ch URLs', () => {
    const url = 'https://int-lexic.swissgeol.ch/Lithology/Marlstone';
    const result = parseLexicTermUrl(url);
    expect(result).not.toBeNull();
    expect(result!.vocabularyId).toBe('lithology');
  });

  it('accepts lexic.swissgeol.ch (production) URLs', () => {
    const url = 'https://lexic.swissgeol.ch/Lithology/Marlstone';
    const result = parseLexicTermUrl(url);
    expect(result).toEqual({
      vocabularyId: 'lithology',
      normalizedTermUrl: url,
    });
  });

  it('strips query parameters from the normalized URL', () => {
    const result = parseLexicTermUrl(LITHOLOGY_URL + '?lang=de');
    expect(result).toEqual({
      vocabularyId: 'lithology',
      normalizedTermUrl: LITHOLOGY_URL,
    });
  });

  it('strips hash from the normalized URL', () => {
    const result = parseLexicTermUrl(LITHOLOGY_URL + '#section');
    expect(result).toEqual({
      vocabularyId: 'lithology',
      normalizedTermUrl: LITHOLOGY_URL,
    });
  });

  it('strips both query and hash from the normalized URL', () => {
    const result = parseLexicTermUrl(LITHOLOGY_URL + '?lang=de#section');
    expect(result).toEqual({
      vocabularyId: 'lithology',
      normalizedTermUrl: LITHOLOGY_URL,
    });
  });

  it('strips trailing slash from path', () => {
    const result = parseLexicTermUrl(LITHOLOGY_URL + '/');
    expect(result).toEqual({
      vocabularyId: 'lithology',
      normalizedTermUrl: LITHOLOGY_URL,
    });
  });

  it('returns null for non-Lexic URLs', () => {
    expect(parseLexicTermUrl('https://example.com/foo')).toBeNull();
    expect(
      parseLexicTermUrl('https://other-lexic.swissgeol.ch/Lithology/X'),
    ).toBeNull();
  });

  it('returns null for unsupported vocabulary path segments', () => {
    expect(
      parseLexicTermUrl('https://dev-lexic.swissgeol.ch/UnknownVocab/Term'),
    ).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(parseLexicTermUrl('not a url')).toBeNull();
    expect(parseLexicTermUrl('')).toBeNull();
  });

  it('returns null for Lexic URLs with only one path segment', () => {
    expect(
      parseLexicTermUrl('https://dev-lexic.swissgeol.ch/Lithology'),
    ).toBeNull();
  });

  it('returns null for Lexic URLs with no path', () => {
    expect(parseLexicTermUrl('https://dev-lexic.swissgeol.ch/')).toBeNull();
    expect(parseLexicTermUrl('https://dev-lexic.swissgeol.ch')).toBeNull();
  });
});

describe('getLexicHref', () => {
  it('appends lang parameter to a URL without query', () => {
    const href = getLexicHref(LITHOSTRATIGRAPHY_URL, 'de');
    expect(href).toBe(LITHOSTRATIGRAPHY_URL + '?lang=de');
  });

  it('replaces existing lang parameter', () => {
    const href = getLexicHref(LITHOSTRATIGRAPHY_URL + '?lang=en', 'fr');
    expect(href).toBe(LITHOSTRATIGRAPHY_URL + '?lang=fr');
  });

  it('preserves other query parameters', () => {
    const href = getLexicHref(LITHOSTRATIGRAPHY_URL + '?foo=bar', 'it');
    expect(href).toContain('foo=bar');
    expect(href).toContain('lang=it');
  });
});

describe('isLexicTermUrl', () => {
  it('returns true for valid Lexic term URLs', () => {
    expect(isLexicTermUrl(CHRONOSTRATIGRAPHY_URL)).toBe(true);
    expect(isLexicTermUrl(TECTONIC_UNITS_URL)).toBe(true);
    expect(isLexicTermUrl(LITHOSTRATIGRAPHY_URL)).toBe(true);
    expect(isLexicTermUrl(LITHOLOGY_URL)).toBe(true);
  });

  it('returns false for non-Lexic URLs', () => {
    expect(isLexicTermUrl('https://example.com/foo')).toBe(false);
  });

  it('returns false for plain strings', () => {
    expect(isLexicTermUrl('hello world')).toBe(false);
  });

  it('returns false for unsupported vocabulary paths', () => {
    expect(isLexicTermUrl('https://dev-lexic.swissgeol.ch/Unknown/Term')).toBe(
      false,
    );
  });
});

describe('toLexicLanguage', () => {
  it('returns de for de', () => {
    expect(toLexicLanguage('de')).toBe('de');
  });

  it('returns en for en', () => {
    expect(toLexicLanguage('en')).toBe('en');
  });

  it('returns fr for fr', () => {
    expect(toLexicLanguage('fr')).toBe('fr');
  });

  it('returns it for it', () => {
    expect(toLexicLanguage('it')).toBe('it');
  });

  it('handles BCP47 locale tags (e.g. de-CH)', () => {
    expect(toLexicLanguage('de-CH')).toBe('de');
    expect(toLexicLanguage('fr-FR')).toBe('fr');
    expect(toLexicLanguage('en-US')).toBe('en');
  });

  it('falls back to en for unsupported languages', () => {
    expect(toLexicLanguage('ja')).toBe('en');
    expect(toLexicLanguage('es')).toBe('en');
    expect(toLexicLanguage('zh')).toBe('en');
  });

  it('falls back to en for empty string', () => {
    expect(toLexicLanguage('')).toBe('en');
  });
});

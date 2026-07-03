import type {
  ByAttributeFilterParameter,
  ChronostratigraphyFilterParameter,
  DefaultFiltersResponse,
  Filter,
  FilterId,
  GetLayersLang,
  InlineResponse200,
  InlineResponse2001,
  InlineResponse2002,
  Layer,
  LayerAvailableFilters,
  TermFilterParameter,
  VocabulariesList,
  VocabularyLayersResponse,
  VocabularyTerms,
  WmsRequest,
  WmsRequestFilters,
  WmsResponse,
} from './generated/lexic-schemas';

export type LexicLanguage = GetLayersLang;
export type LexicFilterId = FilterId;
export type LexicFilter = Filter;
export type LexicLayer = Layer;
export type LexicLayerAvailableFilter = LayerAvailableFilters;
export type LexicLayersResponse = InlineResponse200;
export type LexicLayerFiltersResponse = InlineResponse2001;
export type LexicLayerAttributesResponse = InlineResponse2002;
export type LexicVocabulariesResponse = VocabulariesList;
export type LexicVocabularyTermsResponse = VocabularyTerms;
export type LexicVocabularyLayersResponse = VocabularyLayersResponse;
export type LexicChronostratigraphyFilterParameter =
  ChronostratigraphyFilterParameter;
export type LexicTermFilterParameter = TermFilterParameter;
export type LexicByAttributeFilterParameter = ByAttributeFilterParameter;
export type LexicFilterParameter =
  | LexicChronostratigraphyFilterParameter
  | LexicTermFilterParameter
  | LexicByAttributeFilterParameter;
export type LexicWmsRequestFilter = WmsRequestFilters;
export type LexicWmsRequest = WmsRequest;
export type LexicWmsResponse = WmsResponse;
export type LexicDefaultFiltersResponse = DefaultFiltersResponse;

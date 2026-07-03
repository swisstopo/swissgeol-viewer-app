import { Layer } from 'src/features/layer';
import { TemplateResult } from 'lit';
import { TranslationKey } from 'src/models/translation-key.model';
import { Id } from 'src/models/id.model';

/**
 * `LayerInfo` represents the current data of a specific object on a layer.
 * It contains metadata about that object, and is able to highlight it on the viewer.
 */
export interface LayerInfo {
  /**
   * The layer that was picked.
   */
  layerId: Id<Layer>;

  /**
   * The (translated) name of the picked object.
   */
  title: string;

  /**
   * The picked object's attributes.
   */
  attributes: LayerInfoAttribute[];

  /**
   * Zooms to the picked object.
   */
  zoomToObject(): void;

  /**
   * Highlights the picked object.
   */
  activateHighlight(): void;

  /**
   * Disables the highlight on the picked object.
   */
  deactivateHighlight(): void;

  /**
   * Destroys any highlights and other helper entities, effectively removing it from the viewer.
   * This is called when the info object is no longer needed.
   */
  destroy(): void;
}

export type LayerInfoValue = string | number | TemplateResult | TranslationKey;
export type LayerInfoUrl = { url: string; name?: LayerInfoValue };

export interface LayerInfoLexicTerm {
  type: 'lexic-term';
  termUrl: string;
}

export type LayerInfoAttributeValue =
  | LayerInfoValue
  | LayerInfoUrl
  | LayerInfoLexicTerm;

export interface LayerInfoAttribute {
  key: string | TranslationKey;
  value: LayerInfoAttributeValue;
}

export const isLayerInfoUrl = (
  value: LayerInfoAttributeValue,
): value is LayerInfoUrl =>
  typeof value === 'object' &&
  value !== null &&
  'url' in value &&
  !('type' in value);

export const isLayerInfoLexicTerm = (
  value: LayerInfoAttributeValue,
): value is LayerInfoLexicTerm =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  value.type === 'lexic-term';

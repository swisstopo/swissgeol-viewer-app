import {HIGHLIGHTED_AOI_COLOR, DEFAULT_AOI_COLOR} from '../constants.js';

export function updateColor(entity, selected) {
  const entityType = entity.rectangle ? 'rectangle' : 'polygon';
  entity[entityType].material = selected ? HIGHLIGHTED_AOI_COLOR : DEFAULT_AOI_COLOR;
}

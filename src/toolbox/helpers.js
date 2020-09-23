import {HIGHLIGHTED_AOI_COLOR, DEFAULT_AOI_COLOR, HIGHLIGHTED_POINT_COLOR} from '../constants.js';

export function updateColor(entity, selected) {
  if (entity.point) {
    entity.point.color = selected ? HIGHLIGHTED_POINT_COLOR : DEFAULT_AOI_COLOR;
    return;
  }
  const entityType = entity.polygon ? 'polygon' : 'polyline';
  entity[entityType].material = selected ? HIGHLIGHTED_AOI_COLOR : DEFAULT_AOI_COLOR;
}

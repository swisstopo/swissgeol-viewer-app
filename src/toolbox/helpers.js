import {
  HIGHLIGHTED_AOI_COLOR,
  DEFAULT_AOI_COLOR,
  CESIUM_NOT_GRAPHICS_ENTITY_PROPS, CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD
} from '../constants.js';

export function updateColor(entity, selected) {
  if (entity.billboard) {
    return;
  }
  const entityType = entity.polygon ? 'polygon' : 'polyline';
  entity[entityType].material = selected ? HIGHLIGHTED_AOI_COLOR : DEFAULT_AOI_COLOR;
}

export function cleanupUploadedEntity(entity) {
  const availableProps = [...CESIUM_NOT_GRAPHICS_ENTITY_PROPS, ...CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD];
  const invalidProps = entity.propertyNames.filter(prop => !availableProps.includes(prop));
  invalidProps.forEach(prop => {
    entity[prop] = undefined;
  });
  return entity;
}

export function getUploadedAreaType(entity) {
  for (const geometry of CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD) {
    if (entity[geometry] !== undefined) {
      return geometry === 'polyline' ? 'line' : geometry;
    } else if (entity.position) {
      return 'point';
    }
  }
  return undefined;
}

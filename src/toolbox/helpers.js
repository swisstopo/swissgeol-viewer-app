import {
  CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD
} from '../constants';
import Cartographic from 'cesium/Source/Core/Cartographic';

export function getUploadedEntityType(entity) {
  for (const geometry of CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD) {
    if (entity[geometry] !== undefined) {
      return geometry === 'polyline' ? 'line' : geometry;
    }
  }
  return entity.position ? 'point' : undefined;
}

export function updateBoreholeHeights(entity, date) {
  const depth = entity.properties.depth ? entity.properties.depth.getValue() : undefined;
  if (depth) {
    const position = entity.position.getValue(date);
    const height = Cartographic.fromCartesian(position).height;
    entity.ellipse.extrudedHeight = height;
    entity.ellipse.height = height - depth;
  }
}

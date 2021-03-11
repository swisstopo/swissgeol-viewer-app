import {
  HIGHLIGHTED_AOI_COLOR,
  DEFAULT_AOI_COLOR,
  CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD, DEFAULT_AOI_VOLUME_COLOR
} from '../constants.js';
import Cartographic from 'cesium/Source/Core/Cartographic';

export function updateColor(entity, selected) {
  if (entity.billboard) {
    return;
  }
  if (entity.polylineVolume && entity.polylineVolume.show) {
    const color = selected ? HIGHLIGHTED_AOI_COLOR : DEFAULT_AOI_VOLUME_COLOR;
    entity.polylineVolume.material = color;
    entity.polylineVolume.outlineColor = color;
  }
  const entityType = entity.polygon ? 'polygon' : 'polyline';
  entity[entityType].material = selected ? HIGHLIGHTED_AOI_COLOR : DEFAULT_AOI_COLOR;
}

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

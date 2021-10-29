import {
  CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD
} from '../constants';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {Entity, JulianDate} from 'cesium';

export function getUploadedEntityType(entity: Entity) {
  for (const geometry of CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD) {
    if (entity[geometry] !== undefined) {
      return geometry === 'polyline' ? 'line' : geometry;
    }
  }
  return entity.position ? 'point' : undefined;
}

export function updateBoreholeHeights(entity: Entity, date: JulianDate) {
  if (!entity || !entity.position || !entity.properties || !entity.ellipse) return;
  const depth = entity.properties.depth ? entity.properties.depth.getValue() : undefined;
  if (depth) {
    const position = entity.position.getValue(date);
    const height = Cartographic.fromCartesian(position).height;
    entity.ellipse.extrudedHeight = <any>height;
    entity.ellipse.height = <any>(height - depth);
  }
}

import {
  CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD, DEFAULT_VOLUME_HEIGHT_LIMITS
} from '../constants';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {Entity, Globe, JulianDate} from 'cesium';
import {updateHeightForCartesianPositions} from '../cesiumutils';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {calculateBoxHeight} from '../slicer/helper';

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

export function getAreaPositions(area: Entity, julianDate: JulianDate) {
  if (area.polygon && area.polygon.hierarchy) {
    return area.polygon.hierarchy.getValue(julianDate).positions;
  } else if (area.polyline && area.polyline.positions) {
    return area.polyline.positions.getValue(julianDate);
  } else if (area.billboard && area.position) {
    return [area.position.getValue(julianDate)];
  }
  return undefined;
}

export function updateVolumePositions(entity, positions: Cartesian3[], globe: Globe) {
  const volumeHeightLimits = entity.properties.volumeHeightLimits.getValue();
  let midLowerLimit = 0;
  positions.forEach(p => {
    const cartographicPosition = Cartographic.fromCartesian(p);
    const altitude = globe.getHeight(cartographicPosition) || 0;
    midLowerLimit += volumeHeightLimits.lowerLimit + altitude;
  });
  midLowerLimit /= positions.length;
  entity.polylineVolume.positions = updateHeightForCartesianPositions(positions, midLowerLimit);
  entity.polylineVolume.shape = [
    new Cartesian2(0, 0),
    new Cartesian2(0, 0),
    new Cartesian2(1, 0),
    new Cartesian2(0, volumeHeightLimits.height),
  ];
}

export function updateEntityVolume(entity: Entity, julianDate: JulianDate, globe: Globe) {
  if (!entity || !entity.properties) return;
  const type = entity.properties.type.getValue();
  let positions;
  let volumeHeightLimits = DEFAULT_VOLUME_HEIGHT_LIMITS;
  if (type === 'line') {
    positions = [...entity.polyline!.positions!.getValue(julianDate)];
    entity.polyline!.show = <any>false;
  } else if (type !== 'point') {
    positions = [...entity.polygon!.hierarchy!.getValue(julianDate).positions];
    positions.push(positions[0]);
    entity.polygon!.show = <any>false;
    if (type === 'rectangle') {
      const side1Distance = Cartesian3.distance(positions[0], positions[1]);
      const side2Distance = Cartesian3.distance(positions[1], positions[2]);
      const area = (side1Distance / 1000) * (side2Distance / 1000);
      volumeHeightLimits = calculateBoxHeight(volumeHeightLimits.height, volumeHeightLimits.lowerLimit, area);
    }
  }

  if (!entity.properties.volumeShowed || !entity.properties.volumeHeightLimits) {
    entity.properties.addProperty('volumeHeightLimits', volumeHeightLimits);
    entity.properties.addProperty('volumeShowed', true);
  } else {
    if (!entity.properties.volumeHeightLimits.getValue())
      entity.properties.volumeHeightLimits = volumeHeightLimits;
    entity.properties.volumeShowed = true;
  }

  if (type === 'point') {
    entity.ellipse!.show = <any>true;
    updateBoreholeHeights(entity, julianDate);
  } else {
    updateVolumePositions(entity, positions, globe);
    entity.polylineVolume!.show = <any>true;
  }
}

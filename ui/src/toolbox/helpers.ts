import {CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD, DEFAULT_VOLUME_HEIGHT_LIMITS} from '../constants';
import type {Entity, exportKmlResultKml, Globe, Scene} from 'cesium';
import {
  BoundingSphere,
  exportKml,
  HeadingPitchRange,
  JulianDate,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  EntityCollection} from 'cesium';
import {extendKmlWithProperties, getMeasurements, updateHeightForCartesianPositions} from '../geoblocks/cesium-helpers/cesiumutils';
import {calculateBoxHeight} from '../geoblocks/cesium-helpers/slicer/helper';
import {saveAs} from 'file-saver';
import {translated} from '../i18n';
import type {GeometryTypes, NgmGeometry, SegmentInfo} from './interfaces';
import {cartesianToLv95} from '../projection';

const julianDate = new JulianDate();

export function getUploadedEntityType(entity: Entity): GeometryTypes | undefined {
  for (const geometry of CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD) {
    if (entity[geometry] !== undefined) {
      return geometry === 'polyline' ? 'line' : <GeometryTypes>geometry;
    }
  }
  return entity.position ? 'point' : undefined;
}

export function updateBoreholeHeights(entity: Entity, date: JulianDate) {
  if (!entity || !entity.position || !entity.properties || !entity.ellipse) return;
  const depth = entity.properties.depth ? entity.properties.depth.getValue() : undefined;
  if (depth) {
    const position = entity.position.getValue(date);
    if (!position) return;
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

export function updateEntityVolume(entity: Entity, globe: Globe) {
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

export function hideVolume(entity: Entity) {
  if (entity.billboard) {
    entity.ellipse!.show = <any>false;
  } else {
    if (entity.polyline) {
      entity.polyline!.show = <any>true;
    } else {
      entity.polygon!.show = <any>true;
    }
    entity.polylineVolume!.show = <any>false;
  }
  entity.properties!.volumeShowed = <any>false;
}

export async function downloadGeometry(entity) {
  if (!entity) return;
  const geometries = new EntityCollection();
  const name = entity.name.replace(' ', '_');
  geometries.add(entity);
  const exportResult: exportKmlResultKml = <exportKmlResultKml> await exportKml({
    entities: geometries,
    time: julianDate
  });
  let kml: string = exportResult.kml;
  kml = extendKmlWithProperties(kml, geometries);
  const blob = new Blob([kml], {type: 'application/vnd.google-earth.kml+xml'});
  saveAs(blob, `swissgeol_geometry_${name}.kml`);
}

export function getAreaProperties(entity: Entity, type: GeometryTypes) {
  const props = {};
  if (entity.properties) {
    entity.properties.propertyNames.forEach(propName => {
      const property = entity.properties![propName];
      props[propName] = property ? property.getValue() : undefined;
    });
  }
  if (type === 'point') {
    return {
      ...props,
      type: type
    };
  }
  const positions = type === 'line' ?
    entity.polyline!.positions!.getValue(julianDate) :
    entity.polygon!.hierarchy!.getValue(julianDate).positions;
  const measurements = getMeasurements(positions, type);
  const segmentsLength = measurements.segmentsLength;
  return {
    ...props,
    type: type,
    area: measurements.area?.toFixed(3),
    perimeter: measurements.perimeter?.toFixed(3),
    numberOfSegments: measurements.numberOfSegments,
    sidesLength: [segmentsLength[0], segmentsLength[1]],
  };
}

export function flyToGeom(scene: Scene, entity: Entity, pitch = -(Math.PI / 2), boundingSphereScale = 1) {
  const flyToEntity = (repeat) => {
    let positions = getAreaPositions(entity, julianDate);
    positions = updateHeightForCartesianPositions(positions, undefined, scene);
    const boundingSphere = BoundingSphere.fromPoints(positions, new BoundingSphere());
    boundingSphere.radius *= boundingSphereScale;
    const zoomHeadingPitchRange = new HeadingPitchRange(0, pitch, 0);
    scene.camera.flyToBoundingSphere(boundingSphere, {
      duration: repeat ? 2 : 0,
      offset: zoomHeadingPitchRange,
      complete: () => repeat && flyToEntity(false)
    });
  };
  flyToEntity(true);
}


const GeomTypeMapping = {
  'Point': 'point',
  'LineString': 'line',
  'Polygon': 'polygon',
};

function toCartesian(coordinates: Array<number>): Cartesian3 {
  return Cartesian3.fromDegrees(coordinates[0], coordinates[1], coordinates[2]);
}

const CoordinatesParser = {
  'point': (coordinates) => [toCartesian(coordinates)],
  'line': (coordinates) => coordinates.map(toCartesian),
  'polygon': (coordinates) => coordinates[0].map(toCartesian),
  'rectangle': (coordinates) => coordinates[0].map(toCartesian),
};

export function fromGeoJSON(feature: GeoJSON.Feature): NgmGeometry {
  let type = GeomTypeMapping[feature.geometry.type];
  if (feature.properties?.type === 'rectangle') {
    type = 'rectangle';
  }

  const coordinates = (feature.geometry as GeoJSON.Point | GeoJSON.LineString | GeoJSON.Polygon).coordinates;
  return {
    id: feature.id?.toString(),
    type: type,
    positions: CoordinatesParser[type](coordinates),
    name: feature.properties?.name,
    description: feature.properties?.description ? translated(feature.properties.description) : undefined,
    image: feature.properties?.image,
    website: feature.properties?.website,
    pointSymbol: feature.properties?.pointSymbol,
    color: feature.properties?.color ? Color.fromCssColorString(feature.properties.color) : undefined
  };
}

/**
 * Class method decorator. Class should have `geometriesDataSource` property.
 * Suspend events until all geometries are updated to reduce the number of requests
 * @param {Function} originalMethod
 * @param _context
 */
export function pauseGeometryCollectionEvents(originalMethod: any, _context: any) {
  return function(this: any, ...args: any[]) {
    if (!this.geometriesDataSource) {
      console.warn('No geometriesDataSource.');
      return originalMethod.apply(this, args);
    }
    this.geometriesDataSource.entities.suspendEvents();
    const result = originalMethod.apply(this, args);
    this.geometriesDataSource.entities.resumeEvents();
    return result;
  };
}

const sketchPoint1 = new Cartographic();
const sketchPoint2 = new Cartographic();
export function getSegmentsInfo(points: Cartesian3[], distances: number[]): SegmentInfo[] {
  return distances.map((dist, indx) => {
    let easting = 0;
    let northing = 0;
    let height = 0;
    if (points[indx + 1]) {
      const cartPosition1 = Cartographic.fromCartesian(points[indx], undefined, sketchPoint1);
      const cartPosition2 = Cartographic.fromCartesian(points[indx + 1], undefined, sketchPoint2);
      const lv95Position1 = cartesianToLv95(points[indx]);
      const lv95Position2 = cartesianToLv95(points[indx + 1]);
      easting = Math.abs(lv95Position2[0] - lv95Position1[0]) / 1000;
      northing = Math.abs(lv95Position2[1] - lv95Position1[1]) / 1000;
      height = Math.abs(cartPosition2.height - cartPosition1.height);
    }
    return {
      length: dist,
      eastingDiff: easting,
      northingDiff: northing,
      heightDiff: height,
    };
  });
}

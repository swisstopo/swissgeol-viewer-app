import {
  ArcType,
  BoundingSphere,
  Camera,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  ConstantProperty,
  CustomDataSource,
  DataSource,
  Ellipsoid,
  EntityCollection,
  HeadingPitchRoll,
  HeightReference,
  JulianDate,
  KmlDataSource,
  Math as CMath,
  Matrix3,
  OrientedBoundingBox,
  Plane,
  Rectangle,
  Scene,
  Viewer,
} from 'cesium';
import type { GeometryTypes } from './toolbox/interfaces';
import earcut from 'earcut';
import { DEFAULT_UPLOADED_KML_COLOR } from './constants';

const julianDate = new JulianDate();

export function pickCenter(scene: Scene): Cartesian3 {
  const camera = scene.camera;
  const windowPosition = new Cartesian2(
    scene.canvas.clientWidth / 2,
    scene.canvas.clientHeight / 2,
  );
  const ray = camera.getPickRay(windowPosition);
  if (!ray) return camera.positionWC;
  const center = scene.globe.pick(ray, scene);
  return center !== undefined ? center : camera.positionWC;
}

/**
 * Return the position of the point, on the ellipsoid at the center of the Cesium viewport.
 */
export function pickCenterOnEllipsoid(scene: Scene): Cartesian3 | undefined {
  const camera = scene.camera;
  const windowPosition = new Cartesian2(
    scene.canvas.clientWidth / 2,
    scene.canvas.clientHeight / 2,
  );
  return camera.pickEllipsoid(windowPosition);
}

export function pickPositionOrVoxel(
  scene: Scene,
  windowPosition: Cartesian2,
): Cartesian3 {
  const voxel = scene.pickVoxel(windowPosition);
  if (voxel) {
    return voxel.orientedBoundingBox.center;
  }
  return scene.pickPosition(windowPosition);
}

/**
 * Return the position of the point, on the map or object at the center of the Cesium viewport.
 */
export function pickCenterOnMapOrObject(scene: Scene): Cartesian3 {
  const windowPosition = new Cartesian2(
    scene.canvas.clientWidth / 2,
    scene.canvas.clientHeight / 2,
  );
  return pickPositionOrVoxel(scene, windowPosition);
}

export function verticalDirectionRotate(camera: Camera, angle: number) {
  const position = Cartesian3.normalize(camera.position, new Cartesian3());
  const up = Cartesian3.normalize(camera.up, new Cartesian3());

  const pitch = CMath.toDegrees(camera.pitch);
  if (pitch < -90 || pitch > 0) {
    angle = -angle;
  }

  const tangent = Cartesian3.cross(up, position, new Cartesian3());
  camera.rotate(tangent, angle);
}

function getPolygonArea(positions: Cartesian3[], holes: number[] = []): number {
  const indices = triangulate(positions, holes);
  let area = 0;

  for (let i = 0; i < indices.length; i += 3) {
    const vector1 = positions[indices[i]];
    const vector2 = positions[indices[i + 1]];
    const vector3 = positions[indices[i + 2]];
    //triangle sides
    const a = Cartesian3.distance(vector3, vector2);
    const b = Cartesian3.distance(vector1, vector3);
    const c = Cartesian3.distance(vector1, vector2);
    const p = (a + b + c) / 2;
    const triangleArea = Math.sqrt((p - a) * (p - b) * (p - c) * p);

    area += triangleArea;
  }
  return area * Math.pow(10, -6);
}

export type Measurements = {
  positions: Cartesian3[];
  type: GeometryTypes;
  numberOfSegments: number;
  segmentsLength: number[];
  perimeter?: number;
  area?: number;
};
/**
 * Returns measurements for geometry
 */
export function getMeasurements(
  positions: Cartesian3[],
  type: GeometryTypes,
): Measurements {
  const segmentsLength: number[] = [];
  positions.forEach((p, key) => {
    if (key > 0) {
      segmentsLength.push(Cartesian3.distance(positions[key - 1], p) / 1000);
    }
  });
  const result: Measurements = {
    numberOfSegments: positions.length - 1,
    segmentsLength: segmentsLength.map((l) => Number(l.toFixed(3))),
    positions,
    type,
  };
  let perimeter = segmentsLength.reduce((a, b) => a + b, 0);
  if (type === 'rectangle') {
    perimeter *= 2;
  }
  result.perimeter = perimeter;
  if (type === 'rectangle' || (type === 'polygon' && positions.length > 2)) {
    result.area = getPolygonArea(positions);
  }
  return result;
}

/**
 * Sets height in meters for each cartesian3 position in array
 * @param positions
 * @param [height]
 * @param [scene]
 * @param assignBack assign value to initial position
 */
export function updateHeightForCartesianPositions(
  positions: Cartesian3[],
  height?: number,
  scene?: Scene,
  assignBack: boolean = false,
): Cartesian3[] {
  return positions.map((p) => {
    const cartographicPosition = Cartographic.fromCartesian(p);
    if (typeof height === 'number' && !isNaN(height))
      cartographicPosition.height = height;
    if (scene) {
      const altitude = scene.globe.getHeight(cartographicPosition) || 0;
      cartographicPosition.height += altitude;
    }
    return assignBack
      ? Cartographic.toCartesian(cartographicPosition, Ellipsoid.WGS84, p)
      : Cartographic.toCartesian(cartographicPosition);
  });
}

/**
 * Update exaggeration for each cartesian3 position in array
 */
export function updateExaggerationForCartesianPositions(
  positions: Cartesian3[],
  exaggeration: number,
): Cartesian3[] {
  return positions.map((p) => {
    const cartographicPosition = Cartographic.fromCartesian(p);
    cartographicPosition.height *= exaggeration;
    return Cartographic.toCartesian(cartographicPosition, Ellipsoid.WGS84, p);
  });
}

/**
 * Creates a straight plane that troughs two provided points
 * @param {Cartesian3} point1
 * @param {Cartesian3} point2
 * @param {boolean} negate - if true changes direction from left on the right
 */
export function planeFromTwoPoints(
  point1: Cartesian3,
  point2: Cartesian3,
  negate: boolean = false,
): Plane {
  const p1p2 = Cartesian3.subtract(point2, point1, new Cartesian3());
  const cross = Cartesian3.cross(point1, p1p2, new Cartesian3());
  const normal = Cartesian3.normalize(cross, new Cartesian3());
  if (negate) {
    Cartesian3.negate(normal, normal);
  }
  return Plane.fromPointNormal(point1, normal);
}

/**
 * Extend kml for export with entities properties
 * @param {string} kml - kml for export
 * @param {EntityCollection} entities - list of entities for export
 * @return {string}
 */
export function extendKmlWithProperties(
  kml: string,
  entities: EntityCollection,
): string {
  entities.values.forEach((entity) => {
    let kmlProperties = '<ExtendedData>';
    entity.properties!.propertyNames.forEach((prop) => {
      let value = entity.properties![prop]
        ? entity.properties![prop].getValue()
        : undefined;
      if (value !== undefined && value !== null) {
        value = typeof value === 'object' ? JSON.stringify(value) : value;
        kmlProperties += `<Data name="${prop}"><value>${value}</value></Data>`;
      }
    });
    kmlProperties += '</ExtendedData>';
    const placemark = `<Placemark id="${entity.id}">`;
    kml = kml.replace(placemark, `${placemark}${kmlProperties}`);
  });
  return kml;
}

const scratchVector1 = new Cartesian3();
const scratchVector2 = new Cartesian3();
const scratchProjectionVector = new Cartesian3();

/**
 * Calculates point projection on vector from provided points
 */
export function projectPointOntoVector(
  vectorPoint1: Cartesian3,
  vectorPoint2: Cartesian3,
  pointToProject: Cartesian3,
  result: Cartesian3 = new Cartesian3(),
): Cartesian3 {
  Cartesian3.subtract(vectorPoint2, vectorPoint1, scratchVector1);
  Cartesian3.subtract(pointToProject, vectorPoint1, scratchVector2);
  Cartesian3.projectVector(
    scratchVector2,
    scratchVector1,
    scratchProjectionVector,
  );
  return Cartesian3.add(vectorPoint1, scratchProjectionVector, result);
}

const minDifferenceScratch = new Cartesian3();
const maxDifferenceScratch = new Cartesian3();

/**
 * Wrapper for Cartesian3.lerp. Computes position on segment.
 */
export function clampPosition(
  position: Cartesian3,
  minPosition: Cartesian3,
  maxPosition: Cartesian3,
  start: number,
  end: number,
) {
  let distanceScalar = start;
  const minDifference = Cartesian3.subtract(
    minPosition,
    position,
    minDifferenceScratch,
  );
  const min = minDifference.x + minDifference.y + minDifference.z;
  if (min > 0) {
    const maxDifference = Cartesian3.subtract(
      maxPosition,
      position,
      maxDifferenceScratch,
    );
    const max = maxDifference.x + maxDifference.y + maxDifference.z;
    if (max < 0) {
      const maxDistance = Cartesian3.distance(minPosition, maxPosition);
      const distance = Cartesian3.distance(minPosition, position);
      distanceScalar = distance / maxDistance;
      distanceScalar = CMath.clamp(distanceScalar, start, end);
    } else {
      distanceScalar = end;
    }
  }
  Cartesian3.lerp(minPosition, maxPosition, distanceScalar, position);
}

export function projectPointOnSegment(
  point: Cartesian3,
  startPoint: Cartesian3,
  endPoint: Cartesian3,
  start: number,
  end: number,
  height: number,
): Cartesian3 {
  const position = projectPointOntoVector(startPoint, endPoint, point);
  clampPosition(position, startPoint, endPoint, start, end);
  return updateHeightForCartesianPositions([position], height)[0];
}

/**
 * Gets distance to point in percentage and returns cartesian position on the line
 *
 * @param linePositions
 * @param ratio - distance to point in percentage (value from 0 to 1 where 0 first point of the line and 1 is last)
 * @param result
 */
export function getPointOnPolylineByRatio(
  linePositions: Cartesian3[],
  ratio: number,
  result,
) {
  let indx,
    segmentRatio = 0;
  const distances = linePositions.map((pos, indx) => {
    if (indx === 0) return 0;
    return Cartesian3.distance(linePositions[indx - 1], pos);
  });
  const distance = distances.reduce((partialSum, a) => partialSum + a, 0);
  const distanceToPoint = distance * ratio;
  let currDist = 0,
    prevDist = 0;
  for (let i = 1; i < distances.length; i++) {
    currDist += distances[i];
    if (distanceToPoint > prevDist && distanceToPoint <= currDist) {
      const d1 = currDist - prevDist;
      const d2 = distanceToPoint - prevDist;
      segmentRatio = d2 / d1;
      indx = i;
      break;
    }
    prevDist = currDist;
  }

  return indx > 0
    ? Cartesian3.clone(
        projectPointOnSegment(
          result,
          linePositions[indx - 1],
          linePositions[indx],
          segmentRatio,
          segmentRatio,
          0,
        ),
        result,
      )
    : linePositions[0];
}

const axisScratch = new Cartesian3();

/**
 * Returns 1 if 'to' point on left-bottom side of 'from' point or -1 if vice-versa
 * @param {Cartesian3} from
 * @param {Cartesian3} to
 * @return {number}
 */
export function getDirectionFromPoints(from, to) {
  const axisVect = Cartesian3.subtract(from, to, axisScratch);
  const direction = axisVect.x + axisVect.y + axisVect.z;
  return Math.round((1 / direction) * Math.abs(direction));
}

const westPointScratch = new Cartesian3();
const eastPointScratch = new Cartesian3();

/**
 * Returns vector orthogonal to view vector (vector from camera position to position on map)
 * https://user-images.githubusercontent.com/51954170/108503213-abff8580-72bc-11eb-8b75-3385b5fd171e.png
 */
export function getVectorOrthogonalToView(
  viewer: Viewer,
): Cartesian3 | undefined {
  const hpr = new HeadingPitchRoll(viewer.scene.camera.heading, 0.0, 0.0);
  const rotation = Matrix3.fromHeadingPitchRoll(hpr);
  const viewRect = viewer.scene.camera.computeViewRectangle();
  if (!viewRect) return undefined;

  const northwest = Cartographic.toCartesian(Rectangle.northwest(viewRect));
  const southwest = Cartographic.toCartesian(Rectangle.southwest(viewRect));
  const northeast = Cartographic.toCartesian(Rectangle.northeast(viewRect));
  const southeast = Cartographic.toCartesian(Rectangle.southeast(viewRect));

  Cartesian3.midpoint(northwest, southwest, westPointScratch);
  Cartesian3.midpoint(northeast, southeast, eastPointScratch);
  const viewVect = Cartesian3.subtract(
    eastPointScratch,
    westPointScratch,
    new Cartesian3(),
  );
  return Matrix3.multiplyByVector(rotation, viewVect, viewVect);
}

/**
 * Returns left,right points of view rectangle
 */
export function getOrthogonalViewPoints(viewer: Viewer): Cartesian3[] {
  const center = pickCenterOnEllipsoid(viewer.scene);
  if (!center) return [];

  const left = new Cartesian3();
  const right = new Cartesian3();
  const orthogonalVector = getVectorOrthogonalToView(viewer);
  if (!orthogonalVector) return [];

  Cartesian3.divideByScalar(orthogonalVector, 2, orthogonalVector);
  Cartesian3.subtract(center, orthogonalVector, left);
  Cartesian3.add(center, orthogonalVector, right);
  return updateHeightForCartesianPositions([left, right], 0);
}

export function getValueOrUndefined(prop) {
  return prop ? prop.getValue() : undefined;
}

/**
 * Makes the camera look towards a specific point without changing its location
 * @param position
 * @param camera
 */
export function lookAtPoint(position: Cartesian3, camera: Camera) {
  const cameraPosition = camera.position.clone();
  let direction = Cartesian3.subtract(
    position,
    cameraPosition,
    new Cartesian3(),
  );
  direction = Cartesian3.normalize(direction, direction);
  camera.direction = direction;

  // get an "approximate" up vector, which in this case we want to be something like the geodetic surface normal.
  const approxUp = Cartesian3.normalize(cameraPosition, new Cartesian3());

  // cross view direction with approxUp to get a right normal
  let right = Cartesian3.cross(direction, approxUp, new Cartesian3());
  right = Cartesian3.normalize(right, right);
  camera.right = right;

  // cross right with view direction to get an orthonormal up
  let up = Cartesian3.cross(right, direction, new Cartesian3());
  up = Cartesian3.normalize(up, up);
  camera.up = up;
}

/**
 * @param {Entity} entity
 * @return {Color}
 */
export function getEntityColor(entity) {
  if (entity.billboard) {
    return entity.billboard.color.getValue(julianDate);
  } else if (entity.polyline) {
    return entity.polyline.material.getValue(julianDate).color;
  } else if (entity.polygon) {
    return entity.polygon.material.getValue(julianDate).color;
  }
}

/**
 * Checks is point lies within the polygon
 * @param point
 * @param polygonPositions
 */
export function pointInPolygon(
  point: Cartographic,
  polygonPositions: Cartographic[],
): boolean {
  let isInside = false;
  for (
    let i = 0, j = polygonPositions.length - 1;
    i < polygonPositions.length;
    j = i++
  ) {
    const xi = polygonPositions[i].longitude,
      yi = polygonPositions[i].latitude;
    const xj = polygonPositions[j].longitude,
      yj = polygonPositions[j].latitude;

    const isIntersecting =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;
    if (isIntersecting) isInside = !isInside;
  }

  return isInside;
}

/**
 * Triangulate a polygon.
 *
 * @param {Cartesian2[]} positions Cartesian2 array containing the vertices of the polygon
 * @param {Number[]} [holes] An array of the staring indices of the holes.
 * @returns {Number[]} Index array representing triangles that fill the polygon
 */
export function triangulate(positions, holes) {
  const flattenedPositions = Cartesian2.packArray(positions);
  return earcut(flattenedPositions, holes, 2);
}

const scratchBoundingSphere: BoundingSphere = new BoundingSphere();
const scratchPosition = new Cartesian3();
const moveVector3dScratch = new Cartesian3();
const axisVector3dScratch = new Cartesian3();

/**
 * Gets Cartesian3 position and distance in pixels and calculates second Cartesian3 position on passed axes and side
 *
 * @param scene
 * @param firstPoint cartesian3 position of known point
 * @param distancePx distance between points in pixels
 * @param axis configures on which axis second points should be placed (x or y axis according to map rectangle)
 * @param side configures where second point will be placed (left/right or above/below first point)
 */
export function positionFromPxDistance(
  scene: Scene,
  firstPoint: Cartesian3,
  distancePx: number,
  axis: 'x' | 'y' | 'z',
  side: 1 | -1,
) {
  const mapRect = scene.globe.cartographicLimitRectangle;
  scratchBoundingSphere.center = firstPoint;
  const pixelSize = scene.camera.getPixelSize(
    scratchBoundingSphere,
    scene.drawingBufferWidth,
    scene.drawingBufferHeight,
  );
  const distance = distancePx * pixelSize;
  let corners;
  if (axis === 'y') {
    corners = [
      Cartographic.toCartesian(Rectangle.northeast(mapRect)),
      Cartographic.toCartesian(Rectangle.southeast(mapRect)),
    ];
  } else if (axis === 'x') {
    corners = [
      Cartographic.toCartesian(Rectangle.northwest(mapRect)),
      Cartographic.toCartesian(Rectangle.northeast(mapRect)),
    ];
  } else {
    corners = [
      firstPoint,
      updateHeightForCartesianPositions([firstPoint], distance)[0],
    ];
  }
  Cartesian3.midpoint(corners[0], corners[1], scratchPosition);
  const pos = projectPointOnSegment(
    firstPoint,
    corners[0],
    corners[1],
    0,
    1,
    0,
  );
  Cartesian3.subtract(pos, scratchPosition, axisVector3dScratch);
  const scalar3d =
    (distance / Cartesian3.distance(pos, scratchPosition)) * side;
  Cartesian3.multiplyByScalar(
    axisVector3dScratch,
    scalar3d,
    moveVector3dScratch,
  );
  return Cartesian3.add(firstPoint, moveVector3dScratch, new Cartesian3());
}

/**
 * Checks is geometry of part of geometry inside viewport
 */
export function isGeometryInViewport(
  viewer: Viewer,
  positions: Cartesian3[],
): boolean {
  const camera = viewer.camera;
  const frustum = camera.frustum;
  const cullingVolume = frustum.computeCullingVolume(
    camera.position,
    camera.direction,
    camera.up,
  );

  return (
    cullingVolume.computeVisibility(
      OrientedBoundingBox.fromPoints(positions),
    ) !== -1
  );
}

/**
 * Parses KML file with fixes for clampToGround and adding missing properties.
 */
export async function parseKml(
  viewer: Viewer,
  data: File | string,
  dataSource: CustomDataSource,
  clampToGround: boolean,
) {
  const kmlDataSource = await KmlDataSource.load(data, {
    camera: viewer.scene.camera,
    canvas: viewer.scene.canvas,
    clampToGround,
  });
  let name = kmlDataSource.name;
  kmlDataSource.entities.suspendEvents();
  dataSource.entities.suspendEvents();
  for (const ent of kmlDataSource.entities.values) {
    ent.show = true;
    if (!name) {
      name = ent.name!;
    }
    if (ent['point']) {
      const point = ent['point'];
      const color: Color =
        point.color?.getValue(julianDate)?.color || DEFAULT_UPLOADED_KML_COLOR;
      if (color.alpha === 0) {
        color.alpha = 1;
      }
      point.color = new ConstantProperty(color);
      point.pixelSize = point.pixelSize?.getValue(julianDate) || 1;
      point.heightReference = clampToGround
        ? HeightReference.CLAMP_TO_GROUND
        : point.heightReference?.getValue(julianDate);
    }
    if (ent['polygon']) {
      const polygon = ent['polygon'];
      const color: Color =
        polygon.material?.getValue(julianDate)?.color ||
        DEFAULT_UPLOADED_KML_COLOR;
      if (color.alpha === 0) {
        color.alpha = 1;
      }
      polygon.material = new ColorMaterialProperty(color);
      polygon.heightReference = clampToGround
        ? HeightReference.CLAMP_TO_GROUND
        : polygon.heightReference?.getValue(julianDate);
    }
    if (ent['polyline']) {
      const line = ent['polyline'];
      const color: Color =
        line.material?.getValue(julianDate)?.color ||
        DEFAULT_UPLOADED_KML_COLOR;
      if (color.alpha === 0) {
        color.alpha = 1;
      }
      line.arcType = new ConstantProperty(ArcType.GEODESIC);
      line.clampToGround = new ConstantProperty(clampToGround);
      line.material = new ColorMaterialProperty(color);
      line.width = line.width?.getValue(julianDate) || 2;
    }
    dataSource.entities.add(ent);
  }
  dataSource.entities.resumeEvents();

  // TODO: remove this and fix data upload
  return name ?? 'untitled';
}

// workaround to rerender map after dataSources update in requestRenderMode
export async function renderWithDelay(viewer: Viewer) {
  await new Promise<void>((resolve) =>
    setTimeout(() => {
      viewer.scene.requestRender();
      resolve();
    }, 1000),
  );
}

export function updateExaggerationForKmlDataSource(
  dataSource: CustomDataSource | DataSource | undefined,
  exaggeration: number,
  prevExaggeration: number,
) {
  if (dataSource && dataSource.show) {
    dataSource.entities.suspendEvents();
    const exaggerationScale = exaggeration / prevExaggeration;
    dataSource.entities.values.forEach((ent) => {
      if (ent.position) {
        const position = ent.position.getValue(julianDate);
        position &&
          updateExaggerationForCartesianPositions(
            [position],
            exaggerationScale,
          );
        ent.position = new ConstantPositionProperty(position);
      }
      if (ent['polygon']) {
        const polygon = ent['polygon'];
        const hierarchy = polygon?.hierarchy?.getValue(julianDate);
        if (hierarchy?.positions) {
          const positions = updateExaggerationForCartesianPositions(
            hierarchy.positions,
            exaggerationScale,
          );
          polygon.hierarchy = new ConstantProperty({
            holes: [],
            positions,
          });
        }
      }
      if (ent['polyline']) {
        const line = ent['polyline'];
        const positions = line.positions?.getValue(julianDate);
        if (positions) {
          line.positions = new ConstantProperty(
            updateExaggerationForCartesianPositions(
              positions,
              exaggerationScale,
            ),
          );
        }
      }
    });
    dataSource.entities.resumeEvents();
  }
}

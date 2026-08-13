import proj4 from 'proj4';
import type { Cartesian3 } from 'cesium';
import { Cartographic, Math as CMath } from 'cesium';

export enum AllowedCrs {
  WGS84 = 'EPSG:4326',
  LV95 = 'EPSG:2056',
  LV03 = 'EPSG:21781',
}

export function isAllowedCrs(crs: string): crs is AllowedCrs {
  return Object.values(AllowedCrs).includes(crs as AllowedCrs);
}

export type Coordinate = number[];
type CoordinateWithHeight = [number, number, number];
type CoordinateOrNested =
  Coordinate | CoordinateWithHeight | CoordinateOrNested[];

interface GeoJsonGeometry {
  type: string;
  coordinates: CoordinateOrNested;
}

interface GeoJsonFeature {
  type: 'Feature';
  geometry?: GeoJsonGeometry;
  properties?: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
  crs?: {
    properties?: {
      name?: string;
    };
  };
}

type GeoJson = GeoJsonFeatureCollection | GeoJsonFeature | GeoJsonGeometry;

proj4.defs(
  'EPSG:2056',
  '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs',
);

proj4.defs(
  'EPSG:21781',
  '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs',
);

export function degreesToLv95(coordinates: Array<number>): Array<number> {
  return proj4('EPSG:4326', 'EPSG:2056', coordinates.slice());
}

export function radiansToLv95(coordinates: Array<number>): Array<number> {
  const coordinatesInDegrees = coordinates.map((coord) =>
    CMath.toDegrees(coord),
  );
  return proj4('EPSG:4326', 'EPSG:2056', coordinatesInDegrees.slice());
}

export function cartesianToLv95(position: Cartesian3): Array<number> {
  return degreesToLv95(cartesianToDegrees(position));
}

export function cartesianToDegrees(position: Cartesian3): Array<number> {
  const cartographicPosition = Cartographic.fromCartesian(position);
  const lon = CMath.toDegrees(cartographicPosition.longitude);
  const lat = CMath.toDegrees(cartographicPosition.latitude);
  return [lon, lat, cartographicPosition.height];
}

export function lv95ToDegrees(coordinates: Coordinate): Coordinate {
  return proj4('EPSG:2056', 'EPSG:4326', coordinates);
}

export function lv03ToDegrees(coordinates: Coordinate): Coordinate {
  return proj4('EPSG:21781', 'EPSG:4326', coordinates);
}

function getProjectionFunction(
  crs: AllowedCrs,
): (coords: Coordinate) => Coordinate {
  switch (crs) {
    case AllowedCrs.WGS84:
      return (coords) => coords;
    case AllowedCrs.LV95:
      return lv95ToDegrees;
    case AllowedCrs.LV03:
      return lv03ToDegrees;
    default:
      throw new Error(`Unsupported CRS ${crs}`);
  }
}

function reprojectGeoJsonCoordsDeep(
  coords: any,
  projectFn: (coords: Coordinate) => Coordinate,
): CoordinateOrNested {
  if (
    Array.isArray(coords) &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number'
  ) {
    const x = coords[0];
    const y = coords[1];
    const z = coords.length > 2 ? coords[2] : undefined;
    const lonLat = projectFn([x, y]);
    return typeof z === 'number'
      ? [lonLat[0], lonLat[1], z]
      : [lonLat[0], lonLat[1]];
  }
  return Array.isArray(coords)
    ? coords.map((c) => reprojectGeoJsonCoordsDeep(c, projectFn))
    : coords;
}

export function reprojectGeoJsonToWgs84(
  crs: AllowedCrs,
  geojson: GeoJson,
): GeoJson {
  if (crs === AllowedCrs.WGS84) {
    return geojson;
  }

  const projectFn = getProjectionFunction(crs);
  return reprojectGeoJson(geojson, projectFn);
}

export function reprojectGeoJson(
  geojson: GeoJson,
  projectFn: (coords: Coordinate) => Coordinate,
): GeoJson {
  const g = { ...geojson };

  if ('crs' in g) {
    delete g.crs;
  }

  if (g.type === 'FeatureCollection' && 'features' in g) {
    return {
      ...g,
      features: g.features.map((f) => {
        if (f?.geometry?.coordinates) {
          return {
            ...f,
            geometry: {
              ...f.geometry,
              coordinates: reprojectGeoJsonCoordsDeep(
                f.geometry.coordinates,
                projectFn,
              ),
            },
          };
        }
        return f;
      }),
    };
  }

  if (g.type === 'Feature' && 'geometry' in g && g.geometry?.coordinates) {
    return {
      ...g,
      geometry: {
        ...g.geometry,
        coordinates: reprojectGeoJsonCoordsDeep(
          g.geometry.coordinates,
          projectFn,
        ),
      },
    };
  }

  if ('coordinates' in g) {
    return {
      ...g,
      coordinates: reprojectGeoJsonCoordsDeep(g.coordinates, projectFn),
    };
  }

  return g;
}

export function round(coordinates: Array<number>): Array<number> {
  return coordinates.map(Math.round);
}

const swissIntegerFormat = new Intl.NumberFormat('de-CH', {
  maximumFractionDigits: 1,
});

export function formatCartographicAs2DLv95(carto: Cartographic): Array<string> {
  return proj4('EPSG:4326', 'EPSG:2056', [
    (carto.longitude * 180) / Math.PI,
    (carto.latitude * 180) / Math.PI,
  ])
    .map((num: number) => Number(num.toFixed(1)))
    .map(swissIntegerFormat.format);
}

export const radToDeg = (rad) =>
  (Math.round((100000 * rad * 180) / Math.PI) / 100000).toFixed(5);

export function formatCartesian3AsLv95(position: Cartesian3): Array<string> {
  return cartesianToLv95(position)
    .map((c: number) => Number(c.toFixed(1)))
    .map(swissIntegerFormat.format);
}

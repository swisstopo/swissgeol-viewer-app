import CSVParser from 'papaparse';
import {SWITZERLAND_RECTANGLE} from './constants';
import {Viewer, Ellipsoid, HeadingPitchRange, BoundingSphere} from 'cesium';

/**
 * @return {URLSearchParams}
 */
export function getURLSearchParams() {
  return new URLSearchParams(location.search);
}

/**
 * @param {URLSearchParams} params
 */
export function setURLSearchParams(params) {
  window.history.replaceState({}, '', `${location.pathname}?${params}`);
}

/**
 * @param {string} id
 */
export function clickOnElement(id) {
  document.getElementById(id)?.click();
}

/**
 * @param {string} string
 * @return {string}
 */
export function escapeRegExp(string) {
  return string ? string.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&') : string;
}


/**
 * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
 * @param {function} functionToExecute - executes for each primitive on scene. Gets primitive as the first argument
 */
export function executeForAllPrimitives(viewer, functionToExecute) {
  const primitives = viewer.scene.primitives;
  for (let i = 0, ii = primitives.length; i < ii; i++) {
    const primitive = primitives.get(i);
    functionToExecute(primitive);
  }
}

/**
 * @param {number[]} b1
 * @param {number[]} b2
 * @return {boolean}
 */
export function areBboxIntersectings(b1, b2) {
  /**
   * Instead of relying on bboxes, we could check for the inclusion and
   * intersection of 2 convex polygons. But it may not be worth doing it in JS.
   * See https://raw.githubusercontent.com/davidfig/intersects/master/polygon-polygon.js.
   */
  // this version adapted from Cesium code
  // https://github.com/CesiumGS/cesium/blob/1.76/Source/Core/Rectangle.js#L681
  return (
    Math.max(b1[0], b2[0]) <= Math.min(b1[2], b2[2]) &&
    Math.max(b1[1], b2[1]) <= Math.min(b1[3], b2[3])
  );
}

export function coordinatesToBbox(coordinates) {
  const e = [Infinity, Infinity, -Infinity, -Infinity];
  for (const c of coordinates) {
    if (c[0] < e[0]) {
      e[0] = c[0];
    }
    if (c[1] < e[1]) {
      e[1] = c[1];
    }
    if (c[0] > e[2]) {
      e[2] = c[0];
    }
    if (c[1] > e[3]) {
      e[3] = c[1];
    }
  }
  return e;
}

/**
 * @param {number[]} extent [xmin, ymin, xmax, ymax]
 * @param {number} x
 * @param {number} y
 * @return {boolean} whether [x, y] is inside the extent
 */
export function containsXY(extent, x, y) {
  return extent[0] <= x && x <= extent[2] && extent[1] <= y && y <= extent[3];
}

/**
 *
 * @param {string} str
 * @param {number[]} bbox4326
 * @return {string}
 */
export function filterCsvString(str, bbox4326) {
  const csv = CSVParser.parse(str, {
    header: true,
    skipEmptyLines: 'greedy'
  });

  // find the x and y keys
  const x = csv.meta.fields.find(key => /\w*x4326/.test(key));
  const y = csv.meta.fields.find(key => /\w*y4326/.test(key));

  // filter lines
  const lines = csv.data.filter(line => {
    const x4326 = +line[x].trim();
    const y4326 = +line[y].trim();
    return containsXY(bbox4326, x4326, y4326);
  });

  return CSVParser.unparse({
    fields: csv.meta.fields,
    data: lines
  }, {
    delimiter: csv.meta.delimiter,
    newline: csv.meta.linebreak
  });
}

/**
 * Returns object parsed from string or undefined
 * @param {string} string
 * @returns {object|undefined}
 */
export function parseJson(string) {
  try {
    return JSON.parse(string);
  } catch (e) {
    return undefined;
  }
}

export function interpolateBetweenNumbers(min, max, percent) {
  const diff = max - min;
  return min + ((percent / 100) * diff);
}

export function getPercent(min, max, value) {
  const diff = max - min;
  return value / diff * 100;
}

export async function zoomTo(viewer: Viewer, config): Promise<void> {
  const p = await config.promise;
  if (p.boundingSphere) {
    const switzerlandBS = BoundingSphere.fromRectangle3D(SWITZERLAND_RECTANGLE, Ellipsoid.WGS84);
    let radiusCoef = switzerlandBS.radius / p.boundingSphere.radius;
    radiusCoef = radiusCoef > 3 ? 3 : radiusCoef;
    let boundingSphere = p.boundingSphere;
    const zoomHeadingPitchRange = new HeadingPitchRange(0, Math.PI / 8, radiusCoef * p.boundingSphere.radius);
    if (radiusCoef <= 1) {
      zoomHeadingPitchRange.range = p.boundingSphere.radius * 0.8;
      zoomHeadingPitchRange.heading = Math.PI / 2;
      boundingSphere = switzerlandBS;
    }
    viewer.camera.flyToBoundingSphere(boundingSphere, {
      duration: 0,
      offset: zoomHeadingPitchRange
    });
  } else {
    viewer.zoomTo(p);
  }
}

export function debounce(f, ms) {
  let isCooldown = false;
  return (...args) => {
    if (isCooldown) return;
    f(...args);
    isCooldown = true;
    setTimeout(() => {
      isCooldown = false;
      f(...args);
    }, ms);
  };

}

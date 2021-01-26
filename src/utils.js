export async function readTextFile(url) {
  const response = await fetch(url);
  try {
    return await response.text();
  } catch (e) {
    console.warn(e);
  }
}


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
  document.getElementById(id).click();
}

/**
 * @param {string} string
 * @return {string}
 */
export function escapeRegExp(string) {
  return string ? string.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&') : string;
}


/**
 * @param viewer
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
  const lines = str.split('\n').filter((l, idx) => {
    if (!l || !l.trim()) {
      // some lines have no content :/
      return false;
    }
    if (idx === 0) {
      return true;
    }
    const columns = l.split(',');
    const x4326 = +columns[3].trim();
    const y4326 = +columns[4].trim();
    const inside = containsXY(bbox4326, x4326, y4326);
    return inside;
  });
  const filteredString = lines.join('\n');
  return filteredString;
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

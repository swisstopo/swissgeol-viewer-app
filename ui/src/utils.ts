import CSVParser from 'papaparse';
import type {Viewer} from 'cesium';

export function getURLSearchParams(): URLSearchParams {
  return new URLSearchParams(location.search);
}

export function setURLSearchParams(params: URLSearchParams) {
  window.history.replaceState({}, '', `${location.pathname}?${params}`);
}

export function clickOnElement(id: string) {
  document.getElementById(id)?.click();
}

export function escapeRegExp(string: string) {
  return string ? string.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&') : string;
}

export function executeForAllPrimitives(viewer: Viewer, functionToExecute: (primitive: any) => void) {
  const primitives = viewer.scene.primitives;
  for (let i = 0, ii = primitives.length; i < ii; i++) {
    const primitive = primitives.get(i);
    if (primitive.ready || !primitive.readyPromise)
      functionToExecute(primitive);
    else
      primitive.readyPromise.then(() => functionToExecute(primitive));
  }
}

export function areBboxIntersecting(b1: number[], b2: number[]): boolean {
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

export function coordinatesToBbox(coordinates: number[][]): number[] {
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

export function containsXY(extent: number[], x: number, y: number): boolean {
  return extent[0] <= x && x <= extent[2] && extent[1] <= y && y <= extent[3];
}

export function filterCsvString(str: string, bbox4326: number[]): string {
  const csv = CSVParser.parse(str, {
    header: true,
    skipEmptyLines: 'greedy'
  });

  // find the x and y keys
  const x = csv.meta.fields.find((key: string) => /\w*x4326/.test(key));
  const y = csv.meta.fields.find((key: string) => /\w*y4326/.test(key));

  // filter lines
  const lines = csv.data.filter((line: string) => {
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

export function parseJson(string: string | null): Record<string, any> | undefined {
  if (!string) return undefined;
  try {
    return JSON.parse(string);
  } catch (_e) {
    return undefined;
  }
}

export function interpolateBetweenNumbers(min: number, max: number, percent: number): number {
  const diff = max - min;
  return min + ((percent / 100) * diff);
}

export function getPercent(min: number, max: number, value: number): number {
  const diff = max - min;
  return value / diff * 100;
}

export function debounce(f, ms, skipFirst = false) {
  let isCooldown = false;
  let argumentsArr: any[] = [];
  return (...args) => {
    if (isCooldown) {
      argumentsArr.push([...args]);
      return;
    }
    !skipFirst && f(...args);
    isCooldown = true;
    setTimeout(() => {
      isCooldown = false;
      skipFirst = false;
      const indx = argumentsArr.length - 1;
      if (indx > -1) {
        f(...argumentsArr[indx]);
        argumentsArr = argumentsArr.splice(indx, argumentsArr.length - 1);
      }
    }, ms);
  };
}


export function setBit(num: number, pos: number): number {
  return num | (1 << pos);
}

export function getBit(num: number, pos: number): number {
  return (num & (1 << pos));
}

export function isEmail(email: string | undefined) {
  if (!email) return false;
  const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
  return regex.test(email);
}

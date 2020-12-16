import JSZip from 'jszip';

/**
 * @param {number[]} extent [xmin, ymin, xmax, ymax]
 * @param {number} x
 * @param {number} y
 * @return {boolean} whether [x, y] is inside the extent
 */
export function containsXY(extent, x, y) {
  return extent[0] <= x && x <= extent[2] && extent[1] <= y && y <= extent[3];
}

export function filterCsvString(str, bbox4326) {
  const lines = str.split('\n').filter((l, idx) => {
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
 * @typedef {Object} ZipFromDataItem
 * @property {string} layer
 * @property {string} filename
 * @property {string|ArrayBuffer} content
 */

/**
 * Create a ZIP containing values like:
 * /swissgeol-data/layer_name/filename.ext
 * @param {ZipFromDataItem[]} pieces
 */
export function createZipFromData(pieces) {
  const zip = new JSZip();
  zip.folder('swissgeol-data');
  for (const {layer, filename, content} of pieces) {
    zip.folder(layer).file(filename, content);
  }
  return zip;
}


async function handleCSV(spec, bbox, fetcher) {
  const filename = 'filtered_' + spec.url.substr(spec.url.lastIndexOf('/') + 1);
  const filteredCSV = await fetcher(spec.url)
    .then(r => r.text())
    .then(txt => filterCsvString(txt, bbox));
  return {
    layer: spec.layer,
    filename: filename,
    content: filteredCSV
  };
}


export function isBboxIntersecting(extent1, extent2) {
  // From OL6
  return (
    extent1[0] <= extent2[2] &&
    extent1[2] >= extent2[0] &&
    extent1[1] <= extent2[3] &&
    extent1[3] >= extent2[1]
  );}

export async function getIndex(indices, spec, fetcher) {
  let index = indices[spec.layer];
  if (!index) {
    index = indices[spec.layer] = await fetcher(spec.url)
      .then(r => r.json())
      .then(geojson => geojson.features.map(f => {
        const filename = f.properties.filename;
        // [xmin, ymin, xmax, ymax]
        const e = [Infinity, Infinity, -Infinity, -Infinity];
        for (const c of f.geometry.coordinates[0]) {
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
        const extent = e;
        return {
          filename,
          extent
        };
      }));
  }
  return index;
}

export async function* createIndexedDataGenerator(indices, spec, bbox, fetcher) {
  const index = await getIndex(indices, spec, fetcher);
  const path = spec.url.substr(0, spec.url.lastIndexOf('/'));
  for (const {filename, extent} of index) {
    if (isBboxIntersecting(extent, bbox)) {
      const content = await fetcher(path + '/' + filename).then(r => r.arrayBuffer());
      yield {
        layer: spec.layer,
        filename: filename,
        content: content,
      };
    }
  }
}

export async function* createDataGenerator(specs, bbox, fetcher = fetch) {
  const indices = {};
  for (const spec of specs) {
    switch (spec.type) {
      case 'csv':
        yield await handleCSV(spec, bbox, fetcher);
        break;
      case 'indexed_download':
        for await (const result of createIndexedDataGenerator(indices, spec, bbox, fetcher)) {
          yield result;
        }
        break;
      default:
        throw new Error('Unhandled spec type ' + spec.type);
    }
  }
}


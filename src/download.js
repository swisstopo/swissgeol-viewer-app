import JSZip from 'jszip/dist/jszip.js';
import {coordinatesToBbox, areBboxIntersectings, filterCsvString} from './utils.js';


/**
 * @typedef {Object} DataPiece
 * @property {string} layer
 * @property {string} filename
 * @property {string|ArrayBuffer} content
 */

/**
 * @typedef {Object} DataSpec
 * @property {string} layer
 * @property {string} url
 * @property {('csv'|'indexed_download')} type
 */

/**
 * @typedef {Object} IndexEntry
 * @property {string} filename
 * @property {number[]} extent
 */


/**
 * Create a ZIP containing values like:
 * /swissgeol-data/layer_name/filename.ext
 * @param {DataPiece[]} pieces
 * @return {JSZip}
 */
export function createZipFromData(pieces) {
  const zip = new JSZip();
  const subZip = zip.folder('swissgeol-data');
  for (const {layer, filename, content} of pieces) {
    subZip.folder(layer).file(filename, content);
  }
  return zip;
}


/**
 *
 * @param {DataSpec} spec
 * @param {number[]} bbox
 * @param {fetch} fetcher
 * @return {Promise<DataPiece>}
 */
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


/**
 *
 * @param {Object<string, IndexEntry[]>} indices
 * @param {DataSpec} spec
 * @param {fetch} fetcher
 * @return {Promise<IndexEntry[]>}
 */
export async function getIndex(indices, spec, fetcher) {
  let index = indices[spec.layer];
  if (!index) {
    index = indices[spec.layer] = await fetcher(spec.url)
      .then(r => r.json())
      .then(geojson => geojson.features.map(f => {
        const filename = f.properties.filename;
        // [xmin, ymin, xmax, ymax]
        const extent = coordinatesToBbox(f.geometry.coordinates[0]);
        return {
          filename,
          extent
        };
      }));
  }
  return index;
}

/**
 *
 * @param {Object<string, IndexEntry[]>} indices
 * @param {DataSpec} spec
 * @param {number[]} bbox
 * @param {fetch} fetcher
 * @yields {DataPiece}
 */
export async function* createIndexedDataGenerator(indices, spec, bbox, fetcher) {
  const index = await getIndex(indices, spec, fetcher);
  const path = spec.url.substr(0, spec.url.lastIndexOf('/'));
  for await (const {filename, extent} of index) {
    if (areBboxIntersectings(extent, bbox)) {
      const content = await fetcher(path + '/' + filename).then(r => r.arrayBuffer());
      yield {
        layer: spec.layer,
        filename: filename,
        content: content,
      };
    }
  }
}

/**
 *
 * @param {DataSpec[]} specs
 * @param {number[]} bbox
 * @param {fetch} fetcher
 * @yields {DataPiece}
 */
export async function* createDataGenerator(specs, bbox, fetcher = fetch) {
  const indices = {};
  for await (const spec of specs) {
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

import JSZip from 'jszip/dist/jszip.js';
import {coordinatesToBbox, areBboxIntersecting, filterCsvString} from './utils';


type DataPiece = {
  layer: string,
  filename: string,
  content: string | ArrayBuffer,
}

type DataSpec = {
  layer: string,
  url: string,
  type: string,
}

type IndexEntry = {
  filename: string,
  extent: number[],
}


/**
 * Create a ZIP containing values like: /layer/filename.ext
 * or /filename.ext if all DataPieces belong to the same layer.
 *
 * @param {DataPiece[]} pieces
 * @return {JSZip}
 */
 export function createZipFromData(pieces: DataPiece[]): JSZip {
  const zip = new JSZip();
  const layers = new Set(pieces.map(p => p.layer));
  for (const {layer, filename, content} of pieces) {
    if (layers.size === 1) {
      zip.file(filename, content);
    } else {
      zip.folder(layer).file(filename, content);
    }
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
async function handleCSV(spec: DataSpec, bbox: number[], fetcher: typeof fetch): Promise<DataPiece> {
  const filename = 'filtered_' + spec.url.substring(spec.url.lastIndexOf('/') + 1);
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
async function getIndex(indices: {[s: string]: IndexEntry[];}, spec: DataSpec, fetcher: typeof fetch): Promise<IndexEntry[]> {
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
async function* createIndexedDataGenerator(indices: {[s: string]: IndexEntry[];}, spec: DataSpec, bbox: number[], fetcher: typeof fetch) {
  const index = await getIndex(indices, spec, fetcher);
  const path = spec.url.substring(0, spec.url.lastIndexOf('/'));
  for await (const {filename, extent} of index) {
    if (areBboxIntersecting(extent, bbox)) {
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
 * @param {fetch|null} fetcher
 * @yields {DataPiece}
 */
export async function* createDataGenerator(specs: DataSpec[], bbox: number[], fetcher: typeof fetch | null = fetch) {
  const indices = {};
  for await (const spec of specs) {
    switch (spec.type) {
      case 'csv':
        yield await handleCSV(spec, bbox, fetcher!);
        break;
      case 'indexed_download':
        for await (const result of createIndexedDataGenerator(indices, spec, bbox, fetcher!)) {
          yield result;
        }
        break;
      default:
        throw new Error('Unhandled spec type ' + spec.type);
    }
  }
}

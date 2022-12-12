/* eslint-env node, mocha */

import assert from 'assert';
import {assert as chaiAssert} from 'chai';
import {createDataGenerator, createZipFromData} from '../download';
import {areBboxIntersecting, containsXY, filterCsvString} from '../utils';

// see https://stackoverflow.com/questions/58668361/how-can-i-convert-an-async-iterator-to-an-array
async function toArray<T>(asyncIterator: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const i of asyncIterator) arr.push(i);
  return arr;
}

describe('Download', () => {

  describe('containsXY', () => {
    it('works', () => {
      const extent = [0, 20, 5, 25];
      assert.ok(containsXY(extent, 0, 20));
      assert.ok(containsXY(extent, 5, 25));
      assert.ok(containsXY(extent, 2, 22));
      assert.ok(!containsXY(extent, 50, 100));
      assert.ok(!containsXY(extent, -5, -10));
    });
  });

  describe('bbox inclusion and intersection', () => {
    const unitBox = [-1, -1, 1, 1];
    it('true if completly inside', () => {
      const tested = [-0.5, -0.5, 0.5, 0.5];
      assert.ok(areBboxIntersecting(unitBox, tested));
    });
    it('false if completly outside', () => {
      const tested = [10, 10, 21, 21];
      assert.ok(!areBboxIntersecting(unitBox, tested));
    });
    it('true if overlapping', () => {
      const tested = [0, 0, 2, 2];
      assert.ok(areBboxIntersecting(unitBox, tested));
    });
  });

  describe('filterCsvString', () => {
    it('return empty CSV if input is empty', () => {
      const result = filterCsvString('', [0, 0, 1, 1]);
      assert.strictEqual(result, '');
    });
    it('skip empty lines', () => {
      const result = filterCsvString('\n', [0, 0, 1, 1]);
      assert.strictEqual(result, '');
    });
    it('skip spaces', () => {
      const result = filterCsvString(' ', [0, 0, 1, 1]);
      assert.strictEqual(result, '');
    });

    it('keep first line', () => {
      const result = filterCsvString('nawak', [0, 0, 1, 1]);
      assert.strictEqual(result, 'nawak\n');
    });

    it('should filter according to bbox', () => {
      const csvString = [
        'index,XCOORD,YCOORD,x4326,y4326,ZCOORDB,ORIGNAME',
        'xx,aa,bb,0,0,inside,èè',
        'xx,aa,bb,0,1,inside,èè',
        'xx,aa,bb,5,0,outside,èè',
      ].join('\n');
      const expectedString = [
        'index,XCOORD,YCOORD,x4326,y4326,ZCOORDB,ORIGNAME',
        'xx,aa,bb,0,0,inside,èè',
        'xx,aa,bb,0,1,inside,èè',
      ].join('\n');
      const result = filterCsvString(csvString, [0, 0, 1, 1]);
      assert.strictEqual(result, expectedString);
    });
  });

  describe('createZipFromData', () => {
    it('should be able to create a good-looking zip file', async () => {
      const zip = createZipFromData([
        {layer: 'the_layer', filename: 'file1.csv', content: 'coco'},
        {layer: 'another_layer', filename: 'file1.dxf', content: 'toto'}
      ]);
      const keys = Object.keys(zip.files).join('|');
      // CSV files are stored in a subdirectory of the layer if there are multiple layers
      chaiAssert.include(keys, 'the_layer/file1.csv');

      const result = await zip.generateAsync({type: 'arraybuffer'});
      chaiAssert.isAtLeast(result.byteLength, 300);
    });
  });

  describe('createDataGenerator', () => {
    it('empty specs', async () => {
      // @ts-ignore
      const data = await toArray(createDataGenerator([], [0, 1, 2, 3], null));
      chaiAssert.isEmpty(data);
    });

    it('CSV specs', async () => {
      const fakeFetchResult = {
        text() {
          const csvString = [
            'index,XCOORD,YCOORD,x4326,y4326,ZCOORDB,ORIGNAME',
            'xx,aa,bb,0,0,inside,èè',
            'xx,aa,bb,0,1,inside,èè',
            'xx,aa,bb,5,0,outside,èè',
          ].join('\n');
          return Promise.resolve(csvString);
        }
      };
      const fetcher = (() => Promise.resolve(fakeFetchResult)) as unknown as typeof fetch;
      const spec = {
        type: 'csv',
        url: 'blabla://some.url/and_path/the_csv.csv',
        layer: 'somelayer1',
      };
      const data = await toArray(createDataGenerator([spec], [0, 0, 1, 1], fetcher));
      chaiAssert.deepEqual(data, [{
        content: 'index,XCOORD,YCOORD,x4326,y4326,ZCOORDB,ORIGNAME\nxx,aa,bb,0,0,inside,èè\nxx,aa,bb,0,1,inside,èè',
        filename: 'filtered_the_csv.csv',
        layer: 'somelayer1',
      }]);
    });

    it('indexed data specs', async () => {
      const fakeIndexFetchResult = {
        json() {
          const fakeIndex = '{"type":"FeatureCollection","name":"faults_footprint_boxed","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[7.5441313,46.7171645],[7.6670099,46.7169855],[7.6678264,46.9098738],[7.5445066,46.9100533],[7.5441313,46.7171645]]]},"properties":{"filename":"Aaretal.ts"}}]}';
          return Promise.resolve(JSON.parse(fakeIndex));
        }
      };

      const fakeTSFetchResult = {
        arrayBuffer() {
          return Promise.resolve(new ArrayBuffer(5));
        }
      };
      const fetcher = (url => {
        if (url === 'blabla://some.url/and_path/the_index.json') {
          return Promise.resolve(fakeIndexFetchResult);
        } else if (url === 'blabla://some.url/and_path/Aaretal.ts') {
          return Promise.resolve(fakeTSFetchResult);
        }
        chaiAssert.fail('Fetcher: unknown URL ' + url);
      }) as unknown as typeof fetch;

      const spec = {
        type: 'indexed_download',
        url: 'blabla://some.url/and_path/the_index.json',
        layer: 'somelayer1',
      };

      const data = await toArray(createDataGenerator([spec], [7, 46, 8, 47], fetcher));
      chaiAssert.deepEqual(data, [{
        content: new ArrayBuffer(5),
        filename: 'Aaretal.ts',
        layer: 'somelayer1',
      }]);
    });

  });
});

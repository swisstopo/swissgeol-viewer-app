import assert from 'assert';
import {round} from './utils';

import {heightToValue, valueToHeight} from '../elements/ngm-cam-configuration';

describe('ngm-cam-configuration', () => {
  describe('heightToValue', () => {
    it('should return value from height', () => {
      assert.equal(round(heightToValue(300000)), 1);
      assert.equal(round(heightToValue(150000)), 0.75);
      assert.equal(round(heightToValue(0)), 0.5);
      assert.equal(round(heightToValue(-18000)), 0.2);
      assert.equal(round(heightToValue(-30000)), 0);
    });
  });

  describe('valueToHeight', () => {
    it('should return height from value', () => {
      assert.equal(round(valueToHeight(1)), 300000);
      assert.equal(round(valueToHeight(0.75)), 150000);
      assert.equal(round(valueToHeight(0.5)), 0);
      assert.equal(round(valueToHeight(0.2)), -18000);
      assert.equal(round(valueToHeight(0)), -30000);
    });
  });
});

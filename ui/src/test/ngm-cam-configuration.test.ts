import assert from 'assert';
import { round } from './utils';

import {
  ABSOLUTE_ELEVATION_MAX,
  ABSOLUTE_ELEVATION_MIN,
  heightToValue,
  valueToHeight,
} from '../elements/ngm-cam-configuration';

describe('ngm-cam-configuration', () => {
  describe('heightToValue', () => {
    it('should return value from height', () => {
      assert.equal(round(heightToValue(ABSOLUTE_ELEVATION_MAX)), 1);
      assert.equal(round(heightToValue(ABSOLUTE_ELEVATION_MAX / 2)), 0.75);
      assert.equal(round(heightToValue(0)), 0.5);
      assert.equal(round(heightToValue(-ABSOLUTE_ELEVATION_MIN * 0.6)), 0.2);
      assert.equal(round(heightToValue(-ABSOLUTE_ELEVATION_MIN)), 0);
    });
  });

  describe('valueToHeight', () => {
    it('should return height from value', () => {
      assert.equal(round(valueToHeight(1)), ABSOLUTE_ELEVATION_MAX);
      assert.equal(round(valueToHeight(0.75)), ABSOLUTE_ELEVATION_MAX / 2);
      assert.equal(round(valueToHeight(0.5)), 0);
      assert.equal(round(valueToHeight(0.2)), -ABSOLUTE_ELEVATION_MIN * 0.6);
      assert.equal(round(valueToHeight(0)), -ABSOLUTE_ELEVATION_MIN);
    });
  });
});

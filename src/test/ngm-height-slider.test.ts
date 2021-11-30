import assert from 'assert';
import {round} from './utils';
import {heightToValue, valueToHeight} from '../elements/ngm-height-slider';

describe('ngm-height-slider', () => {
  describe('heightToValue', () => {
    it('should return value from height', () => {
      assert.equal(round(heightToValue(30000)), 2.68);
      assert.equal(round(heightToValue(0)), 1.35);
      assert.equal(round(heightToValue(-18000)), 0.54);
      assert.equal(round(heightToValue(-30000)), 0);
    });
  });

  describe('valueToHeight', () => {
    it('should return height from value', () => {
      assert.equal(round(valueToHeight(3), 0), 300000);
      assert.equal(round(valueToHeight(1.35), 0), 0);
      assert.equal(round(valueToHeight(0.54), 0), -18000);
      assert.equal(round(valueToHeight(0), 0), -30000);
    });
  });
});

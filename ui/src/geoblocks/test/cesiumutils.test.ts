import {Cartographic} from 'cesium';
import assert from 'assert';
import {pointInPolygon} from '../cesium-helpers/cesiumutils';

describe('cesiumutils', () => {
  it('pointInPolygon', () => {
    const pointOut = new Cartographic(0.13465633189595935, 0.8213472012085337);
    const pointIn = new Cartographic(0.133554459808144, 0.8136780538021509);
    const polygon = [
      new Cartographic(0.13129664065348745, 0.8154271621950616),
      new Cartographic(0.13593782281119837, 0.8157959387045614),
      new Cartographic(0.13271661636675128, 0.809966430655292),
    ];
    assert(!pointInPolygon(pointOut, polygon));
    assert(pointInPolygon(pointIn, polygon));
  });
});

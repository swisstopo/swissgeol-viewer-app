import {
    Cartesian3,
    Cartographic,
    Transforms,
    Matrix4,
  } from 'cesium';

function getEastNorthUpTransform(tileset, relativeHeight) {
    let origin = tileset.boundingSphere.center;
    console.log('bounding sphere z', origin.z);
    const cartographic = Cartographic.fromCartesian(origin);
    console.log('cartographic height', cartographic.height);
    cartographic.height = relativeHeight;
    console.log('cartographic relative height', cartographic.height);
    origin = Cartographic.toCartesian(cartographic);
    const enu = Transforms.eastNorthUpToFixedFrame(origin);
    return enu;
}

export function getScaleTransform(tileset, scale, relativeHeight) {
    const toGlobal = getEastNorthUpTransform(tileset, relativeHeight);
    const toLocal = Matrix4.inverse(toGlobal, new Matrix4());
    const localScale = new Cartesian3(1.0, 1.0, scale);
    const localScaleMatrix = Matrix4.fromScale(localScale);
    const transform = Matrix4.multiply(toGlobal, Matrix4.multiply(localScaleMatrix, toLocal, new Matrix4()), new Matrix4());
    return transform;
}
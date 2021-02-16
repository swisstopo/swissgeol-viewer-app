import Cartographic from 'cesium/Source/Core/Cartographic';
import {radiansToLv95} from '../projection';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';

export function getOffsetForPrimitive(primitive, bboxCenter) {
  const tileCenter = Cartographic.fromCartesian(primitive.boundingSphere.center);
  const cartCenter = Cartographic.fromCartesian(bboxCenter);
  const lv95Center = radiansToLv95([cartCenter.longitude, cartCenter.latitude]);
  const lv95Tile = radiansToLv95([tileCenter.longitude, tileCenter.latitude]);
  const offsetX = lv95Center[1] - lv95Tile[1];
  const offsetY = lv95Center[0] - lv95Tile[0];

  const transformCenter = Matrix4.getTranslation(primitive.root.transform, new Cartesian3());
  const transformCartographic = Cartographic.fromCartesian(transformCenter);
  const boundingSphereCartographic = Cartographic.fromCartesian(primitive.boundingSphere.center);
  let offsetZ = boundingSphereCartographic.height;
  if (transformCartographic) {
    offsetZ = transformCartographic.height;
  }
  return {
    offsetX: offsetX,
    offsetY: offsetY,
    offsetZ: offsetZ,
  };
}

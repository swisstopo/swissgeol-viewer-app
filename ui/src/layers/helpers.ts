import EarthquakeVisualizer from '../earthquakeVisualization/earthquakeVisualizer.js';
import {
  IonResource,
  GeoJsonDataSource,
  Cesium3DTileset,
  Cesium3DTileStyle,
  Cartographic,
  LabelStyle,
  Rectangle,
  Cartesian3,
  Ellipsoid,
  Matrix3,
  Matrix4,
  Cesium3DTileColorBlendMode,
  Cesium3DTilesVoxelProvider,
  VoxelPrimitive,
} from 'cesium';
import {getSwisstopoImagery} from '../swisstopoImagery.js';
import {LayerType} from '../constants';
import {isLabelOutlineEnabled} from '../permalink';
import AmazonS3Resource from '../AmazonS3Resource.js';
import type {Viewer} from 'cesium';
import type {Config} from './ngm-layers-item.js';
import {getVoxelShader} from './voxels-helper';

export function createEarthquakeFromConfig(viewer: Viewer, config: Config) {
  const earthquakeVisualizer = new EarthquakeVisualizer(viewer, config);
  if (config.visible) {
    earthquakeVisualizer.setVisible(true);
  }
  config.setVisibility = visible => earthquakeVisualizer.setVisible(visible);
  config.setOpacity = (opacity: number) => earthquakeVisualizer.setOpacity(opacity);
  return earthquakeVisualizer;
}

export function createIonGeoJSONFromConfig(viewer: Viewer, config) {
  return IonResource.fromAssetId(config.assetId)
    .then(resource => GeoJsonDataSource.load(resource))
    .then(dataSource => {
      viewer.dataSources.add(dataSource);
      dataSource.show = !!config.visible;
      config.setVisibility = visible => dataSource.show = !!visible;
      return dataSource;
    });
}


export function create3DVoxelsTilesetFromConfig(viewer: Viewer, config: Config, _): VoxelPrimitive {
  const provider = new Cesium3DTilesVoxelProvider({
    url: config.url!,
  });

  const primitive = new VoxelPrimitive({
    /** @ts-ignore */
    provider: provider,
  });

  primitive.nearestSampling = true;
  primitive.stepSize = 0.37;
  primitive.depthTest = true;
  primitive.show = !!config.visible;

  viewer.scene.primitives.add(primitive);

  config.setVisibility = visible => {
    primitive.show = !!visible;
  };

  primitive.readyPromise.then(() => {
    if (!primitive.provider.names.includes(config.voxelDataName)) {
      throw new Error(`Voxel data name ${config.voxelDataName} not found in the tileset`);
    }
    primitive.customShader = getVoxelShader(config);
  });

  return primitive;
}
export function create3DTilesetFromConfig(viewer: Viewer, config: Config, tileLoadCallback) {
  let resource: string | Promise<IonResource> | AmazonS3Resource;
  if (config.aws_s3_bucket && config.aws_s3_key) {
    resource = new AmazonS3Resource({
      bucket: config.aws_s3_bucket,
      url: config.aws_s3_key,
    });
  } else if (config.url) {
    resource = config.url;
  } else {
    resource = IonResource.fromAssetId(config.assetId!);
  }

  const tileset = new Cesium3DTileset({
    url: resource,
    show: !!config.visible,
    backFaceCulling: false,
    maximumScreenSpaceError: tileLoadCallback ? Number.NEGATIVE_INFINITY : 16, // 16 - default value
  });

  if (config.style) {
    if (config.layer === 'ch.swisstopo.swissnames3d.3d') { // for performance testing
      config.style.labelStyle = isLabelOutlineEnabled() ? LabelStyle.FILL_AND_OUTLINE : LabelStyle.FILL;
    }
    tileset.style = new Cesium3DTileStyle(config.style);
  }

  (tileset as any).pickable = config.pickable !== undefined ? config.pickable : false;
  viewer.scene.primitives.add(tileset);

  config.setVisibility = visible => {
    tileset.show = !!visible;
  };

  if (!config.opacityDisabled) {
    config.setOpacity = opacity => {
      const style = config.style;
      if (style && (style.color || style.labelColor)) {
        const {propertyName, colorType, colorValue} = styleColorParser(style);
        const color = `${colorType}(${colorValue}, ${opacity})`;
        tileset.style = new Cesium3DTileStyle({...style, [propertyName]: color});
      } else {
        const color = `color("white", ${opacity})`;
        tileset.style = new Cesium3DTileStyle({...style, color});
      }
    };
    config.setOpacity(config.opacity ? config.opacity : 1);
  }

  if (tileLoadCallback) {
    const removeTileLoadListener = tileset.tileLoad.addEventListener(tile => tileLoadCallback(tile, removeTileLoadListener));
  }

  tileset.readyPromise.then(() => {
    if (config.propsOrder) {
      tileset.properties.propsOrder = config.propsOrder;
    }
    if (config.heightOffset) {
      const cartographic = Cartographic.fromCartesian(tileset.boundingSphere.center);
      const surface = Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0.0);
      const offset = Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, config.heightOffset);
      const translation = Cartesian3.subtract(offset, surface, new Cartesian3());
      tileset.modelMatrix = Matrix4.fromTranslation(translation);
      viewer.scene.requestRender();
    }
  });
  // for correct highlighting
  tileset.colorBlendMode = Cesium3DTileColorBlendMode.REPLACE;
  return tileset;
}

export function createSwisstopoWMTSImageryLayer(viewer: Viewer, config: Config) {
  let layer = {} as any;
  config.setVisibility = visible => layer.show = !!visible;
  config.setOpacity = opacity => layer.alpha = opacity;
  config.remove = () => viewer.scene.imageryLayers.remove(layer, false);
  config.add = (toIndex) => {
    const layersLength = viewer.scene.imageryLayers.length;
    if (toIndex > 0 && toIndex < layersLength) {
      const imageryIndex = layersLength - toIndex;
      viewer.scene.imageryLayers.add(layer, imageryIndex);
      return;
    }
    viewer.scene.imageryLayers.add(layer);
  };

  return getSwisstopoImagery(config.layer!, config.maximumLevel).then(l => {
    layer = l;
    viewer.scene.imageryLayers.add(layer);
    layer.alpha = config.opacity || 1;
    layer.show = !!config.visible;
    return layer;
  });
}


export function createCesiumObject(viewer: Viewer, config: Config, tileLoadCallback?) {
  const factories = {
    [LayerType.ionGeoJSON]: createIonGeoJSONFromConfig,
    [LayerType.tiles3d]: create3DTilesetFromConfig,
    [LayerType.voxels3dtiles]: create3DVoxelsTilesetFromConfig,
    [LayerType.swisstopoWMTS]: createSwisstopoWMTSImageryLayer,
    [LayerType.earthquakes]: createEarthquakeFromConfig,
  };
  return factories[config.type!](viewer, config, tileLoadCallback);
}

function styleColorParser(style: any) {
  const propertyName = style.color ? 'color' : 'labelColor';
  let colorType = style[propertyName].slice(0, style[propertyName].indexOf('('));
  const lastIndex = colorType === 'rgba' ? style[propertyName].lastIndexOf(',') : style[propertyName].indexOf(')');
  const colorValue = style[propertyName].slice(style[propertyName].indexOf('(') + 1, lastIndex);
  colorType = colorType === 'rgb' ? 'rgba' : colorType;
  return {propertyName, colorType, colorValue};
}


export function getBoxFromRectangle(rectangle: Rectangle, height: number, result: Cartesian3 = new Cartesian3()): Cartesian3 {
  const sw = Cartographic.toCartesian(Rectangle.southwest(rectangle, new Cartographic()));
  const se = Cartographic.toCartesian(Rectangle.southeast(rectangle, new Cartographic()));
  const nw = Cartographic.toCartesian(Rectangle.northwest(rectangle, new Cartographic()));
  result.x = Cartesian3.distance(sw, se); // gets box width
  result.y = Cartesian3.distance(sw, nw); // gets box length
  result.z = height;
  return result;
}

/**
 * Returns rectangle from width height and center point
 */
export function calculateRectangle(width: number, height: number, center: Cartesian3, result: Rectangle = new Rectangle()): Rectangle {
  const w = new Cartesian3(center.x, center.y - width / 2, center.z);
  result.west = Ellipsoid.WGS84.cartesianToCartographic(w).longitude;
  const s = new Cartesian3(center.x + height / 2, center.y, center.z);
  result.south = Ellipsoid.WGS84.cartesianToCartographic(s).latitude;
  const e = new Cartesian3(center.x, center.y + width / 2, center.z);
  result.east = Ellipsoid.WGS84.cartesianToCartographic(e).longitude;
  const n = new Cartesian3(center.x - height / 2, center.y, center.z);
  result.north = Ellipsoid.WGS84.cartesianToCartographic(n).latitude;

  return result;
}

/**
 * Calculates box from bounding volume
 */
export function calculateBox(halfAxes: Matrix3, boundingSphereRadius: number, result: Cartesian3 = new Cartesian3()): Cartesian3 {
  const absMatrix = Matrix3.abs(halfAxes, new Matrix3());
  for (let i = 0; i < 3; i++) {
    const column = Matrix3.getColumn(absMatrix, i, new Cartesian3());
    const row = Matrix3.getRow(absMatrix, i, new Cartesian3());
    result.y = result.y + column.x + row.x;
    result.x = result.x + column.y + row.y;
    result.z = result.z + column.z + row.z;
  }
  // scale according to bounding sphere
  const diagonal = Math.sqrt(result.x * result.x + result.y * result.y);
  const radius = boundingSphereRadius;
  const scale = Math.max(diagonal / (radius * 2), (radius * 2) / diagonal);
  result.x = result.x * scale;
  result.y = result.y * scale;
  result.z = result.z > 60000 ? 60000 : result.z;

  return new Cartesian3(result.x, result.y, result.z);
}

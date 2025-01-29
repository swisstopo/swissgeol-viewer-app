import EarthquakeVisualizer from '../earthquakeVisualization/earthquakeVisualizer.js';
import { ImageryLayer, Rectangle, Viewer } from 'cesium';
import {
  Cartesian3,
  Cartographic,
  Cesium3DTileColorBlendMode,
  Cesium3DTileset,
  Cesium3DTileStyle,
  Cesium3DTilesVoxelProvider,
  Ellipsoid,
  GeoJsonDataSource,
  IonResource,
  LabelStyle,
  Matrix3,
  Matrix4,
  VoxelPrimitive,
} from 'cesium';
import { getSwisstopoImagery } from '../swisstopoImagery';
import { LayerType } from '../constants';
import { isLabelOutlineEnabled } from '../permalink';
import AmazonS3Resource from '../AmazonS3Resource.js';
import { getVoxelShader } from './voxels-helper';
import MainStore from '../store/main';
import { LayerConfig } from '../layertree';

export interface PickableCesium3DTileset extends Cesium3DTileset {
  pickable?: boolean;
}
export interface PickableVoxelPrimitive extends VoxelPrimitive {
  pickable?: boolean;
  layer?: string;
}

export async function createEarthquakeFromConfig(
  viewer: Viewer,
  config: LayerConfig,
) {
  const earthquakeVisualizer = new EarthquakeVisualizer(viewer, config);
  if (config.visible) {
    await earthquakeVisualizer.setVisible(true);
  }
  config.setVisibility = (visible) => earthquakeVisualizer.setVisible(visible);
  config.setOpacity = (opacity: number) =>
    earthquakeVisualizer.setOpacity(opacity);
  return earthquakeVisualizer;
}

export function createIonGeoJSONFromConfig(viewer: Viewer, config) {
  return IonResource.fromAssetId(config.assetId)
    .then((resource) => GeoJsonDataSource.load(resource))
    .then((dataSource) => {
      viewer.dataSources.add(dataSource);
      dataSource.show = !!config.visible;
      config.setVisibility = (visible) => (dataSource.show = !!visible);
      return dataSource;
    });
}

export async function create3DVoxelsTilesetFromConfig(
  viewer: Viewer,
  config: LayerConfig,
  _,
): Promise<VoxelPrimitive> {
  const provider = await Cesium3DTilesVoxelProvider.fromUrl(config.url!);

  const primitive: PickableVoxelPrimitive = new VoxelPrimitive({
    provider: provider,
  });

  const searchParams = new URLSearchParams(location.search);
  const stepSize = parseFloat(searchParams.get('stepSize') ?? '1');

  primitive.nearestSampling = true;
  primitive.stepSize = stepSize;
  primitive.depthTest = true;
  primitive.show = !!config.visible;
  primitive.pickable = config.pickable ?? false;
  primitive.layer = config.layer;

  viewer.scene.primitives.add(primitive);

  config.setVisibility = (visible) => {
    if (config.type === LayerType.voxels3dtiles) {
      if (visible) MainStore.addVisibleVoxelLayer(config.layer);
      else MainStore.removeVisibleVoxelLayer(config.layer);
    }
    primitive.show = !!visible;
  };

  if (
    config.voxelDataName &&
    !primitive.provider.names.includes(config.voxelDataName)
  ) {
    throw new Error(
      `Voxel data name ${config.voxelDataName} not found in the tileset`,
    );
  }
  primitive.customShader = getVoxelShader(config);
  return primitive;
}
export async function create3DTilesetFromConfig(
  viewer: Viewer,
  config: LayerConfig,
  tileLoadCallback,
) {
  let resource: string | IonResource | AmazonS3Resource;
  if (config.aws_s3_bucket && config.aws_s3_key) {
    resource = new AmazonS3Resource({
      bucket: config.aws_s3_bucket,
      url: config.aws_s3_key,
    });
  } else if (config.url) {
    resource = config.url;
  } else {
    resource = await IonResource.fromAssetId(config.assetId!, {
      accessToken: config.ionToken,
    });
  }

  const tileset: PickableCesium3DTileset = await Cesium3DTileset.fromUrl(
    resource,
    {
      show: !!config.visible,
      backFaceCulling: false,
      maximumScreenSpaceError: tileLoadCallback ? Number.NEGATIVE_INFINITY : 16, // 16 - default value
    },
  );

  if (config.style) {
    if (config.layer === 'ch.swisstopo.swissnames3d.3d') {
      // for performance testing
      config.style.labelStyle = isLabelOutlineEnabled()
        ? LabelStyle.FILL_AND_OUTLINE
        : LabelStyle.FILL;
    }
    tileset.style = new Cesium3DTileStyle(config.style);
  }

  tileset.pickable = config.pickable ?? false;
  viewer.scene.primitives.add(tileset);

  config.setVisibility = (visible) => {
    tileset.show = !!visible;
  };

  if (!config.opacityDisabled) {
    config.setOpacity = (opacity) => {
      const style = config.style;
      if (style && (style.color || style.labelColor)) {
        const { propertyName, colorType, colorValue } = styleColorParser(style);
        const color = `${colorType}(${colorValue}, ${opacity})`;
        tileset.style = new Cesium3DTileStyle({
          ...style,
          [propertyName]: color,
        });
      } else {
        const color = `color("white", ${opacity})`;
        tileset.style = new Cesium3DTileStyle({ ...style, color });
      }
    };
    config.setOpacity(config.opacity ? config.opacity : 1);
  }

  if (tileLoadCallback) {
    const removeTileLoadListener = tileset.tileLoad.addEventListener((tile) =>
      tileLoadCallback(tile, removeTileLoadListener),
    );
  }

  if (config.propsOrder) {
    tileset.properties.propsOrder = config.propsOrder;
  }
  if (config.heightOffset) {
    const cartographic = Cartographic.fromCartesian(
      tileset.boundingSphere.center,
    );
    const surface = Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      0.0,
    );
    const offset = Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      config.heightOffset,
    );
    const translation = Cartesian3.subtract(offset, surface, new Cartesian3());
    tileset.modelMatrix = Matrix4.fromTranslation(translation);
    viewer.scene.requestRender();
  }
  // for correct highlighting
  tileset.colorBlendMode = Cesium3DTileColorBlendMode.REPLACE;
  return tileset;
}

export async function createSwisstopoWMTSImageryLayer(
  viewer: Viewer,
  config: LayerConfig,
) {
  const layer: ImageryLayer = await getSwisstopoImagery(config);
  config.setVisibility = (visible) => (layer.show = !!visible);
  config.setOpacity = (opacity) => (layer.alpha = opacity);
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
  config.setTime = (time: string) => {
    config.wmtsCurrentTime = time;
    layer.show = false;
    viewer.scene.render();
    setTimeout(() => {
      layer.show = true;
      viewer.scene.render();
    }, 100);
  };
  viewer.scene.imageryLayers.add(layer);
  layer.alpha = config.opacity ?? 1;
  layer.show = !!config.visible;
  return layer;
}

export function createCesiumObject(
  viewer: Viewer,
  config: LayerConfig,
  tileLoadCallback?,
) {
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
  let colorType = style[propertyName].slice(
    0,
    style[propertyName].indexOf('('),
  );
  const lastIndex =
    colorType === 'rgba'
      ? style[propertyName].lastIndexOf(',')
      : style[propertyName].indexOf(')');
  const colorValue = style[propertyName].slice(
    style[propertyName].indexOf('(') + 1,
    lastIndex,
  );
  colorType = colorType === 'rgb' ? 'rgba' : colorType;
  return { propertyName, colorType, colorValue };
}

export function getBoxFromRectangle(
  rectangle: Rectangle,
  height: number,
  result: Cartesian3 = new Cartesian3(),
): Cartesian3 {
  const sw = Cartographic.toCartesian(
    Rectangle.southwest(rectangle, new Cartographic()),
  );
  const se = Cartographic.toCartesian(
    Rectangle.southeast(rectangle, new Cartographic()),
  );
  const nw = Cartographic.toCartesian(
    Rectangle.northwest(rectangle, new Cartographic()),
  );
  result.x = Cartesian3.distance(sw, se); // gets box width
  result.y = Cartesian3.distance(sw, nw); // gets box length
  result.z = height;
  return result;
}

/**
 * Returns rectangle from width height and center point
 */
export function calculateRectangle(
  width: number,
  height: number,
  center: Cartesian3,
  result: Rectangle = new Rectangle(),
): Rectangle {
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
export function calculateBox(
  halfAxes: Matrix3,
  boundingSphereRadius: number,
  result: Cartesian3 = new Cartesian3(),
): Cartesian3 {
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

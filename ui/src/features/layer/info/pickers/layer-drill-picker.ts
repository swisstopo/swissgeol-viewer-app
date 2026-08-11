import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { LayerInfo, LayerInfoAttribute } from '../layer-info.model';
import {
  BoundingSphere,
  Cartesian3,
  Cesium3DTileFeature,
  Cesium3DTileset,
  Color,
  ColorMaterialProperty,
  Entity,
  HeadingPitchRange,
  JulianDate,
  Viewer,
} from 'cesium';
import {
  DRILL_PICK_LENGTH,
  DRILL_PICK_LIMIT,
  GEOMETRY_DATASOURCE_NAME,
  NO_EDIT_GEOMETRY_DATASOURCE_NAME,
  OBJECT_HIGHLIGHT_COLOR,
  OBJECT_ZOOMTO_RADIUS,
} from 'src/constants';
import NavToolsStore from 'src/store/navTools';
import { TemplateResult } from 'lit';
import {
  BaseLayerController,
  getTranslationKeyForLayerAttributeName,
  Layer,
} from 'src/features/layer';
import { Id } from 'src/models/id.model';

const PROPERTIES_TO_EXCLUDE = new Set([
  'color_blue',
  'color_green',
  'color_red',
  'model_feature',
  'm_alias',
  'oname',
  'style_transparency',
]);

export abstract class LayerInfoDrillPicker<
  T extends Layer,
> implements LayerInfoPicker {
  constructor(
    private readonly controller: BaseLayerController<T>,
    private readonly viewer: Viewer,
  ) {}

  get layerId(): Id<T> {
    return this.layer.id as Id<T>;
  }

  protected get layer(): T {
    return this.controller.layer;
  }

  async pick(pick: LayerPickData): Promise<LayerInfo[]> {
    const feature = this.pickByDrill(pick);
    if (feature === null) {
      return [];
    }
    if (feature instanceof Cesium3DTileFeature) {
      return this.pickFeature(pick, feature);
    }

    const tileset = (feature as any).content?._tileset as
      Cesium3DTileset | undefined;
    if (tileset !== undefined && 'metadata' in tileset) {
      return this.pickFeatureForNewTileset(pick, tileset);
    }
    if (
      typeof feature === 'object' &&
      'primitive' in feature &&
      'id' in feature &&
      feature.id instanceof Entity
    ) {
      return this.pickEntity(feature.id, feature.primitive as object);
    }
    console.warn(
      `Picked unsupported object on layer '${this.controller.layer.id}'. It will be ignored.`,
      feature,
    );
    return [];
  }

  destroy(): void {
    // Nothing to do here.
  }

  abstract get orderOfProperties(): string[];

  private pickFeature(
    pick: LayerPickData,
    feature: Cesium3DTileFeature,
  ): LayerInfo[] {
    const attributes = extractFeatureAttributes(
      feature,
      this.layer,
      this.orderOfProperties,
    );
    return [
      new LayerInfoForFeature(this.viewer, {
        feature,
        position: pick.globePosition.cartesian,
        attributes,
        layerId: this.controller.layer.id,
        title: `layers:layers.${this.controller.layer.id}`,
      }),
    ];
  }

  private pickFeatureForNewTileset(
    pick: LayerPickData,
    tileset: Cesium3DTileset,
  ) {
    const attributes: LayerInfoAttribute[] = extractTilesetAttributes(
      tileset,
      this.layer,
      this.orderOfProperties,
    );
    return [
      new LayerInfoForFeature(this.viewer, {
        feature: tileset,
        position: pick.globePosition.cartesian,
        attributes,
        layerId: this.controller.layer.id,
        title:
          this.controller.layer.label ??
          `layers:layers.${this.controller.layer.id}`,
      }),
    ];
  }

  private pickEntity(entity: Entity, primitive: object): LayerInfo[] {
    if (primitive?.['allowPicking'] === false) {
      return [];
    }

    const attributes = extractEntityAttributes(
      this.viewer,
      entity,
      this.orderOfProperties,
    );
    if (attributes.length === 0) {
      return [];
    }
    return [
      new LayerInfoForEntity(this.viewer, {
        entity,
        attributes,
        layerId: this.layerId,
        title:
          this.controller.layer.label ??
          `layers:layers.${this.controller.layer.id}`,
      }),
    ];
  }

  private pickByDrill(pick: LayerPickData): unknown | null {
    const objects = this.viewer.scene.drillPick(
      pick.windowPosition,
      DRILL_PICK_LIMIT,
      DRILL_PICK_LENGTH,
      DRILL_PICK_LENGTH,
    );
    if (objects.length === 0) {
      return null;
    }

    const slicerDataSource = this.viewer.dataSources.getByName('slicer')[0];
    if (slicerDataSource === undefined) {
      return null;
    }

    const first = objects[0];
    if (first.id == null || !slicerDataSource.entities.contains(first.id)) {
      return first;
    }

    // Selects second object if first is entity related to slicing box and next is not related to slicing box.
    const second = objects[1];
    if (second?.id != null && !slicerDataSource.entities.contains(second.id)) {
      return second;
    }

    return null;
  }
}

class LayerInfoForFeature implements LayerInfo {
  public readonly layerId: Id<Layer>;
  public readonly title: string;
  public readonly attributes: LayerInfoAttribute[];

  private readonly feature: Cesium3DTileFeature | Cesium3DTileset;
  private readonly position: Cartesian3;

  constructor(
    private readonly viewer: Viewer,
    data: Pick<LayerInfo, 'layerId' | 'title' | 'attributes'> & {
      feature: Cesium3DTileFeature | Cesium3DTileset;
      layerId: Id<Layer>;
      position: Cartesian3;
    },
  ) {
    this.feature = data.feature;
    this.position = data.position;
    this.layerId = data.layerId;
    this.title = data.title;
    this.attributes = data.attributes;

    if (this.feature instanceof Cesium3DTileFeature) {
      this.feature.color = OBJECT_HIGHLIGHT_COLOR.withAlpha(
        this.feature.color.alpha,
      );
    } else {
      this.feature.customShader!.setUniform('u_isHighlighted', true);
    }
  }

  zoomToObject(): void {
    NavToolsStore.hideTargetPoint();
    const boundingSphere = new BoundingSphere(
      this.position,
      OBJECT_ZOOMTO_RADIUS,
    );
    const zoomHeadingPitchRange = new HeadingPitchRange(
      0,
      Math.PI / 8,
      boundingSphere.radius,
    );
    this.viewer.scene.camera.flyToBoundingSphere(boundingSphere, {
      duration: 0,
      offset: zoomHeadingPitchRange,
    });
  }

  activateHighlight() {
    // Highlights are not supported here.
  }

  deactivateHighlight() {
    // Highlights are not supported here.
  }

  destroy() {
    if (this.feature instanceof Cesium3DTileFeature) {
      this.feature.color = Color.WHITE;
    } else {
      this.feature.customShader!.setUniform('u_isHighlighted', false);
    }
  }
}

class LayerInfoForEntity implements LayerInfo {
  public readonly layerId: Id<Layer>;
  public readonly title: string;
  public readonly attributes: LayerInfoAttribute[];

  private readonly entity: Entity;
  private readonly geometry: { material: ColorMaterialProperty } | null;

  private readonly originalColor: Color;

  constructor(
    private readonly viewer: Viewer,
    data: Pick<LayerInfo, 'layerId' | 'title' | 'attributes'> & {
      entity: Entity;
      layerId: Id<Layer>;
    },
  ) {
    this.entity = data.entity;
    this.layerId = data.layerId;
    this.title = data.title;
    this.attributes = data.attributes;

    this.geometry = this.findGeometry();
    if (this.geometry === null) {
      this.originalColor = Color.TRANSPARENT;
    } else {
      this.originalColor = Color.clone(
        this.geometry.material.getValue(JulianDate.now()).color,
      );
      this.geometry.material = new ColorMaterialProperty(
        OBJECT_HIGHLIGHT_COLOR.withAlpha(this.originalColor!.alpha),
      );
    }
  }

  private findGeometry(): { material: ColorMaterialProperty } | null {
    for (const value of Object.values(this.entity)) {
      if (
        value !== null &&
        typeof value === 'object' &&
        'material' in value &&
        value.material instanceof ColorMaterialProperty
      ) {
        return value;
      }
    }
    return null;
  }

  zoomToObject(): void {
    const props = this.entity.properties?.getValue(JulianDate.now());
    this.viewer.zoomTo(this.entity, props?.zoomHeadingPitchRange).then();
  }

  activateHighlight() {
    // Highlights are not supported here.
  }

  deactivateHighlight() {
    // Highlights are not supported here.
  }

  destroy() {
    if (this.geometry === null) {
      return;
    }
    this.geometry.material = new ColorMaterialProperty(this.originalColor);
  }
}

const extractFeatureAttributes = (
  feature: Cesium3DTileFeature,
  layer: Layer,
  orderOfProperties: string[],
): LayerInfoAttribute[] => {
  const attributes: LayerInfoAttribute[] = [];
  const propertyNames = sortPropertyNames(
    feature.getPropertyIds(),
    orderOfProperties,
  );
  for (const propertyName of propertyNames) {
    const value = feature.getProperty(propertyName);
    if (typeof value === 'number' || !!value) {
      attributes.push({
        key: getTranslationKeyForLayerAttributeName(layer, propertyName),
        value,
      });
    }
  }
  return attributes;
};

const extractEntityAttributes = (
  viewer: Viewer,
  entity: Entity,
  orderOfProperties: string[],
): LayerInfoAttribute[] => {
  if (entity.properties === undefined) {
    return [];
  }

  const geomDataSource = viewer.dataSources.getByName(
    GEOMETRY_DATASOURCE_NAME,
  )[0];
  const noEditGeomDataSource = viewer.dataSources.getByName(
    NO_EDIT_GEOMETRY_DATASOURCE_NAME,
  )[0];

  if (
    geomDataSource.entities.contains(entity) ||
    noEditGeomDataSource.entities.contains(entity)
  ) {
    // If the entity is a drawing, then we simply show its id.
    return [{ key: 'geomId', value: entity.id }];
  }

  const properties = entity.properties.getValue(
    JulianDate.fromDate(new Date()),
  );
  const sortedPropertyNames = sortPropertyNames(
    Object.keys(properties),
    orderOfProperties,
  );

  const attributes: LayerInfoAttribute[] = [{ key: 'id', value: entity.id }];
  for (const key of sortedPropertyNames) {
    const value = properties[key];
    if (
      typeof value === 'number' ||
      isTemplateResult(value) ||
      (typeof value === 'string' && /[A-Za-z0-9]/g.test(value))
    ) {
      attributes.push({ key, value });
    }
  }
  return attributes;
};

const extractTilesetAttributes = (
  tileset: Cesium3DTileset,
  layer: Layer,
  orderOfProperties: string[],
): LayerInfoAttribute[] => {
  const metadata = tileset['metadata'];
  if (metadata == null) {
    return [];
  }

  const properties: Record<string, unknown> = metadata
    .getPropertyIds()
    .reduce((acc: Record<string, unknown>, id: string) => {
      return {
        ...acc,
        [id]: metadata.getProperty(id)[0],
      };
    }, {});

  const attributes: LayerInfoAttribute[] = [];
  const propertyNames = sortPropertyNames(
    Object.keys(properties),
    orderOfProperties,
  );

  for (const propertyName of propertyNames) {
    const value = properties[propertyName] as any;
    if (
      (typeof value === 'number' || !!value) &&
      !PROPERTIES_TO_EXCLUDE.has(propertyName)
    ) {
      attributes.push({
        key: getTranslationKeyForLayerAttributeName(layer, propertyName),
        value,
      });
    }
  }
  return attributes;
};

const sortPropertyNames = (
  propertyNames: string[],
  orderOfProperties: string[] = [],
): string[] => {
  const lowerPriorityProps = propertyNames
    .filter((prop) => !orderOfProperties.includes(prop))
    .sort((left, right) => {
      const titleLeft = left.toLowerCase();
      const titleRight = right.toLowerCase();
      if (titleLeft === titleRight) {
        return 0;
      }
      return titleLeft > titleRight ? 1 : -1;
    });
  return [...orderOfProperties, ...lowerPriorityProps];
};

/**
 * Whether the passed value follows the lit TemplateResult interface.
 * @param {unknown} value
 * @return {boolean}
 */
const isTemplateResult = (value: unknown): value is TemplateResult => {
  return (
    value !== null &&
    typeof value === 'object' &&
    'strings' in value &&
    'values' in value
  );
};

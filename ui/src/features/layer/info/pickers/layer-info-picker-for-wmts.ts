import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { lv95ToDegrees, radiansToLv95 } from 'src/projection';
import i18next from 'i18next';
import {
  CallbackProperty,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  CustomDataSource,
  Entity,
  HeightReference,
  Viewer,
} from 'cesium';
import {
  OBJECT_HIGHLIGHT_COLOR,
  SWISSTOPO_IT_HIGHLIGHT_COLOR,
} from 'src/constants';
import {
  LayerInfo,
  LayerInfoAttribute,
} from 'src/features/layer/info/layer-info.model';
import { WmtsLayerController } from 'src/features/layer/controllers/layer-wmts.controller';
import { WmtsLayer } from 'src/features/layer';
import { Id } from 'src/models/id.model';
import {
  IdentifiedGeometry,
  IdentifyResult,
  LayerInfoPickerForWmtsService,
} from 'src/features/layer/info/pickers/layer-info-picker-for-wmts.service';

export class LayerInfoPickerForWmts implements LayerInfoPicker {
  private readonly highlights: CustomDataSource;
  private readonly service: LayerInfoPickerForWmtsService;

  constructor(
    private readonly controller: WmtsLayerController,
    private readonly viewer: Viewer,
  ) {
    this.highlights = new CustomDataSource(
      `${this.constructor.name}.${controller.layer.id}`,
    );
    this.service = new LayerInfoPickerForWmtsService(controller.layer);
    this.viewer.dataSources.add(this.highlights).then();
  }

  get layerId(): Id<WmtsLayer> {
    return this.controller.layer.id;
  }

  async pick(pick: LayerPickData): Promise<LayerInfo[]> {
    if (!this.controller.layer.isVisible) {
      return [];
    }

    // Flow:
    // 1) Try geo.admin identify/htmlPopup when supported.
    // 2) If no results, fallback to external WMS GetFeatureInfo.
    // 3) Convert returned geometry + attributes to LayerInfo objects.
    const geom2056 = radiansToLv95([
      pick.globePosition.cartographic.longitude,
      pick.globePosition.cartographic.latitude,
    ]) as [number, number];
    const tolerance = getTolerance(pick.distance);
    const lang = i18next.language;

    const results = this.service.shouldUseGeoAdminIdentify()
      ? await this.service.fetchIdentifyResults(geom2056, tolerance, lang)
      : null;
    if (results != null && results.length > 0) {
      const entities: Array<Promise<LayerInfo>> = [];
      for (const result of results) {
        if (result.geometry == null) {
          continue;
        }
        const entity = this.createEntityForGeometry(result.geometry);
        entities.push(this.getInfoForResult(result, entity));
      }
      return Promise.all(entities);
    }

    // For external (non-geo.admin) layers, or when identify returns no results,
    // fall back to a standard WMS GetFeatureInfo request against the layer's serviceUrl.
    const serviceFeatures = await this.service.fetchServiceFeatureInfo(
      geom2056,
      lang,
    );
    if (serviceFeatures == null || serviceFeatures.length === 0) {
      return [];
    }

    return serviceFeatures.map((feature) => {
      const entity =
        feature.geometry == null
          ? this.createPointEntity(geom2056)
          : this.createEntityForGeometry(feature.geometry);
      return new LayerInfoForWmts(this.viewer, this.highlights, {
        entity,
        title: `layers:layers.${this.controller.layer.id}`,
        layerId: this.controller.layer.id,
        attributes: this.service.mapFeaturePropertiesToAttributes(
          feature.properties,
        ),
      });
    });
  }

  destroy(): void {
    this.viewer.dataSources.remove(this.highlights, true);
  }

  private async getInfoForResult(
    result: IdentifyResult,
    entity: Entity,
  ): Promise<LayerInfoForWmts> {
    const lang = i18next.language;
    const html = await this.service.fetchHtmlPopup(result, lang);
    const attributes = this.service.extractPopupAttributes(html);
    return new LayerInfoForWmts(this.viewer, this.highlights, {
      entity,
      title: `layers:layers.${this.controller.layer.id}`,
      layerId: this.controller.layer.id,
      attributes,
      identifyResult: result,
      service: this.service,
    });
  }

  private createEntityForGeometry(geometry: IdentifiedGeometry): Entity {
    switch (geometry.type) {
      case 'Polygon':
        return this.createPolygonEntity(
          (geometry.coordinates as number[][][])[0],
        );
      case 'MultiPolygon':
        return this.createMultiPolygonEntity(
          geometry.coordinates as number[][][][],
        );
      case 'LineString':
        return this.createLineEntity(geometry.coordinates as number[][]);
      case 'MultiLineString':
        return this.createLineEntity((geometry.coordinates as number[][][])[0]);
      case 'Point':
        return this.createPointEntity(geometry.coordinates as number[]);
      case 'MultiPoint':
        return this.createPointEntity((geometry.coordinates as number[][])[0]);
      default:
        throw new Error(`Unsupported geometry type '${geometry.type}'`);
    }
  }

  private createPolygonEntity(nestedCoordinates: number[][]) {
    const coordinates = nestedCoordinates.map((coords) => {
      const degrees = lv95ToDegrees(coords);
      return Cartesian3.fromDegrees(degrees[0], degrees[1]);
    });
    return new Entity({
      polygon: {
        hierarchy: coordinates,
        material: OBJECT_HIGHLIGHT_COLOR.withAlpha(0.7),
      },
    });
  }

  private createMultiPolygonEntity(nestedCoordinates: number[][][][]) {
    const entity = new Entity();
    for (const coordinates of nestedCoordinates) {
      entity.merge(this.createPolygonEntity(coordinates[0]));
    }
    return entity;
  }

  private createLineEntity(nestedCoordinates: number[][]) {
    const coordinates = nestedCoordinates.map((coords) => {
      const degrees = lv95ToDegrees(coords);
      return Cartesian3.fromDegrees(degrees[0], degrees[1]);
    });
    return new Entity({
      polyline: {
        positions: coordinates,
        material: OBJECT_HIGHLIGHT_COLOR,
        clampToGround: true,
        width: 4,
      },
    });
  }

  private createPointEntity(coords: number[]) {
    const degrees = lv95ToDegrees(coords);
    const coordinates = Cartesian3.fromDegrees(degrees[0], degrees[1]);
    const entity = new Entity({
      position: coordinates,
      point: {
        color: new CallbackProperty(
          (t) =>
            entity.point?.outlineWidth?.getValue(t) === 1
              ? SWISSTOPO_IT_HIGHLIGHT_COLOR
              : Color.TRANSPARENT,
          false,
        ),
        pixelSize: 10,
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        outlineColor: Color.BLACK,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    return entity;
  }
}

class LayerInfoForWmts implements LayerInfo {
  public readonly title: string;
  public readonly layerId: Id<WmtsLayer>;
  public attributes: LayerInfoAttribute[];

  private readonly entity: Entity;
  private readonly identifyResult: IdentifyResult | null;
  private readonly service: LayerInfoPickerForWmtsService | null;

  constructor(
    private readonly viewer: Viewer,
    private readonly dataSource: CustomDataSource,
    data: Pick<LayerInfo, 'layerId' | 'title' | 'attributes'> & {
      entity: Entity;
      layerId: Id<WmtsLayer>;
      identifyResult?: IdentifyResult;
      service?: LayerInfoPickerForWmtsService;
    },
  ) {
    this.entity = data.entity;
    this.title = data.title;
    this.layerId = data.layerId;
    this.attributes = data.attributes;
    this.identifyResult = data.identifyResult ?? null;
    this.service = data.service ?? null;
    this.dataSource.entities.add(this.entity);
  }

  async refreshForLanguage(lang: string): Promise<void> {
    if (this.identifyResult == null || this.service == null) {
      return;
    }
    const html = await this.service.fetchHtmlPopup(this.identifyResult, lang);
    this.attributes = this.service.extractPopupAttributes(html);
  }

  zoomToObject(): void {
    this.viewer.zoomTo(this.entity).then();
  }

  activateHighlight(): void {
    this.viewer.scene.requestRender();

    const { entity } = this;
    if (entity.polygon !== undefined) {
      entity.polygon.material = new ColorMaterialProperty(
        SWISSTOPO_IT_HIGHLIGHT_COLOR,
      );
      return;
    }
    if (entity.polyline !== undefined) {
      entity.polyline.material = new ColorMaterialProperty(
        SWISSTOPO_IT_HIGHLIGHT_COLOR,
      );
      return;
    }
    if (entity.point !== undefined) {
      entity.point.outlineWidth = new ConstantProperty(1);
    }
  }

  deactivateHighlight(): void {
    this.viewer.scene.requestRender();

    const { entity } = this;
    if (entity.polygon !== undefined) {
      entity.polygon.material = new ColorMaterialProperty(
        OBJECT_HIGHLIGHT_COLOR.withAlpha(0.7),
      );
      return;
    }
    if (entity.polyline !== undefined) {
      entity.polyline.material = new ColorMaterialProperty(
        OBJECT_HIGHLIGHT_COLOR,
      );
      return;
    }
    if (entity.point !== undefined) {
      entity.point.outlineWidth = new ConstantProperty(0);
    }
  }

  destroy(): void {
    this.dataSource.entities.remove(this.entity);
  }
}

const getTolerance = (distance: number) => {
  if (distance > 100000) {
    return 300;
  }
  if (distance < 2500) {
    return 20;
  } else {
    return 100;
  }
};

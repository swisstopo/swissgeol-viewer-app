import {
  BaseLayerController,
  LayerStyle,
  LayerType,
  mapLayerSourceToResource,
  Tiles3dLayer,
  Tiles3dLayerController,
} from 'src/features/layer';
import {
  getStyleForProperty,
  createCanvasForBillboard,
} from 'src/features/layer/utils/layer-style.utils';
import { GeoJsonLayer } from 'src/features/layer/models/layer-geojson.model';
import {
  GeoJsonDataSource,
  JulianDate,
  ColorMaterialProperty,
  ConstantProperty,
  Color,
  Entity,
  ClassificationType,
  Cesium3DTileset,
  CustomDataSource,
  HeightReference,
  PropertyBag,
  Cartesian3,
} from 'cesium';
import { DEFAULT_UPLOADED_GEOJSON_COLOR } from 'src/constants';
import { makeId } from 'src/models/id.model';
import {
  GeoJsonFeatureCollection,
  isAllowedCrs,
  reprojectGeoJsonToWgs84,
} from 'src/projection';

export class GeoJsonLayerController extends BaseLayerController<GeoJsonLayer> {
  private dataSource!: CustomDataSource;
  private terrainController!: Tiles3dLayerController | null;

  get type(): LayerType.GeoJson {
    return LayerType.GeoJson;
  }

  /**
   * The tileset representing the geojsons's terrain,
   * or `null`, if the layer does not have a custom terrain.
   */
  get terrain(): Cesium3DTileset | null {
    return this.terrainController?.tileset ?? null;
  }

  zoomIntoView() {
    this.viewer.flyTo(this.dataSource).then();
  }

  moveToTop(): void {
    this.terrainController?.moveToTop();
    this.viewer.dataSources.raiseToTop(this.dataSource);
  }

  protected reactToChanges(): void {
    this.watch(this.layer.source);

    this.watch(this.layer.isVisible, (isVisible) => {
      this.dataSource.show = isVisible;
      if (this.terrainController) {
        this.terrainController
          .update({ ...this.terrainController.layer, isVisible })
          .then();
      }
    });

    this.watch(this.layer.opacity, (opacity) => {
      this.setLayerOpacity(opacity);
    });
  }

  protected async addToViewer(): Promise<void> {
    if (this.layer.terrain) {
      this.terrainController = this.makeTerrainController();
      await this.terrainController.add();
    }

    const resource = await mapLayerSourceToResource(this.layer.source);
    const raw = (await resource.fetchJson()) as GeoJsonFeatureCollection;
    let geoJsonDataSource: GeoJsonDataSource;
    const crsName = raw?.crs?.properties?.name;
    if (crsName && isAllowedCrs(crsName)) {
      const converted = reprojectGeoJsonToWgs84(crsName, raw);
      geoJsonDataSource = await GeoJsonDataSource.load(converted);
    } else {
      geoJsonDataSource = await GeoJsonDataSource.load(resource);
    }

    if (this.dataSource === undefined) {
      this.dataSource = new CustomDataSource();
      await this.viewer.dataSources.add(this.dataSource);
    } else {
      this.dataSource.entities.removeAll();
    }

    const { dataSource } = this;
    dataSource.name = geoJsonDataSource.name;

    geoJsonDataSource.entities.suspendEvents();
    this.dataSource.entities.suspendEvents();

    for (const ent of geoJsonDataSource.entities.values) {
      if (dataSource.name?.length === 0) {
        dataSource.name = ent.name ?? '';
      }
      this.addEntityToDataSource(ent, dataSource);
    }
    dataSource.entities.resumeEvents();
    geoJsonDataSource.entities.resumeEvents();

    this.setLayerOpacity(this.layer.opacity);
  }

  protected removeFromViewer(): void {
    this.terrainController?.remove();
    this.viewer.dataSources.remove(this.dataSource, true);
  }

  private addEntityToDataSource(
    ent: Entity,
    dataSource: CustomDataSource,
  ): Entity[] | void {
    const classificationType = this.terrainController
      ? ClassificationType.CESIUM_3D_TILE
      : ClassificationType.BOTH;
    if (ent.billboard) {
      const billboard = this.createBillboardEntity(ent);
      if (billboard) {
        dataSource.entities.add(billboard);
      }
    }
    if (ent.polyline) {
      const polyline = this.createPolylineEntity(ent, classificationType);
      if (polyline) {
        dataSource.entities.add(polyline);
      }
    }
    if (ent.polygon) {
      const polygonGraphics = this.createPolygonEntity(ent, classificationType);
      if (polygonGraphics) {
        for (const pg of polygonGraphics) {
          dataSource.entities.add(pg);
        }
      }
    }
  }

  private createBillboardEntity(ent: Entity): Entity | void {
    if (!ent.billboard) {
      return;
    }
    const position = ent.position?.getValue(JulianDate.now());
    if (!position) {
      return;
    }

    // LayerStyles defined on the layer should override any styling defined in the GeoJson properties.
    if (this.layer.layerStyle && ent.properties) {
      return this.applyLayerStyleToBillBoardEntity(
        ent.properties,
        this.layer.layerStyle,
        position,
      );
    }

    return new Entity({
      position,
      billboard: {
        image: ent.billboard.image,
        heightReference: HeightReference.CLAMP_TO_TERRAIN,
      },
      properties: ent.properties,
    });
  }

  private createPolylineEntity(
    ent: Entity,
    classificationType: ClassificationType,
  ): Entity | void {
    if (!ent.polyline) {
      return;
    }
    const positions = ent.polyline.positions?.getValue(JulianDate.now());
    if (!positions?.length) {
      return;
    }

    let width = ent.polyline.width?.getValue(JulianDate.now()) ?? 2;
    let material = ent.polyline.material;

    if (this.layer.layerStyle && ent.properties) {
      const style = getStyleForProperty(
        ent.properties,
        this.layer.layerStyle,
        'line',
      );
      if (style) {
        width = style.vectorOptions.stroke?.width ?? 2;
        const color = style.vectorOptions.stroke?.color;
        material = new ColorMaterialProperty(
          color
            ? Color.fromCssColorString(color)
            : DEFAULT_UPLOADED_GEOJSON_COLOR,
        );
      }
    }

    return new Entity({
      polyline: {
        positions,
        classificationType,
        clampToGround: true,
        width,
        material,
      },
      properties: ent.properties,
    });
  }

  private createPolygonEntity(
    ent: Entity,
    classificationType: ClassificationType,
  ): Entity[] | void {
    if (!ent.polygon) {
      return;
    }

    const hierarchy = ent.polygon.hierarchy?.getValue(JulianDate.now());
    if (!hierarchy?.positions?.length) {
      return;
    }

    if (this.layer.layerStyle && ent.properties) {
      const style = getStyleForProperty(
        ent.properties,
        this.layer.layerStyle,
        'polygon',
      );
      if (style) {
        const fillColor = style.vectorOptions.fill?.color;
        const polygon = new Entity({
          polygon: {
            hierarchy,
            classificationType,
            outline: false,
            material: fillColor
              ? new ColorMaterialProperty(Color.fromCssColorString(fillColor))
              : DEFAULT_UPLOADED_GEOJSON_COLOR,
          },
          properties: ent.properties,
        });
        // When clamping a GeoJson to the ground, the borders disappear.
        // This is why we add the borders manually for all Polygon Entities
        const strokeColor = style.vectorOptions.stroke?.color;
        const border = new Entity({
          polyline: {
            classificationType,
            positions: hierarchy.positions,
            clampToGround: true,
            width: style.vectorOptions.stroke?.width ?? 2,
            material: strokeColor
              ? new ColorMaterialProperty(Color.fromCssColorString(strokeColor))
              : DEFAULT_UPLOADED_GEOJSON_COLOR,
          },
          properties: ent.properties,
        });
        return [border, polygon];
      }
    }

    const polygon = new Entity({
      polygon: {
        hierarchy,
        classificationType,
        outline: false,
        material: ent.polygon.material,
      },
      properties: ent.properties,
    });
    // When clamping a GeoJson to the ground, the borders disappear.
    // This is why we add the borders manually for all Polygon Entities
    const border = new Entity({
      polyline: {
        classificationType,
        positions: hierarchy.positions,
        clampToGround: true,
        width: ent.polygon.outlineWidth?.getValue(JulianDate.now()) ?? 2,
        material:
          ent.polygon.outlineColor?.getValue(JulianDate.now()) ??
          DEFAULT_UPLOADED_GEOJSON_COLOR,
      },
      properties: ent.properties,
    });
    return [border, polygon];
  }

  private makeTerrainController(): Tiles3dLayerController {
    return new Tiles3dLayerController(this.makeTiles3dLayer());
  }

  private makeTiles3dLayer(): Tiles3dLayer {
    return {
      type: LayerType.Tiles3d,
      id: makeId(this.layer.id),
      source: this.layer.terrain!,
      isVisible: this.layer.isVisible,
      /*
      We cannot use the same approach as we do with the TIFF layers, where we set isPartiallyTransparent to true and add the Source to the imagery layers,
      because GeoJson layers cannot be added to the tileset's imagery layers.
      That would discard all fragments of the tilesets, including parts that are covered by the GeoJson.
      Instead, we set the opacity to 0, making the tileset fully invisible, but still allowing the GeoJson to be clamped to it.
      */
      opacity: 1,
      canUpdateOpacity: false,
      downloadUrl: null,
      geocatId: null,
      label: null,
      infoBox: null,
      orderOfProperties: [],
      customProperties: {},
      isPartiallyTransparent: false,
      sliceSelection: null,
    };
  }

  private setLayerOpacity(opacity: number): void {
    const { dataSource } = this;
    const now = JulianDate.now();
    for (const ent of dataSource.entities.values) {
      if (ent.billboard) {
        const props = ent.properties?.getValue(now);
        const hex = props?.['marker-color'];
        if (typeof hex === 'string') {
          const color = Color.fromAlpha(Color.fromCssColorString(hex), opacity);
          ent.billboard.color = new ConstantProperty(color);
        }
      }
      if (ent.polygon) {
        const polygon = ent.polygon;
        const base = polygon.material.getValue(now).color;
        polygon.material = new ColorMaterialProperty(
          Color.fromAlpha(base, opacity),
        );
      }
      if (ent.polyline) {
        const line = ent.polyline;
        const base = line.material.getValue(now).color;
        line.material = new ColorMaterialProperty(
          Color.fromAlpha(base, opacity),
        );
      }
    }
  }

  private applyLayerStyleToBillBoardEntity(
    properties: PropertyBag,
    layerStyle: LayerStyle,
    position: Cartesian3,
  ): Entity | void {
    const style = getStyleForProperty(properties, layerStyle, 'point');
    if (!style) {
      return;
    }

    const vectorOptions = style.vectorOptions;
    if (vectorOptions.type === 'icon') {
      return new Entity({
        position,
        billboard: {
          image: vectorOptions.src,
          heightReference: HeightReference.CLAMP_TO_TERRAIN,
        },
        properties,
      });
    }
    const canvas = createCanvasForBillboard(vectorOptions) ?? null;
    if (!canvas) {
      return;
    }

    return new Entity({
      position,
      billboard: {
        image: canvas,
        rotation: vectorOptions.rotation ?? 0,
        heightReference: HeightReference.CLAMP_TO_TERRAIN,
      },
      properties,
    });
  }
}

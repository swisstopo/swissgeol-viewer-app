import { BaseLayerController } from 'src/features/layer/controllers/layer.controller';
import { WmtsLayer, WmtsLayerSource, LayerType } from 'src/features/layer';
import {
  Credit,
  ImageryLayer,
  ImageryLayerCollection,
  Rectangle,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
} from 'cesium';
import {
  DEFAULT_WMTS_SERVICE,
  SWITZERLAND_RECTANGLE,
  WMTS_CAPABILITIES_BY_SERVICE,
  WEB_MERCATOR_TILING_SCHEME,
} from 'src/constants';
import i18next from 'i18next';

/**
 * {@link WmtsLayerController} is the {@link LayerController} implementation for {@link WmtsLayer} instances.
 *
 * This controller's layers are displayed using {@link ImageryLayer},
 * which are added to `viewer.scene.imageryLayers`.
 */
export class WmtsLayerController extends BaseLayerController<WmtsLayer> {
  /**
   * The imagery provider.
   *
   * This provider is responsible for fetching data for {@link layer}.
   *
   * @private
   */
  private provider!: WmtsImageryProvider;

  /**
   * The imagery layer created from {@link provider}.
   *
   * This is the value responsible for displaying the layer on the viewer.
   *
   * @private
   */
  private _imagery!: ImageryLayer;

  constructor(
    layer: WmtsLayer,

    private readonly customTarget: ImageryLayerCollection | null = null,
  ) {
    super(layer);
  }

  get type(): LayerType.Wmts {
    return LayerType.Wmts;
  }

  get imagery(): ImageryLayer {
    return this._imagery;
  }

  private get imageryLayers(): ImageryLayerCollection {
    return this.customTarget ?? this.viewer.scene.imageryLayers;
  }

  protected override reactToChanges(): void {
    // These are the values that are statically references by the `provider`.
    // They can't be changed after the provider has been created, and require reinitialization.
    this.watch(this.layer.id);
    this.watch(this.layer.maxLevel);
    this.watch(this.layer.credit);
    this.watch(this.layer.format);
    this.watch(this.layer.times?.current);

    // Apply opacity to the Cesium layer.
    this.watch(this.layer.opacity, (opacity) => {
      this._imagery.alpha = opacity;
    });

    // Show or hide the Cesium layer.
    this.watch(this.layer.isVisible, (isVisible) => {
      // Hiding the layer via `show = false` or removing it often leads to render errors,
      // probably due to some tile objects not being removed cleanly.
      // Instead, we simply make the layer fully opaque and disable its picking.

      if (isVisible) {
        this._imagery.alpha = this.layer.opacity;
        this.provider.enablePickFeatures = true;
      } else {
        this._imagery.alpha = 0;
        this.provider.enablePickFeatures = false;
      }
    });
  }

  protected override async addToViewer(): Promise<void> {
    // Create new instances of both the provider and layer.
    this.provider = await this.makeProvider();
    (this.provider as { controller?: WmtsLayerController }).controller = this;
    const imagery = new ImageryLayer(this.provider, {
      show: this.layer.isVisible,
      alpha: this.layer.opacity,
    });

    const { imageryLayers } = this;
    if (this._imagery === undefined) {
      // Add a new Cesium layer.
      imageryLayers.add(imagery);
    } else {
      // Replace an existing Cesium layer.
      const i = imageryLayers.indexOf(this._imagery);
      this.removeLayerFromViewer();
      imageryLayers.add(imagery, i);
    }

    this._imagery = imagery;
  }

  /**
   * Remove both the {@link _imagery} and the {@link provider} from the viewer.
   * @protected
   */
  protected override removeFromViewer(): void {
    this.removeLayerFromViewer();
    this.provider = undefined as unknown as WmtsImageryProvider;
  }

  /**
   * Remove the Cesium layer, but keep the {@link provider} intact.
   * @private
   */
  private removeLayerFromViewer(): void {
    const imagery = this._imagery;
    if (imagery === undefined) {
      return;
    }
    try {
      this.imageryLayers.remove(imagery, true);
    } catch (e) {
      // For some reason, removing an imagery can lead to an error about its tiles already being destroyed.
      // There doesn't seem to be a way to circumvent or detect this (`imagery.isDestroyed()` is `false`),
      // so we just catch the error and move on.
      if (!String(e).startsWith('DeveloperError: This object was destroyed,')) {
        throw e;
      }
    }
    this._imagery = undefined as unknown as ImageryLayer;
  }

  override zoomIntoView(): void {
    this.viewer.flyTo(this._imagery).then();
  }

  override moveToTop(): void {
    this.imageryLayers.raiseToTop(this._imagery);
  }

  /**
   * Creates a provider instance based on the layer's source type.
   * @private
   */
  protected async makeProvider(): Promise<WmtsImageryProvider> {
    switch (this.layer.source) {
      case WmtsLayerSource.WMS:
        return this.makeProviderForWms();
      case WmtsLayerSource.WMTS:
        return this.makeProviderForWmts();
    }
  }

  private makeProviderForWms(): WmtsImageryProvider {
    const resolvedService = this.layer.service ?? DEFAULT_WMTS_SERVICE;
    const links =
      WMTS_CAPABILITIES_BY_SERVICE[resolvedService] ??
      WMTS_CAPABILITIES_BY_SERVICE[DEFAULT_WMTS_SERVICE];
    const isDefaultGeoAdmin = links?.wms === 'https://wms.geo.admin.ch/';

    const credit = this.layer.credit ?? String(this.layer.id);

    return new WebMapServiceImageryProvider({
      url:
        this.layer.serviceUrl ??
        (isDefaultGeoAdmin
          ? 'https://wms{s}.geo.admin.ch?version=1.3.0'
          : (links?.wms ?? 'https://wms.geo.admin.ch/')),
      crs: 'EPSG:4326',
      parameters: {
        FORMAT: this.layer.format,
        TRANSPARENT: true,
        LANG: i18next.language,
      },
      subdomains: isDefaultGeoAdmin ? '0123' : undefined,
      tilingScheme: WEB_MERCATOR_TILING_SCHEME,
      layers: String(this.layer.id),
      maximumLevel: this.layer.maxLevel ?? undefined,
      rectangle: SWITZERLAND_RECTANGLE,
      credit: new Credit(credit),
    });
  }

  private makeProviderForWmts(): WmtsImageryProvider {
    const resolvedService = this.layer.service ?? DEFAULT_WMTS_SERVICE;
    const links =
      WMTS_CAPABILITIES_BY_SERVICE[resolvedService] ??
      WMTS_CAPABILITIES_BY_SERVICE[DEFAULT_WMTS_SERVICE];
    const url =
      this.layer.serviceUrl ??
      (links?.wmts
        ? `${links.wmts
            .split('?')[0]
            .replace(
              /\/$/,
              '',
            )}/rest/{layer}/default/3857/{TileMatrix}/{TileRow}/{TileCol}.{format}`
        : 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}');

    const tileMatrixSet = this.layer.customProperties.tileMatrixSet ?? '3857';
    const style = this.layer.customProperties.wmtsStyle ?? 'default';
    const tileMatrixTag = (
      _: unknown,
      __: number,
      ___: number,
      level: number,
    ) =>
      tileMatrixSet.includes(':') ? `${tileMatrixSet}:${level}` : String(level);

    const credit = this.layer.credit ?? String(this.layer.id);
    const rectangle = this.resolveRectangle();

    return new UrlTemplateImageryProvider({
      url,
      maximumLevel: this.layer.maxLevel ?? undefined,
      rectangle,
      credit: new Credit(credit),
      customTags: {
        x: (_, x) => String(x),
        y: (_, __, y) => String(y),
        z: (_, __, ___, level) => String(level),
        TileCol: (_, x) => String(x),
        TileRow: (_, __, y) => String(y),
        TileMatrix: tileMatrixTag,
        layer: () => this.layer.id,
        Layer: () => this.layer.id,
        format: () => this.layer.format.split('/')[1],
        Format: () => this.layer.format,
        timestamp: () => this.layer.times?.current ?? 'current',
        Time: () => this.layer.times?.current ?? 'current',
        style: () => style,
        Style: () => style,
        TileMatrixSet: () => tileMatrixSet,
      },
    });
  }

  /**
   * Returns the layer's rectangle from its WGS84 extent if available,
   * falling back to the default Switzerland rectangle.
   */
  private resolveRectangle(): Rectangle {
    const extent = this.layer.customProperties.wgs84Extent;
    if (!extent) {
      return SWITZERLAND_RECTANGLE;
    }
    const parts = extent.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      return SWITZERLAND_RECTANGLE;
    }
    const [west, south, east, north] = parts;
    return Rectangle.fromDegrees(west, south, east, north);
  }
}

export type WmtsImageryProvider =
  | WebMapServiceImageryProvider
  | UrlTemplateImageryProvider;

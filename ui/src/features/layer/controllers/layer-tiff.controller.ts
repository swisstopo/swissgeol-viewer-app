import {
  BaseLayerController,
  mapLayerSourceToResource,
} from 'src/features/layer/controllers/layer.controller';
import {
  LayerType,
  TiffLayer,
  Tiles3dLayer,
  WmtsLayer,
  WmtsLayerSource,
} from 'src/features/layer';
import {
  Cesium3DTileset,
  UrlTemplateImageryProvider,
  WebMercatorTilingScheme,
} from 'cesium';
import { SWITZERLAND_RECTANGLE, TITILER_BY_PAGE_HOST } from 'src/constants';
import { Tiles3dLayerController } from 'src/features/layer/controllers/layer-tiles3d.controller';
import { makeId } from 'src/models/id.model';
import {
  WmtsImageryProvider,
  WmtsLayerController,
} from 'src/features/layer/controllers/layer-wmts.controller';

export class TiffLayerController extends BaseLayerController<TiffLayer> {
  /**
   * The controller responsible for displaying the tiff's active band.
   *
   * If {@link terrainController} exists, the bands are rendered on top of it.
   * Otherwise, they are draped directly onto the base terrain.
   * @private
   */
  private bandController!: WmtsLayerController;

  /**
   * The controller responsible for displaying the tiff's terrain.
   *
   * For tiffs without a {@link TiffLayer.terrain terrain}, this is `null`.
   * @private
   */
  private terrainController!: Tiles3dLayerController | null;

  get type(): LayerType.Tiff {
    return LayerType.Tiff;
  }

  /**
   * The tileset representing the tiff's terrain,
   * or `null`, if the layer does not have a custom terrain.
   */
  get terrain(): Cesium3DTileset | null {
    return this.terrainController?.tileset ?? null;
  }

  /**
   * The main controller, i.e. the one that is directly added to the viewer.
   * @private
   */
  private get controller(): WmtsLayerController | Tiles3dLayerController {
    return this.terrainController ?? this.bandController;
  }

  zoomIntoView(): void {
    this.controller.zoomIntoView();
  }

  moveToTop(): void {
    this.controller.moveToTop();
  }

  protected reactToChanges(): void {
    // Don't watch anything, as we handle changes in the child controllers.
  }

  async update(layer: TiffLayer): Promise<void> {
    await super.update(layer);

    await this.terrainController?.update(this.makeTiles3dLayer());
    await this.bandController?.update(this.makeWmtsLayer());
  }

  protected async addToViewer(): Promise<void> {
    this.terrainController = this.layer.terrain && this.makeTerrainController();
    await this.terrainController?.add();

    this.bandController ??= this.makeBandController();
    await this.bandController.add();
  }

  protected removeFromViewer(): void {
    this.controller.remove();
  }

  private makeBandController(): WmtsLayerController {
    // A getter for the current layer for use within the layer controller.
    // This allows the inner controller to access the most recent version of our model at any time.
    const getLayer = () => this.layer;

    // A subclass of `WmtsLayerController` that loads tiff data from TiTiler.
    class CustomWmtsController extends WmtsLayerController {
      protected override reactToChanges(): void {
        super.reactToChanges();

        // Reinitialize the layer when the band index changes.
        const layer = getLayer();
        this.watch(layer.bandIndex);
      }

      protected override async makeProvider(): Promise<WmtsImageryProvider> {
        const layer = getLayer();
        const resource = await mapLayerSourceToResource(layer.source);
        const band = layer.bands[layer.bandIndex];
        const noDataParam =
          band.display?.noData === null ? '' : '&nodata={nodata}';
        const rescaleParam = band.display?.isDiscrete
          ? ''
          : '&rescale={min},{max}';
        const provider = new UrlTemplateImageryProvider({
          url: `${TITILER_BY_PAGE_HOST[globalThis.location.host]}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url={url}&bidx={bidx}&colormap_name={colormap}${rescaleParam}${noDataParam}`,
          customTags: {
            url: () => resource.url,
            bidx: () => band.index,
            colormap: () => band.display!.colorMap,
            min: () => band.display!.bounds[0],
            max: () => band.display!.bounds[1],
            nodata: () => band.display!.noData,
          },
          rectangle: SWITZERLAND_RECTANGLE,
          tilingScheme: new WebMercatorTilingScheme(),
          enablePickFeatures: true,
          hasAlphaChannel: true,
        });
        provider.errorEvent.addEventListener(() => {
          // Suppress error logs
        });
        return provider;
      }
    }

    const wmtsLayer = this.makeWmtsLayer();
    return this.terrainController === null
      ? // If there is no custom terrain, we add the band directly to the viewer.
        new CustomWmtsController(wmtsLayer)
      : // If there is a custom terrain, we drape the band on top of it.
        new CustomWmtsController(
          wmtsLayer,
          this.terrainController.tileset.imageryLayers,
        );
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
      opacity: this.layer.opacity,
      canUpdateOpacity: true,
      downloadUrl: null,
      geocatId: null,
      label: null,
      infoBox: null,
      orderOfProperties: [],
      customProperties: {},

      // Make the layer partially transparent to hide parts that are not covered by the imagery.
      isPartiallyTransparent: true,
      sliceSelection: null,
    };
  }

  private makeWmtsLayer(): WmtsLayer {
    // Check if the band layers are standalone, i.e. added directly to the viewer.
    const isStandalone = this.terrainController === null;
    return {
      type: LayerType.Wmts,

      // These don't actually matter all that much compared to normal WMTS layers,
      // as we create a custom provider that doesn't rely on them.
      id: makeId(this.layer.id),
      source: WmtsLayerSource.WMTS,
      serviceUrl: null,
      format: '',
      credit: '',
      maxLevel: null,

      // These don't matter, as they are never exposed to anyone outside of this controller.
      times: null,
      label: null,
      geocatId: null,
      downloadUrl: null,
      infoBox: null,
      customProperties: {},

      // Standalone bands inherit the opacity and visibility of the tiff.
      // Non-standalone bands have these at static values, as they are set on the terrain.
      opacity: isStandalone ? this.layer.opacity : 1,
      canUpdateOpacity: isStandalone,
      isVisible: isStandalone ? this.layer.isVisible : true,
      ogcSource: null,
    };
  }
}

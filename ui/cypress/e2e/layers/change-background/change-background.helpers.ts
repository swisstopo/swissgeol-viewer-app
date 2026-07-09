import type { UrlTemplateImageryProvider } from 'cesium';
import type { WmtsLayerController } from '../../../../src/features/layer';
import { getViewer } from '../../common/viewer';

export const ORTHOGRAPHIC_LAYER = 'ch.swisstopo.swissimage';
export const TOPOGRAPHIC_LAYER = 'ch.swisstopo.pixelkarte-grau';
export const LAKES_AND_RIVERS_LAYER = 'lakes_rivers_map';

export const hasViewerBackground = (layer: string) => {
  getViewer().then((viewer) => {
    const provider = viewer.scene.imageryLayers.get(0)?.imageryProvider;
    expect(Object.getPrototypeOf(provider).constructor.name).to.be.equal(
      'UrlTemplateImageryProvider',
    );
    const urlProvider = provider as UrlTemplateImageryProvider & {
      controller: WmtsLayerController;
    };

    const [expectedLayerName, expectedFormat] =
      layer === LAKES_AND_RIVERS_LAYER
        ? ['ch.bafu.vec25-gewaessernetz_2000', 'image/png']
        : [layer, 'image/jpeg'];

    expect(urlProvider.url).to.include('wmts.geo.admin.ch');
    expect(urlProvider.url).to.include(expectedLayerName);

    expect(urlProvider.controller).to.not.be.undefined;
    expect(urlProvider.controller.layer.id).to.equal(expectedLayerName);
    expect(urlProvider.controller.layer.format).to.equal(expectedFormat);
  });
};

export const getLayerList = () => cy.get('ngm-catalog-display-list');

export const getBackgroundLayerItem = () =>
  getLayerList().shadow().find('ngm-catalog-display-list-item:last-child');

export const getBackgroundButton = () =>
  getBackgroundLayerItem()
    .shadow()
    .get('[data-cy="background"][role="button"]');

export const getBackgroundSelect = () =>
  getBackgroundLayerItem().shadow().find('ngm-background-layer-select');

export const getBackgroundSelector = (layer: string) =>
  getBackgroundSelect().shadow().find(`[data-cy="${layer}"]`);

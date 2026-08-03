import { BaseService } from 'src/services/base.service';
import { LayerService, LayerUpdate } from 'src/features/layer/layer.service';
import {
  combineLatest,
  debounceTime,
  identity,
  map,
  of,
  switchMap,
} from 'rxjs';
import {
  BACKGROUND_LAYER,
  BackgroundLayer,
  BackgroundLayerVariant,
  DEFAULT_BACKGROUND_VARIANT,
  Layer,
  LayerSourceType,
  LayerType,
  WmtsLayer,
} from 'src/features/layer/models';
import { Id, makeId } from 'src/models/id.model';
import { IonService } from 'src/services/ion.service';
import { clientConfigContext } from 'src/context';
import { parseBoolean } from 'src/utils/type.utils';

export class LayerUrlService extends BaseService {
  private layerService!: LayerService;
  private ionService!: IonService;

  /**
   * A temporary storage of layers loaded from Cesium Ion.
   * Will be reset after the initial load.
   * @private
   */
  private temporaryIonLayers: Layer[] | null = null;

  constructor() {
    super();

    Promise.all([LayerService.inject(), IonService.inject()]).then(
      ([layerService, ionService]) => {
        this.layerService = layerService;
        this.ionService = ionService;
        return this.initialize();
      },
    );
  }

  private async initialize(): Promise<void> {
    // Wait for all layer configs to be loaded.
    await this.layerService.ready;

    // Read the params and sync them to our local state.
    const params = this.readParams();
    await this.syncParamsToLayers(params.layers);
    this.syncParamsToBackground(params.background);
    this.temporaryIonLayers = null;

    // Start syncing local state changes to the url.
    this.layerService.activeLayerIds$
      .pipe(
        switchMap((ids) => {
          if (ids.length === 0) {
            return of([]);
          }
          return combineLatest(ids.map((id) => this.layerService.layer$(id)));
        }),
        debounceTime(250),
        map(this.makeLayerParams),
      )
      .subscribe((params) => {
        this.writeParams((url) => this.writeLayerParams(params, url));
      });

    this.ionService.accessToken = params.layers.ionAccessToken;

    this.layerService
      .layer$(BACKGROUND_LAYER.id)
      .pipe(debounceTime(250), map(this.makeBackgroundParams))
      .subscribe((params) =>
        this.writeParams((url) => this.writeBackgroundParams(params, url)),
      );
  }

  private readParams(): Params {
    const url = new URL(window.location.href);
    const params: Params = {
      layers: {
        layers: this.getLayerParamFromUrl(url, 'layers') as Array<Id<Layer>>,
        visibility: this.getLayerParamFromUrl(url, 'visibility').map(
          (visibility) => parseBoolean(visibility),
        ),
        transparency: this.getLayerParamFromUrl(url, 'transparency').map(
          Number,
        ),
        timestamp: this.getLayerParamFromUrl(url, 'timestamp').map((it) =>
          it === '' ? 'current' : it,
        ),
        ionAccessToken: url.searchParams.get(
          getLayerParamName('ionAccessToken'),
        ),
      },
      background: {
        map:
          (this.getBackgroundParamFromUrl(
            url,
            'map',
          ) as Id<BackgroundLayerVariant>) ?? DEFAULT_BACKGROUND_VARIANT.id,
        transparency: Number(
          this.getBackgroundParamFromUrl(url, 'transparency') ?? '0',
        ),
      },
    };

    // `ionAssetIds` is an old parameter that contained the ids of custom assets loaded from Cesium Ion.
    // We do not use it anymore, as we store these custom ids at the same place as non-custom layer ids.
    // Here, we parse the ids, which can be necessary if someone were to use an old link.
    const assetIds = url.searchParams.get('ionAssetIds');
    if (assetIds !== null) {
      const assetIdNumbers = assetIds
        .split(',')
        .map((it) => makeId<Layer>(Number(it)));
      params.layers.layers.push(...assetIdNumbers);
    }

    return params;
  }

  private async syncParamsToLayers(params: LayerParams): Promise<void> {
    for (let i = params.layers.length - 1; i >= 0; i--) {
      const id = params.layers[i];
      const hasActivated = await this.activateLayer(id, params);
      if (!hasActivated) {
        continue;
      }

      const update: LayerUpdate = {
        isVisible: params.visibility[i] ?? true,
        opacity: 1 - (params.transparency[i] ?? 0),
      };

      const layer = this.layerService.layerOrNull(id);
      if (layer === null) {
        continue;
      }

      const timestamp = params.timestamp[i] ?? 'current';
      if (layer.type === LayerType.Wmts && timestamp !== 'current') {
        (update as LayerUpdate<WmtsLayer>).times = {
          ...layer.times!,
          current: timestamp,
        };
      }

      this.layerService.update(id, update);
    }
  }

  private async activateLayer(
    id: Id<Layer>,
    params: LayerParams,
  ): Promise<boolean> {
    // Load custom Cesium Ion layers.
    // These were most likely included via the Cesium Ion upload modal.
    const assetId = Number.parseInt(String(id));
    if (!Number.isNaN(assetId)) {
      this.temporaryIonLayers ??= await this.ionService.fetchLayers({
        accessToken: params.ionAccessToken ?? undefined,
      });
      const layer = this.temporaryIonLayers.find((it) => it.id === assetId);
      if (layer === undefined) {
        console.error(`Unknown Cesium Ion asset: ${id}`);
        return false;
      }
      this.layerService.activateCustomLayer(layer);
      return true;
    }

    // WMTS layer that are not part of the catalog need to be activated as custom WMTS layers.
    // These were most likely included via search.
    if (
      typeof id === 'string' &&
      id.startsWith('ch.') &&
      !this.layerService.hasLayer(id)
    ) {
      this.layerService.activateCustomLayerFromWmts(id as Id<WmtsLayer>);
      return true;
    }

    // Attempt to activate a catalog layer.
    this.layerService.activate(id);
    return true;
  }

  private syncParamsToBackground(params: BackgroundParams): void {
    const isVisible = params.map !== 'empty_map';
    const update: LayerUpdate<BackgroundLayer> = {
      activeVariantId: isVisible ? params.map : DEFAULT_BACKGROUND_VARIANT.id,
      opacity: 1 - (params.transparency ?? 0),
    };
    this.layerService.update(BACKGROUND_LAYER.id, update);

    // Update visibility in a later step so it doesn't get overwritten by opacity.
    this.layerService.update(BACKGROUND_LAYER.id, { isVisible });
  }

  private makeLayerParams = (layers: Layer[]): LayerParams => {
    const params = makeEmptyLayerParams();
    const defaultIonAccessToken =
      BaseService.get(clientConfigContext).ionDefaultAccessToken;
    for (const layer of layers) {
      // Ignore local-only layers.
      if (layer.isLocal) {
        continue;
      }

      params.layers.push(layer.id);
      params.visibility.push(layer.isVisible);
      params.transparency.push(Number((1 - layer.opacity).toFixed(2)));

      const timestamp =
        (layer.type === LayerType.Wmts && layer.times?.current) || '';
      params.timestamp.push(timestamp === 'current' ? '' : timestamp);

      // If there are custom layers loaded via Cesium Ion,
      // we store the last layer's ion access token.
      // The current URL parameters don't have a way to store more than one access token,
      // so there may be some mismatches after reloading.
      if (
        'source' in layer &&
        typeof layer.source === 'object' &&
        layer.source !== null &&
        !(layer.source instanceof File) &&
        'type' in layer.source &&
        layer.source.type === LayerSourceType.CesiumIon &&
        layer.source.accessToken !== undefined &&
        layer.source.accessToken !== defaultIonAccessToken
      ) {
        params.ionAccessToken = layer.source.accessToken;
      }
    }
    if (params.timestamp.every((it) => it === '')) {
      params.timestamp = [];
    }
    if (params.visibility.every(identity)) {
      params.visibility = [];
    }
    return params;
  };

  private makeBackgroundParams = (layer: BackgroundLayer): BackgroundParams => {
    return {
      map: layer.isVisible ? layer.activeVariantId : makeId('empty_map'),
      transparency: 1 - layer.opacity,
    };
  };

  private writeParams = (write: (url: URL) => void): void => {
    const url = new URL(window.location.href);

    // Remove deprecated parameters.
    url.searchParams.delete('ionAssetIds');

    write(url);
    history.replaceState(null, '', url.toString().replace(/%2C/g, ','));
  };

  private writeLayerParams(params: LayerParams, url: URL): void {
    for (const [key, values] of Object.entries(params) as Array<
      [keyof LayerParams, LayerParams[keyof LayerParams]]
    >) {
      const name = getLayerParamName(key);
      if (values === null || values.length === 0) {
        url.searchParams.delete(name);
      } else if (Array.isArray(values)) {
        url.searchParams.set(
          name,
          values.map((it: (typeof values)[0]) => String(it)).join(','),
        );
      } else {
        url.searchParams.set(name, String(values));
      }
    }
  }

  private writeBackgroundParams(params: BackgroundParams, url: URL): void {
    const mapName = getBackgroundParamName('map');
    if (params.map === DEFAULT_BACKGROUND_VARIANT.id) {
      url.searchParams.delete(mapName);
    } else {
      url.searchParams.set(mapName, String(params.map));
    }

    const transparencyName = getBackgroundParamName('transparency');
    if (params.transparency === 0) {
      url.searchParams.delete(transparencyName);
    } else {
      url.searchParams.set(transparencyName, params.transparency.toFixed(2));
    }
  }

  private getLayerParamFromUrl(url: URL, key: keyof LayerParams): string[] {
    const name = getLayerParamName(key);
    const value = url.searchParams.get(name);
    return value === null ? [] : value.split(',');
  }

  private getBackgroundParamFromUrl(
    url: URL,
    key: keyof BackgroundParams,
  ): string | null {
    const name = getBackgroundParamName(key);
    return url.searchParams.get(name);
  }
}

interface Params {
  layers: LayerParams;
  background: BackgroundParams;
}

interface LayerParams {
  layers: Array<Id<Layer>>;
  visibility: boolean[];
  transparency: number[];
  timestamp: string[];
  ionAccessToken: string | null;
}

interface BackgroundParams {
  map: Id<BackgroundLayerVariant>;
  transparency: number;
}

const makeEmptyLayerParams = (): LayerParams => ({
  layers: [],
  visibility: [],
  transparency: [],
  timestamp: [],
  ionAccessToken: null,
});

const getLayerParamName = (key: keyof LayerParams): string => {
  switch (key) {
    case 'layers':
      return key;
    case 'ionAccessToken':
      return 'ionToken';
    default:
      return `layers_${key}`;
  }
};

const getBackgroundParamName = (key: keyof BackgroundParams): string =>
  key === 'map' ? key : `map_${key}`;

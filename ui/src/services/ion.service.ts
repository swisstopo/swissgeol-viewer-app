import { BaseService } from 'src/services/base.service';
import {
  GeoJsonLayer,
  KmlLayer,
  Layer,
  LayerSourceType,
  LayerType,
  Tiles3dLayer,
} from 'src/features/layer';
import { clientConfigContext } from 'src/context';
import { makeId } from 'src/models/id.model';

const DEFAULT_ASSET_TYPES: AssetType[] = ['3DTILES', 'GEOJSON', 'KML'];
const DEFAULT_ASSET_STATUS: AssetStatus = 'COMPLETE';

export class IonService extends BaseService {
  private _accessToken: string | null = null;

  public get accessToken(): string | null {
    return this._accessToken;
  }

  public set accessToken(token: string | null) {
    this._accessToken = token;
  }

  async fetchLayers(options: {
    accessToken: string | undefined;
  }): Promise<Layer[]> {
    const assets = await this.fetchIonAssets(options);
    if (assets.items === undefined) {
      throw new Error(
        `Failed to load assets from Cesium Ion: ${assets.message}`,
      );
    }
    return assets.items.map((it) =>
      this.mapAssetToLayer(it, options.accessToken),
    );
  }

  private readonly mapAssetToLayer = (
    asset: IonAsset,
    accessToken?: string,
  ): Layer => {
    switch (asset.type) {
      case 'GEOJSON':
        return {
          type: LayerType.GeoJson,
          id: makeId(asset.id),
          opacity: 1,
          source: {
            type: LayerSourceType.CesiumIon,
            assetId: asset.id,
            accessToken: accessToken ?? undefined,
          },
          canUpdateOpacity: true,
          shouldClampToGround: true,
          isVisible: true,
          label: asset.name,
          geocatId: null,
          downloadUrl: null,
          infoBox: null,
          customProperties: {},
          orderOfProperties: [],
          terrain: null,
          layerStyle: null,
        } satisfies GeoJsonLayer;
      case 'KML':
        return {
          type: LayerType.Kml,
          id: makeId(asset.id),
          opacity: 1,
          source: {
            type: LayerSourceType.CesiumIon,
            assetId: asset.id,
            accessToken: accessToken ?? undefined,
          },
          canUpdateOpacity: false,
          shouldClampToGround: true,
          isVisible: true,
          label: asset.name,
          geocatId: null,
          downloadUrl: null,
          infoBox: null,
          customProperties: {},
        } satisfies KmlLayer;
      case '3DTILES':
        return {
          type: LayerType.Tiles3d,
          id: makeId(asset.id),
          source: {
            type: LayerSourceType.CesiumIon,
            assetId: asset.id,
            accessToken: accessToken ?? undefined,
          },
          label: asset.name,
          opacity: 1,
          canUpdateOpacity: true,
          isVisible: true,
          geocatId: null,
          downloadUrl: null,
          infoBox: null,
          orderOfProperties: [],
          isPartiallyTransparent: false,
          customProperties: {},
        } satisfies Tiles3dLayer;
      default:
        throw new Error(`Unsupported asset type: ${asset.type}`);
    }
  };

  public async fetchIonAssets(
    options: AssetOptions,
  ): Promise<{ items?: IonAsset[]; message?: string }> {
    const url = new URL('https://api.cesium.com/v1/assets');

    const status = options.status ?? DEFAULT_ASSET_STATUS;
    const statusParam = Array.isArray(status) ? status.join(',') : status;
    url.searchParams.set('status', statusParam);
    const assetType = options.type ?? DEFAULT_ASSET_TYPES;
    if (Array.isArray(assetType)) {
      for (const type of assetType) {
        url.searchParams.append('type', type);
      }
    } else {
      url.searchParams.set('type', assetType);
    }
    if (options.search) {
      url.searchParams.set('search', options.search);
    }
    if (options.sortOrder) {
      url.searchParams.set('sortOrder', options.sortOrder);
    }
    if (options.sortBy) {
      url.searchParams.set('sortBy', options.sortBy);
    }
    if (options.page) {
      url.searchParams.set('page', options.page.toString());
    }
    if (options.limit) {
      url.searchParams.set('limit', options.limit.toString());
    }

    options.accessToken ??=
      BaseService.get(clientConfigContext).ionDefaultAccessToken;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
      },
    });

    return await response.json();
  }
}

export interface IonAsset {
  archivable: boolean;
  attribution: string;
  bytes: number;
  dateAdded: string;
  description: string;
  exportable: boolean;
  id: number;
  name: string;
  percentComplete: number;
  status: AssetStatus;
  type: AssetType;
}

type AssetOptions = {
  accessToken: string | undefined;
  status?: AssetStatus | AssetStatus[];
  type?: AssetType | AssetType[];
  sortOrder?: 'ASC' | 'DESC';
  sortBy?:
    'ID' | 'NAME' | 'DESCRIPTION' | 'BYTES' | 'TYPE' | 'STATUS' | 'DATE_ADDED';
  search?: string;
  page?: number;
  limit?: number;
};

export type AssetStatus =
  | 'AWAITING_FILES'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETE'
  | 'ERROR'
  | 'DATA_ERROR';

export type AssetType =
  '3DTILES' | 'GLTF' | 'IMAGERY' | 'TERRAIN' | 'KML' | 'CZML' | 'GEOJSON';

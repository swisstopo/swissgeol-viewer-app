type AssetStatus =
  | 'AWAITING_FILES'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETE'
  | 'ERROR'
  | 'DATA_ERROR';
type AssetType =
  | '3DTILES'
  | 'GLTF'
  | 'IMAGERY'
  | 'TERRAIN'
  | 'KML'
  | 'CZML'
  | 'GEOJSON';

export type IonAsset = {
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
};

export type GetAssetOptions = {
  status: AssetStatus | AssetStatus[];
  type: AssetType | AssetType[];
  sortOrder?: 'ASC' | 'DESC';
  sortBy?:
    | 'ID'
    | 'NAME'
    | 'DESCRIPTION'
    | 'BYTES'
    | 'TYPE'
    | 'STATUS'
    | 'DATE_ADDED';
  search?: string;
  page?: number;
  limit?: number;
};

const DEFAULT_OPTIONS: GetAssetOptions = {
  status: 'COMPLETE',
  type: '3DTILES',
};

// For more details: https://cesium.com/learn/ion/rest-api/#tag/Assets
export async function getAssets(
  token: string,
  options = DEFAULT_OPTIONS,
): Promise<{ items?: IonAsset[]; message?: string }> {
  const url = new URL('https://api.cesium.com/v1/assets');

  const statusParam = Array.isArray(options.status)
    ? options.status.join(',')
    : options.status;
  url.searchParams.set('status', statusParam);
  const typeParam = Array.isArray(options.type)
    ? options.type.join(',')
    : options.type;
  url.searchParams.set('type', typeParam);
  if (options.search) url.searchParams.set('search', options.search);
  if (options.sortOrder) url.searchParams.set('sortOrder', options.sortOrder);
  if (options.sortBy) url.searchParams.set('sortBy', options.sortBy);
  if (options.page) url.searchParams.set('page', options.page.toString());
  if (options.limit) url.searchParams.set('limit', options.limit.toString());

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return await response.json();
}

export type PopupItem = {
  content: string;
  mouseEnter: () => void;
  mouseLeave: () => void;
  zoom: () => void;
};

export type QueryResult = {
  properties?: [string, number | string][];
  popupItems?: PopupItem[];
  geomId?: string;
  onshow?: () => void;
  onhide?: () => void;
  zoom?: () => void;
};

export interface IdentifyResult {
  layerBodId: string;
  featureId: string;
  geometry: { type: string; coordinates: number[] };
}

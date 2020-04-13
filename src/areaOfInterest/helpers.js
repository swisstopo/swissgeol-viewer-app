import {HIGHLIGHTED_AOI_COLOR, DEFAULT_AOI_COLOR} from '../constants.js';
import {LOCALSTORAGE_AOI_ITEM_NAME, LOCALSTORAGE_AOI_TIME_ITEM_NAME, LOCALSTORAGE_AOI_TIMEOUT} from '../constants';

export function updateColor(entity, selected) {
  const entityType = entity.rectangle ? 'rectangle' : 'polygon';
  entity[entityType].material = selected ? HIGHLIGHTED_AOI_COLOR : DEFAULT_AOI_COLOR;
}

export function getStoredAoi() {
  const aoiTimestamp = localStorage.getItem(LOCALSTORAGE_AOI_TIME_ITEM_NAME);
  if (aoiTimestamp) {
    const timestamp = new Date(aoiTimestamp);
    if ((new Date - timestamp) > LOCALSTORAGE_AOI_TIMEOUT) {
      localStorage.removeItem(LOCALSTORAGE_AOI_ITEM_NAME);
    }
  }
  const storedAoi = localStorage.getItem(LOCALSTORAGE_AOI_ITEM_NAME);
  if (storedAoi) {
    return JSON.parse(storedAoi);
  }
  return [];
}

export function setAoiInStorage(areas) {
  localStorage.setItem(LOCALSTORAGE_AOI_ITEM_NAME, JSON.stringify(areas));
  localStorage.setItem(LOCALSTORAGE_AOI_TIME_ITEM_NAME, new Date());
}

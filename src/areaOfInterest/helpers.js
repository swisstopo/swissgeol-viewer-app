import {HIGHLIGHTED_AOI_COLOR, DEFAULT_AOI_COLOR, LOCALSTORAGE_AOI_ITEM_NAME} from '../constants.js';

export function updateColor(entity, selected) {
  const entityType = entity.rectangle ? 'rectangle' : 'polygon';
  entity[entityType].material = selected ? HIGHLIGHTED_AOI_COLOR : DEFAULT_AOI_COLOR;
}

export function getStoredAoi() {
  const storedAoi = localStorage.getItem(LOCALSTORAGE_AOI_ITEM_NAME);
  if (storedAoi) {
    return JSON.parse(storedAoi);
  }
  return [];
}

export function setAoiInStorage(areas) {
  localStorage.setItem(LOCALSTORAGE_AOI_ITEM_NAME, JSON.stringify(areas));
}

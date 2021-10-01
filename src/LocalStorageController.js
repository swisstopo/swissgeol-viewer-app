const LOCALSTORAGE_AOI_KEY = 'aoi';
const LOCALSTORAGE_CATALOG_KEY = 'hideCatalogWindow';

export default class LocalStorageController {

  static get hideCatalogValue() {
    return localStorage.getItem(LOCALSTORAGE_CATALOG_KEY) === 'true';
  }

  static toggleCatalogState() {
    const newValue = localStorage.getItem(LOCALSTORAGE_CATALOG_KEY) !== 'true';
    localStorage.setItem(LOCALSTORAGE_CATALOG_KEY, newValue);
  }

  static getStoredAoi() {
    const storedAoi = localStorage.getItem(LOCALSTORAGE_AOI_KEY);
    if (storedAoi) {
      return JSON.parse(storedAoi);
    }
    return [];
  }

  static setAoiInStorage(areas) {
    localStorage.setItem(LOCALSTORAGE_AOI_KEY, JSON.stringify(areas));
  }
}

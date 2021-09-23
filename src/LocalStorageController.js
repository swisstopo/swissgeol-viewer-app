const LOCALSTORAGE_AOI_KEY = 'aoi';
const LOCALSTORAGE_WELCOME_KEY = 'hideWelcome';
const LOCALSTORAGE_CATALOG_KEY = 'hideCatalogWindow';

export default class LocalStorageController {
  static get hideWelcomeValue() {
    return localStorage.getItem(LOCALSTORAGE_WELCOME_KEY) === 'true';
  }

  static get hideCatalogValue() {
    return localStorage.getItem(LOCALSTORAGE_CATALOG_KEY) === 'true';
  }

  static updateWelcomePanelState() {
    const newValue = localStorage.getItem(LOCALSTORAGE_WELCOME_KEY) !== 'true';
    localStorage.setItem(LOCALSTORAGE_WELCOME_KEY, newValue);
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

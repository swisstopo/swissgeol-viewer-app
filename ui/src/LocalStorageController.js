const LOCALSTORAGE_AOI_KEY = 'aoi';
const LOCALSTORAGE_VIEW_KEY = 'view';

export default class LocalStorageController {

  static getStoredAoi() {
    const storedAoi = localStorage.getItem(LOCALSTORAGE_AOI_KEY);
    if (storedAoi) {
      return JSON.parse(storedAoi);
    }
    return [];
  }

  static setAoiInStorage(areas) {
    const aoi = areas.filter(area => !area.fromTopic);
    localStorage.setItem(LOCALSTORAGE_AOI_KEY, JSON.stringify(aoi));
  }

  static storeCurrentView() {
    localStorage.setItem(LOCALSTORAGE_VIEW_KEY, location.search);
  }

  static removeStoredView() {
    localStorage.removeItem(LOCALSTORAGE_VIEW_KEY);
  }

  static get storedView() {
    return localStorage.getItem(LOCALSTORAGE_VIEW_KEY);
  }
}

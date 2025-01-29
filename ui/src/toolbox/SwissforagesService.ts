import { SWISSFORAGES_API_URL } from '../constants';
import { radiansToLv95 } from '../projection';
import i18next from 'i18next';
import { showSnackbarInfo } from '../notifications';

interface SwissforagesResponse {
  success: boolean;
  data: {
    cid: string;
    mid: string;
  };
}

export class SwissforagesService {
  userToken: string | undefined;
  workGroupId: string | undefined;
  headers = new Headers({
    'bdms-authorization': 'bdms-v1',
    'Content-Type': 'application/json;charset=UTF-8',
    Authorization: '',
  });

  get requestOptions() {
    return {
      method: 'POST',
      headers: this.headers,
    };
  }

  /**
   * Gets swissforages user credentials and returns user workgroups list
   * @param username
   * @param password
   * @return {Promise<string|array>}
   */
  async login(username, password) {
    const token = `Basic ${btoa(`${username}:${password}`)}`;
    const data = JSON.stringify({ action: 'GET' });

    this.headers.set('Authorization', token);
    const fetchResult = await fetch(`${SWISSFORAGES_API_URL}/user`, {
      ...this.requestOptions,
      body: data,
    });
    const response = await fetchResult.json();

    if (response && response.success) {
      const workgroups = response.data.workgroups.filter((group) =>
        group.roles.includes('EDIT'),
      );
      if (workgroups.length) {
        this.userToken = token;
        return workgroups;
      } else {
        throw new Error(i18next.t('tbx_swissforages_no_permission_error'));
      }
    } else {
      throw new Error(i18next.t('tbx_swissforages_no_user_error'));
    }
  }

  async createBorehole(cartographicPosition, depth, name) {
    if (!this.workGroupId) return;
    const lv95Position = radiansToLv95([
      cartographicPosition.longitude,
      cartographicPosition.latitude,
    ]);
    const location = await this.getLocation(lv95Position);
    location[4] = cartographicPosition.height;

    let boreholeId = 0;
    const createResult = await fetch(`${SWISSFORAGES_API_URL}/borehole/edit`, {
      ...this.requestOptions,
      body: JSON.stringify({ action: 'CREATE', id: this.workGroupId }),
    });
    const response = await createResult.json();

    if (response && response.success) {
      boreholeId = response.id;
    } else {
      throw new Error(i18next.t('tbx_swissforages_borehole_creation_error'));
    }

    if (location) {
      try {
        await fetch(`${SWISSFORAGES_API_URL}/borehole/edit`, {
          ...this.requestOptions,
          body: JSON.stringify({
            action: 'PATCH',
            id: boreholeId,
            field: 'location',
            value: location,
          }),
        });
      } catch (e) {
        console.error(e);
        showSnackbarInfo(i18next.t('tbx_swissforages_borehole_location_error'));
      }
    }

    if (depth) {
      try {
        await fetch(`${SWISSFORAGES_API_URL}/borehole/edit`, {
          ...this.requestOptions,
          body: JSON.stringify({
            action: 'PATCH',
            id: boreholeId,
            field: 'length',
            value: depth,
          }),
        });
      } catch (e) {
        console.error(e);
        showSnackbarInfo(i18next.t('tbx_swissforages_borehole_depth_error'));
      }
    }

    if (name) {
      try {
        await fetch(`${SWISSFORAGES_API_URL}/borehole/edit`, {
          ...this.requestOptions,
          body: JSON.stringify({
            action: 'PATCH',
            id: boreholeId,
            field: 'custom.public_name',
            value: name,
          }),
        });
      } catch (e) {
        console.error(e);
        showSnackbarInfo(i18next.t('tbx_swissforages_borehole_name_error'));
      }
    }
    return boreholeId;
  }

  async getLocation(position) {
    let response: SwissforagesResponse | undefined;
    try {
      const fetchResult = await fetch(
        `${SWISSFORAGES_API_URL}/geoapi/location`,
        {
          ...this.requestOptions,
          body: JSON.stringify({
            action: 'LOCATION',
            easting: position[0],
            northing: position[1],
          }),
        },
      );
      response = await fetchResult.json();
    } catch (e) {
      console.error(e);
      showSnackbarInfo(i18next.t('tbx_swissforages_get_location_error'));
    }

    if (response && response.success) {
      const cid = response.data.cid;
      const mid = response.data.mid;
      return [...position, cid, mid];
    } else {
      return position;
    }
  }

  async getBoreholeById(boreholeId) {
    const fetchResult = await fetch(`${SWISSFORAGES_API_URL}/borehole`, {
      ...this.requestOptions,
      body: JSON.stringify({
        action: 'GET',
        id: boreholeId,
      }),
    });
    const response = await fetchResult.json();

    if (response && response.success) {
      return response.data;
    } else {
      throw new Error(i18next.t('tbx_swissforages_borehole_sync_error'));
    }
  }
}

import {SWISSFORAGES_API_URL} from '../constants';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {radiansToLv95} from '../projection';

const byteSize = str => new Blob([str]).size;

export class SwissforagesService {
  constructor() {
    this.userToken = undefined;
    this.workGroupId = undefined;
    this.headers = new Headers({
      'bdms-authorization': 'bdms-v1',
      'Content-Type': 'application/json;charset=UTF-8',
      // 'Content-Length': '0',
      'Authorization': '',
    });
  }

  get requestOptions() {
    return {
      method: 'POST',
      headers: this.headers
    };
  }

  /**
   * Gets swissforages user credentials and returns user workgroups list or error
   * @param username
   * @param password
   * @return {Promise<string|array>}
   */
  async login(username, password) {
    const token = `Basic ${btoa(`${username}:${password}`)}`;
    const data = JSON.stringify({action: 'GET'});

    this.headers.set('Authorization', token);
    this.headers.set('Content-Length', `${byteSize(data)}`); // todo check if needed \ remove

    const fetchResult = await fetch(`${SWISSFORAGES_API_URL}/user`, {
      ...this.requestOptions,
      body: data
    });
    const response = await fetchResult.json();

    if (response && response.success) {
      const workgroups = response.data.workgroups.filter(group => group.roles.includes('EDIT'));
      if (workgroups.length) {
        this.userToken = token;
        return workgroups;
      } else {
        return 'No write permisions';
      }
    } else {
      return 'User not found'; // TODO translation
    }
  }

  async createBorehole(position, name) {
    if (!this.workGroupId) return;
    const cartographicPosition = Cartographic.fromCartesian(position);
    const lv95Position = radiansToLv95([cartographicPosition.longitude, cartographicPosition.latitude]);
    const location = await this.getLocation(lv95Position);
    location[4] = cartographicPosition.height;

    let boreholeId = 0;
    const createResult = await fetch(`${SWISSFORAGES_API_URL}/borehole/edit`, {
      ...this.requestOptions,
      body: JSON.stringify({'action': 'CREATE', 'id': this.workGroupId}),
    });
    const response = await createResult.json();

    if (response && response.success) {
      boreholeId = response.id;
    } else {
      return 'Error during borehole creation'; // todo translation
    }

    // todo handle errors
    if (location) {
      await fetch(`${SWISSFORAGES_API_URL}/borehole/edit`, {
        ...this.requestOptions,
        body: JSON.stringify({
          'action': 'PATCH',
          'id': boreholeId,
          'field': 'location',
          'value': location
        }),
      });
    }

    if (name) {
      await fetch(`${SWISSFORAGES_API_URL}/borehole/edit`, {
        ...this.requestOptions,
        body: JSON.stringify({
          'action': 'PATCH',
          'id': boreholeId,
          'field': 'custom.public_name',
          'value': name
        }),
      });
    }
    return boreholeId;
  }

  async getLocation(position) {
    const fetchResult = await fetch(`${SWISSFORAGES_API_URL}/geoapi/location`, {
      ...this.requestOptions,
      body: JSON.stringify({
        action: 'LOCATION',
        easting: position[0],
        northing: position[1]
      }),
    });
    const response = await fetchResult.json();

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
        id: boreholeId
      }),
    });
    const response = await fetchResult.json();

    if (response && response.success) {
      return response.data;
    } else {
      return 'Error';
    }
  }
}

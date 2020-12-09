import {SWISSFORAGES_API_URL} from '../constants';
import Cartographic from 'cesium/Source/Core/Cartographic';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {radiansToLv95} from '../projection';

export class SwissforagesService {
  constructor() {
    this.userToken = undefined;
    this.workGroupId = undefined;
    this.headers = new Headers({
      'bdms-authorization': 'bdms-v1',
      'Content-Type': 'application/json;charset=UTF-8',
    });
  }

  get requestOptions() {
    return {
      method: 'POST',
      credentials: 'include',
      headers: this.headers
    };
  }

  async login(username, password) {
    this.userToken = `Basic ${btoa(`${username}:${password}`)}`;
    this.headers.append('Authorization', this.userToken);
    const response = await fetch(`${SWISSFORAGES_API_URL}/user`, {
      ...this.requestOptions,
      body: JSON.stringify({
        action: 'GET'
      })
    });
    // todo check workgroup
    // todo handle response
  }

  async createBorehole(position, name) {
    const cartographicPosition = Cartographic.fromCartesian(position);
    const lv95Position = radiansToLv95([cartographicPosition.longitude, cartographicPosition.latitude]);
    const location = await this.getLocation(lv95Position);
    location[4] = cartographicPosition.height;
    let boreholeId = 0; // todo take from create response
    const createResponse = await fetch(`${SWISSFORAGES_API_URL}/borehole/edit`, {
      ...this.requestOptions,
      body: JSON.stringify({'action': 'CREATE', 'id': this.workGroupId}),
    });
    // todo handle response
    const updLocationResponse = await fetch(`${SWISSFORAGES_API_URL}/borehole/edit`, {
      ...this.requestOptions,
      body: JSON.stringify({
        'action': 'PATCH',
        'id': boreholeId,
        'field': 'location',
        'value': location
      }),
    });
    const updNameResponse = await fetch(`${SWISSFORAGES_API_URL}/borehole/edit`, {
      ...this.requestOptions,
      body: JSON.stringify({
        'action': 'PATCH',
        'id': boreholeId,
        'field': 'custom.public_name',
        'value': name
      }),
    });
    // todo handle response
    return boreholeId;
  }

  async getLocation(position) {
    const response = await fetch(`${SWISSFORAGES_API_URL}/geoapi/location`, {
      ...this.requestOptions,
      body: JSON.stringify({
        action: 'LOCATION',
        easting: position[0],
        northing: position[1]
      }),
    });
    // todo handle response
  }
}

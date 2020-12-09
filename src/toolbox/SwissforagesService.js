export class SwissforagesService {
  constructor() {
    this.userToken = undefined;
    this.workGroupId = undefined;
  }

  async login(username, password) {
    const response = await fetch('https://swissforages.ch/api/v1/user', {
      method: 'POST',
      credentials: 'include',
      headers: new Headers({
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
        'bdms-authorization': 'bdms-v1',
        'Content-Type': 'application/json;charset=UTF-8',
      }),
      body: JSON.stringify({
        action: 'GET'
      }),
      // mode: 'no-cors'
    });
  }

  createBorehole() {

  }
}

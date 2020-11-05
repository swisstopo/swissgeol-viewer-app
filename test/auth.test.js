/* eslint-env node, mocha */

import assert from 'assert';
import jsdom from 'jsdom-global';

// initialize some constants
const url = 'http://localhost/';
const user = {name: 'John Doe'};
const payload = Buffer.from(JSON.stringify(user)).toString('base64').replace(/=/g, '');
const jwt = `header.${payload}.signature`;
const token = `#access_token=${jwt}`;
const idToken = '&id_token=bidon';
const type = '&token_type=Bearer';
const state = '&state=test';

// initialize the window, document and localStorage objects
jsdom('', {url: url + token + type + state + idToken});
global.localStorage = window.localStorage;

// load the component
import Auth from '../src/auth.js';

describe('Auth', () => {

  describe('state', () => {
    it('should initialize the state', () => {
      const theState = Auth.state();
      assert.ok(theState.length > 0);
      assert.ok(Auth.state() === theState);
      Auth.state('test');
      assert.ok(Auth.state() === 'test');
    });
  });

  describe('getUser, setUser and logout', () => {
    it('should get, set and remove the user', () => {
      Auth.logout();
      assert.ok(Auth.getUser() === null);
      Auth.setUser(user);
      assert.deepStrictEqual(Auth.getUser(), user);
      Auth.logout();
      assert.ok(Auth.getUser() === null);
    });
  });

  describe('waitForAuthenticate', () => {
    it('should wait until the user authenticates', async () => {
      Auth.logout();
      setInterval(() => Auth.setUser(user), 120);
      await Auth.waitForAuthenticate();
      assert.deepStrictEqual(Auth.getUser(), user);
    });
  });

  describe('initialize', () => {
    it('should extract the user from the hash in the response URL', () => {
      Auth.logout();
      Auth.state('test');
      Auth.initialize();
      assert.deepStrictEqual(Auth.getUser(), user);
    });
  });
});

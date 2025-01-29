/* eslint-env node, mocha */

import assert from 'assert';
import jsdom from 'jsdom-global';

// initialize some constants
const url = 'http://localhost/';
const user = { name: 'John Doe' };
const payload = Buffer.from(JSON.stringify(user))
  .toString('base64')
  .replace(/=/g, '');
const jwt = `header.${payload}.signature`;
const token = `#access_token=${jwt}`;
const idToken = '&id_token=bidon';
const type = '&token_type=Bearer';
const state = '&state=test';

// initialize the window, document and localStorage objects
jsdom('', { url: url + token + type + state + idToken });
global.localStorage = window.localStorage;

// load the component
import AuthService from '../authService.js';

describe('Auth', () => {
  describe('state', () => {
    it('should initialize the state', () => {
      const theState = AuthService.state();
      assert.ok(theState.length > 0);
      assert.ok(AuthService.state() === theState);
      AuthService.state('test');
      assert.ok(AuthService.state() === 'test');
    });
  });

  describe('getUser, setUser and logout', () => {
    it('should get, set and remove the user', () => {
      AuthService.logout();
      assert.ok(AuthService.getUser() === null);
      AuthService.setUser(user);
      assert.deepStrictEqual(AuthService.getUser(), user);
      AuthService.logout();
      assert.ok(AuthService.getUser() === null);
    });
  });

  describe('waitForAuthenticate', () => {
    it('should wait until the user authenticates', async () => {
      AuthService.logout();
      setTimeout(() => AuthService.setUser(user));
      await AuthService.waitForAuthenticate();
      assert.deepStrictEqual(AuthService.getUser(), user);
    });
  });

  describe('initialize', () => {
    it('should extract the user from the hash in the response URL', () => {
      AuthService.logout();
      AuthService.state('test');
      AuthService.initialize();
      assert.deepStrictEqual(AuthService.getUser(), user);
    });
  });
});

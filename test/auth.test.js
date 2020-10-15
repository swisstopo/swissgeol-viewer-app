/* eslint-env node, mocha */

import assert from 'assert';
import jsdom from 'jsdom-global';

// initialize some constants
const url = 'http://localhost/';
const user = {name: 'John Doe'};
const payload = Buffer.from(JSON.stringify(user)).toString('base64').replace(/=/g, '');
const jwt = `header.${payload}.signature`;
const token = `#access_token=${jwt}`;
const type = '&token_type=Bearer';
const state = '&state=test';

// initialize the window, document and localStorage objects
jsdom('', {url: url + token + type + state});
global.localStorage = window.localStorage;

// load the component
import Auth from '../src/auth.js';

describe('Auth', () => {

  describe('state', () => {
    it('should initialize the state', () => {
      const state = Auth.state();
      assert.ok(state.length > 0);
      assert.ok(Auth.state() === state);
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

  describe('parseResponse', () => {
    it('should throw an error when the input is input', () => {
      assert.throws(() => Auth.parseResponse(undefined), Error);
      assert.throws(() => Auth.parseResponse(''), Error);
      assert.throws(() => Auth.parseResponse('#'), Error);
      assert.throws(() => Auth.parseResponse('#a='), Error);
      assert.throws(() => Auth.parseResponse('#=1'), Error);
    });
    it('should parse a well formed input', () => {
      assert.deepStrictEqual(Auth.parseResponse('#a=1'), {a: '1'});
      assert.deepStrictEqual(Auth.parseResponse('#a=1'), {a: '1'});
      assert.deepStrictEqual(Auth.parseResponse('#a=1&b=2'), {a: '1', b: '2'});
      assert.deepStrictEqual(Auth.parseResponse(token), {access_token: jwt});
    });
  });

  describe('parseToken', () => {
    it('should throw an error when the input is input', () => {
      assert.throws(() => Auth.parseToken(undefined), Error);
      assert.throws(() => Auth.parseToken(undefined), Error);
    });
    it('should parse a well formed input', () => {
      assert.deepStrictEqual(Auth.parseToken(jwt), user);
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

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
      assert.equal(Auth.state(), state);
      Auth.state('test');
      assert.equal(Auth.state(), 'test');
    });
  });

  describe('getUser, setUser and removeUser', () => {
    it('should get, set and remove the user', () => {
      Auth.clear();
      assert.deepEqual(Auth.getUser(), null);
      Auth.setUser(user);
      assert.deepEqual(Auth.getUser(), user);
      Auth.clear();
      assert.deepEqual(Auth.getUser(), null);
    });
  });

  describe('waitForAuthenticate', () => {
    it('should wait until the user authenticates', async () => {
      Auth.clear();
      setInterval(() => Auth.setUser(user), 120);
      await Auth.waitForAuthenticate();
      assert.deepEqual(Auth.getUser(), user);
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
      assert.deepEqual(Auth.parseResponse('#a=1'), {a: 1});
      assert.deepEqual(Auth.parseResponse('#a=1'), {a: 1});
      assert.deepEqual(Auth.parseResponse('#a=1&b=2'), {a: 1, b: 2});
      assert.deepEqual(Auth.parseResponse(token), {access_token: jwt});
    });
  });

  describe('parseToken', () => {
    it('should throw an error when the input is input', () => {
      assert.throws(() => Auth.parseToken(undefined), Error);
      assert.throws(() => Auth.parseToken(undefined), Error);
    });
    it('should parse a well formed input', () => {
      assert.deepEqual(Auth.parseToken(jwt), user);
    });
  });

  describe('initialize', () => {
    it('should extract the user from the hash in the response URL', () => {
      Auth.state('test');
      Auth.clear();
      Auth.initialize();
      assert.deepEqual(Auth.getUser(), user);
    });
  });

});

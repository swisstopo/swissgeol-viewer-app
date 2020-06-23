import assert from 'assert'
import jsdom from 'jsdom-global';

// initialize some constants
const url = 'http://localhost/';
const user = {name: "John Doe"};
const payload = Buffer.from(JSON.stringify(user)).toString('base64').replace(/=/g, '');
const jwt = `header.${payload}.signature`;
const token = `#access_token=${jwt}`;
const type = '&token=Bearer';
const state = `&state=test`;

// initialize the window, document and localStorage objects
jsdom('', {url: url + token + type + state});
global.localStorage = window.localStorage;

// load the component
import Auth from '../src/auth.js';

describe('Auth', function () {
  
  describe('state', function () {
    it('should initialize the state', function () {
      let state = Auth.state();
      assert.ok(state.length > 0);
      assert.equal(Auth.state(), state);
      Auth.state('test');
      assert.equal(Auth.state(), 'test');
    });
  });

  describe('getUser, setUser and removeUser', function () {
    it('should get, set and remove the user', function () {
      Auth.removeUser();
      assert.deepEqual(Auth.getUser(), null);
      Auth.setUser(user);
      assert.deepEqual(Auth.getUser(), user);
      Auth.removeUser();
      assert.deepEqual(Auth.getUser(), null);
    });
  });

  describe('authenticate', function () {
    it('should wait until the user authenticates', async function () {
      Auth.removeUser()
      setInterval(() => Auth.setUser(user), 100);
      await Auth.authenticate();
      assert.deepEqual(Auth.getUser(), user);
    });
  });

  describe('parseResponse', function () {
    it('should throw an error when the input is input', function () {
      assert.throws(() => Auth.parseResponse(undefined), Error);
      assert.throws(() => Auth.parseResponse(''), Error);
      assert.throws(() => Auth.parseResponse('#'), Error);
      assert.throws(() => Auth.parseResponse('#a='), Error);
      assert.throws(() => Auth.parseResponse('#=1'), Error);
    });
    it('should parse a well formed input', function () {
      assert.deepEqual(Auth.parseResponse('#a=1'), {a: 1});
      assert.deepEqual(Auth.parseResponse('#a=1'), {a: 1});
      assert.deepEqual(Auth.parseResponse('#a=1&b=2'), {a: 1, b: 2});
      assert.deepEqual(Auth.parseResponse(token), {access_token: jwt});
    });
  });

  describe('parseToken', function () {
    it('should throw an error when the input is input', function () {
      assert.throws(() => Auth.parseToken(undefined), Error);
      assert.throws(() => Auth.parseToken(undefined), Error);
    });
    it('should parse a well formed input', function () {
      assert.deepEqual(Auth.parseToken(jwt), user);
    });
  });

  describe('initialize', function () {
    it('should throw an error when the input is input', function () {
      Auth.state('test');
      Auth.removeUser();
      Auth.initialize();
      assert.deepEqual(Auth.getUser(), user)
    });
  });

});

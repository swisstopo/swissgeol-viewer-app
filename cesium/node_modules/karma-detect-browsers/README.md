# karma-detect-browsers

> Karma runner plugin for detecting all browsers installed on the current system. Adds all found browsers to the browser array in the karma config file.

> [![NPM version](https://badge.fury.io/js/karma-detect-browsers.svg)](http://badge.fury.io/js/karma-detect-browsers)
[![Build Status](https://secure.travis-ci.org/litixsoft/karma-detect-browsers.svg?branch=master)](https://travis-ci.org/litixsoft/karma-detect-browsers)
[![david-dm](https://david-dm.org/litixsoft/karma-detect-browsers.svg?theme=shields.io)](https://david-dm.org/litixsoft/karma-detect-browsers/)
[![david-dm](https://david-dm.org/litixsoft/karma-detect-browsers/dev-status.svg?theme=shields.io)](https://david-dm.org/litixsoft/karma-detect-browsers#info=devDependencies&view=table)

## Installation

The easiest way is to keep `karma-detect-browsers` as a devDependency in your `package.json`.
```json
{
  "devDependencies": {
    "karma": "^0.13",
    "karma-detect-browsers": "^2.0"
  }
}
```

You can simply do it by:
```bash
npm install karma-detect-browsers --save-dev
```

## Get started

* add detectBrowsers as framework and plugin to your karma config file
* add the karma browser plugins for all the browser installed on your system
* add the karma browser plugins to the `package.json` file

```js
// karma.conf.js
module.exports = function(config) {
  config.set({
    frameworks: ['detectBrowsers'],

    plugins: [
      'karma-chrome-launcher',
      'karma-edge-launcher',
      'karma-firefox-launcher',
      'karma-ie-launcher',
      'karma-safari-launcher',
      'karma-safaritechpreview-launcher',
      'karma-opera-launcher',
      'karma-phantomjs-launcher',
      'karma-detect-browsers'
    ]
  });
};
```

## Configuration
```js
// karma.conf.js
module.exports = function(config) {
  config.set({
    frameworks: ['detectBrowsers'],

    // configuration
    detectBrowsers: {
      // enable/disable, default is true
      enabled: true,

      // enable/disable phantomjs support, default is true
      usePhantomJS: true,

      // use headless mode, for browsers that support it, default is false
      preferHeadless: true,

      // post processing of browsers list
      // here you can edit the list of browsers used by karma
      postDetection: function(availableBrowsers) {
        /* Karma configuration with custom launchers
          customLaunchers: {
            IE9: {
              base: 'IE',
              'x-ua-compatible': 'IE=EmulateIE9'
            }
          }
        */

          //Add IE Emulation
          var result = availableBrowsers;

          if (availableBrowsers.indexOf('IE')>-1) {
            result.push('IE9');
          }

          //Remove PhantomJS if another browser has been detected
          if (availableBrowsers.length > 1 && availableBrowsers.indexOf('PhantomJS')>-1) {
            var i = result.indexOf('PhantomJS');

            if (i !== -1) {
              result.splice(i, 1);
            }
          }

          return result;
        }
    },

    plugins: [
      'karma-chrome-launcher',
      'karma-edge-launcher',
      'karma-firefox-launcher',
      'karma-ie-launcher',
      'karma-safari-launcher',
      'karma-safaritechpreview-launcher',
      'karma-opera-launcher',
      'karma-phantomjs-launcher',
      'karma-detect-browsers'
    ]
  });
};
```

## Contributing
In lieu of a formal styleguide take care to maintain the existing coding style. Lint and test your code using [grunt](http://gruntjs.com/).

You can preview your changes by running:
```bash
grunt demo
```

## Release History
### v2.3.3
* Fix path for Chromium browser in macOS

### v2.3.2
* Remove extra check if browsers are listed as plugin in the karma config file

### v2.3.1
* Fix log output of the browsers used, take possible changes made in the postDetection() function into account

### v2.3.0
* Split Chrome and Chromium
* Add support for headless mode in Chrome and Firefox
* Add check if all browser launchers are installed
* Preserve browser config for non-detectable browsers like SauceLabs

### v2.2.6
* Fix problem with stating multiple Firefox instances in Linux

### v2.2.5
* Update edge launcher binary path

### v2.2.4
* Update Edge detection to follow bug fixes in karma-edge-launcher

### v2.2.3
* Edge.js will always return a browser object

### v2.2.2
* Fix error with Edge module on unix systems

### v2.2.1
* Fix for build errors on unix systems

### v2.2.0
* Add support for detecting Microsoft Edge browser

### v2.1.0
* Add support for detecting Safari Tech Preview

### v2.0.1
* Add some executables names for the Chrome browser in Linux

### v2.0.0
* Drop peerDependencies so that the user has full control which karma browser plugins are installed via npm
* This is a breaking change since now you have to manually add the karma browser plugins to the `package.json` file of your project

### v1.1.2
* Revert peerDependencies changes, since this would be a breaking change. Waiting for npm v3 final.

### v1.1.1
* Move peerDependencies to dependencies in preparation of npm v3+

### v1.1.0
* Use karma's logger instead of console.log to respect the log level set in the karma config file

### v1.0.0
* PhantomJS was not used when there are no browsers installed in the system

### v0.1.3
* add new parameter (postDetection) to post process browser list

### v0.1.2
* add support for phantomjs, is enabled by default, can be disabled

### v0.1.1
* only override browsers in config when a browser was found by the plugin

### v0.1.0
* first release

## Author
[Litixsoft GmbH](http://www.litixsoft.de)

## License
Copyright (C) 2013-2018 Litixsoft GmbH <info@litixsoft.de>
Licensed under the MIT license.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included i
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

# karma-edge-launcher

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/karma-runner/karma-edge-launcher)
 [![npm version](https://img.shields.io/npm/v/karma-edge-launcher.svg?style=flat-square)](https://www.npmjs.com/package/karma-edge-launcher) [![npm downloads](https://img.shields.io/npm/dm/karma-edge-launcher.svg?style=flat-square)](https://www.npmjs.com/package/karma-edge-launcher)

[![Build Status](https://img.shields.io/travis/karma-runner/karma-edge-launcher/master.svg?style=flat-square)](https://travis-ci.org/karma-runner/karma-edge-launcher) [![Build Status](https://img.shields.io/appveyor/ci/nickmccurdy/karma-edge-launcher-ui7ax/master.svg?style=flat-square)](https://ci.appveyor.com/project/nickmccurdy/karma-edge-launcher-ui7ax) [![Dependency Status](https://img.shields.io/david/karma-runner/karma-edge-launcher.svg?style=flat-square)](https://david-dm.org/karma-runner/karma-edge-launcher) [![devDependency Status](https://img.shields.io/david/dev/karma-runner/karma-edge-launcher.svg?style=flat-square)](https://david-dm.org/karma-runner/karma-edge-launcher#info=devDependencies)

> Launcher for Microsoft Edge.

This is a fork of the [launcher for Internet Explorer](https://github.com/karma-runner/karma-ie-launcher). Originally located at [nickmccurdy/karma-edge-launcher](https://github.com/nickmccurdy/karma-edge-launcher).

Based on [edge-launcher](https://github.com/MicrosoftEdge/edge-launcher).

## Status
In development, with pre-1.0 versions now available on the npm registry.

## Installation

The easiest way is to keep `karma-edge-launcher` as a devDependency, by running

```bash
npm install karma-edge-launcher --save-dev
```

## Configuration
```js
// karma.conf.js
module.exports = function(config) {
  config.set({
    browsers: ['Edge']
  });
};
```

You can pass list of browsers as a CLI argument too:
```bash
karma start --browsers Edge
```

----

For more information on Karma see the [homepage].


[homepage]: http://karma-runner.github.com

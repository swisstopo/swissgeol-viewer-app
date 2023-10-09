# glsl-strip-comments
Strip comments from GLSL code.

## Usage

[![NPM](https://nodei.co/npm/glsl-strip-comments.png?mini=true)](https://nodei.co/npm/glsl-strip-comments/)

```js
var glslStripComments = require("glsl-strip-comments");

var output;

// WebGL 1.0
output = glslStripComments(input);

// WebGL 2.0
output = glslStripComments(input, { version: '300 es' });
```

See [glsl-tokenizer](https://github.com/stackgl/) for more information.
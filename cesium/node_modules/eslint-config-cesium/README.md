# eslint-config-cesium

The official [shareable ESLint config](http://eslint.org/docs/developer-guide/shareable-configs) for the [Cesium](https://cesium.com/) ecosystem.

## Usage

---

We export three ESLint configurations.

### eslint-config-cesium

This config contains basic Cesium syntax and style config, from which `browser` and `node` extend. Extends `eslint:recommended` and `prettier` with additional rules.

### eslint-config-cesium/browser

For use in browser environments.

### eslint-config-cesium/node

For use in Node.js environments.

---

To use any of these configs:

1. Install `eslint` and `eslint-config-prettier`. If using the `cesium/node` config, also install `eslint-plugin-node`.

2. Add `"extends": "cesium"/browser` or `"extends": "cesium/node"` to your `.eslintrc.*` files

"use strict";

module.exports = {
  extends: ["./index.js", "plugin:node/recommended"],
  env: {
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2023
  },
  plugins: ["node"],
  rules: {
    "global-require": "error",
    "node/no-new-require": "error",
    "node/no-unsupported-features/node-builtins": "off",
    "no-process-exit": "off",
  },
};

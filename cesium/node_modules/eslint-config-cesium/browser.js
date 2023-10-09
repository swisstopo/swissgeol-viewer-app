"use strict";

module.exports = {
  extends: "./index.js",
  env: {
    browser: true,
  },
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2020
  },
  rules: {
    "no-implicit-globals": "error",
  },
};
